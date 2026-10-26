import os
import json
from flask import Flask, jsonify, request, send_from_directory
from collections import deque

app = Flask(__name__, static_folder='static', static_url_path='')

MAZES_PATH = os.path.join(os.path.dirname(__file__), 'mazes.json')

if os.name == 'nt':
    app_data_dir = os.path.join(os.getenv('APPDATA', os.path.expanduser('~')), 'MazeCrawler')
else:
    app_data_dir = os.path.join(os.path.expanduser('~'), '.mazecrawler')

os.makedirs(app_data_dir, exist_ok=True)
HIGH_SCORES_PATH = os.path.join(app_data_dir, 'high_scores.json')

def load_mazes():
    """Loads maze layouts from the external JSON configuration file."""
    if os.path.exists(MAZES_PATH):
        with open(MAZES_PATH, 'r') as f:
            data = json.load(f)
            return {int(k): v for k, v in data.items()}
    return {1: {"grid": [], "start": [0, 0], "exit": [0, 0]}}

MAZES = load_mazes()

def load_high_scores():
    """Loads high scores from high_scores.json."""
    if os.path.exists(HIGH_SCORES_PATH):
        try:
            with open(HIGH_SCORES_PATH, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_high_scores(scores):
    """Saves high scores to high_scores.json."""
    with open(HIGH_SCORES_PATH, 'w') as f:
        json.dump(scores, f, indent=2)

def find_tile_coords(grid, tile_val):
    """Finds coordinates of a specific tile value in the grid."""
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] == tile_val:
                return [r, c]
    return None

def solve_path_segment(grid, start, end, allowed_vals):
    """Computes shortest path between two points using BFS."""
    if not grid:
        return []
        
    queue = deque([[start]])
    visited = {tuple(start)}
    
    while queue:
        path = queue.popleft()
        r, c = path[-1]
        
        if [r, c] == end:
            return path
            
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < len(grid) and 0 <= nc < len(grid[0]):
                if grid[nr][nc] in allowed_vals and (nr, nc) not in visited:
                    visited.add((nr, nc))
                    queue.append(path + [[nr, nc]])
    return []

def solve_mandatory_maze(grid, start, exit_pos, level = 1):
    """Computes optimal path passing through the center item (4) first."""
    center_pos = find_tile_coords(grid, 4)
    if not center_pos or level > 2:
        return solve_path_segment(grid, start, exit_pos, [0, 2, 3, 4, 6, 7])
    
    leg1 = solve_path_segment(grid, start, center_pos, [0, 3, 4, 6, 7])
    if not leg1:
        return []
        
    leg2 = solve_path_segment(grid, center_pos, exit_pos, [0, 2, 3, 4, 6, 7])
    if not leg2:
        return []
        
    return leg1 + leg2[1:]

def solve_excavation_maze(grid, start, exit_pos):
    """Computes optimal path under the 10-step allowance rule, 
    checkpoint resets on #4, and free re-traversal."""
    
    if not grid:
        return []

    initial_allowance = 10
    start_key = (start[0], start[1])
    
    queue = deque([(start[0], start[1], initial_allowance, {start_key}, [start])])
    
    visited = {}

    while queue:
        r, c, allowance, excavated, path = queue.popleft()

        if [r, c] == exit_pos:
            return path

        state_key = (r, c, allowance)
        if state_key in visited and visited[state_key] <= len(excavated):
            continue
        visited[state_key] = len(excavated)

        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc

            if 0 <= nr < len(grid) and 0 <= nc < len(grid[0]) and grid[nr][nc] not in (-1, 1):
                next_key = (nr, nc)
                is_target_exit = ([nr, nc] == exit_pos)
                is_already_excavated = next_key in excavated

                next_allowance = allowance if (is_target_exit or is_already_excavated) else allowance - 1

                if next_allowance >= 0:
                    if grid[nr][nc] == 4:
                        next_allowance = 10

                    next_excavated = excavated.copy()
                    next_excavated.add(next_key)

                    queue.append((nr, nc, next_allowance, next_excavated, path + [[nr, nc]]))
                      
    return []

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')
    
@app.route('/api/maze', methods=['GET'])
def get_maze():
    level = int(request.args.get('level', 1))
    maze_data = MAZES.get(level, MAZES[1])
    
    if level == 4:
        optimal_path = solve_excavation_maze(maze_data["grid"], maze_data["start"], maze_data["exit"])
    else:
        optimal_path = solve_mandatory_maze(maze_data["grid"], maze_data["start"], maze_data["exit"], level)
    
    return jsonify({
        "level": level,
        "grid": maze_data["grid"],
        "start": maze_data["start"],
        "exit": maze_data["exit"],
        "optimal_path": optimal_path,
        "optimal_distance": len(optimal_path) - 1 if optimal_path else 0
    })

@app.route('/api/scores', methods=['GET'])
def get_all_scores():
    return jsonify(load_high_scores())

@app.route('/api/score', methods=['POST'])
def calculate_score():
    data = request.json or {}
    level = str(data.get('level', 1))
    actual_distance = data.get('actual_distance', 0)
    bonus = int(data.get('bonus', 0))
    elapsed_time = int(data.get('elapsed_time', 0))
    
    maze_data = MAZES.get(int(level), MAZES[1])
    grid = maze_data["grid"]
    optimal_path = solve_mandatory_maze(grid, maze_data["start"], maze_data["exit"], int(level))
    optimal_distance = len(optimal_path) - 1 if optimal_path else 1

    if actual_distance <= 0:
        score = 0
    else:
        ratio = optimal_distance / actual_distance
        score = min(100, max(0, round(ratio * 100)))

    final_score = score + bonus
    
    high_scores = load_high_scores()
    if level not in high_scores:
        high_scores[level] = []

    level_leaderboard = high_scores[level]
    
    new_entry = {
        "score": final_score,
        "elapsed_time": elapsed_time
    }
    
    level_leaderboard.append(new_entry)
    
    level_leaderboard.sort(key=lambda x: (-x["score"], x["elapsed_time"]))
    
    high_scores[level] = level_leaderboard[:10]
    
    is_high_score = len(level_leaderboard) > 0 and level_leaderboard[0]["score"] == final_score and level_leaderboard[0]["elapsed_time"] == elapsed_time

    save_high_scores(high_scores)
        
    return jsonify({
        "base_score": score,
        "score": final_score,
        "is_high_score": is_high_score,
        "optimal_distance": optimal_distance,
        "optimal_path": optimal_path
    })    

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)