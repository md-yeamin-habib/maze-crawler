const canvas = document.getElementById('navCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');

const compassNeedle = document.getElementById('compassNeedle');
const levelSelect = document.getElementById('levelSelect');
const restartBtn = document.getElementById('restartBtn');
const hintBtn = document.getElementById('hintBtn');

const btnUp = document.getElementById('btnUp');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnDown = document.getElementById('btnDown');
const btnCenter = document.getElementById('btnCenter');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    minimapCanvas.width = minimapCanvas.parentElement.clientWidth;
    minimapCanvas.height = minimapCanvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const TILE_SIZE = 60;
const WALL_HEIGHT_UNITS = 3.0;

let currentLevel = 1;
let mazeData = null;
let grid = [];

let level2State = 0;
let leverAngle = Math.PI / 4;
let waterHeight = 3.0;  

let startPos = { r: 15, c: 1 };
let exitPos = { r: 1, c: 15 };
let centerPos = null;
let optimalPath = [];

let player = {
    r: 15,
    c: 1,
    x: 0,
    y: 0,
    angle: Math.PI / 2,
    targetAngle: Math.PI / 2,
    isMoving: false,
    moveProgress: 1.0,
    fromR: 15,
    fromC: 1,
    toR: 15,
    toC: 1,
    hasWizardHat: false, 
    isTransforming: false,
    hasWizardStaff: false,
    hp: 100,
    maxhp: 100,
    mp: 100,
    maxmp: 100,
    isGrabbed: false,
    isPoisoned: false,
    isToxicSwimming: false
};

let activeModal = null;

let camAngle = Math.PI / 2;
let trailPoints = [];
let visitedCells = new Set();
let isGameFinished = false;
let startTime = null;
let elapsedTimeSec = 0;
let totalDistanceCovered = 0;
let killCount = 0;
let damageTaken = 0;
let hintsUsed = 0;
let finalScore = 0;
let frameCount = 0;

let hintActive = false;
let hintTimer = null;
let hintPos = null;

// --- State Variables for Damage, Death Animation & Game Timer ---
let lastDrainSec = -1; 
let hurtPhase = 0; // 0: none, 1: red frame, 2: regular frame
let hurtTimer = null;

let isDying = false;
let deathStage = 0;
let deathTimer = null;
let currentDeathImg = null;

let activeFireball = null;
let castingAnimTimer = null;

let killedMobCells = [];
let hintMobPositions = [];

let activeGrabCrab = null;
let grabPressCount = 0;
const REQUIRED_GRAG_PRESSES = 12;

const zoomLevels = [100, 125, 150, 200, 300, 400, 500];
let zoomIdx = 0;          // Index in zoomLevels (0 = 100%)
let minimapPanX = 0;      // Pan offset X
let minimapPanY = 0;      // Pan offset Y
let minimapTool = 'none'; // 'none', 'zoomIn', 'zoomOut'

let isDragging = false;
let startX = 0, startY = 0;
let toastTimer = null;

let escapeSuccessfulTriggered = false;

// --- CHEAT CONSOLE STATE ---
let cheats = {
    disableMobs: false,
    infiniteHp: false,
    infiniteMp: false,
    oneHitKill: false,
    noWater: false,
    noWalls: false,
    invisibility: false
};

function openCheatConsole() {
    // Initialize persistent tracker state on first open if not already set
    if (typeof window._lastCheatState === 'undefined') {
        window._lastCheatState = {
            disableMobs: cheats.disableMobs || false,
            noWater: cheats.noWater || false,
            noWalls: cheats.noWalls || false
        };
    }

    let contentHtml = `
        <div style="text-align: left; display: flex; flex-direction: column; gap: 12px; padding: 4px 0; max-height: 350px; overflow-y: auto;">
            <div class="cheat-option-row">
                <span>Disable Mob Spawning</span>
                <label class="switch"><input type="checkbox" id="cheatMobToggle" ${cheats.disableMobs ? 'checked' : ''}><span class="slider-toggle"></span></label>
            </div>
            <div class="cheat-option-row">
                <span>Infinite Health (HP)</span>
                <label class="switch"><input type="checkbox" id="cheatHpToggle" ${cheats.infiniteHp ? 'checked' : ''}><span class="slider-toggle"></span></label>
            </div>
            <div class="cheat-option-row">
                <span>Infinite Magic (MP)</span>
                <label class="switch"><input type="checkbox" id="cheatMpToggle" ${cheats.infiniteMp ? 'checked' : ''}><span class="slider-toggle"></span></label>
            </div>
            <div class="cheat-option-row">
                <span>One-Hit Kills</span>
                <label class="switch"><input type="checkbox" id="cheatKillToggle" ${cheats.oneHitKill ? 'checked' : ''}><span class="slider-toggle"></span></label>
            </div>
            <div class="cheat-option-row">
                <span>No Water</span>
                <label class="switch"><input type="checkbox" id="cheatWaterToggle" ${cheats.noWater ? 'checked' : ''}><span class="slider-toggle"></span></label>
            </div>
            <div class="cheat-option-row">
                <span>No Walls</span>
                <label class="switch"><input type="checkbox" id="cheatWallsToggle" ${cheats.noWalls ? 'checked' : ''}><span class="slider-toggle"></span></label>
            </div>
            <div class="cheat-option-row">
                <span>Invisibility</span>
                <label class="switch"><input type="checkbox" id="cheatInvisibilityToggle" ${cheats.invisibility ? 'checked' : ''}><span class="slider-toggle"></span></label>
            </div>
        </div>
    `;

    showCustomModal({
        title: "Cheat Console",
        message: contentHtml,  
        buttons: [
            {
                text: "Apply",
                bg: "linear-gradient(135deg, #22c55e, #16a34a)",
                callback: () => {
                    const newDisableMobs = document.getElementById('cheatMobToggle').checked;
                    const newNoWater = document.getElementById('cheatWaterToggle').checked;
                    const newNoWalls = document.getElementById('cheatWallsToggle').checked;

                    // Check what actually changed compared to the last applied state
                    let mobsChanged = newDisableMobs !== window._lastCheatState.disableMobs;
                    let waterChanged = newNoWater !== window._lastCheatState.noWater;
                    let wallsChanged = newNoWalls !== window._lastCheatState.noWalls;

                    let shouldReload = waterChanged || wallsChanged;

                    // Update active cheat states
                    cheats.disableMobs = newDisableMobs;
                    cheats.infiniteHp = document.getElementById('cheatHpToggle').checked;
                    cheats.infiniteMp = document.getElementById('cheatMpToggle').checked;
                    cheats.oneHitKill = document.getElementById('cheatKillToggle').checked;
                    cheats.noWater = newNoWater;
                    cheats.noWalls = newNoWalls;
                    cheats.invisibility = document.getElementById('cheatInvisibilityToggle').checked; 

                    // Update stored baseline for future comparisons
                    window._lastCheatState.disableMobs = newDisableMobs;
                    window._lastCheatState.noWater = newNoWater;
                    window._lastCheatState.noWalls = newNoWalls;

                    // If water or wall state changed, reload the level
                    if (shouldReload) {
                        loadLevel(currentLevel);
                    } else if (mobsChanged) {
                        // Only re-initialize mobs if the mob toggle itself was intentionally changed
                        if (currentLevel === 2) initCrabs();
                        if (currentLevel === 3) initSnakes();
                        if (currentLevel === 4) initBats();
                        if (currentLevel === 5) {
                            initPlants();
                            initMinotaurs();
                        }
                    }
                }
            },
            {
                text: "Cancel",
                bg: "linear-gradient(135deg, #334155, #475569)",
                callback: () => {}
            }
        ],
        modalClass: "medium-modal"
    });
}

document.getElementById('cheatConsoleBtn').addEventListener('click', openCheatConsole);

// --- HIGH SCORES TABBED MODAL ---
async function openHighScoresModal() {
    let scoresData = {};
    try {
        const response = await fetch('/api/scores');
        scoresData = await response.json();
    } catch (err) {
        scoresData = {};
    }

    let activeTabLevel = currentLevel;

    function renderModalContent(selectedLevel) {
        activeTabLevel = selectedLevel;

        let tabsHtml = `<div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 14px; flex-wrap: wrap;">`;
        for (let lvl = 1; lvl <= 5; lvl++) {
            let isActive = lvl === selectedLevel ? 'active' : '';
            tabsHtml += `<button class="hs-tab-btn ${isActive}" onclick="switchHighScoreTab(${lvl})">Level ${lvl}</button>`;
        }
        tabsHtml += `</div>`;

        let rawList = scoresData[selectedLevel] || scoresData[selectedLevel.toString()] || [];
        
        let tableContainerHtml = `<div id="hsTableContainer">`;
        if (rawList.length === 0) {
            tableContainerHtml += `
                <div style="font-size: 15px; color: #64748b; font-style: italic; padding: 20px 0; text-align: center;">
                    No recorded runs for Level ${selectedLevel} yet.
                </div>
            `;
        } else {
            tableContainerHtml += `
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: center;">
                    <thead>
                        <tr style="color: #94a3b8; border-bottom: 1px solid #334155; font-size: 12px;">
                            <th style="padding: 6px; width: 25%;">Rank</th>
                            <th style="padding: 6px; width: 40%;">Score</th>
                            <th style="padding: 6px; width: 35%;">Time</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            rawList.slice(0, 10).forEach((entry, idx) => {
                let mins = Math.floor(entry.elapsed_time / 60).toString().padStart(2, '0');
                let secs = (entry.elapsed_time % 60).toString().padStart(2, '0');
                
                // Rank color rules (#1 Gold, #2 Silver, #3 Bronze, others Default White)
                let rankColor = '#fef3c7';
                if (idx === 0) rankColor = '#fbbf24';
                else if (idx === 1) rankColor = '#cbd5e1';
                else if (idx === 2) rankColor = '#d97706';

                // Score color rules (Score > 90 Green, Score < 30 Red, others Default White)
                let scoreColor = '#fef3c7';
                if (entry.score >= 90) scoreColor = '#22c55e';
                else if (entry.score < 30) scoreColor = '#ef4444';

                tableContainerHtml += `
                    <tr style="border-bottom: 1px solid #1e293b;">
                        <td style="padding: 6px; color: ${rankColor};">#${idx + 1}</td>
                        <td style="padding: 6px; color: ${scoreColor};">${entry.score}</td>
                        <td style="padding: 6px; color: #f8fafc;">${mins}:${secs}</td>
                    </tr>
                `;
            });

            tableContainerHtml += `</tbody></table>`;
        }
        tableContainerHtml += `</div>`;

        return tabsHtml + tableContainerHtml;
    }

    // Dynamic global tab-switch function attached to window
    window.switchHighScoreTab = function(lvl) {
        const bodyEl = document.getElementById('hsModalBody');
        if (bodyEl) {
            bodyEl.innerHTML = renderModalContent(lvl);
        }
    };

    let initialBodyHtml = `<div id="hsModalBody">${renderModalContent(activeTabLevel)}</div>`;

    showCustomModal({
        title: "Highest Scores",
        message: initialBodyHtml,
        buttons: [
            {
                text: "Close",
                bg: "linear-gradient(135deg, #334155, #475569)",
                callback: () => {}
            }
        ],
        modalClass: "wide-modal"
    });
}

document.getElementById('highScoresBtn').addEventListener('click', openHighScoresModal);

// ==========================================
// --- HELPER UTILITIES ---
// ==========================================

function loadAsset(path) {
    const img = new Image();
    img.src = path;
    return img;
}

function loadFrameArray(basePath, count, extension = 'png') {
    return Array.from({ length: count }, (_, i) => loadAsset(`${basePath}${i + 1}.${extension}`));
}

function flashBar(barElementId, className = 'flash-red', duration = 350) {
    const barEl = document.getElementById(barElementId);
    if (barEl) {
        barEl.classList.add(className);
        setTimeout(() => {
            barEl.classList.remove(className);
        }, duration);
    }
}

function checkGridBounds(r, c, targetGrid = grid) {
    if (!targetGrid || targetGrid.length === 0) return false;
    return r >= 0 && r < targetGrid.length && c >= 0 && c < targetGrid[0].length;
}

function getRelativeFacing(movementAngle, playerAngle) {
    let relAngle = movementAngle - playerAngle;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    let absAngle = Math.abs(relAngle);
    if (absAngle < Math.PI * 0.25) return 'front';
    if (absAngle > Math.PI * 0.75) return 'back';
    if (relAngle > 0) return 'left';
    return 'right';
}

function getModalIconSvg(title) {
    if (title.includes("Score")) {
        // Trophy Icon
        return `<svg style="vertical-align: middle; margin-right: 6px; fill: #fbbf24;" width="22" height="22" viewBox="0 0 24 24">
            <path d="M18 2H6v2H2v4c0 2.21 1.79 4 4 4h1c.75 1.43 2.11 2.58 3.79 2.94C10.35 15.48 10 16.69 10 18v2H7v2h10v-2h-3v-2c0-1.31-.35-2.52-.79-3.06 1.68-.36 3.04-1.51 3.79-2.94h1c2.21 0 4-1.79 4-4V4h-4V2zm-14 6V6h2v3.52C5.35 9.28 4.66 8.68 4 8zm16 0c-.66.68-1.35 1.28-2 1.52V6h2v2z"/>
        </svg>`;
    }
    if (title.includes("Cheat")) {
        // Bug Icon
        return `<svg style="vertical-align: middle; margin-right: 6px; fill: #fbbf24;" width="22" height="22" viewBox="0 0 24 24">
            <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.56 5.06 12.3 5 12 5s-.56.06-.82.17L9 3 7.59 4.41l1.63 1.63c-.75.51-1.37 1.18-1.82 1.96H4v2h2.08C6.03 10.33 6 10.66 6 11v1H4v2h2v1c0 .34.03.67.08 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.08c.05-.33.08-.66.08-1v-1h2v-2h-2v-1c0-.34-.03-.67-.08-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/>
        </svg>`;
    }
    if (title.includes("Died")) {
        // Skull Icon
        return `<svg style="vertical-align: middle; margin-right: 6px; fill: #0f172a; stroke: #fbbf24; stroke-width: 1.5; stroke-linejoin: round;" width="22" height="22" viewBox="0 0 24 24">
            <path d="M12 2C7 2 4 5 4 9.5C4 12.5 5.5 14.8 7 16.2V19C7 19.5 7.5 20 8 20H9.5C10 20 10.5 19.5 10.5 19V17.5H13.5V19C13.5 19.5 14 20 14.5 20H16C16.5 20 17 19.5 17 19V16.2C18.5 14.8 20 12.5 20 9.5C20 5 17 2 12 2Z"/>
            <ellipse cx="8.5" cy="10" rx="2" ry="2.2" fill="#fbbf24" stroke="none"/>
            <ellipse cx="15.5" cy="10" rx="2" ry="2.2" fill="#fbbf24" stroke="none"/>
            <path d="M12 12.5L10.8 14.8C10.6 15.2 10.9 15.6 11.3 15.6H12.7C13.1 15.6 13.4 15.2 13.2 14.8L12 12.5Z" fill="#fbbf24" stroke="none"/>
        </svg>`;
    } 
    if (title.includes("Crab Grip!") || title.includes("Swallowed!")) {
        // Classic Yellow/Black Warning Sign Icon
        return `<svg style="vertical-align: middle; margin-right: 6px;" width="22" height="22" viewBox="0 0 24 24">
            <path d="M12,2 L2,20 C1.5,21 2.2,22 3.3,22 L20.7,22 C21.8,22 22.5,21 22,20 L12,2 Z" fill="#fbbf24" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
            <path d="M11,9 C11,8.4 11.5,8 12,8 C12.5,8 13,8.4 13,9 L12.5,15 C12.5,15.3 12.3,15.5 12,15.5 C11.7,15.5 11.5,15.3 11.5,15 L11,9 Z" fill="#111827"/>
            <circle cx="12" cy="18" r="1.2" fill="#111827"/>
        </svg>`;
    }
    if (title.includes("Wooden Chest") || title.includes("Chest")) {
        // Closed Gold/Dark Chest SVG
        return `<svg style="vertical-align: middle; margin-right: 6px;" width="22" height="22" viewBox="0 0 24 24">
            <rect x="2" y="5" width="20" height="15" rx="3.5" ry="3.5" fill="#0f172a" stroke="#fbbf24" stroke-width="1.8" />
            <line x1="2" y1="11" x2="22" y2="11" stroke="#fbbf24" stroke-width="1.8" />
            <path d="M 6.5,5 L 6.5,20" stroke="#fbbf24" stroke-width="1.8" fill="none" />
            <path d="M 17.5,5 L 17.5,20" stroke="#fbbf24" stroke-width="1.8" fill="none" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="#0f172a" stroke="#fbbf24" stroke-width="1.5" />
            <circle cx="12" cy="11.2" r="0.8" fill="#fbbf24" />
            <polygon points="11.4,11.2 12.6,11.2 12.3,13.2 11.7,13.2" fill="#fbbf24" />
        </svg>`;
    }
    
    // Default: Golden Sparkle / Auto Awesome Icon
    return `<svg style="vertical-align: middle; margin-right: 6px; fill: #fbbf24;" width="22" height="22" viewBox="0 0 24 24">
        <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 3 6.5 9.5 0 12l6.5 2.5L9 21l2.5-6.5L18 12l-6.5-2.5zm7 6.5l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 16z"/>
    </svg>`;
}

function showCustomModal({ title, message, buttons = [], 
    badgeHtml = '', isProximity = false, onClose = null, 
    modalClass = '' }) {
    if (activeModal) activeModal.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'customModalOverlay';
    if (isProximity) overlay.dataset.isProximityModal = "true";
    
    const box = document.createElement('div');
    box.id = 'customModalBox';
    if (modalClass) box.classList.add(modalClass);
    
    let finalButtons = buttons;
    if (!finalButtons || finalButtons.length === 0) {
        finalButtons = [{
            text: "Continue",
            bg: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            callback: null
        }];
    }
    
    let buttonsHtml = '';
    finalButtons.forEach((btn, index) => {
        buttonsHtml += `<button id="modalBtn_${index}" class="customModalActionBtn" style="background: ${btn.bg || 
            'linear-gradient(135deg, #4f46e5, #7c3aed)'}; 
            color: #fef3c7; border: 1px solid #fbbf24; 
            padding: 8px 16px; font-weight: bold; border-radius: 4px; 
            cursor: pointer; font-family: 'Georgia', serif; 
            transition: all 0.2s; margin: 0 5px;">${btn.text}</button>`;
    });

    let iconSvg = getModalIconSvg(title);

    box.innerHTML = `
        ${badgeHtml}
        <button id="customModalCloseBtn">✕</button>
        <h3 style="display: flex; align-items: center; justify-content: center;">${iconSvg} <span>${title}</span></h3>
        <div style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #e2e8f0; text-align: center;">${message}</div>
        <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
            ${buttonsHtml}
        </div>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    activeModal = overlay;
    
    const dismissModal = (callback) => {
        if (callback) callback();
        overlay.remove();
        activeModal = null;
        if (onClose) onClose();
        window.removeEventListener('keydown', keyHandler);
    };

    document.getElementById('customModalCloseBtn').addEventListener('click', () => dismissModal(null));

    finalButtons.forEach((btn, index) => {
        const el = document.getElementById(`modalBtn_${index}`);
        if (el) {
            el.addEventListener('click', () => dismissModal(btn.callback));
        }
    });

    const keyHandler = (e) => {
        if (player.isGrabbed) return;
        
        // Escape always safely closes/cancels instead of triggering Take All
        if (e.key === 'Escape') {
            e.preventDefault();
            let closeBtn = finalButtons.find(b => b.text.toLowerCase().includes('close') || b.text.toLowerCase().includes('cancel'));
            dismissModal(closeBtn ? closeBtn.callback : null);
        } 
        // Enter / Space handling
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (title.includes("Chest")) {
                // For chests, Enter/Space defaults to safe Close rather than Take All
                let closeBtn = finalButtons.find(b => b.text.toLowerCase().includes('close'));
                dismissModal(closeBtn ? closeBtn.callback : null);
            } else {
                dismissModal(finalButtons.length > 0 ? finalButtons[0].callback : null);
            }
        }
    };
    window.addEventListener('keydown', keyHandler);
}

// ==========================================
// --- GAMEPLAY MECHANICS & EVENT HANDLERS ---
// ==========================================

function triggerCrabGrab(crab) {
    if (player.isGrabbed || isDying || isGameFinished) return;
    player.isGrabbed = true;
    activeGrabCrab = crab;
    grabPressCount = 0;
    escapeSuccessfulTriggered = false;

    let modalHtml = `
        <p>A giant cavern crab has clamped its claw onto your left leg!<br><br>
        <b>You are trapped and cannot move forward.</b><br>
        Repeatedly press <b>S</b> or <b>Down Arrow</b> to spin around and break free!<br><br>
        Spins: <span id="grabPressCountText" style="color: #fbbf24; font-size: 18px; font-weight: bold;">0 / ${REQUIRED_GRAG_PRESSES}</span></p>
    `;

    showCustomModal({ title: "Crab Grip!", message: modalHtml, buttons: [] });
}

function handleGrabEscapePress() {
    if (!player.isGrabbed || escapeSuccessfulTriggered) return;
    grabPressCount++;
    handleTurn('AROUND');

    let countEl = document.getElementById('grabPressCountText');
    if (countEl) {
        countEl.innerText = `${grabPressCount} / ${REQUIRED_GRAG_PRESSES}`;
    }

    if (grabPressCount >= REQUIRED_GRAG_PRESSES) {
        escapeSuccessfulTriggered = true;
        player.isGrabbed = false;
        
        player.isMoving = false;
        player.moveProgress = 1.0;
        player.angle = player.targetAngle;
        player.fromR = player.r;
        player.fromC = player.c;
        player.toR = player.r;
        player.toC = player.c;

        if (activeEatenPlant) {
            activeEatenPlant.state = 'IDLE';
            activeEatenPlant.calmTimer = 300; // Keep plant calm for 5 seconds post-escape
            activeEatenPlant = null; // Clears eaten state immediately
        }

        const modalBox = document.getElementById('customModalBox');
        if (modalBox) {
            const pEl = modalBox.querySelector('p');
            if (pEl) {
                pEl.innerHTML = `<b style="color: #22c55e; font-size: 18px;">Escape Successful!</b><br><br>You broke free and dashed away!`;
            }
        }

        setTimeout(() => {
            if (activeModal) {
                activeModal.remove();
                activeModal = null;
            }
            player.isGrabbed = false;
            player.isMoving = false;
        }, 800);
    }
}

function triggerHurtAnimation() {
    flashBar('healthFill', 'flash-red', 350);
    hurtPhase = 1;
    
    if (hurtTimer) clearTimeout(hurtTimer);
    hurtTimer = setTimeout(() => {
        hurtPhase = 2;
        hurtTimer = setTimeout(() => {
            hurtPhase = 0;
        }, 200);
    }, 200);
}

function triggerDeathSequence() {
    if (isDying) return;
    isDying = true;
    isGameFinished = true;

    player.isGrabbed = false;
    activeGrabCrab = null;
    activeEatenPlant = null;
    if (activeModal) {
        activeModal.remove();
        activeModal = null;
    }

    deathStage = 0;

    const steps = [
        { img: player.hasWizardStaff ? hurtSceneAssets.blueStaffReg.tilt : hurtSceneAssets.blueReg.tilt, delay: 180 },
        { img: player.hasWizardStaff ? hurtSceneAssets.blueStaffRed.tilt : hurtSceneAssets.blueRed.tilt, delay: 180 },
        { img: player.hasWizardStaff ? hurtSceneAssets.blueStaffReg.tilt : hurtSceneAssets.blueReg.tilt, delay: 180 },
        { img: player.hasWizardStaff ? hurtSceneAssets.blueStaffRed.tilt : hurtSceneAssets.blueRed.tilt, delay: 180 },
        { img: player.hasWizardStaff ? hurtSceneAssets.blueStaffRed.ash1 : hurtSceneAssets.blueRed.ash1, delay: 200 },
        { img: player.hasWizardStaff ? hurtSceneAssets.blueStaffReg.ash1 : hurtSceneAssets.blueReg.ash1, delay: 200 },
        { img: player.hasWizardStaff ? hurtSceneAssets.blueStaffRed.ash1 : hurtSceneAssets.blueRed.ash1, delay: 200 },
        { img: player.hasWizardStaff ? hurtSceneAssets.blueStaffReg.ash1 : hurtSceneAssets.blueReg.ash1, delay: 200 },
        { img: hurtSceneAssets.ashHeavy, delay: 250 },
        { img: hurtSceneAssets.ashHalf, delay: 250 },
        { img: hurtSceneAssets.ashSlight, delay: 250 },
        { img: null, delay: 100 }
    ];

    function runDeathStep(index) {
        if (index < steps.length) {
            currentDeathImg = steps[index].img;
            deathTimer = setTimeout(() => {
                runDeathStep(index + 1);
            }, steps[index].delay);
        } else {
            isDying = false;
            showScorecardModal(true);
        }
    }

    runDeathStep(0);
}

async function showScorecardModal(isDeath = false) {
    let baseScore = 0;
    let isHighScore = false;
    
    let bonus = 0;
    let killBonus = (currentLevel >= 2) ? killCount * 10 : 0;
    bonus += killBonus;

    let hatPenalty = (!player.hasWizardHat) ? -50 : 0;
    bonus += hatPenalty;

    let flawlessBonus = (currentLevel > 1 && damageTaken === 0) ? 20 : 0;
    bonus += flawlessBonus;

    let holdYourBreathBonus = (!isDeath && currentLevel === 2 && waterHeight === 3.0) ? 20 : 0;
    bonus += holdYourBreathBonus;

    let hintPenalty = hintsUsed * -5;
    bonus += hintPenalty;

    if (!isDeath) {
        try {
            const response = await fetch('/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    level: currentLevel, 
                    actual_distance: totalDistanceCovered,
                    bonus: bonus,
                    elapsed_time: elapsedTimeSec
                })
            });
            const data = await response.json();
            baseScore = data.base_score;
            finalScore = data.score;
            isHighScore = data.is_high_score;
        } catch (err) {
            console.error("Score submission error:", err);
            finalScore = Math.max(0, 50 + bonus);
        }
    } else {
        baseScore = 0;
        finalScore = bonus;
    }

    updateUI();

    let formattedDist = totalDistanceCovered >= 1000 
        ? `${(totalDistanceCovered / 1000).toFixed(1)} km` 
        : `${totalDistanceCovered} m`;

    let mins = Math.floor(elapsedTimeSec / 60).toString().padStart(2, '0');
    let secs = (elapsedTimeSec % 60).toString().padStart(2, '0');
    let formattedTime = `${mins}:${secs}`;

    let scoreColor = "#fef3c7";
    if (finalScore >= 90) {
        scoreColor = "#22c55e";
    } else if (finalScore < 30) {
        scoreColor = "#ef4444";
    }

    let rowStyle = "display: flex; justify-content: space-between; margin-bottom: 6px;";

    let scorecardHtml = `
        <div style="text-align: left; font-size: 14px; line-height: 1.5;">
            <div style="${rowStyle}"><span>Distance Covered:</span> <b>${formattedDist}</b></div>
            <div style="${rowStyle}"><span>Time Elapsed:</span> <b>${formattedTime}</b></div>
            ${!isDeath ? `<div style="${rowStyle}"><span>Base Score:</span> <b>${baseScore}</b></div>` : ''}
    `;

    if (currentLevel >= 2) {
        scorecardHtml += `<div style="${rowStyle}"><span>Total Kills (${killCount}):</span> <span style="color: #22c55e; font-weight: bold;">+${killBonus}</span></div>`;
    }

    if (currentLevel === 2 && holdYourBreathBonus > 0) {
        scorecardHtml += `<div style="${rowStyle}"><span>Hold Your Breath:</span> <span style="color: #22c55e; font-weight: bold;">+${holdYourBreathBonus}</span></div>`;
    }

    if (!player.hasWizardHat) {
        scorecardHtml += `<div style="${rowStyle}"><span>You're Not A Wizard:</span> <span style="color: #ef4444; font-weight: bold;">${hatPenalty}</span></div>`;
    }

    if (currentLevel > 1 && damageTaken === 0) {
        scorecardHtml += `<div style="${rowStyle}"><span>Flawless Victory:</span> <span style="color: #22c55e; font-weight: bold;">+${flawlessBonus}</span></div>`;
    }

    if (hintsUsed > 0) {
        scorecardHtml += `<div style="${rowStyle}"><span>Hints Used (${hintsUsed}):</span> <span style="color: #ef4444; font-weight: bold;">${hintPenalty}</span></div>`;
    }

    scorecardHtml += `
            <hr style="border: 0; border-top: 1px solid #334155; margin: 12px 0;">
            <div style="${rowStyle} font-size: 16px; align-items: center;"><span>Final Score:</span> <span style="color: ${scoreColor}; font-weight: bold; font-size: 18px;">${finalScore}</span></div>
        </div>
    `;

    let modalButtons = [
        {
            text: `Retry <span class="material-icons" style="vertical-align: middle; font-size: 16px; margin-left: 2px;">refresh</span>`,
            bg: "linear-gradient(135deg, #334155, #475569)",
            callback: () => resetGame()
        }
    ];

    if (!isDeath) {
        modalButtons.push({
            text: "Next ▶",
            bg: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            callback: () => {
                let nextLvl = currentLevel + 1;
                if (nextLvl <= 5) {
                    levelSelect.value = nextLvl.toString();
                    loadLevel(nextLvl);
                } else {
                    loadLevel(5);
                }
            }
        });
    }

    let badgeHtml = (!isDeath && isHighScore) ? `
        <div style="position: absolute; top: -36px; left: -36px; width: 170px; height: 170px; z-index: 25; pointer-events: none; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));">
            <img src="assets/ribbon/high_score_ribbon.png" style="width: 100%; height: 100%; display: block;" alt="New High Score">
        </div>
    ` : '';
    
    showCustomModal({
        title: isDeath ? "You Died" : "Level Completed!",
        message: scorecardHtml,
        buttons: modalButtons,
        badgeHtml: badgeHtml
    });
}

async function fetchScore() {
    await showScorecardModal(false);
}

// ==========================================
// --- ASSET DEFINITIONS & LOADERS ---
// ==========================================

let wizardHatImages = {
    front: loadAsset('assets/wizard_hat/wizard_hat_front.png'),
    back: loadAsset('assets/wizard_hat/wizard_hat_back.png'),
    left: loadAsset('assets/wizard_hat/wizard_hat_left.png'),
    right: loadAsset('assets/wizard_hat/wizard_hat_right.png')
};

let bookshelfImages = {
    side: loadAsset('assets/bookshelf/wooden_bookshelf_side.png'),
    faces: loadFrameArray('assets/bookshelf/wooden_bookshelf_face_', 15)
};

let bookshelfVariantCache = {};

let libraryEnvImages = {
    outerWall: loadAsset('assets/library/library_outer_wall.png'),
    outerWallCorner: loadAsset('assets/library/library_outer_wall_corner.png')
};

let wizardStaffAssets = {
    staff: loadAsset('assets/wizard_staff/magic_staff.png'),
    levers: {
        front: loadAsset('assets/wizard_staff/lever_front.png'),
        back: loadAsset('assets/wizard_staff/lever_back.png'),
        left: loadAsset('assets/wizard_staff/lever_left.png'),
        right: loadAsset('assets/wizard_staff/lever_right.png')
    }
};

let underwaterWallAssets = {
    outerWall: loadAsset('assets/underwater/stone_outer_wall.png'),
    innerWalls: loadFrameArray('assets/underwater/stone_wall_v', 4)
};

let stoneWallTemplates = underwaterWallAssets.innerWalls;
let underwaterWallVariantCache = {};

let coral_green_v1 = loadAsset('assets/corals/coral_green_v1.png');
let coral_green_v2 = loadAsset('assets/corals/coral_green_v2.png');
let coral_green_v3 = loadAsset('assets/corals/coral_green_v3.png');
let coral_green_v4 = loadAsset('assets/corals/coral_green_v4.png');

let coral_orange_v1 = loadAsset('assets/corals/coral_orange_v1.png');
let coral_orange_v2 = loadAsset('assets/corals/coral_orange_v2.png');
let coral_orange_v3 = loadAsset('assets/corals/coral_orange_v3.png');
let coral_orange_v4 = loadAsset('assets/corals/coral_orange_v4.png');

let coral_pink_v1 = loadAsset('assets/corals/coral_pink_v1.png');
let coral_pink_v2 = loadAsset('assets/corals/coral_pink_v2.png');
let coral_pink_v3 = loadAsset('assets/corals/coral_pink_v3.png');
let coral_pink_v4 = loadAsset('assets/corals/coral_pink_v4.png');

function getCoralImage(family, version) {
    if (family === 'green') {
        if (version === 1) return coral_green_v1;
        if (version === 2) return coral_green_v2;
        if (version === 3) return coral_green_v3;
        return coral_green_v4;
    } else if (family === 'orange') {
        if (version === 1) return coral_orange_v1;
        if (version === 2) return coral_orange_v2;
        if (version === 3) return coral_orange_v3;
        return coral_orange_v4;
    } else {
        if (version === 1) return coral_pink_v1;
        if (version === 2) return coral_pink_v2;
        if (version === 3) return coral_pink_v3;
        return coral_pink_v4;
    }
}

let coralVariantCache = {};

let crabAssets = {
    idle: {
        front: loadFrameArray('assets/crab/idle/crab_idle_front', 3),
        back: loadFrameArray('assets/crab/idle/crab_idle_back', 3),
        left: loadFrameArray('assets/crab/idle/crab_idle_left', 3),
        right: loadFrameArray('assets/crab/idle/crab_idle_right', 3)
    },
    move: {
        front: loadFrameArray('assets/crab/move/crab_walk_front', 6),
        back: loadFrameArray('assets/crab/move/crab_walk_back', 6),
        left: loadFrameArray('assets/crab/move/crab_walk_left', 6),
        right: loadFrameArray('assets/crab/move/crab_walk_right', 6)
    },
    attack: loadFrameArray('assets/crab/attack/crab_attack', 2),
    grab: [
        loadAsset('assets/crab/attack/crab_grab_player_reg.png'),
        loadAsset('assets/crab/attack/crab_grab_player_red.png')
    ],
    hurt: {
        reg: loadAsset('assets/crab/hurt/crab_reg.png'),
        red: loadAsset('assets/crab/hurt/crab_red.png'),
        regAsh: loadAsset('assets/crab/hurt/crab_reg_ash.png'),
        redAsh: loadAsset('assets/crab/hurt/crab_red_ash.png')
    },
    death: {
        ashMed: loadAsset('assets/crab/hurt/ash_med.png'),
        ashLight: loadAsset('assets/crab/hurt/ash_light.png')
    }
};

let crabs = [];
let initialCrabSpawns = [];

let snakeAssets = {
    movement: {
        front: loadFrameArray('assets/snake/movement/front/snake_move_front', 10),
        back: loadFrameArray('assets/snake/movement/back/snake_move_back', 10),
        left: loadFrameArray('assets/snake/movement/left/snake_move_left', 10),
        right: loadFrameArray('assets/snake/movement/right/snake_move_right', 10)
    },
    bite: loadFrameArray('assets/snake/bite/snake_bite', 2),
    hurt: {
        reg: loadAsset('assets/snake/hurt/snake_reg.png'),
        red: loadAsset('assets/snake/hurt/snake_red.png'),
        regAsh: loadAsset('assets/snake/hurt/snake_reg_ash.png'),
        redAsh: loadAsset('assets/snake/hurt/snake_red_ash.png')
    },
    death: {
        ashMed: loadAsset('assets/snake/hurt/ash_med.png'),
        ashLight: loadAsset('assets/snake/hurt/ash_light.png')
    }
};

let snakes = [];
let initialSnakeSpawns = [];

function initSnakes() {
    snakes = [];
    if (currentLevel !== 3 || cheats.disableMobs) return;
    
    if (initialSnakeSpawns.length === 0) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                let val = grid[r][c];
                if (val === 6) {
                    initialSnakeSpawns.push({ r, c, val });
                    grid[r][c] = 0; 
                }
            }
        }
    }

    for (let spawn of initialSnakeSpawns) {
        let dr = -1;
        let dc = 0;
        snakes.push({
            r: spawn.r,
            c: spawn.c,
            fromR: spawn.r,
            fromC: spawn.c,
            toR: spawn.r + dr,
            toC: spawn.c + dc,
            x: spawn.c * TILE_SIZE + TILE_SIZE / 2,
            y: spawn.r * TILE_SIZE + TILE_SIZE / 2,
            dr: dr,
            dc: dc,
            distanceTraveled: 0,
            maxDistance: 5,
            speed: 0.02,
            state: 'MOVING', 
            turnFrameIndex: 6, 
            turnTimer: 0,
            hp: 15,
            maxhp: 15,
            hurtPhase: 0,
            hurtTimer: null,
            isDying: false,
            deathStage: 0,
            deathTimer: null,
            currentDeathImg: null
        });
    }
}

function getMobFacing(mob) {
    // Normalize dr/dc to clean discrete orthogonal directions (-1, 0, or 1)
    let dr = Math.abs(mob.dr) > 0.5 ? Math.sign(mob.dr) : 0;
    let dc = Math.abs(mob.dc) > 0.5 ? Math.sign(mob.dc) : 0;

    let movementAngle = Math.atan2(dr, dc);
    return getRelativeFacing(movementAngle, camAngle);
}

function getMinotaurFacing(mob) {
    let dr = mob.dr !== undefined ? mob.dr : (mob.lastDr !== undefined ? mob.lastDr : 0);
    let dc = mob.dc !== undefined ? mob.dc : (mob.lastDc !== undefined ? mob.lastDc : 0);

    if (dr === 0 && dc === 0) {
        return 'front';
    }

    let movementAngle = Math.atan2(-dr, dc);
    let facing = getRelativeFacing(movementAngle, camAngle);

    if (facing === 'front') return 'back';
    if (facing === 'right') return 'left';
    if (facing === 'left') return 'right';
    return 'front';
}

function triggerMobHurt(mob, damage, assets, collectionArray) {
    if (mob.isDying) return;
    mob.hp -= cheats.oneHitKill ? mob.maxhp : damage;
    
    if (mob.hp <= 0) {
        triggerMobDeath(mob, assets, collectionArray);
        return;
    }

    mob.hurtPhase = 1;
    if (mob.hurtTimer) clearTimeout(mob.hurtTimer);
    mob.hurtTimer = setTimeout(() => {
        mob.hurtPhase = 2;
        mob.hurtTimer = setTimeout(() => {
            mob.hurtPhase = 0;
        }, 150);
    }, 150);
}

function triggerMobDeath(mob, assets, collectionArray) {
    if (mob.isDying) return;
    mob.isDying = true;
    killCount++;
    killedMobCells.push({ r: mob.r, c: mob.c });

    const deathSteps = [
        { img: assets.hurt.reg, delay: 150 },
        { img: assets.hurt.red, delay: 150 },
        { img: assets.hurt.reg, delay: 150 },
        { img: assets.hurt.red, delay: 150 },
        { img: assets.hurt.regAsh, delay: 200 },
        { img: assets.hurt.redAsh, delay: 200 },
        { img: assets.hurt.ashMed, delay: 250 },
        { img: assets.hurt.ashLight, delay: 250 },
        { img: null, delay: 100 }
    ];

    function runDeathStep(index) {
        if (index < deathSteps.length) {
            mob.currentDeathImg = deathSteps[index].img;
            mob.deathTimer = setTimeout(() => runDeathStep(index + 1), deathSteps[index].delay);
        } else {
            let idx = collectionArray.indexOf(mob);
            if (idx !== -1) collectionArray.splice(idx, 1);
        }
    }
    runDeathStep(0);
}

function triggerCrabHurt(crab) {
    triggerMobHurt(crab, 10, crabAssets, crabs);
}

function triggerSnakeHurt(snake) {
    triggerMobHurt(snake, 10, snakeAssets, snakes);
}

function triggerCrabDeath(crab) {
    triggerMobDeath(crab, crabAssets, crabs);
}

function triggerSnakeDeath(snake) {
    triggerMobDeath(snake, snakeAssets, snakes);
}

function triggerBatHurt(bat) {
    triggerMobHurt(bat, 10, batAssets, bats);
}

function triggerBatDeath(bat) {
    triggerMobDeath(bat, batAssets, bats);
}

let fireballCombatAssets = {
    playerBlueStaff: loadAsset('assets/player/fireball/player_blue_staff.png'),
    tile1: loadAsset('assets/player/fireball/fireball_tile1.png'),
    flight: loadAsset('assets/player/fireball/fireball_flight.png'),
    impact: loadAsset('assets/player/fireball/fireball_impact.png'),
    ashLight: loadAsset('assets/player/fireball/fireball_ash_light.png'),
    ashMed: loadAsset('assets/player/fireball/fireball_ash_med.png')
};

let playerAssets = {
    grayRobe: {
        idle: loadAsset('assets/player/idle/player_gray_robe.png'),
        walk: loadFrameArray('assets/player/movement/gray_robe_walk/player_gray_walk', 4)
    },
    blueRobe: {
        idle: loadAsset('assets/player/idle/player_blue_robe.png'),
        staffIdle: loadAsset('assets/player/idle/player_blue_robe_staff.png'),
        walk: loadFrameArray('assets/player/movement/blue_robe_walk/player_blue_walk', 4),
        walkStaff: loadFrameArray('assets/player/movement/blue_robe_walk/player_blue_walk', 4, 'png') // Mapping to loaded staff frames
    },
    transform: loadAsset('assets/player/idle/player_transform.png')
};

// Fix staff walk frames mapping explicitly
playerAssets.blueRobe.walkStaff = [
    loadAsset('assets/player/movement/blue_robe_walk/player_blue_walk1_staff.png'),
    loadAsset('assets/player/movement/blue_robe_walk/player_blue_walk2_staff.png'),
    loadAsset('assets/player/movement/blue_robe_walk/player_blue_walk3_staff.png'),
    loadAsset('assets/player/movement/blue_robe_walk/player_blue_walk4_staff.png')
];

let playerMovementExtraAssets = {
    swimIdle: loadAsset('assets/player/idle/player_swim_idle.png'),
    swimIdleExt: loadAsset('assets/player/idle/player_swim_idle_ext.png'),
    stun: loadFrameArray('assets/player/stun/player_blue_stun', 2),
    swimFrames: loadFrameArray('assets/player/swim/player_blue_swim', 6)
};

const playerToxicAssets = {
    idle: loadAsset('assets/player/idle/player_toxic_idle.png'),
    walk: loadFrameArray('assets/player/movement/blue_robe_walk/player_toxic_walk', 4)
};

let hurtSceneAssets = {
    ashHalf: loadAsset('assets/player/hurtscene/ash_half.png'),
    ashHeavy: loadAsset('assets/player/hurtscene/ash_heavy.png'),
    ashSlight: loadAsset('assets/player/hurtscene/ash_slight.png'),
    blueRed: {
        ash1: loadAsset('assets/player/hurtscene/player_blue_red_ash1.png'),
        hurt: loadAsset('assets/player/hurtscene/player_blue_red_hurt.png'),
        tilt: loadAsset('assets/player/hurtscene/player_blue_red_tilt.png')
    },
    blueReg: {
        ash1: loadAsset('assets/player/hurtscene/player_blue_reg_ash1.png'),
        hurt: loadAsset('assets/player/hurtscene/player_blue_reg_hurt.png'),
        tilt: loadAsset('assets/player/hurtscene/player_blue_reg_tilt.png')
    },
    blueStaffRed: {
        ash1: loadAsset('assets/player/hurtscene/player_blue_staff_red_ash1.png'),
        hurt: loadAsset('assets/player/hurtscene/player_blue_staff_red_hurt.png'),
        tilt: loadAsset('assets/player/hurtscene/player_blue_staff_red_tilt.png')
    },
    blueStaffReg: {
        ash1: loadAsset('assets/player/hurtscene/player_blue_staff_reg_ash1.png'),
        hurt: loadAsset('assets/player/hurtscene/player_blue_staff_reg_hurt.png'),
        tilt: loadAsset('assets/player/hurtscene/player_blue_staff_reg_tilt.png')
    },
    toxicReg: loadAsset('assets/player/hurtscene/player_toxic_reg.png'),
    toxicRed: loadAsset('assets/player/hurtscene/player_toxic_red.png')
};

// --- LEVEL 4 ASSETS ---
let glacialCaveAssets = {
    stoneOuterWall: loadAsset('assets/glacial_caves/stone_outer_wall.png'),
    stoneWalls: loadFrameArray('assets/glacial_caves/stone_wall_v', 4),
    iceRegular: loadFrameArray('assets/glacial_caves/ice_block_regular_v', 4),
    iceCracked: loadFrameArray('assets/glacial_caves/ice_block_cracked_v', 4),
    ashMed: loadAsset('assets/glacial_caves/ash_med.png')
};

let chestAssets = {
    close: loadAsset('assets/chests/chest_close.png'),
    open: loadAsset('assets/chests/chest_open.png')
};

let bombAssets = {
    unlit: loadAsset('assets/bomb/barrel_bomb_unlit.png'),
    lit1: loadAsset('assets/bomb/barrel_bomb_lit1.png'),
    lit2: loadAsset('assets/bomb/barrel_bomb_lit2.png'),
    lit3: loadAsset('assets/bomb/barrel_bomb_lit3.png'),
    explode1: loadAsset('assets/bomb/barrel_bomb_explode1.png'),
    explode2: loadAsset('assets/bomb/barrel_bomb_explode2.png'),
    explosion: loadAsset('assets/bomb/explosion.png'),
    ashLight: loadAsset('assets/bomb/ash_light.png'),
    ashMed: loadAsset('assets/bomb/ash_med.png'),
    ashHeavy: loadAsset('assets/bomb/ash_heavy.png')
};

let batAssets = {
    idle: loadFrameArray('assets/bat/idle/bat_sleeping', 4),
    movement: {
        back: loadFrameArray('assets/bat/movement/back/bat_back', 6),
        front: loadFrameArray('assets/bat/movement/front/bat_front', 6),
        left: loadFrameArray('assets/bat/movement/left/bat_left', 6),
        right: loadFrameArray('assets/bat/movement/right/bat_right', 6)
    },
    hurt: {
        reg: loadAsset('assets/bat/hurt/bat_hurt_reg.png'),
        red: loadAsset('assets/bat/hurt/bat_hurt_red.png'),
        regAsh: loadAsset('assets/bat/hurt/bat_hurt_reg_ash.png'),
        redAsh: loadAsset('assets/bat/hurt/bat_hurt_red_ash.png'),
        ashMed: loadAsset('assets/bat/hurt/ash_med.png'),
        ashLight: loadAsset('assets/bat/hurt/ash_light.png')
    }
};

// --- LEVEL 4 STATE VARIABLES & CONSTANTS ---
let frozenGrid = []; // 2D array tracking ice coverage (1: frozen, 0: melted)
let iceVariantCache = {}; // Caches visual variant indices for ice/stone blocks per cell
let glacialWallVariantCache = {};
let level4Bombs = []; // Array storing barrel bomb entities and their ignition/explosion states
let bats = []; // Array storing active cave bat entities, positions, and movement states
let initialBatSpawns = [];
let initialBombSpawns = [];

// --- CHEST SYSTEM STATE ---
let chests = [];
let openedChestCells = [];

// --- ITEM DICTIONARY & FACTORY ---
const ITEM_DICTIONARY = {
    apple: {
        id: 'apple',
        name: 'Detox Apple',
        desc: 'Restores 25% HP upon consumption',
        icon: 'assets/sprites/apple.png'
    },
    potion: {
        id: 'potion',
        name: 'Mana Potion',
        desc: 'Restores 100% MP upon consumption',
        icon: 'assets/sprites/potion_bottle.png'
    }
};

function createItem(id) {
    let template = ITEM_DICTIONARY[id];
    if (!template) return null;
    return {
        ...template,
        taken: false
    };
}

// --- UPDATED INIT CHESTS METHOD ---
function initChests() {
    chests = [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (grid[r][c] === 4) {
                let items = [];

                if (currentLevel === 3) {
                    items.push(createItem('apple'));
                    if (Math.random() < 0.80) {
                        items.push(createItem('potion'));
                    }
                    if (Math.random() < 0.40) {
                        items.push(createItem('apple'));
                    }
                } else if (currentLevel === 4) {
                    items.push(createItem('potion'));
                    if (Math.random() < 0.40) {
                        items.push(createItem('apple'));
                    }
                } else if (currentLevel === 5) {
                    if (Math.random() < 0.6) {
                        items.push(createItem('potion'));
                    }
                    if (Math.random() < 0.8) {
                        items.push(createItem('apple'));
                    }
                } else {
                    items.push(createItem('potion'));
                }

                chests.push({
                    r: r,
                    c: c,
                    isOpen: false,
                    items: items
                });
            }
        }
    }
}

// --- BOMB SYSTEM INITIALIZATION & STATE MANAGEMENT ---
function initBombs() {
    level4Bombs = [];
    if (currentLevel !== 4) return;

    if (initialBombSpawns.length === 0) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (grid[r][c] === 6) {
                    initialBombSpawns.push({ r, c });
                }
            }
        }
    }

    for (let spawn of initialBombSpawns) {
        level4Bombs.push({
            r: spawn.r,
            c: spawn.c,
            x: spawn.c * TILE_SIZE + TILE_SIZE / 2,
            y: spawn.r * TILE_SIZE + TILE_SIZE / 2,
            state: 'unlit', // 'unlit' -> 'lit1' -> 'lit2' -> 'lit3' -> 'explode' -> 'explosion' -> 'ashHeavy' -> 'ashMed' -> 'ashLight'
            fuseTimer: null,
            explodeCycles: 0,
            active: true
        });
    }
}

function triggerBombIgnition(bomb) {
    if (!bomb || bomb.state !== 'unlit') return;
    
    bomb.state = 'lit1';

    // Fuse countdown phase: changes state every 500ms
    bomb.fuseTimer = setInterval(() => {
        if (bomb.state === 'lit1') {
            bomb.state = 'lit2';
        } else if (bomb.state === 'lit2') {
            bomb.state = 'lit3';
        } else if (bomb.state === 'lit3') {
            clearInterval(bomb.fuseTimer);
            startBombExplosionSequence(bomb);
        }
    }, 500);
}

function startBombExplosionSequence(bomb) {
    bomb.state = 'explode1';
    bomb.explodeCycles = 0;
    bomb.animFrameCounter = 0;

    // We can handle the alternating explosion frames smoothly via the update loop or a clean ticker
    if (bomb.fuseTimer) clearInterval(bomb.fuseTimer);
    
    let explodeInterval = setInterval(() => {
        bomb.explodeCycles++;
        bomb.state = (bomb.state === 'explode1') ? 'explode2' : 'explode1';

        if (bomb.explodeCycles >= 6) {
            clearInterval(explodeInterval);
            detonateBomb(bomb);
        }
    }, 120);
}

function detonateBomb(bomb) {
    bomb.state = 'explosion';

    // 1. Destroy/Crack Ice Blocks
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            let tr = bomb.r + dr;
            let tc = bomb.c + dc;
            if (checkGridBounds(tr, tc) && frozenGrid[tr] && frozenGrid[tr][tc] > 0) {
                triggerBreakIce(tr, tc);
            }
        }
    }

    for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
            if (Math.abs(dr) === 3 || Math.abs(dc) === 3) {
                let tr = bomb.r + dr;
                let tc = bomb.c + dc;
                if (checkGridBounds(tr, tc) && frozenGrid[tr] && frozenGrid[tr][tc] === 1) {
                    frozenGrid[tr][tc] = 2;
                }
            }
        }
    }

    // 2. Chain Reaction for Other Unlit Bombs
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            let tr = bomb.r + dr;
            let tc = bomb.c + dc;
            let nearbyBomb = level4Bombs.find(b => b.r === tr && b.c === tc && b.state === 'unlit');
            if (nearbyBomb && nearbyBomb !== bomb) {
                triggerBombIgnition(nearbyBomb);
            }
        }
    }

    // 3. Player & Mob Damage Calculation
    let playerDist = Math.max(Math.abs(player.r - bomb.r), Math.abs(player.c - bomb.c));
    if (playerDist <= 1) deductPlayerHP(50);
    else if (playerDist === 2) deductPlayerHP(20);
    else if (playerDist === 3) deductPlayerHP(5);

    if (currentLevel === 4 && typeof bats !== 'undefined') {
        for (let bat of bats) {
            if (bat.isDying) continue;
            let batDist = Math.max(Math.abs(bat.r - bomb.r), Math.abs(bat.c - bomb.c));
            if (batDist <= 2) triggerBatHurt(bat, 50);
        }
    }

    // 4. Queue Aftermath Animation Frames instead of nested timeouts
    bombAnimationQueue.push({ bomb: bomb, stage: 'ashHeavy', framesLeft: 15 });
}

function initBats() {
    bats = [];
    if (currentLevel !== 4 || cheats.disableMobs) return;

    if (initialBatSpawns.length === 0) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (grid[r][c] === 7) { // 7 designates initial bat/roost spawn in Level 4
                    initialBatSpawns.push({ r, c });
                    grid[r][c] = 0; // Clear cell value to empty floor initially
                }
            }
        }
    }

    for (let spawn of initialBatSpawns) {
        bats.push({
            r: spawn.r,
            c: spawn.c,
            x: spawn.c * TILE_SIZE + TILE_SIZE / 2,
            y: spawn.r * TILE_SIZE + TILE_SIZE / 2,
            state: 'HIBERNATING', // HIBERNATING, FLYING, or SLEEPING
            distanceCovered: 0,
            minDistance: 8,
            maxDistance: 30,
            sleepAnimIndex: 0,
            dr: -1,
            dc: 0,
            speed: 0.03,
            hp: 10,
            maxhp: 10,
            attackCooldown: 60,
            hurtPhase: 0,
            hurtTimer: null,
            isDying: false,
            currentDeathImg: null
        });
    }
}

// --- LEVEL 5 ASSETS ---
let labyrinthAssets = {
    baseWall: loadAsset('assets/labyrinth/labyrinth_wall_base.png'),
    vinesWall: loadAsset('assets/labyrinth/labyrinth_wall_vines.png'),
    outerWall: loadAsset('assets/labyrinth/labyrinth_wall_heavy_vines.png')
};

const FOV = 320;
const CAMERA_HEIGHT = 170;
const LOOK_AHEAD = 160;

function project3D(worldX, worldY, heightOffset = 0) {
    let dx = worldX - player.x;
    let dy = player.y - worldY; 
    
    let rotX = dx * Math.sin(camAngle) - dy * Math.cos(camAngle);
    let rotZ = dx * Math.cos(camAngle) + dy * Math.sin(camAngle);

    let renderZ = rotZ + LOOK_AHEAD; 
    if (renderZ < 10) renderZ = 10;
    
    let screenX = (rotX * FOV) / renderZ + canvas.width / 2;
    let screenY = ((CAMERA_HEIGHT - heightOffset) * FOV) / renderZ + canvas.height * 0.45;
    
    return { x: screenX, y: screenY, scale: FOV / renderZ, rotZ: rotZ };
}

// --- LEVEL 5 PLANT MONSTER ASSETS & STATE ---
let plantAssets = {
    idle: {
        front: loadFrameArray('assets/plant/idle/front/plant_idle_front', 4),
        back: loadFrameArray('assets/plant/idle/back/plant_idle_back', 4),
        left: loadFrameArray('assets/plant/idle/left/plant_idle_left', 4),
        right: loadFrameArray('assets/plant/idle/right/plant_idle_right', 4)
    },
    alert: {
        front: loadFrameArray('assets/plant/idle/front/plant_active_front', 4),
        back: loadFrameArray('assets/plant/idle/back/plant_active_back', 4),
        left: loadFrameArray('assets/plant/idle/left/plant_active_left', 4),
        right: loadFrameArray('assets/plant/idle/right/plant_active_right', 4)
    },
    attack: loadFrameArray('assets/plant/attack/plant_attack', 6),
    stomach: loadAsset('assets/plant/attack/plant_stomach.png'),
    hurt: {
        reg: loadAsset('assets/plant/hurt/plant_hurt_reg.png'),
        red: loadAsset('assets/plant/hurt/plant_hurt_red.png'),
        regAsh: loadAsset('assets/plant/hurt/plant_hurt_reg_ash.png'),
        redAsh: loadAsset('assets/plant/hurt/plant_hurt_red_ash.png'),
        ashMed: loadAsset('assets/plant/hurt/ash_med.png'),
        ashLight: loadAsset('assets/plant/hurt/ash_light.png')
    }
};

let plants = [];
let initialPlantSpawns = [];
let activeEatenPlant = null;

function initPlants() {
    plants = [];
    if (currentLevel !== 5 || cheats.disableMobs) return;

    if (initialPlantSpawns.length === 0) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (grid[r][c] === 7) { // Spawn marker
                    initialPlantSpawns.push({ r, c });
                    grid[r][c] = 0; 
                }
            }
        }
    }

    for (let spawn of initialPlantSpawns) {
        plants.push({
            r: spawn.r,
            c: spawn.c,
            x: spawn.c * TILE_SIZE + TILE_SIZE / 2,
            y: spawn.r * TILE_SIZE + TILE_SIZE / 2,
            hp: 40,
            maxhp: 40,
            state: 'IDLE', // 'IDLE', 'ACTIVE', 'ATTACKING'
            calmTimer: 0,
            hurtPhase: 0,
            hurtTimer: null,
            isDying: false,
            deathStage: 0,
            deathTimer: null,
            currentDeathImg: null
        });
    }
}

function triggerPlantHurt(plant) {
    triggerMobHurt(plant, 10, plantAssets, plants);
    // Hitting an idle plant forces it into active state even if outside range
    if (plant.state === 'IDLE') {
        plant.state = 'ACTIVE';
        plant.calmTimer = 300; // 5 seconds at 60fps
    }
}

function triggerPlantDeath(plant) {
    if (activeEatenPlant === plant) {
        activeEatenPlant = null;
        player.isGrabbed = false;
        if (activeModal) {
            activeModal.remove();
            activeModal = null;
        }
    }
    triggerMobDeath(plant, plantAssets, plants);
}

// ==========================================
// --- LEVEL 6: MINOTAUR LABYRINTH ASSETS ---
// ==========================================

let minotaurAssets = {
    idle: {
        front: loadAsset('assets/minotaur/idle/minotaur_idle_front.png'),
        back: loadAsset('assets/minotaur/idle/minotaur_idle_back.png'),
        left: loadAsset('assets/minotaur/idle/minotaur_idle_left.png'),
        right: loadAsset('assets/minotaur/idle/minotaur_idle_right.png')
    },
    walk: {
        front: [
            loadAsset('assets/minotaur/walk/minotaur_walk_front1.png'),
            loadAsset('assets/minotaur/walk/minotaur_walk_front2.png')
        ],
        back: [
            loadAsset('assets/minotaur/walk/minotaur_walk_back1.png'),
            loadAsset('assets/minotaur/walk/minotaur_walk_back2.png')
        ],
        left: [
            loadAsset('assets/minotaur/walk/minotaur_walk_left1.png'),
            loadAsset('assets/minotaur/walk/minotaur_walk_left2.png')
        ],
        right: [
            loadAsset('assets/minotaur/walk/minotaur_walk_right1.png'),
            loadAsset('assets/minotaur/walk/minotaur_walk_right2.png')
        ]
    },
    attack: {
        front: loadFrameArray('assets/minotaur/attack/front/minotaur_attack_front', 8),
        back: loadFrameArray('assets/minotaur/attack/back/minotaur_attack_back', 8),
        left: loadFrameArray('assets/minotaur/attack/left/minotaur_attack_left', 8),
        right: loadFrameArray('assets/minotaur/attack/right/minotaur_attack_right', 8)
    },
    hurt: {
        reg: loadAsset('assets/minotaur/hurt/minotaur_hurt_reg.png'),
        red: loadAsset('assets/minotaur/hurt/minotaur_hurt_red.png'),
        regAsh: loadAsset('assets/minotaur/hurt/minotaur_hurt_reg_ash.png'),
        redAsh: loadAsset('assets/minotaur/hurt/minotaur_hurt_red_ash.png'),
        ashLight: loadAsset('assets/minotaur/hurt/ash_light.png'),
        ashMed: loadAsset('assets/minotaur/hurt/ash_med.png')
    }
};

let minotaurs = [];
let initialMinotaurSpawns = [];

function initMinotaurs() {
    minotaurs = [];
    if (currentLevel !== 5 || cheats.disableMobs) return;

    if (initialMinotaurSpawns.length === 0) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (grid[r][c] === 6) { 
                    initialMinotaurSpawns.push({ r, c });
                    grid[r][c] = 0; 
                }
            }
        }
    }

    for (let spawn of initialMinotaurSpawns) {
        minotaurs.push({
            r: spawn.r,
            c: spawn.c,
            spawnR: spawn.r,
            spawnC: spawn.c, 
            x: spawn.c * TILE_SIZE + TILE_SIZE / 2,
            y: spawn.r * TILE_SIZE + TILE_SIZE / 2,
            hp: 100,
            maxhp: 100,
            state: 'IDLE', 
            pathHistory: [],    
            isBacktracking: false, 
            attackFrameIndex: 0,
            hurtPhase: 0,
            hurtTimer: null,
            isDying: false,
            deathStage: 0,
            deathTimer: null,
            currentDeathImg: null
        });
    }
}

// ==========================================
// --- MINOTAUR DAMAGE & DRAW PIPELINE ---
// ==========================================

function triggerMinotaurHurt(minotaur) {
    triggerMobHurt(minotaur, 10, minotaurAssets, minotaurs);
}

function triggerMinotaurDeath(minotaur) {
    triggerMobDeath(minotaur, minotaurAssets, minotaurs);
}

const modalStyle = document.createElement('style');
modalStyle.innerHTML = `
    #customModalOverlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(2, 6, 23, 0.4); display: flex; align-items: center; justify-content: center;
        z-index: 10000; font-family: 'Georgia', serif; animation: fadeIn 0.3s ease;
        pointer-events: none;
    }
    #customModalBox {
        position: relative; background: #0f172a; border: 3px double #fbbf24; padding: 24px 32px;
        border-radius: 8px; max-width: 350px; min-width: 250px; text-align: center;
        box-shadow: 0 0 25px rgba(251, 191, 36, 0.3); color: #fef3c7;
        pointer-events: auto;
    }
    #customModalCloseBtn {
        position: absolute; top: 8px; right: 12px; background: transparent; border: none;
        color: #94a3b8; font-size: 18px; cursor: pointer; transition: color 0.2s;
    }
    #customModalCloseBtn:hover { color: #fef3c7; }
    #customModalBox h3 {
        margin: 0 0 12px 0; color: #fbbf24; font-size: 20px; letter-spacing: 1px;
    }
    #customModalBox p {
        margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #e2e8f0;
    }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
`;
document.head.appendChild(modalStyle);

const LEVEL_THEMES = {
    1: { name: "Library", floor: "#c89d67", mazeWall: "#8c5f32", stroke: "#5a3818" },
    2: { name: "Underwater Cavern", floor: "#0f172a", mazeWall: "#0e7490", stroke: "#164e63" },
    3: { name: "Toxic Tunnels", floor: "#1e293b", mazeWall: "#475569", stroke: "#0f172a" },
    4: { name: "Glacial Cave", floor: "#e2ecf0", mazeWall: "#000000", stroke: "#0c4a6e" },
    5: { name: "Ancient Labyrinth", floor: "#a39e83", mazeWall: "#c5c0a3", stroke: "#57533f" }
};

let sewerAssets = {
    outerWall: loadAsset('assets/sewer/sewer_outer_wall.png'),
    walls: loadFrameArray('assets/sewer/sewer_wall_var', 6)
};

let sewerWallVariantCache = {};

const GLOBAL_COLORS = {
    start: "#f43f5e",
    exit: "#10b981",
    outerWall: "#334155",
    hint: "#ef4444"
};

function getCellColor(val) {
    let currentTheme = LEVEL_THEMES[currentLevel] || LEVEL_THEMES[1];
    switch (val) {
        case 2:  return GLOBAL_COLORS.exit;
        case 3:  return GLOBAL_COLORS.start;
        case -1: return GLOBAL_COLORS.outerWall;
        case 1:
        case 5:  return currentTheme.mazeWall;
        default: return currentTheme.floor;
    }
}

function getCellStrokeColor(val) {
    let currentTheme = LEVEL_THEMES[currentLevel] || LEVEL_THEMES[1];
    switch (val) {
        case 2:  return '#34d399';
        case 3:  return '#fb7185';
        case -1: return '#1e293b';
        default: return currentTheme.stroke;
    }
}

function initGridVariantCache(gridData, targetValues, maxVariants) {
    let cache = {};
    for (let r = 0; r < gridData.length; r++) {
        for (let c = 0; c < gridData[0].length; c++) {
            if (targetValues.includes(gridData[r][c])) {
                cache[`${r},${c}`] = Math.floor(Math.random() * maxVariants);
            }
        }
    }
    return cache;
}

function initCoralCache(gridData) {
    let cache = {};
    let families = ['green', 'orange', 'pink'];
    for (let r = 0; r < gridData.length; r++) {
        for (let c = 0; c < gridData[0].length; c++) {
            if (gridData[r][c] === 1) {
                let family = families[Math.floor(Math.random() * families.length)];
                let version = Math.floor(Math.random() * 4) + 1;
                cache[`${r},${c}`] = { family, version };
            }
        }
    }
    return cache;
}

async function loadLevel(levelNum) {
    try {
        if (levelNum > 5) {
            levelNum = 5;
            if (levelSelect) levelSelect.value = "5";
        }

        currentLevel = levelNum;
        const response = await fetch(`/api/maze?level=${levelNum}`);
        mazeData = await response.json();
        
        grid = mazeData.grid;
        
        // --- NO WALLS CHEAT: Convert all inner walls (1 or 5) to empty floors (0) ---
        if (cheats.noWalls) {
            for (let r = 0; r < grid.length; r++) {
                for (let c = 0; c < grid[0].length; c++) {
                    if (grid[r][c] === 1 || grid[r][c] === 5) {
                        grid[r][c] = 0;
                    }
                }
            }
        }

        if (cheats.noWater && levelNum === 3) {
            for (let r = 0; r < grid.length; r++) {
                for (let c = 0; c < grid[0].length; c++) {
                    if (grid[r][c] === 7) {
                        grid[r][c] = 0;
                    }
                }
            }
        }
        // --------------------------------------------------------------------------

        startPos = { r: mazeData.start[0], c: mazeData.start[1] };
        exitPos = { r: mazeData.exit[0], c: mazeData.exit[1] };
        
        centerPos = null;
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (grid[r][c] === 4) {
                    centerPos = { r, c };
                }
            }
        }

        initChests();

        if (levelNum === 1) {
            bookshelfVariantCache = initGridVariantCache(grid, [1, 5], 15);
        } else if (levelNum === 2) {
            underwaterWallVariantCache = initGridVariantCache(grid, [-1], 4);
            coralVariantCache = initCoralCache(grid);
            initCrabs();
        } else if (levelNum === 3) {
            sewerWallVariantCache = initGridVariantCache(grid, [1, -1], 6);
            initSnakes();
        } else if (levelNum === 4) {
            if (!cheats.noWalls) {
                frozenGrid = grid.map(row => row.map(val => (val === -1 || val === 2 || val === 3) ? 0 : 1));
                iceVariantCache = initGridVariantCache(grid, [0, 1, 4, 6, 7, 5], 4);
            } else {
                frozenGrid = grid.map(row => row.map(() => 0));
                iceVariantCache = {};
            }
            initBombs();
            initBats();
            glacialWallVariantCache = initGridVariantCache(grid, [-1], 4);

        } else if (levelNum === 5) {
            initPlants();
            initMinotaurs();
        }

        grid[startPos.r][startPos.c] = 3;

        optimalPath = mazeData.optimal_path || [];
        resetGame();

    } catch (err) {
        console.error("Failed to load maze level:", err);
    }
}

function resetGame() {
    if (deathTimer) clearTimeout(deathTimer);
    if (hurtTimer) clearTimeout(hurtTimer);
    if (castingAnimTimer) clearTimeout(castingAnimTimer);
    if (hintTimer) clearTimeout(hintTimer);
    if (iconTimeout) clearTimeout(iconTimeout);

    if (activeModal) {
        activeModal.remove();
        activeModal = null;
    }

    if (currentLevel === 1) {
        bookshelfVariantCache = initGridVariantCache(grid, [1, 5], 15);
    } else if (currentLevel === 2) {
        underwaterWallVariantCache = initGridVariantCache(grid, [-1], 4);
        coralVariantCache = initCoralCache(grid);
    } else if (currentLevel === 3) {
        sewerWallVariantCache = initGridVariantCache(grid, [1, -1], 6);
    } else if (currentLevel === 4) {
        if (!cheats.noWalls) {
            frozenGrid = grid.map(row => row.map(val => (val === -1 || val === 2 || val === 3) ? 0 : 1));
            iceVariantCache = initGridVariantCache(grid, [0, 1, 4, 6, 7, 5], 4);
        } else {
            frozenGrid = grid.map(row => row.map(() => 0));
            iceVariantCache = {};
        }
        initBombs();
        glacialWallVariantCache = initGridVariantCache(grid, [-1], 4);
    }

    iceMeltingQueue = {}; // Tracks r,c -> { state, framesLeft }
    bombAnimationQueue = []; // Tracks active bomb aftermath animations

    isDying = false;
    deathStage = 0;
    currentDeathImg = null;
    hurtPhase = 0;
    lastDrainSec = -1;
    player.isGrabbed = false;
    activeGrabCrab = null;
    activeEatenPlant = null;

    zoomIdx = 0;
    minimapPanX = 0;
    minimapPanY = 0;
    minimapTool = 'none';
    updateMinimapToolUI();

    initChests();

    player.r = startPos.r;
    player.c = startPos.c;
    player.x = player.c * TILE_SIZE + TILE_SIZE / 2;
    player.y = player.r * TILE_SIZE + TILE_SIZE / 2;
    player.angle = Math.PI / 2;
    player.targetAngle = player.angle;
    player.isMoving = false;
    player.moveProgress = 1.0;
    
    player.hasWizardHat = (currentLevel >= 2);
    player.hasWizardStaff = (currentLevel >= 3);
    player.isTransforming = false;
    player.hp = 100;
    player.mp = 100;
    player.isToxicSwimming = false;
    player.isPoisoned = false;

    killedMobCells = [];
    openedChestCells = [];

    if (centerPos) {
        grid[centerPos.r][centerPos.c] = 4;
    }
    
    camAngle = player.angle;
    trailPoints = [{ x: player.x, y: player.y }];
    
    visitedCells.clear();
    visitedCells.add(`${player.r},${player.c}`);
    
    isGameFinished = false;
    startTime = null;
    elapsedTimeSec = 0;
    totalDistanceCovered = 0;
    killCount = 0;
    damageTaken = 0;
    hintsUsed = 0;
    finalScore = 0;

    level2State = 0;
    leverAngle = Math.PI / 4;
    waterHeight = 3.0;
    initCrabs();
    initSnakes();
    initBats();
    initPlants();
    initMinotaurs();
    
    clearHint();
    updateUI();
}

levelSelect.addEventListener('change', (e) => {
    let lvl = parseInt(e.target.value);
    if (lvl >= 1 && lvl <= 5) {
        loadLevel(lvl);
    } else {
        levelSelect.value = "1";
        loadLevel(1);
    }
});

restartBtn.addEventListener('click', () => resetGame());

function triggerHint() {
    if (isGameFinished || hintActive) return;
    hintActive = true;
    hintsUsed++;
    hintPos = { x: player.x, y: player.y };

    if (currentLevel === 2) {
        hintMobPositions = crabs.filter(mob => !mob.isDying).map(mob => ({ r: mob.r, c: mob.c }));
    } else if (currentLevel === 3) {
        hintMobPositions = snakes.filter(mob => !mob.isDying).map(mob => ({ r: mob.r, c: mob.c }));
    } else if (currentLevel === 4) {
        let batPositions = bats.filter(b => !b.isDying).map(b => ({ r: b.r, c: b.c }));
        let bombPositions = level4Bombs.filter(b => b.active).map(b => ({ r: b.r, c: b.c }));
        hintMobPositions = [...batPositions, ...bombPositions];
    } else if (currentLevel === 5) {
        let plantPositions = plants.filter(mob => !mob.isDying).map(mob => ({ r: mob.r, c: mob.c }));
        let minotaurPositions = minotaurs.filter(mob => !mob.isDying).map(mob => ({ r: mob.r, c: mob.c }));
        hintMobPositions = [...plantPositions, ...minotaurPositions];
    }
    
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
        hintActive = false;
        hintPos = null;
        hintMobPositions = [];
    }, 5000);
}

hintBtn.addEventListener('click', triggerHint);

function clearHint() {
    if (hintTimer) clearTimeout(hintTimer);
    hintActive = false;
    hintPos = null;
    hintMobPositions = [];
}

let iconTimeout = null;

function flashBackHandIcon() {
    btnCenter.innerHTML = `<span class="material-icons" style="font-size: 20px; line-height: 1;">back_hand</span>`;
    
    if (iconTimeout) clearTimeout(iconTimeout);
    iconTimeout = setTimeout(() => {
        btnCenter.innerHTML = "◯";
    }, 1000);
}

btnCenter.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    flashBackHandIcon();
    handlePickInteraction();
});

btnCenter.addEventListener('click', () => {
    if (currentLevel === 1) {
        return;
    } else if (currentLevel === 2 && level2State !== 2) {
            return;
    } else {
        handleFireAction();
    }
});

function handlePickInteraction() {
    if (centerPos && player.r === centerPos.r && player.c === centerPos.c) {
        if (currentLevel === 2) {
            if (level2State === 0) {
                level2State = 1;
                leverAngle = -Math.PI / 4;
                showCustomModal({
                    title: "Emergency Drainage",
                    message: "You pull the heavy stone lever! Valves open across the cavern, and the water begins to drain block by block."
                });
            } else if (level2State === 1 && waterHeight <= 0.1) {
                level2State = 2;
                player.hasWizardStaff = true;
                grid[centerPos.r][centerPos.c] = 0; 
                
                showCustomModal({
                    title: "Arcane Staff Acquired",
                    message: "You unseat the staff from its mounting base!<br><br>✨ <i>You have obtained the Magic Staff. You can now use Fireball.</i> ✨",
                    onClose: () => {
                        player.isMoving = false;
                        player.moveProgress = 1.0;
                        player.fromR = player.r;
                        player.fromC = player.c;
                        player.toR = player.r;
                        player.toC = player.c;
                        player.hp = 100;
                    }
                });
            } else if (level2State === 1 && waterHeight > 0.1) {
                showCustomModal({
                    title: "System Locked",
                    message: "The water level is still too high! Wait for the cavern to drain completely before extracting the staff."
                });
            }
        } else if (currentLevel === 1 && !player.hasWizardHat) {
            player.isTransforming = true;
            player.hasWizardHat = true;
            grid[centerPos.r][centerPos.c] = 0;
            
            showCustomModal({
                title: "Arcane Ascension",
                message: "You have claimed the Wizard's Hat from the ancient altar!<br><br>✨ <i>You are now a Wizard!</i> ✨",
                onClose: () => {
                    player.hasWizardHat = true;
                    player.isTransforming = false;
                    player.isMoving = false;
                    player.moveProgress = 1.0;
                    player.fromR = player.r;
                    player.fromC = player.c;
                    player.toR = player.r;
                    player.toC = player.c;
                }
            });
        }
    }

    // Check if player is standing on an interactive chest
    let chest = chests.find(ch => player.r === ch.r && player.c === ch.c);
    if (chest && currentLevel > 2) {
        openChestModal(chest);
        return;
    }
}

function openChestModal(chest) {
    if (activeModal) activeModal.remove(); 
    chest.isOpen = true;

    if (!openedChestCells.some(cell => cell.r === chest.r && cell.c === chest.c)) {
        openedChestCells.push({ r: chest.r, c: chest.c });
    }

    const consumeItem = (item) => {
        if (item.taken) return;
        if (item.id === 'potion') {
            player.mp = player.maxmp;
            flashBar('magicFill', 'flash-blue', 350);
        } else if (item.id === 'apple') {
            player.hp = Math.min(player.maxhp, player.hp + player.maxhp * 0.25);
            flashBar('healthFill', 'flash-green', 350);
            player.isPoisoned = false;
        }
        item.taken = true;
        updateUI();
    };

    const renderChestGridHtml = () => {
        let gridHtml = `<div style="display: grid; grid-template-columns: repeat(3, 60px); grid-template-rows: repeat(3, 60px); gap: 6px; justify-content: center; margin: 15px 0;">`;
        
        for (let i = 0; i < 9; i++) {
            let itemHtml = '';
            let eventAttrs = '';
            let clickAttr = '';

            let item = chest.items[i];
            if (item && !item.taken) {
                let color = item.id === 'potion' ? '#38bdf8' : '#fbbf24';
                eventAttrs = `onmouseenter="showTooltip(event, '${item.name}', '${item.desc}', '${color}')" onmousemove="moveTooltip(event)" onmouseleave="hideTooltip()"`;
                itemHtml = `<img src="${item.icon}" style="width: 40px; height: 40px; object-fit: contain; cursor: pointer;" alt="${item.name}">`;
                clickAttr = `onclick="takeChestItem(${i}); hideTooltip();"`;
            }

            gridHtml += `<div class="chest-slot" ${eventAttrs} ${clickAttr} style="width: 60px; height: 60px; background: #1e293b; border: 2px solid #334155; border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative;">${itemHtml}</div>`;
        }
        gridHtml += `</div>`;
        return gridHtml;
    };

    window.takeChestItem = (index) => {
        let item = chest.items[index];
        if (item) {
            consumeItem(item);
            const bodyEl = document.getElementById('chestModalGridContainer');
            if (bodyEl) bodyEl.innerHTML = renderChestGridHtml();
        }
    };

    let modalMessageHtml = `
        <div style="font-size: 13px; color: #94a3b8; margin-bottom: 8px; font-style: italic;">
            Hover over an item to see its description.<br>Click an item to take it.
        </div>
        <div id="chestModalGridContainer">
            ${renderChestGridHtml()}
        </div>
    `;

    setTimeout(() => {
        showCustomModal({
            title: "Wooden Chest",
            message: modalMessageHtml,
            isProximity: true, 
            buttons: [
                {
                    text: "Take All",
                    bg: "linear-gradient(135deg, #22c55e, #16a34a)",
                    callback: () => {
                        hideTooltip();
                        chest.items.forEach(item => {
                            if (!item.taken) {
                                consumeItem(item);
                            }
                        });
                        chest.isOpen = false;
                    }
                },
                {
                    text: "Close",
                    bg: "linear-gradient(135deg, #334155, #475569)",
                    callback: () => {
                        hideTooltip();
                        chest.isOpen = false;
                    }
                }
            ],
            onClose: () => {
                hideTooltip();
                chest.isOpen = false;
            }
        });
    }, 50);
}

function showTooltip(e, name, desc, color) {
    let tt = document.getElementById('gameCustomTooltip');
    let titleEl = document.getElementById('ttTitle');
    let descEl = document.getElementById('ttDesc');
    if (!tt || !titleEl || !descEl) return;

    titleEl.innerText = name;
    titleEl.style.color = color;
    descEl.innerText = desc;

    tt.style.display = 'block';
    moveTooltip(e);
}

function moveTooltip(e) {
    let tt = document.getElementById('gameCustomTooltip');
    if (!tt || tt.style.display === 'none') return;
    
    // Offset slightly from cursor so it doesn't block clicks
    let x = e.clientX + 15;
    let y = e.clientY + 15;
    
    // Prevent tooltip from going off-screen on the right/bottom
    if (x + tt.offsetWidth > window.innerWidth) {
        x = window.innerWidth - tt.offsetWidth - 15;
    }
    if (y + tt.offsetHeight > window.innerHeight) {
        y = window.innerHeight - tt.offsetHeight - 15;
    }

    tt.style.left = x + 'px';
    tt.style.top = y + 'px';
}

function hideTooltip() {
    let tt = document.getElementById('gameCustomTooltip');
    if (tt) tt.style.display = 'none';
}

function handleFireAction() {
    if (isGameFinished || currentLevel === 1 || (currentLevel === 2 && !player.hasWizardStaff)) return;
    if (!player.hasWizardStaff) {
        showCustomModal({ title: "Locked Ability", message: "You do not possess the Magic Staff yet! Find it in the center of the labyrinth." });
        return;
    }
    if (player.mp < 10 && !cheats.infiniteMp) {
        showCustomModal({ title: "Low Mana", message: "Not enough MP to cast Fireball!" });
        return;
    }
    if (activeFireball && activeFireball.active) return;

    if (!cheats.infiniteMp) {
        player.mp -= 10;
        flashBar('magicFill', 'flash-blue', 350);
        updateUI();
    }

    let deg = Math.round(((player.angle * 180) / Math.PI) / 90) * 90 % 360;
    if (deg < 0) deg += 360;

    let dr = 0, dc = 0;
    if (deg === 90) dr = -1;
    else if (deg === 0 || deg === 360) dc = 1;  
    else if (deg === 270) dr = 1;  
    else if (deg === 180) dc = -1; 

    player.isCasting = true;
    if (castingAnimTimer) clearTimeout(castingAnimTimer);
    castingAnimTimer = setTimeout(() => {
        player.isCasting = false;
    }, 400);

    activeFireball = {
        active: true,
        r: player.r,
        c: player.c,
        fromR: player.r,
        fromC: player.c,
        toR: player.r + dr,
        toC: player.c + dc,
        dr: dr,
        dc: dc,
        distanceTraveled: 0,
        maxDistance: 5,
        hasHit: false,
        state: 'tile1',
        x: player.x,
        y: player.y,
        progress: 0.0
    };

    setTimeout(() => {
        if (activeFireball && activeFireball.active && activeFireball.state === 'tile1') {
            activeFireball.state = 'flight';
        }
    }, 150);
}

function resolveFireballImpact() {
    if (!activeFireball) return;
    activeFireball.hasHit = true;
    activeFireball.state = 'impact';
    
    setTimeout(() => {
        if (!activeFireball) return;
        activeFireball.state = 'ashMed';
        setTimeout(() => {
            if (!activeFireball) return;
            activeFireball.state = 'ashLight';
            setTimeout(() => {
                if (activeFireball) activeFireball.active = false;
            }, 200);
        }, 200);
    }, 150);
}

window.addEventListener('keydown', (e) => {
    if (player.isGrabbed) {
        if (e.key.toLowerCase() === 's' || e.key === 'ArrowDown') {
            e.preventDefault();
            handleGrabEscapePress();
        }
        return;
    }

    if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.code === 'Space') {
        e.preventDefault();
        handleMoveForward();
    }
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') handleTurn('LEFT');
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') handleTurn('RIGHT');
    if (e.key.toLowerCase() === 's' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleTurn('AROUND');
    }
    if (e.key.toLowerCase() === 'h') triggerHint();
    
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            flashBackHandIcon();
            handlePickInteraction();
        } else {
            if (currentLevel === 1) {
                return;
            } else {
                handleFireAction();
            }
        }
    }
});

function getCrabFacing(crab) {
    let dr = crab.baseDr !== undefined ? crab.baseDr : crab.dr;
    let dc = crab.baseDc !== undefined ? crab.baseDc : crab.dc;

    let movementAngle = Math.atan2(dr, dc);
    let rawFacing = getRelativeFacing(movementAngle, player.angle);

    if (rawFacing === 'front') return 'left';
    if (rawFacing === 'left') return 'front';
    if (rawFacing === 'back') return 'right';
    if (rawFacing === 'right') return 'back';

    return rawFacing;
}

function initCrabs() {
    crabs = [];
    if (currentLevel !== 2 || cheats.disableMobs) return;
    
    if (initialCrabSpawns.length === 0) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                let val = grid[r][c];
                if (val === 6 || val === 7) {
                    initialCrabSpawns.push({ r, c, val });
                    grid[r][c] = 0; 
                }
            }
        }
    }

    for (let spawn of initialCrabSpawns) {
        let facing = (spawn.val === 6) ? 'right' : 'back';
        let dr = (spawn.val === 6) ? 1 : 0;
        let dc = (spawn.val === 6) ? 0 : 1;
        
        crabs.push({
            r: spawn.r,
            c: spawn.c,
            fromR: spawn.r,
            fromC: spawn.c,
            toR: spawn.r + dr,
            toC: spawn.c + dc,
            x: spawn.c * TILE_SIZE + TILE_SIZE / 2,
            y: spawn.r * TILE_SIZE + TILE_SIZE / 2,
            facing: facing,
            dr: dr,
            dc: dc,
            baseDr: dr,
            baseDc: dc,
            isMoving: true,
            blocksWalked: 0,
            waitTimer: 0,
            moveProgress: 0.0,
            hp: 20,
            maxhp: 20,
            hurtPhase: 0,
            hurtTimer: null,
            isDying: false,
            deathStage: 0,
            deathTimer: null,
            currentDeathImg: null
        });
    }
}

function deductPlayerHP(amount) {
    if (!cheats.infiniteHp) {
        player.hp -= amount;
        damageTaken += amount;
    
        if (!player.isGrabbed) {
            triggerHurtAnimation();
        } else {
            flashBar('healthFill', 'flash-red', 350);
        }

        if (player.hp <= 0) {
            player.hp = 0;
            triggerDeathSequence();
        }
    }
}

let iceMeltingQueue = {}; // Tracks r,c -> { state, framesLeft }
let bombAnimationQueue = []; // Tracks active bomb aftermath animations

function triggerBreakIce(r, c) {
    if (!checkGridBounds(r, c) || (frozenGrid[r][c] !== 1 && frozenGrid[r][c] !== 2)) return;
    
    // If it's already cracked (state 2), skip straight to ash (3); otherwise set to cracked (2)
    let nextIceState = (frozenGrid[r][c] === 2) ? 3 : 2;
    frozenGrid[r][c] = nextIceState; 

    let bomb = level4Bombs.find(b => b.r === r && b.c === c && b.state === 'unlit');
    if (bomb) {
        triggerBombIgnition(bomb);
    }

    // Queue frame-based transition instead of setTimeout (~15 frames per stage)
    iceMeltingQueue[`${r},${c}`] = { state: nextIceState, framesLeft: 15 };
}

function updateIceAndBombAnimations() {
    // Process Ice Melting Queue
    for (let key in iceMeltingQueue) {
        let item = iceMeltingQueue[key];
        item.framesLeft--;

        if (item.framesLeft <= 0) {
            let [r, c] = key.split(',').map(Number);
            if (checkGridBounds(r, c)) {
                if (frozenGrid[r][c] === 2) {
                    frozenGrid[r][c] = 3; // Move to ash
                    item.framesLeft = 15; // Reset timer for final clear
                } else if (frozenGrid[r][c] === 3) {
                    frozenGrid[r][c] = 0; // Fully cleared
                    delete iceMeltingQueue[key];
                }
            } else {
                delete iceMeltingQueue[key];
            }
        }
    }

    // Process Bomb Aftermath Queue
    for (let i = bombAnimationQueue.length - 1; i >= 0; i--) {
        let anim = bombAnimationQueue[i];
        anim.framesLeft--;

        if (anim.framesLeft <= 0) {
            if (anim.stage === 'ashHeavy') {
                anim.bomb.state = 'ashMed';
                anim.stage = 'ashMed';
                anim.framesLeft = 15;
            } else if (anim.stage === 'ashMed') {
                anim.bomb.state = 'ashLight';
                anim.stage = 'ashLight';
                anim.framesLeft = 15;
            } else if (anim.stage === 'ashLight') {
                anim.bomb.state = 'ashLight';
                anim.bomb.active = false;
                grid[anim.bomb.r][anim.bomb.c] = 0;
                bombAnimationQueue.splice(i, 1);
            }
        }
    }
}

function updateCrabs() {
    if (currentLevel !== 2) return;

    if (cheats.noWater) {
        waterHeight = 0.0;
    }
    if (level2State === 1 && waterHeight > 0) {
        waterHeight -= 0.01; 
        if (waterHeight < 0) waterHeight = 0;
    }

    if (waterHeight >= 1.5 && !isGameFinished && !isDying) {
        if (elapsedTimeSec > 0 && elapsedTimeSec !== lastDrainSec) {
            lastDrainSec = elapsedTimeSec;
            deductPlayerHP(3);
        }
    }

    if (!isDying && !isGameFinished && !cheats.invisibility) {
        for (let crab of crabs) {
            if (crab.waitTimer > 0) continue;
            if (crab.isDying) continue;

            if (player.r === crab.r && player.c === crab.c) {
                if (waterHeight > 0.1) {
                    if (!player.isGrabbed) {
                        let canGrab = false;
                        if (crab.facing === 'front' && player.r >= crab.r) canGrab = true;
                        else if (crab.facing === 'back' && player.r <= crab.r) canGrab = true;
                        else if (crab.facing === 'left' && player.c <= crab.c) canGrab = true;
                        else if (crab.facing === 'right' && player.c >= crab.c) canGrab = true;
                        else if (player.r === crab.r && player.c === crab.c) canGrab = true;

                        if (canGrab) {
                            crab.isMoving = false;
                            crab.waitTimer = 999;
                            triggerCrabGrab(crab);
                            break;
                        }
                    }
                } else {
                    deductPlayerHP(10);
                    crab.waitTimer = 60; 
                    crab.isMoving = false;
                    break;
                }
            }
        }
    }

    for (let crab of crabs) {
        if (crab.waitTimer > 0) {
            crab.waitTimer--;
            continue;
        }

        if (crab.isMoving) {
            crab.moveProgress += 0.01;
            
            let startX = crab.fromC * TILE_SIZE + TILE_SIZE / 2;
            let startY = crab.fromR * TILE_SIZE + TILE_SIZE / 2;
            let targetX = crab.toC * TILE_SIZE + TILE_SIZE / 2;
            let targetY = crab.toR * TILE_SIZE + TILE_SIZE / 2;
            
            crab.x = startX + (targetX - startX) * crab.moveProgress;
            crab.y = startY + (targetY - startY) * crab.moveProgress;

            if (crab.moveProgress >= 1.0) {
                crab.moveProgress = 1.0;
                crab.isMoving = false;
                crab.r = crab.toR;
                crab.c = crab.toC;
                crab.blocksWalked++;

                let nextR = crab.r + crab.dr;
                let nextC = crab.c + crab.dc;
                let nextCell = checkGridBounds(nextR, nextC) ? grid[nextR][nextC] : -1;

                if (nextCell === 1 || nextCell === -1 || crab.blocksWalked >= 5) {
                    crab.dr = -crab.dr;
                    crab.dc = -crab.dc;
                    crab.blocksWalked = 0;
                    crab.waitTimer = 30;
                } else {
                    crab.fromR = crab.r;
                    crab.fromC = crab.c;
                    crab.toR = nextR;
                    crab.toC = nextC;
                    crab.isMoving = true;
                    crab.moveProgress = 0.0;
                }
            }
        } else {
            let nextR = crab.r + crab.dr;
            let nextC = crab.c + crab.dc;
            let nextCell = checkGridBounds(nextR, nextC) ? grid[nextR][nextC] : -1;

            if (nextCell === 1 || nextCell === -1 || crab.blocksWalked >= 5) {
                crab.dr = -crab.dr;
                crab.dc = -crab.dc;
                crab.blocksWalked = 0;
                crab.waitTimer = 30;
            } else {
                crab.fromR = crab.r;
                crab.fromC = crab.c;
                crab.toR = nextR;
                crab.toC = nextC;
                crab.isMoving = true;
                crab.moveProgress = 0.0;
            }
        }
    }
}

function updateSnakes() {
    if (currentLevel !== 3) return;

    if (!isGameFinished && !isDying) {
        let currentCellVal = checkGridBounds(player.r, player.c) ? grid[player.r][player.c] : 0;
        
        if (currentCellVal === 7) {
            player.isToxicSwimming = true;
            if (elapsedTimeSec > 0 && elapsedTimeSec !== lastDrainSec) {
                lastDrainSec = elapsedTimeSec;
                deductPlayerHP(10);
            }
        } else if (player.isToxicSwimming && currentCellVal === 0) {
            player.isToxicSwimming = false;
        }

        if (player.isPoisoned) {
            if (elapsedTimeSec > 0 && elapsedTimeSec !== lastDrainSec) {
                lastDrainSec = elapsedTimeSec;
                deductPlayerHP(2);
            }
        }
    }

    for (let snake of snakes) {
        if (snake.waitTimer > 0) {
            snake.waitTimer--;
            continue;
        }

        if (!isDying && !isGameFinished && !cheats.invisibility && player.r === snake.r 
            && player.c === snake.c && !snake.isDying) {
            if (!player.isPoisoned) {
                player.isPoisoned = true;
            }
        }

        if (snake.state === 'MOVING') {
            let nextX = snake.x + snake.dc * snake.speed * TILE_SIZE;
            let nextY = snake.y + snake.dr * snake.speed * TILE_SIZE;
            
            let nextR = Math.floor(nextY / TILE_SIZE);
            let nextC = Math.floor(nextX / TILE_SIZE);

            let cellVal = checkGridBounds(nextR, nextC) ? grid[nextR][nextC] : -1;

            if (cellVal === 1 || cellVal === -1 || cellVal === 5) {
                snake.state = 'TURNING';
                snake.turnFrameIndex = 6;
                snake.turnTimer = 0;
            } else {
                snake.x = nextX;
                snake.y = nextY;
                snake.r = nextR;
                snake.c = nextC;
                snake.distanceTraveled += snake.speed;

                if (snake.distanceTraveled >= snake.maxDistance) {
                    snake.distanceTraveled = snake.maxDistance;
                    snake.state = 'TURNING';
                    snake.turnFrameIndex = 6;
                    snake.turnTimer = 0;
                }
            }
        } else if (snake.state === 'TURNING') {
            snake.turnTimer++;
            if (snake.turnTimer % 8 === 0) {
                snake.turnFrameIndex++;
                if (snake.turnFrameIndex > 9) {
                    snake.dr = -snake.dr;
                    snake.dc = -snake.dc;
                    snake.distanceTraveled = 0;
                    snake.state = 'MOVING';
                }
            }
        }
    }

    let isAnyChestOpen = chests.some(ch => ch.isOpen);
    if (!isAnyChestOpen) {
        let nearbyChest = chests.find(ch => player.r === ch.r && player.c === ch.c && !ch.isOpen && !ch.promptDismissed);
        if (nearbyChest) {
            if (!activeModal) {
                showCustomModal({
                    title: "Wooden Chest",
                    message: "You stand before a sealed wooden chest.<br><br>Right-click the center button (◯) or press <b>Shift + Enter</b> to open the chest.",
                    isProximity: true,
                    buttons: [{ text: "Continue", bg: "linear-gradient(135deg, #4f46e5, #7c3aed)", callback: () => {} }],
                    onClose: () => { nearbyChest.promptDismissed = true; }
                });
            }
        } else {
            for (let ch of chests) {
                if (player.r !== ch.r || player.c !== ch.c) ch.promptDismissed = false;
            }
            if (activeModal && activeModal.dataset.isProximityModal === "true") {
                activeModal.remove();
                activeModal = null;
            }
        }
    }
}

function updateBats() {
    if (currentLevel !== 4) return;

    for (let bat of bats) {
        if (bat.isDying) continue;
        if (bat.attackCooldown > 0) bat.attackCooldown--;

        let iceState = checkGridBounds(bat.r, bat.c) ? frozenGrid[bat.r][bat.c] : 0;
        let cellVal = checkGridBounds(bat.r, bat.c) ? grid[bat.r][bat.c] : 0;

        const setOrthogonalDirectionTowardPlayer = (b) => {
            let dr = player.r - b.r;
            let dc = player.c - b.c;
            if (Math.abs(dr) >= Math.abs(dc)) {
                b.dr = Math.sign(dr);
                b.dc = 0;
            } else {
                b.dr = 0;
                b.dc = Math.sign(dc);
            }
            if (b.dr === 0 && b.dc === 0) b.dr = -1;
        };

        if (bat.state === 'HIBERNATING') {
            if (iceState === 0) {
                bat.state = 'FLYING';
                bat.distanceCovered = 0;
                grid[bat.r][bat.c] = 0; 
                
                if (activeFireball && activeFireball.active) {
                    bat.dr = activeFireball.dr;
                    bat.dc = activeFireball.dc;
                } else {
                    bat.dr = -1;
                    bat.dc = 0;
                }

                bat.r = Math.floor(bat.r);
                bat.c = Math.floor(bat.c);
                bat.x = bat.c * TILE_SIZE + TILE_SIZE / 2;
                bat.y = bat.r * TILE_SIZE + TILE_SIZE / 2;
            }
            continue;
        }

        if (bat.state === 'SLEEPING') {
            let distToPlayer = Math.max(Math.abs(player.r - bat.r), Math.abs(player.c - bat.c));
            let fireballNear = activeFireball && activeFireball.active && Math.max(Math.abs(activeFireball.r - bat.r), Math.abs(activeFireball.c - bat.c)) <= 1;

            if ((!cheats.invisibility && distToPlayer === 0) || fireballNear) {
                bat.state = 'FLYING';
                bat.distanceCovered = 0;
                if (cellVal === 7) grid[bat.r][bat.c] = 0;
                bat.x = bat.c * TILE_SIZE + TILE_SIZE / 2;
                bat.y = bat.r * TILE_SIZE + TILE_SIZE / 2;

                setOrthogonalDirectionTowardPlayer(bat);
            }
            continue;
        }

        if (bat.state === 'FLYING') {
            const isPassable = (r, c) => {
                if (!checkGridBounds(r, c)) return false;
                if (grid[r][c] === -1) return false;
                if (frozenGrid[r] && (frozenGrid[r][c] === 1 || frozenGrid[r][c] === 2)) return false;
                return true;
            };

            let nextR = bat.r + bat.dr;
            let nextC = bat.c + bat.dc;

            if (bat.distanceCovered >= bat.maxDistance || !isPassable(nextR, nextC)) {
                let currentIceState = checkGridBounds(bat.r, bat.c) ? frozenGrid[bat.r][bat.c] : 0;
                let currentCellVal = checkGridBounds(bat.r, bat.c) ? grid[bat.r][bat.c] : 0;

                if (bat.distanceCovered >= bat.minDistance && currentIceState === 0 && currentCellVal === 0) {
                    bat.state = 'SLEEPING';
                    bat.distanceCovered = 0;
                    grid[bat.r][bat.c] = 7; 
                    bat.x = bat.c * TILE_SIZE + TILE_SIZE / 2;
                    bat.y = bat.r * TILE_SIZE + TILE_SIZE / 2;
                } else {
                    let rightDr = bat.dc;
                    let rightDc = -bat.dr;
                    let leftDr = -bat.dc;
                    let leftDc = bat.dr;

                    if (isPassable(bat.r + rightDr, bat.c + rightDc)) {
                        bat.dr = rightDr;
                        bat.dc = rightDc;
                    } else if (isPassable(bat.r + leftDr, bat.c + leftDc)) {
                        bat.dr = leftDr;
                        bat.dc = leftDc;
                    } else {
                        if (bat.distanceCovered >= bat.minDistance && currentIceState === 0 && currentCellVal === 0) {
                            bat.state = 'SLEEPING';
                            bat.distanceCovered = 0;
                            grid[bat.r][bat.c] = 7;
                            bat.x = bat.c * TILE_SIZE + TILE_SIZE / 2;
                            bat.y = bat.r * TILE_SIZE + TILE_SIZE / 2;
                        } else {
                            bat.dr = -bat.dr;
                            bat.dc = -bat.dc;
                        }
                    }
                }
            } else {
                let nextX = bat.x + bat.dc * bat.speed * TILE_SIZE;
                let nextY = bat.y + bat.dr * bat.speed * TILE_SIZE;

                bat.x = nextX;
                bat.y = nextY;
                bat.r = Math.floor(bat.y / TILE_SIZE);
                bat.c = Math.floor(bat.x / TILE_SIZE);

                if (bat.dr !== 0) bat.x = bat.c * TILE_SIZE + TILE_SIZE / 2;
                if (bat.dc !== 0) bat.y = bat.r * TILE_SIZE + TILE_SIZE / 2;

                bat.distanceCovered += bat.speed;

                if (!isDying && !isGameFinished && !cheats.invisibility && player.r === bat.r && player.c === bat.c) {
                    if (bat.attackCooldown === 0) {
                        deductPlayerHP(5);
                        bat.attackCooldown = 60; 
                    }
                }
            }
        }
    }
}

function updatePlants() {
    if (currentLevel !== 5) return;

    for (let plant of plants) {
        if (plant.isDying) continue;

        let distR = Math.abs(player.r - plant.r);
        let distC = Math.abs(player.c - plant.c);
        let maxDist = Math.max(distR, distC);

        if (plant.calmTimer > 0) {
            plant.calmTimer--;
            if (plant.calmTimer === 0 && maxDist > 2) {
                plant.state = 'IDLE';
            }
        }

        if (maxDist <= 1) {
            if (plant.calmTimer === 0 && !cheats.invisibility) {
                if (plant.state !== 'ATTACKING') {
                    plant.state = 'ATTACKING';
                    plant.attackFrameIndex = 0;
                }

                if (frameCount % 6 === 0) {
                    plant.attackFrameIndex = (plant.attackFrameIndex || 0) + 1;
                    
                    if (plant.attackFrameIndex >= 6 && !player.isGrabbed && !isDying && !isGameFinished && activeEatenPlant === null) {
                        player.isGrabbed = true;
                        activeEatenPlant = plant;
                        grabPressCount = 0;
                        escapeSuccessfulTriggered = false;

                        setTimeout(() => {
                            if (activeEatenPlant === plant) {
                                let modalHtml = `
                                    <p>The Giant Flytrap has lunged forward and swallowed you whole!<br><br>
                                    <b>You are trapped inside its stomach and losing health!</b><br>
                                    Repeatedly press <b>S</b> or <b>Down Arrow</b> to break free (${REQUIRED_GRAG_PRESSES} times)!<br><br>
                                    Spins: <span id="grabPressCountText" style="color: #fbbf24; font-size: 18px; font-weight: bold;">0 / ${REQUIRED_GRAG_PRESSES}</span></p>
                                `;
                                showCustomModal({ title: "Swallowed!", message: modalHtml, buttons: [] });
                            }
                        }, 1000);
                    }
                }
            }
        } else if (maxDist <= 2) {
            if (plant.calmTimer === 0 && !cheats.invisibility) {
                plant.state = 'ACTIVE';
                plant.attackFrameIndex = 0;
            }
        } else {
            if (plant.state === 'ATTACKING' && activeEatenPlant !== plant) {
                plant.state = 'ACTIVE';
                plant.calmTimer = 300; 
                plant.attackFrameIndex = 0;
            } else if (plant.state === 'ACTIVE' && plant.calmTimer === 0) {
                plant.state = 'IDLE';
            }
        }
    }

    if (player.isGrabbed && activeEatenPlant !== null && !isDying && !isGameFinished) {
        if (elapsedTimeSec > 0 && elapsedTimeSec !== lastDrainSec) {
            lastDrainSec = elapsedTimeSec;
            deductPlayerHP(10);
        }
    }
}

function updateMinotaurs() {
    if (currentLevel !== 5 || cheats.disableMobs) return;

    const isPassable = (r, c) => checkGridBounds(r, c) && grid[r][c] !== -1 && grid[r][c] !== 1 && grid[r][c] !== 5;

    // Standard BFS for shortest path step
    const getNextOrthogonalStep = (startR, startC, targetR, targetC) => {
        if (startR === targetR && startC === targetC) return { dr: 0, dc: 0 };
        let queue = [{ r: startR, c: startC, path: [] }];
        let visited = new Set();
        visited.add(`${startR},${startC}`);
        let dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

        while (queue.length > 0) {
            let curr = queue.shift();
            if (curr.r === targetR && curr.c === targetC) {
                return curr.path.length > 0 ? curr.path[0] : { dr: 0, dc: 0 };
            }
            for (let d of dirs) {
                let nr = curr.r + d.dr;
                let nc = curr.c + d.dc;
                if (isPassable(nr, nc) && !visited.has(`${nr},${nc}`)) {
                    visited.add(`${nr},${nc}`);
                    queue.push({ r: nr, c: nc, path: [...curr.path, d] });
                }
            }
        }
        return { dr: 0, dc: 0 };
    };

    // Find a random passable tile within max steps using BFS flood-fill
    const getRandomPassableTileWithinSteps = (startR, startC, maxSteps) => {
        let reachableTiles = [];
        let queue = [{ r: startR, c: startC, dist: 0 }];
        let visited = new Set();
        visited.add(`${startR},${startC}`);
        let dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

        while (queue.length > 0) {
            let curr = queue.shift();
            if (curr.dist > 5 && curr.dist <= maxSteps) { // Minimum distance 5 so it actually goes somewhere
                reachableTiles.push({ r: curr.r, c: curr.c });
            }
            if (curr.dist < maxSteps) {
                for (let d of dirs) {
                    let nr = curr.r + d.dr;
                    let nc = curr.c + d.dc;
                    if (isPassable(nr, nc) && !visited.has(`${nr},${nc}`)) {
                        visited.add(`${nr},${nc}`);
                        queue.push({ r: nr, c: nc, dist: curr.dist + 1 });
                    }
                }
            }
        }
        if (reachableTiles.length === 0) return { r: startR, c: startC };
        return reachableTiles[Math.floor(Math.random() * reachableTiles.length)];
    };

    for (let minotaur of minotaurs) {
        if (minotaur.isDying) continue;

        // Initialize properties
        if (minotaur.targetR === undefined) minotaur.targetR = minotaur.r;
        if (minotaur.targetC === undefined) minotaur.targetC = minotaur.c;
        if (minotaur.dr === undefined) minotaur.dr = 0;
        if (minotaur.dc === undefined) minotaur.dc = 0;
        if (minotaur.outboundTarget === undefined) minotaur.outboundTarget = null;
        if (minotaur.pathHistory === undefined) minotaur.pathHistory = [];
        if (minotaur.isBacktracking === undefined) minotaur.isBacktracking = false;
        if (minotaur.interruptionPoint === undefined) minotaur.interruptionPoint = null;

        let chebyshevDist = Math.max(Math.abs(player.r - minotaur.r), Math.abs(player.c - minotaur.c));
        let moveSpeed = 2.0;

        // --- 1. MELEE ATTACK ---
        if (chebyshevDist <= 1 && !isDying && !isGameFinished && !cheats.invisibility) {
            minotaur.state = 'ATTACKING';
            deductPlayerHP(player.maxhp);
            continue;
        }

        // --- 2. SUB-TILE STEP TRANSITION ---
        if (minotaur.r !== minotaur.targetR || minotaur.c !== minotaur.targetC) {
            let targetX = minotaur.targetC * TILE_SIZE + TILE_SIZE / 2;
            let targetY = minotaur.targetR * TILE_SIZE + TILE_SIZE / 2;
            let dx = targetX - minotaur.x;
            let dy = targetY - minotaur.y;
            let dist = Math.hypot(dx, dy);

            if (dist > moveSpeed) {
                minotaur.x += (dx / dist) * moveSpeed;
                minotaur.y += (dy / dist) * moveSpeed;
            } else {
                let oldR = minotaur.r;
                let oldC = minotaur.c;
                minotaur.r = minotaur.targetR;
                minotaur.c = minotaur.targetC;
                minotaur.x = targetX;
                minotaur.y = targetY;

                // Record step history if patrolling normally (outbound)
                if (minotaur.state === 'IDLE' && !minotaur.isBacktracking && !minotaur.interruptionPoint) {
                    minotaur.pathHistory.push({ r: oldR, c: oldC });
                }
            }
            continue;
        }

        // --- 3. STATE MACHINE & BFS LOGIC ---

        // A. CHASING PLAYER (Triggered within range)
        if (chebyshevDist <= 3 && !cheats.invisibility) {
            if (minotaur.state !== 'CHASING') {
                // Save where we were interrupted before starting the chase!
                minotaur.interruptionPoint = { r: minotaur.r, c: minotaur.c };
            }
            minotaur.state = 'CHASING';
            minotaur.lastKnownPlayerR = player.r;
            minotaur.lastKnownPlayerC = player.c;

            let nextStep = getNextOrthogonalStep(minotaur.r, minotaur.c, player.r, player.c);
            if (nextStep.dr !== 0 || nextStep.dc !== 0) {
                minotaur.dr = nextStep.dr;
                minotaur.dc = nextStep.dc;
                minotaur.targetR = minotaur.r + nextStep.dr;
                minotaur.targetC = minotaur.c + nextStep.dc;
            }
            continue;
        }

        // B. POST-CHASE: RETURN TO INTERRUPTION POINT (X, Y)
        if (minotaur.state === 'CHASING' && chebyshevDist > 3) {
            if (minotaur.interruptionPoint) {
                // Use BFS to navigate back to the exact cell where the chase began
                if (minotaur.r !== minotaur.interruptionPoint.r || minotaur.c !== minotaur.interruptionPoint.c) {
                    let nextStep = getNextOrthogonalStep(minotaur.r, minotaur.c, minotaur.interruptionPoint.r, minotaur.interruptionPoint.c);
                    if (nextStep.dr !== 0 || nextStep.dc !== 0) {
                        minotaur.dr = nextStep.dr;
                        minotaur.dc = nextStep.dc;
                        minotaur.targetR = minotaur.r + nextStep.dr;
                        minotaur.targetC = minotaur.c + nextStep.dc;
                        continue;
                    }
                }
                // Successfully returned to (X, Y)! Clear interruption and resume patrol.
                minotaur.interruptionPoint = null;
            }
            minotaur.state = 'IDLE';
        }

        // C. NORMAL PATROL (Outbound & Inbound Backtracking)
        minotaur.state = 'CHASING'; // Keeps walk animation active

        if (minotaur.isBacktracking) {
            // INBOUND: Pop history stack to retrace steps back to spawn
            if (minotaur.pathHistory.length > 0) {
                let prevCell = minotaur.pathHistory.pop();
                minotaur.targetR = prevCell.r;
                minotaur.targetC = prevCell.c;
                minotaur.dr = minotaur.targetR - minotaur.r;
                minotaur.dc = minotaur.targetC - minotaur.c;
            } else {
                // Fully returned home! Reset for a fresh outbound journey.
                minotaur.isBacktracking = false;
                minotaur.outboundTarget = null;
            }
        } else {
            // OUTBOUND: Pick a random static target once, then use BFS to walk to it
            if (!minotaur.outboundTarget || (minotaur.r === minotaur.outboundTarget.r && minotaur.c === minotaur.outboundTarget.c)) {
                minotaur.outboundTarget = getRandomPassableTileWithinSteps(minotaur.spawnR, minotaur.spawnC, 35);
            }

            let nextStep = getNextOrthogonalStep(minotaur.r, minotaur.c, minotaur.outboundTarget.r, minotaur.outboundTarget.c);

            if (nextStep.dr !== 0 || nextStep.dc !== 0) {
                minotaur.dr = nextStep.dr;
                minotaur.dc = nextStep.dc;
                minotaur.targetR = minotaur.r + nextStep.dr;
                minotaur.targetC = minotaur.c + nextStep.dc;
            } else {
                // Reached the outbound target destination, now switch to inbound backtracking!
                minotaur.isBacktracking = true;
            }
        }
    }
}

function update() {
    updateIceAndBombAnimations();

    if (startTime && !isGameFinished) {
        elapsedTimeSec = Math.floor((Date.now() - startTime) / 1000);
    }

    if (player.isMoving) {
        let movementSpeed = 0.12;
        if (currentLevel === 2 && waterHeight >= 0.1) {
            movementSpeed *= 0.8;
        }

        player.moveProgress += movementSpeed;
        if (player.moveProgress >= 1.0) {
            player.moveProgress = 1.0;
            player.isMoving = false;
            
            player.x = player.c * TILE_SIZE + TILE_SIZE / 2;
            player.y = player.r * TILE_SIZE + TILE_SIZE / 2;
            
            visitedCells.add(`${player.r},${player.c}`);
            totalDistanceCovered += 1;
            trailPoints.push({ x: player.x, y: player.y });

            if (centerPos && currentLevel < 3) {
                let isOnCenter = (player.r === centerPos.r && player.c === centerPos.c);
                let needsInteraction = (currentLevel === 1 && !player.hasWizardHat && grid[centerPos.r][centerPos.c] === 4) ||
                    (currentLevel === 2 && (!player.hasWizardStaff || level2State < 2) && grid[centerPos.r][centerPos.c] === 4);

                if (isOnCenter && needsInteraction) {
                    if (!activeModal) {
                        let title = (currentLevel === 1) ? "Ancient Altar" : "Mysterious Lever";
                        let msg = (currentLevel === 1) 
                            ? "You stand before the altar of arcane knowledge.<br><br>Right-click the center button (◯) or press <b>Shift + Enter</b> to claim your hat." 
                            : "You stand before a mysterious heavy lever.<br><br>Right-click the center button (◯) or press <b>Shift + Enter</b> to interact.";
                        showCustomModal({ title, message: msg, isProximity: true });
                    }
                } else {
                    if (activeModal && activeModal.dataset.isProximityModal === "true") {
                        activeModal.remove();
                        activeModal = null;
                    }
                }
            }

            if (grid[player.r][player.c] === 2 && !isGameFinished) {
                isGameFinished = true;
                fetchScore();
            }
        } else {
            let startX = player.fromC * TILE_SIZE + TILE_SIZE / 2;
            let startY = player.fromR * TILE_SIZE + TILE_SIZE / 2;
            let targetX = player.c * TILE_SIZE + TILE_SIZE / 2;
            let targetYCoord = player.toR * TILE_SIZE + TILE_SIZE / 2;
            
            player.x = startX + (targetX - startX) * player.moveProgress;
            player.y = startY + (targetYCoord - startY) * player.moveProgress;
        }
    }

    // --- LEVEL-SPECIFIC ENTITY & ENVIRONMENT UPDATES ---
    updateCrabs();
    updateSnakes();
    updateBats();
    updatePlants();
    updateMinotaurs();

    let openChest = chests.find(ch => ch.isOpen && (player.r !== ch.r || player.c !== ch.c));
    if (openChest) {
        openChest.isOpen = false;
        hideTooltip();
        if (activeModal && activeModal.dataset.isProximityModal === "true") {
            activeModal.remove();
            activeModal = null;
        }
    }

    // --- FIREBALL COLLISION & FLIGHT LOGIC ---
    if (activeFireball && activeFireball.active) {
        if (!activeFireball.hasHit) {
            activeFireball.progress += 0.15;
            
            let fromX = activeFireball.fromC * TILE_SIZE + TILE_SIZE / 2;
            let fromY = activeFireball.fromR * TILE_SIZE + TILE_SIZE / 2;
            let toX = activeFireball.toC * TILE_SIZE + TILE_SIZE / 2;
            let toY = activeFireball.toR * TILE_SIZE + TILE_SIZE / 2;

            activeFireball.x = fromX + (toX - fromX) * activeFireball.progress;
            activeFireball.y = fromY + (toY - fromY) * activeFireball.progress;

            if (activeFireball.progress >= 1.0) {
                activeFireball.progress = 0.0;
                activeFireball.r = activeFireball.toR;
                activeFireball.c = activeFireball.toC;
                activeFireball.distanceTraveled += 1;

                let currentCell = checkGridBounds(activeFireball.r, activeFireball.c) ? grid[activeFireball.r][activeFireball.c] : -1;
                let hitCrab = crabs.find(crab => !crab.isDying && crab.r === activeFireball.r && crab.c === activeFireball.c);
                let hitSnake = snakes.find(snake => !snake.isDying && snake.r === activeFireball.r && snake.c === activeFireball.c);
                let hitBat = (currentLevel === 4) ? bats.find(bat => !bat.isDying && bat.r === activeFireball.r && bat.c === activeFireball.c && bat.state !== 'HIBERNATING') : null;
                let hitBomb = (currentLevel === 4) ? level4Bombs.find(b => b.r === activeFireball.r && b.c === activeFireball.c && b.state === 'unlit') : null;
                let iceState = (currentLevel === 4 && checkGridBounds(activeFireball.r, activeFireball.c)) ? frozenGrid[activeFireball.r][activeFireball.c] : 0;
                let hitPlant = (currentLevel === 5) ? plants.find(p => !p.isDying && p.r === activeFireball.r && p.c === activeFireball.c) : null;
                let hitMinotaur = (currentLevel === 5) ? minotaurs.find(m => !m.isDying && m.r === activeFireball.r && m.c === activeFireball.c) : null;

                if (hitSnake) {
                    triggerSnakeHurt(hitSnake);
                    resolveFireballImpact();
                } else if (hitCrab) {
                    triggerCrabHurt(hitCrab);
                    resolveFireballImpact();
                } else if (hitBat) {
                    triggerBatHurt(hitBat);
                    resolveFireballImpact();
                } else if (hitBomb) {
                    triggerBombIgnition(hitBomb);
                    resolveFireballImpact();
                } else if (hitPlant) {
                    triggerPlantHurt(hitPlant);
                    resolveFireballImpact();
                } else if (hitMinotaur) {
                    triggerMinotaurHurt(hitMinotaur);
                    resolveFireballImpact();
                } else if (currentLevel === 4 && (iceState === 1 || iceState === 2)) {
                    triggerBreakIce(activeFireball.r, activeFireball.c);
                    resolveFireballImpact();
                } else if (currentCell === 1 || currentCell === 5 || currentCell === -1) {
                    resolveFireballImpact();
                } else if (activeFireball.distanceTraveled >= activeFireball.maxDistance) {
                    activeFireball.hasHit = true;
                    activeFireball.state = 'ashLight';
                    setTimeout(() => {
                        if (activeFireball) activeFireball.active = false;
                    }, 200);
                } else {
                    activeFireball.fromR = activeFireball.r;
                    activeFireball.fromC = activeFireball.c;
                    activeFireball.toR = activeFireball.r + activeFireball.dr;
                    activeFireball.toC = activeFireball.c + activeFireball.dc;
                }
            }
        }
    }

    let angleDiff = player.targetAngle - player.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    player.angle += angleDiff * 0.2;

    let camDiff = player.angle - camAngle;
    while (camDiff > Math.PI) camDiff -= Math.PI * 2;
    while (camDiff < -Math.PI) camDiff += Math.PI * 2;
    camAngle += camDiff * 0.15;

    updateUI();
}

function handleMoveForward() {
    if (isGameFinished || player.isMoving || player.isGrabbed) return;

    let angleDiff = player.targetAngle - player.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) < 0.1) {
        player.angle = player.targetAngle;
    } else {
        return;
    }

    if (!startTime) startTime = Date.now();

    let deg = Math.round(((player.angle * 180) / Math.PI) / 90) * 90 % 360;
    if (deg < 0) deg += 360;

    let dr = 0, dc = 0;
    if (deg === 90) dr = -1;
    else if (deg === 0 || deg === 360) dc = 1;  
    else if (deg === 270) dr = 1;  
    else if (deg === 180) dc = -1; 

    let nextR = player.r + dr;
    let nextC = player.c + dc;

    if (checkGridBounds(nextR, nextC)) {
        let cellTarget = grid[nextR][nextC];
        let isIceBlocked = (currentLevel === 4 && frozenGrid[nextR] && frozenGrid[nextR][nextC] > 0);
        
        if (cellTarget !== 1 && cellTarget !== 5 && cellTarget !== -1 && !isIceBlocked) {
            player.fromR = player.r;
            player.fromC = player.c;
            player.toR = nextR;
            player.toC = nextC;
            player.isMoving = true;
            player.moveProgress = 0.0;

            player.r = nextR;
            player.c = nextC;

            updatePlayerSightLine();
        }
    }
}

function handleTurn(direction) {
    if (isGameFinished || player.isMoving) return;
    if (!startTime) startTime = Date.now();

    if (direction === 'LEFT') player.targetAngle += Math.PI / 2;
    else if (direction === 'RIGHT') player.targetAngle -= Math.PI / 2;
    else if (direction === 'AROUND') player.targetAngle += Math.PI;

    updatePlayerSightLine();
}

btnUp.addEventListener('click', () => handleMoveForward());
btnLeft.addEventListener('click', () => handleTurn('LEFT'));
btnRight.addEventListener('click', () => handleTurn('RIGHT'));
btnDown.addEventListener('click', () => handleTurn('AROUND'));

let playerSightLineSet = new Set();

function updatePlayerSightLine() {
    playerSightLineSet.clear();

    if (currentLevel !== 4) return;

    // Scan all tiles within 3 steps in every direction around the player
    for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
            if (dr === 0 && dc === 0) continue;
            let dist = Math.max(Math.abs(dr), Math.abs(dc)); // Chebyshev distance (square radius)
            if (dist <= 3) {
                let checkR = player.r + dr;
                let checkC = player.c + dc;
                if (checkGridBounds(checkR, checkC)) {
                    let alpha = 0.3; // Distance 1
                    if (dist === 2) alpha = 0.55;
                    else if (dist === 3) alpha = 0.8;

                    playerSightLineSet.add(`${checkR},${checkC}:${alpha}`);
                }
            }
        }
    }
}

// ==========================================
// --- RENDER PIPELINES ---
// ==========================================

function pushFloorAndCeiling(renderList, wx, wy, half, h, centerProj, distSq, floorType, ceilingType = 'standard_ceiling', floorHeightOffset = 0) {
    let p1 = project3D(wx - half, wy - half, floorHeightOffset);
    let p2 = project3D(wx + half, wy - half, floorHeightOffset);
    let p3 = project3D(wx + half, wy + half, floorHeightOffset);
    let p4 = project3D(wx - half, wy + half, floorHeightOffset);

    let t1 = project3D(wx - half, wy - half, h);
    let t2 = project3D(wx + half, wy - half, h);
    let t3 = project3D(wx + half, wy + half, h);
    let t4 = project3D(wx - half, wy + half, h);

    if (p1 && p2 && p3 && p4 && t1 && t2 && t3 && t4) {
        renderList.push({
            type: floorType, depth: centerProj.rotZ, dist: distSq, isBehind: false, p1, p2, p3, p4
        });
        renderList.push({
            type: ceilingType, depth: centerProj.rotZ, dist: distSq, isBehind: false, p1: t1, p2: t2, p3: t3, p4: t4
        });
    }
}

function drawClippedImage(ctx, img, p1, p2, t1, t2) {
    if (!img || !img.complete || img.naturalWidth <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.closePath();
    ctx.clip();

    let minX = Math.min(p1.x, p2.x, t1.x, t2.x);
    let minY = Math.min(p1.y, p2.y, t1.y, t2.y);
    let maxX = Math.max(p1.x, p2.x, t1.x, t2.x);
    let maxY = Math.max(p1.y, p2.y, t1.y, t2.y);

    ctx.drawImage(img, minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
}

function draw3DView_level1() {
    if (!grid.length) return;

    let renderList = [];

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            let cellType = grid[r][c];
            if (cellType === undefined || cellType === null) continue;

            let wx = c * TILE_SIZE + TILE_SIZE / 2;
            let wy = r * TILE_SIZE + TILE_SIZE / 2;
            let half = TILE_SIZE / 2;
            let h = TILE_SIZE * WALL_HEIGHT_UNITS;
            
            let centerProj = project3D(wx, wy, 0);
            if (!centerProj) continue;

            let distSq = (wx - player.x) * (wx - player.x) + (wy - player.y) * (wy - player.y);
            let isBehind = centerProj.rotZ < 0;

            let floorType = (cellType === 3) ? 'start_floor' : ((cellType === 2) ? 'exit_floor' : 'standard_floor');
            pushFloorAndCeiling(renderList, wx, wy, half, h, centerProj, distSq, floorType, 'standard_ceiling');

            if (cellType === 4) {
                let bobOffset = Math.sin(frameCount * 0.1) * 6;
                let pCenter = project3D(wx, wy, TILE_SIZE * 0.3 + bobOffset);
                if (pCenter) {
                    renderList.push({
                        type: 'altar_hat',
                        depth: centerProj.rotZ, dist: distSq, isBehind, pCenter
                    });
                }
            }

            if (centerProj.rotZ >= -TILE_SIZE && (cellType === 1 || cellType === 5 || cellType === -1)) {
                let isOpen = (row, col) => {
                    if (!checkGridBounds(row, col)) return false;
                    let val = grid[row][col];
                    if (cellType === -1) {
                        return val === 0 || val === 2 || val === 3 || val === 4 || val === -1;
                    }
                    return val === 0 || val === 2 || val === 3 || val === 4;
                };

                let widthFactor = (cellType === -1) ? 1.0 : 0.7;
                let inset = half * (1.0 - widthFactor);
                let bHalf = half - inset;

                let pNW, pNE, pSE, pSW, tNW, tNE, tSE, tSW;

                if (cellType === 5) {
                    pNW = project3D(wx - bHalf, wy - half, 0);
                    pNE = project3D(wx + bHalf, wy - half, 0);
                    pSE = project3D(wx + bHalf, wy + half, 0);
                    pSW = project3D(wx - bHalf, wy + half, 0);
                    tNW = project3D(wx - bHalf, wy - half, h);
                    tNE = project3D(wx + bHalf, wy - half, h);
                    tSE = project3D(wx + bHalf, wy + half, h);
                    tSW = project3D(wx - bHalf, wy + half, h);
                } else {
                    pNW = project3D(wx - half, wy - bHalf, 0);
                    pNE = project3D(wx + half, wy - bHalf, 0);
                    pSE = project3D(wx + half, wy + bHalf, 0);
                    pSW = project3D(wx - half, wy + bHalf, 0);
                    tNW = project3D(wx - half, wy - bHalf, h);
                    tNE = project3D(wx + half, wy - bHalf, h);
                    tSE = project3D(wx + half, wy + bHalf, h);
                    tSW = project3D(wx - half, wy + bHalf, h);
                }

                let addFace = (faceType, faceCenter, p1, p2, t1, t2, cellR, cellC, neighborVal) => {
                    if (faceCenter && faceCenter.rotZ > -TILE_SIZE && p1 && p2 && t1 && t2) {
                        let isCorner = false;
                        if (faceType === 'outer_wall') {
                            isCorner = (neighborVal === -1 || neighborVal === undefined || neighborVal === null);
                        }
                        renderList.push({
                            type: faceType, depth: faceCenter.rotZ, dist: distSq, isBehind,
                            realP1: p1, realP2: p2, realT1: t1, realT2: t2, cellR: cellR, cellC: cellC, isCorner: isCorner
                        });
                    }
                };

                if (isOpen(r - 1, c)) {
                    let faceCenter = project3D(wx, wy - half, h / 2);
                    let neighborVal = (r - 1 >= 0) ? grid[r - 1][c] : -1;
                    let faceType = (cellType === -1) ? 'outer_wall' : (cellType === 5 ? 'maze_wall_side' : 'maze_wall_face');
                    addFace(faceType, faceCenter, pNW, pNE, tNW, tNE, r, c, neighborVal);
                }
                if (isOpen(r + 1, c)) {
                    let faceCenter = project3D(wx, wy + half, h / 2);
                    let neighborVal = (r + 1 < grid.length) ? grid[r + 1][c] : -1;
                    let faceType = (cellType === -1) ? 'outer_wall' : (cellType === 5 ? 'maze_wall_side' : 'maze_wall_face');
                    addFace(faceType, faceCenter, pSE, pSW, tSE, tSW, r, c, neighborVal);
                }
                if (isOpen(r, c - 1)) {
                    let faceCenter = project3D(wx - half, wy, h / 2);
                    let neighborVal = (c - 1 >= 0) ? grid[r][c - 1] : -1;
                    let faceType = (cellType === -1) ? 'outer_wall' : (cellType === 5 ? 'maze_wall_face' : 'maze_wall_side');
                    addFace(faceType, faceCenter, pSW, pNW, tSW, tNW, r, c, neighborVal);
                }
                if (isOpen(r, c + 1)) {
                    let faceCenter = project3D(wx + half, wy, h / 2);
                    let neighborVal = (c + 1 < grid[0].length) ? grid[r][c + 1] : -1;
                    let faceType = (cellType === -1) ? 'outer_wall' : (cellType === 5 ? 'maze_wall_face' : 'maze_wall_side');
                    addFace(faceType, faceCenter, pNE, pSE, tNE, tSE, r, c, neighborVal);
                }
            }
        }
    }

    renderList.sort((a, b) => b.depth - a.depth);

    for (let item of renderList) {
        ctx.globalAlpha = (item.isBehind && !player.isGrabbed) ? 0.5 : 1.0;

        if (item.type === 'standard_floor') {
            ctx.fillStyle = '#c89d67';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#8c5f32';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'standard_ceiling') {
            ctx.fillStyle = '#231005';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#0a0301';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'exit_floor') {
            ctx.save();
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'start_floor') {
            ctx.save();
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fb7185';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'outer_wall') {
            let img = item.isCorner ? libraryEnvImages.outerWallCorner : libraryEnvImages.outerWall;
            if (img && img.complete && img.naturalWidth > 0) {
                drawClippedImage(ctx, img, item.realP1, item.realP2, item.realT1, item.realT2);
            } else {
                ctx.fillStyle = '#4a250c';
                ctx.beginPath();
                ctx.moveTo(item.realP1.x, item.realP1.y);
                ctx.lineTo(item.realP2.x, item.realP2.y);
                ctx.lineTo(item.realT2.x, item.realT2.y);
                ctx.lineTo(item.realT1.x, item.realT1.y);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#2d1506';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        } else if (item.type === 'maze_wall_side') {
            drawClippedImage(ctx, bookshelfImages.side, item.realP1, item.realP2, item.realT1, item.realT2);
        } else if (item.type === 'maze_wall_face') {
            let variantIdx = bookshelfVariantCache[`${item.cellR},${item.cellC}`] || 0;
            drawClippedImage(ctx, bookshelfImages.faces[variantIdx], item.realP1, item.realP2, item.realT1, item.realT2);
        } else if (item.type === 'altar_hat') {
            ctx.save();
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 15;
            
            let imgWidth = item.pCenter.scale * 60;
            let imgHeight = item.pCenter.scale * 60;
            let hatImg = wizardHatImages.front;

            if (hatImg && hatImg.complete && hatImg.naturalWidth > 0) {
                ctx.drawImage(
                    hatImg,
                    item.pCenter.x - imgWidth / 2,
                    item.pCenter.y - imgHeight / 2,
                    imgWidth,
                    imgHeight
                );
            }
            ctx.restore();
        }
    }
    ctx.globalAlpha = 1.0;
}

function draw3DView_level2() {
    if (!grid.length) return;

    let renderList = [];

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            let cellType = grid[r][c];
            if (cellType === undefined || cellType === null) continue;

            let wx = c * TILE_SIZE + TILE_SIZE / 2;
            let wy = r * TILE_SIZE + TILE_SIZE / 2;
            let half = TILE_SIZE / 2;
            let h = TILE_SIZE * WALL_HEIGHT_UNITS; 
            
            let centerProj = project3D(wx, wy, 0);
            if (!centerProj) continue;

            let distSq = (wx - player.x) * (wx - player.x) + (wy - player.y) * (wy - player.y);
            let isBehind = centerProj.rotZ < 0;

            let floorType = (cellType === 3) ? 'start_floor' : ((cellType === 2) ? 'exit_floor' : 'cave_floor');
            pushFloorAndCeiling(renderList, wx, wy, half, h, centerProj, distSq, floorType, 'cave_ceiling');

            if (cellType === 4 && level2State < 2) {
                let pBase = project3D(wx, wy, 0);
                if (pBase) {
                    renderList.push({
                        type: 'asset_lever',
                        depth: centerProj.rotZ, dist: distSq, isBehind, pBase
                    });
                }
            }

            if (centerProj.rotZ >= -TILE_SIZE && (cellType === 1 || cellType === -1)) {
                let pNW = project3D(wx - half, wy - half, 0);
                let pNE = project3D(wx + half, wy - half, 0);
                let pSE = project3D(wx + half, wy + half, 0);
                let pSW = project3D(wx - half, wy + half, 0);
                let tNW = project3D(wx - half, wy - half, h);
                let tNE = project3D(wx + half, wy - half, h);
                let tSE = project3D(wx + half, wy + half, h);
                let tSW = project3D(wx - half, wy + half, h);

                if (cellType === 1) {
                    let coralData = coralVariantCache[`${r},${c}`] || { family: 'green', version: 1 };
                    let coralImg = getCoralImage(coralData.family, coralData.version);

                    let coralHalf = TILE_SIZE * 0.85;
                    let coralH = TILE_SIZE * 1.8;

                    let cp1 = project3D(wx - coralHalf, wy, 0);
                    let cp2 = project3D(wx + coralHalf, wy, 0);
                    let ct2 = project3D(wx + coralHalf, wy, coralH);
                    let ct1 = project3D(wx - coralHalf, wy, coralH);
                    let cCenter1 = project3D(wx, wy, coralH / 2);

                    let cs1 = project3D(wx, wy - coralHalf, 0);
                    let cs2 = project3D(wx, wy + coralHalf, 0);
                    let cst2 = project3D(wx, wy + coralHalf, coralH);
                    let cst1 = project3D(wx, wy - coralHalf, coralH);
                    let cCenter2 = project3D(wx, wy, coralH / 2);

                    if (cCenter1 && cp1 && cp2 && ct1 && ct2) {
                        renderList.push({
                            type: 'coral_intersection_wall',
                            depth: cCenter1.rotZ,
                            texture: coralImg,
                            p1: cp1, p2: cp2, t1: ct1, t2: ct2, isBehind
                        });
                    }
                    if (cCenter2 && cs1 && cs2 && cst1 && cst2) {
                        renderList.push({
                            type: 'coral_intersection_wall',
                            depth: cCenter2.rotZ,
                            texture: coralImg,
                            p1: cs1, p2: cs2, t1: cst1, t2: cst2, isBehind
                        });
                    }
                } else if (cellType === -1) {
                    let addOuterFace = (faceCenter, p1, p2, t1, t2, neighborR, neighborC, faceIdx) => {
                        if (faceCenter && faceCenter.rotZ > -TILE_SIZE && p1 && p2 && t1 && t2) {
                            let wallType = 'stone_outer_wall';
                            let templateIdx = 0;

                            let neighborVal = checkGridBounds(neighborR, neighborC) ? grid[neighborR][neighborC] : -1;
                            if (neighborVal !== -1) {
                                wallType = 'stone_brick_wall';
                                templateIdx = (r + c + faceIdx) % 4;
                            }

                            renderList.push({
                                type: wallType, depth: faceCenter.rotZ, dist: distSq, isBehind,
                                realP1: p1, realP2: p2, realT1: t1, realT2: t2, templateIdx: templateIdx
                            });
                        }
                    };

                    addOuterFace(project3D(wx, wy - half, h / 2), pNW, pNE, tNW, tNE, r - 1, c, 0);
                    addOuterFace(project3D(wx, wy + half, h / 2), pSE, pSW, tSE, tSW, r + 1, c, 1);
                    addOuterFace(project3D(wx - half, wy, h / 2), pSW, pNW, tSW, tNW, r, c - 1, 2);
                    addOuterFace(project3D(wx + half, wy, h / 2), pNE, pSE, tNE, tSE, r, c + 1, 3);
                }
            }
        }
    }

    if (currentLevel === 2) {
        for (let crab of crabs) {
            let proj = project3D(crab.x, crab.y, 0);
            if (proj) {
                let distSq = (crab.x - player.x) * (crab.x - player.x) + (crab.y - player.y) * (crab.y - player.y);
                renderList.push({
                    type: 'crab',
                    depth: proj.rotZ,
                    dist: distSq,
                    isBehind: proj.rotZ < 0,
                    proj: proj,
                    crab: crab
                });
            }
        }
    }

    renderList.sort((a, b) => b.depth - a.depth);

    for (let item of renderList) {
        ctx.globalAlpha = (item.isBehind && !player.isGrabbed) ? 0.4 : 1.0;

        if (item.type === 'cave_floor') {
            ctx.fillStyle = '#102336';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#091622';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'cave_ceiling') {
            ctx.fillStyle = '#070c14';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#030509';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'exit_floor') {
            ctx.save();
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'start_floor') {
            ctx.save();
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fb7185';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'stone_outer_wall') {
            drawClippedImage(ctx, underwaterWallAssets.outerWall, item.realP1, item.realP2, item.realT1, item.realT2);
        } else if (item.type === 'stone_brick_wall') {
            drawClippedImage(ctx, stoneWallTemplates[item.templateIdx || 0], item.realP1, item.realP2, item.realT1, item.realT2);
        } else if (item.type === 'coral_intersection_wall') {
            drawClippedImage(ctx, item.texture, item.p1, item.p2, item.t1, item.t2);
        } else if (item.type === 'asset_lever') {
            let pBase = item.pBase;
            if (pBase) {
                ctx.save();
                let leverImg = (level2State >= 1) ? wizardStaffAssets.levers.back : wizardStaffAssets.levers.front;

                let imgW = pBase.scale * 70;
                let imgH = pBase.scale * 90;

                if (leverImg && leverImg.complete && leverImg.naturalWidth > 0) {
                    ctx.drawImage(
                        leverImg,
                        pBase.x - imgW / 2,
                        pBase.y - imgH,
                        imgW,
                        imgH
                    );
                }
                ctx.restore();
            }
        } else if (item.type === 'crab') {
            draw_crab(item.crab);
        }
    }

    if (currentLevel === 2 && waterHeight > 0) {
        let waterRatio = waterHeight / 3.0;
        let cutoffY = canvas.height * (1.0 - waterRatio * 0.6);

        let waveOffset = Math.sin(frameCount * 0.05) * 6;
        ctx.save();
        ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
        ctx.fillRect(0, cutoffY + waveOffset, canvas.width, canvas.height - cutoffY);
        ctx.restore();
    }

    ctx.globalAlpha = 1.0;
}

function draw3DView_level3() {
    if (!grid.length) return;

    let renderList = [];

    let isExposed = (r, c, side) => {
        if (!checkGridBounds(r, c)) return false;
        let cellVal = grid[r][c];
        if (cellVal !== 1 && cellVal !== 5) return false;

        let nr = r, nc = c;
        if (side === 'N') nr--;
        else if (side === 'S') nr++;
        else if (side === 'W') nc--;
        else if (side === 'E') nc++;

        if (!checkGridBounds(nr, nc)) return false;
        let neighbor = grid[nr][nc];
        return (neighbor === 0 || neighbor === 2 || neighbor === 3 || neighbor === 6 || neighbor === 7 || neighbor === 4);
    };

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            let cellType = grid[r][c];
            if (cellType === undefined || cellType === null) continue;

            let wx = c * TILE_SIZE + TILE_SIZE / 2;
            let wy = r * TILE_SIZE + TILE_SIZE / 2;
            let half = TILE_SIZE / 2;
            let h = TILE_SIZE * WALL_HEIGHT_UNITS;

            let centerProj = project3D(wx, wy, 0);
            if (!centerProj) continue;

            let distSq = (wx - player.x) * (wx - player.x) + (wy - player.y) * (wy - player.y);                
            let isBehind = centerProj.rotZ < 0;

            let floorHeightOffset = (cellType === 7) ? -25 : 0;
            let floorType = (cellType === 7) ? 'toxic_pit_floor' : ((cellType === 3) ? 'start_floor' : ((cellType === 2) ? 'exit_floor' : 'sewer_floor'));
            pushFloorAndCeiling(renderList, wx, wy, half, h, centerProj, distSq, floorType, 'sewer_ceiling', floorHeightOffset);

            if (centerProj.rotZ >= -TILE_SIZE && (cellType === 1 || cellType === 5 || cellType === -1)) {
                let widthFactor = 1.0;
                let inset = half * (1.0 - widthFactor);
                let bHalf = half - inset;

                let pNW, pNE, pSE, pSW, tNW, tNE, tSE, tSW;

                if (cellType === 1) {
                    pNW = project3D(wx - half, wy - bHalf, 0);
                    pNE = project3D(wx + half, wy - bHalf, 0);
                    pSE = project3D(wx + half, wy + bHalf, 0);
                    pSW = project3D(wx - half, wy + bHalf, 0);
                    tNW = project3D(wx - half, wy - bHalf, h);
                    tNE = project3D(wx + half, wy - bHalf, h);
                    tSE = project3D(wx + half, wy + bHalf, h);
                    tSW = project3D(wx - half, wy + bHalf, h);
                } else {
                    pNW = project3D(wx - half, wy - half, 0);
                    pNE = project3D(wx + half, wy - half, 0);
                    pSE = project3D(wx + half, wy + half, 0);
                    pSW = project3D(wx - half, wy + half, 0);
                    tNW = project3D(wx - half, wy - half, h);
                    tNE = project3D(wx + half, wy - half, h);
                    tSE = project3D(wx + half, wy + half, h);
                    tSW = project3D(wx - half, wy + half, h);
                }

                let addFace = (side, faceCenter, realP1, realP2, realT1, realT2) => {
                    if (!faceCenter || faceCenter.rotZ <= -TILE_SIZE || !realP1 || !realP2 || !realT1 || !realT2) return;

                    if (cellType === -1 || !isExposed(r, c, side)) {
                        renderList.push({
                            type: 'sewer_outer_wall', depth: faceCenter.rotZ, dist: distSq, isBehind,
                            realP1, realP2, realT1, realT2
                        });
                    } else {
                        let variantIdx = sewerWallVariantCache[`${r},${c}`] || 0;
                        let img = sewerAssets.walls[variantIdx];
                        renderList.push({
                            type: 'sewer_wall_variant', depth: faceCenter.rotZ, dist: distSq, isBehind,
                            realP1, realP2, realT1, realT2, img
                        });
                    }
                };

                addFace('N', project3D(wx, wy - half, h / 2), pNW, pNE, tNW, tNE);
                addFace('S', project3D(wx, wy + half, h / 2), pSE, pSW, tSE, tSW);
                addFace('W', project3D(wx - half, wy, h / 2), pSW, pNW, tSW, tNW);
                addFace('E', project3D(wx + half, wy, h / 2), pNE, pSE, tNE, tSE);
            }
        }
    }

    if (currentLevel === 3) {
        for (let snake of snakes) {
            let proj = project3D(snake.x, snake.y, 10);
            if (proj) {
                let distSq = (snake.x - player.x) * (snake.x - player.x) + (snake.y - player.y) * (snake.y - player.y);
                renderList.push({
                    type: 'snake',
                    depth: proj.rotZ,
                    dist: distSq,
                    isBehind: proj.rotZ < 0,
                    proj: proj,
                    snake: snake
                });
            }
        }

        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (grid[r][c] === 4) {
                    let wx = c * TILE_SIZE + TILE_SIZE / 2;
                    let wy = r * TILE_SIZE + TILE_SIZE / 2;
                    let proj = project3D(wx, wy, 0);
                    if (proj) {
                        let distSq = (wx - player.x) * (wx - player.x) + (wy - player.y) * (wy - player.y);
                        let chestObj = chests.find(ch => ch.r === r && ch.c === c);
                        let isChestOpen = chestObj ? chestObj.isOpen : false;
                        let chestImg = isChestOpen ? chestAssets.open : chestAssets.close;

                        renderList.push({
                            type: 'chest',
                            depth: proj.rotZ,
                            dist: distSq,
                            isBehind: proj.rotZ < 0,
                            pChest: proj,
                            texture: chestImg
                        });
                    }
                }
            }
        }
    }

    renderList.sort((a, b) => b.depth - a.depth);

    for (let item of renderList) {
        ctx.globalAlpha = (item.isBehind && !player.isGrabbed) ? 0.5 : 1.0;

        if (item.type === 'sewer_floor') {
            ctx.fillStyle = '#15171c';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'toxic_pit_floor') {
            ctx.fillStyle = '#4C8A38';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
        } else if (item.type === 'sewer_ceiling') {
            ctx.fillStyle = '#070c14';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#030509';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'exit_floor') {
            ctx.save();
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'start_floor') {
            ctx.save();
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fb7185';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'sewer_outer_wall' || item.type === 'sewer_wall_variant') {
            let img = (item.type === 'sewer_outer_wall') ? sewerAssets.outerWall : item.img;
            drawClippedImage(ctx, img, item.realP1, item.realP2, item.realT1, item.realT2);
        } else if (item.type === 'snake') {
            draw_snake(item.snake);
        } else if (item.type === 'chest') {
            ctx.save();
            let imgW = item.pChest.scale * 60;
            let imgH = item.pChest.scale * 60;
            if (item.texture && item.texture.complete && item.texture.naturalWidth > 0) {
                ctx.drawImage(item.texture, item.pChest.x - imgW / 2, item.pChest.y - imgH / 2, imgW, imgH);
            }
            ctx.restore();
        }
    }

    ctx.globalAlpha = 1.0;
}

function draw3DView_level4() {
    if (!grid.length) return;

    let renderList = [];

    let isExposed = (r, c, side) => {
        let nr = r, nc = c;
        if (side === 'N') nr--;
        else if (side === 'S') nr++;
        else if (side === 'W') nc--;
        else if (side === 'E') nc++;

        if (!checkGridBounds(nr, nc)) return false;
        let neighborVal = grid[nr][nc];
        if (neighborVal === -1) return false;
        return true;
    };       

    // --- OPTIMIZATION: Bounding Box Culling ---
    // Restricts the render loops to a local viewing radius around the player.
    let renderRadius = 12;
    let minR = Math.max(0, player.r - renderRadius);
    let maxR = Math.min(grid.length - 1, player.r + renderRadius);
    let minC = Math.max(0, player.c - renderRadius);
    let maxC = Math.min(grid[0].length - 1, player.c + renderRadius);

    for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
            let cellType = grid[r][c];
            if (cellType === undefined || cellType === null) continue;

            let wx = c * TILE_SIZE + TILE_SIZE / 2;
            let wy = r * TILE_SIZE + TILE_SIZE / 2;
            let half = TILE_SIZE / 2;
            let h = TILE_SIZE * WALL_HEIGHT_UNITS;
            
            let centerProj = project3D(wx, wy, 0);
            if (!centerProj) continue;

            let distSq = (wx - player.x) * (wx - player.x) + (wy - player.y) * (wy - player.y);
            let isBehind = centerProj.rotZ < 0;

            let floorType = (cellType === 3) ? 'start_floor' : ((cellType === 2) ? 'exit_floor' : 'glacial_floor');
            pushFloorAndCeiling(renderList, wx, wy, half, h, centerProj, distSq, floorType, 'glacial_ceiling');

            if (cellType === 4) {
                let pChest = project3D(wx, wy, 0);
                if (pChest) {
                    let chestObj = chests.find(ch => ch.r === r && ch.c === c);
                    let isChestOpen = chestObj ? chestObj.isOpen : false;
                    let chestImg = isChestOpen ? chestAssets.open : chestAssets.close;

                    renderList.push({
                        type: 'glacial_chest',
                        depth: centerProj.rotZ, dist: distSq, isBehind, pChest, texture: chestImg
                    });
                }
            }

            if (cellType === 6) {
                for (let bomb of level4Bombs) {
                    if (!bomb.active) continue;
                    let pBomb = project3D(bomb.x, bomb.y, 0);
                    if (pBomb) {
                        let bombDistSq = (bomb.x - player.x) * (bomb.x - player.x) + (bomb.y - player.y) * (bomb.y - player.y);
                        renderList.push({
                            type: 'barrel_bomb',
                            depth: pBomb.rotZ, dist: bombDistSq, isBehind: pBomb.rotZ < 0, pBomb: pBomb, bomb: bomb
                        });
                    }
                }
            }

            if (centerProj.rotZ >= -TILE_SIZE) {
                let pNW = project3D(wx - half, wy - half, 0);
                let pNE = project3D(wx + half, wy - half, 0);
                let pSE = project3D(wx + half, wy + half, 0);
                let pSW = project3D(wx - half, wy + half, 0);
                let tNW = project3D(wx - half, wy - half, h);
                let tNE = project3D(wx + half, wy - half, h);
                let tSE = project3D(wx + half, wy + half, h);
                let tSW = project3D(wx - half, wy + half, h);

                if (cellType === -1) {
                    let addOuterFace = (faceCenter, p1, p2, t1, t2, neighborR, neighborC) => {
                        if (faceCenter && faceCenter.rotZ > -TILE_SIZE && p1 && p2 && t1 && t2) {
                            let neighborVal = checkGridBounds(neighborR, neighborC) ? grid[neighborR][neighborC] : -1;
                            let wallVar = (glacialWallVariantCache[`${r},${c}`] || 0) % 4;
                            let wallImg = (neighborVal === -1) ? glacialCaveAssets.stoneOuterWall : glacialCaveAssets.stoneWalls[wallVar];

                            renderList.push({
                                type: 'glacial_wall', depth: faceCenter.rotZ, dist: distSq, isBehind,
                                realP1: p1, realP2: p2, realT1: t1, realT2: t2, texture: wallImg
                            });
                        }
                    };

                    addOuterFace(project3D(wx, wy - half, h / 2), pNW, pNE, tNW, tNE, r - 1, c);
                    addOuterFace(project3D(wx, wy + half, h / 2), pSE, pSW, tSE, tSW, r + 1, c);
                    addOuterFace(project3D(wx - half, wy, h / 2), pSW, pNW, tSW, tNW, r, c - 1);
                    addOuterFace(project3D(wx + half, wy, h / 2), pNE, pSE, tNE, tSE, r, c + 1);
                } else if (frozenGrid[r] && frozenGrid[r][c] > 0) {
                    let tileDistSq = (r - player.r) * (r - player.r) + (c - player.c) * (c - player.c);
                    if (tileDistSq > 36) continue;

                    let iceState = frozenGrid[r][c];
                    let variantIdx = (iceVariantCache[`${r},${c}`] || 0) % 4;
                    
                    let iceImg;
                    if (iceState === 3) {
                        iceImg = glacialCaveAssets.ashMed;
                    } else if (iceState === 2) {
                        iceImg = glacialCaveAssets.iceCracked[variantIdx];
                    } else {
                        iceImg = glacialCaveAssets.iceRegular[variantIdx];
                    }

                    let transparencyAlpha = null;
                    for (let entry of playerSightLineSet) {
                        let [coord, alphaStr] = entry.split(':');
                        let [targetR, targetC] = coord.split(',').map(Number);
                        if (r === targetR && c === targetC) {
                            transparencyAlpha = parseFloat(alphaStr);
                            break;
                        }
                    }

                    let addIceFace = (side, faceCenter, p1, p2, t1, t2) => {
                        if (faceCenter && faceCenter.rotZ > -TILE_SIZE && isExposed(r, c, side) && p1 && p2 && t1 && t2) {
                            renderList.push({
                                type: 'ice_block', depth: faceCenter.rotZ, dist: distSq, isBehind,
                                realP1: p1, realP2: p2, realT1: t1, realT2: t2, texture: iceImg,
                                customAlpha: transparencyAlpha
                            });
                        }
                    };

                    addIceFace('N', project3D(wx, wy - half, h / 2), pNW, pNE, tNW, tNE);
                    addIceFace('S', project3D(wx, wy + half, h / 2), pSE, pSW, tSE, tSW);
                    addIceFace('W', project3D(wx - half, wy, h / 2), pSW, pNW, tSW, tNW);
                    addIceFace('E', project3D(wx + half, wy, h / 2), pNE, pSE, tNE, tSE);
                }
            }
        }
    }

    // --- Global Bat Collection (Mirrors Crabs & Snakes) ---
    if (currentLevel === 4) {
        for (let bat of bats) {
            if (bat.isDying && !bat.currentDeathImg) continue;
            let proj = project3D(bat.x, bat.y, 10);
            if (proj) {
                let batDistSq = (bat.x - player.x) * (bat.x - player.x) + (bat.y - player.y) * (bat.y - player.y);
                renderList.push({
                    type: 'bat',
                    depth: proj.rotZ,
                    dist: batDistSq,
                    isBehind: proj.rotZ < 0,
                    proj: proj,
                    bat: bat
                });
            }
        }
    }

    renderList.sort((a, b) => b.depth - a.depth);

    for (let item of renderList) {
        let baseAlpha = item.isBehind ? 0.5 : 1.0;
        
        if (item.type === 'ice_block' && item.customAlpha !== null && item.customAlpha !== undefined) {
            ctx.globalAlpha = item.customAlpha;
        } else {
            ctx.globalAlpha = baseAlpha;
        }

        if (item.type === 'glacial_floor') {
            ctx.fillStyle = '#082f49';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#0c4a6e';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'exit_floor') {
            ctx.save();
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'start_floor') {
            ctx.save();
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fb7185';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'glacial_ceiling') {
            ctx.fillStyle = '#031926';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
        } else if (item.type === 'glacial_wall' || item.type === 'ice_block') {
            drawClippedImage(ctx, item.texture, item.realP1, item.realP2, item.realT1, item.realT2);
        } else if (item.type === 'glacial_chest') {
            ctx.save();
            let imgW = item.pChest.scale * 60;
            let imgH = item.pChest.scale * 60;
            if (item.texture && item.texture.complete && item.texture.naturalWidth > 0) {
                ctx.drawImage(item.texture, item.pChest.x - imgW / 2, item.pChest.y - imgH / 2, imgW, imgH);
            }
            ctx.restore();
        } else if (item.type === 'barrel_bomb') {
            ctx.save();
            let bomb = item.bomb;
            let texture = bombAssets[bomb.state] || bombAssets.unlit;

            let pBombBase = project3D(bomb.x, bomb.y, -30);
            if (!pBombBase) {
                ctx.restore();
                continue;
            }

            let imgW = pBombBase.scale * 60;
            let imgH = pBombBase.scale * 120;

            if (bomb.state === 'explosion') {
                imgW *= 2.0; 
                imgH *= 2.0;
            }

            if (texture && texture.complete && texture.naturalWidth > 0) {
                ctx.drawImage(texture, pBombBase.x - imgW / 2, pBombBase.y - imgH, imgW, imgH);
            }
            ctx.restore();
        } else if (item.type === 'bat') {
            draw_bat(item.bat);
        }
    }
    ctx.globalAlpha = 1.0;
}

function draw3DView_level5() {
    if (!grid.length) return;

    let renderList = [];

    let isFaceExposed = (r, c, side) => {
        let nr = r, nc = c;
        if (side === 'N') nr--;
        else if (side === 'S') nr++;
        else if (side === 'W') nc--;
        else if (side === 'E') nc++;

        if (!checkGridBounds(nr, nc)) return false;
        let neighborVal = grid[nr][nc];
        return (neighborVal !== -1 && neighborVal !== 1 && neighborVal !== 5);
    };

    let renderRadius = 12;
    let minR = Math.max(0, player.r - renderRadius);
    let maxR = Math.min(grid.length - 1, player.r + renderRadius);
    let minC = Math.max(0, player.c - renderRadius);
    let maxC = Math.min(grid[0].length - 1, player.c + renderRadius);

    for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
            let cellType = grid[r][c];
            if (cellType === undefined || cellType === null) continue;

            let wx = c * TILE_SIZE + TILE_SIZE / 2;
            let wy = r * TILE_SIZE + TILE_SIZE / 2;
            let half = TILE_SIZE / 2;
            let h = TILE_SIZE * WALL_HEIGHT_UNITS; // Dynamic wall height scaling

            let centerProj = project3D(wx, wy, 0);
            if (!centerProj) continue;

            let distSq = (wx - player.x) * (wx - player.x) + (wy - player.y) * (wy - player.y);
            let isBehind = centerProj.rotZ < 0;

            let floorType = (cellType === 3) ? 'start_floor' : ((cellType === 2) ? 'exit_floor' : 'labyrinth_floor');
            pushFloorAndCeiling(renderList, wx, wy, half, h, centerProj, distSq, floorType, 'labyrinth_ceiling');

            if (cellType === 4) {
                let pChest = project3D(wx, wy, 0);
                if (pChest) {
                    let chestObj = chests.find(ch => ch.r === r && ch.c === c);
                    let isChestOpen = chestObj ? chestObj.isOpen : false;
                    let chestImg = isChestOpen ? chestAssets.open : chestAssets.close;

                    renderList.push({
                        type: 'labyrinth_chest',
                        depth: centerProj.rotZ, dist: distSq, isBehind, pChest, texture: chestImg
                    });
                }
            }

            if (centerProj.rotZ >= -TILE_SIZE) {
                let pNW = project3D(wx - half, wy - half, 0);
                let pNE = project3D(wx + half, wy - half, 0);
                let pSE = project3D(wx + half, wy + half, 0);
                let pSW = project3D(wx - half, wy + half, 0);
                let tNW = project3D(wx - half, wy - half, h);
                let tNE = project3D(wx + half, wy - half, h);
                let tSE = project3D(wx + half, wy + half, h);
                let tSW = project3D(wx - half, wy + half, h);

                if (cellType === -1 || cellType === 1 || cellType === 5) {
                    let addWallFace = (side, faceCenter, p1, p2, t1, t2) => {
                        if (!faceCenter || faceCenter.rotZ <= -TILE_SIZE || !p1 || !p2 || !t1 || !t2) return;

                        let exposed = isFaceExposed(r, c, side);
                        let tex;

                        if (cellType === -1) {
                            tex = exposed ? labyrinthAssets.outerWall : labyrinthAssets.baseWall;
                        } else if (cellType === 5) {
                            tex = exposed ? labyrinthAssets.vinesWall : labyrinthAssets.baseWall;
                        } else {
                            tex = labyrinthAssets.baseWall;
                        }

                        renderList.push({
                            type: 'labyrinth_wall', depth: faceCenter.rotZ, dist: distSq, isBehind,
                            realP1: p1, realP2: p2, realT1: t1, realT2: t2, texture: tex
                        });
                    };

                    addWallFace('N', project3D(wx, wy - half, h / 2), pNW, pNE, tNW, tNE);
                    addWallFace('S', project3D(wx, wy + half, h / 2), pSE, pSW, tSE, tSW);
                    addWallFace('W', project3D(wx - half, wy, h / 2), pSW, pNW, tSW, tNW);
                    addWallFace('E', project3D(wx + half, wy, h / 2), pNE, pSE, tNE, tSE);
                }
            }
        }
    }

    if (currentLevel === 5) {
        for (let plant of plants) {
            if (plant.isDying && !plant.currentDeathImg) continue;
            let proj = project3D(plant.x, plant.y, 10);
            if (proj) {
                let distSq = (plant.x - player.x) * (plant.x - player.x) + (plant.y - player.y) * (plant.y - player.y);
                renderList.push({
                    type: 'plant', depth: proj.rotZ, dist: distSq, isBehind: proj.rotZ < 0, proj, plant
                });
            }
        }
    }

    if (currentLevel === 5) {
        for (let minotaur of minotaurs) {
            if (minotaur.isDying && !minotaur.currentDeathImg) continue;
            let proj = project3D(minotaur.x, minotaur.y, 10);
            if (proj) {
                let distSq = (minotaur.x - player.x) * (minotaur.x - player.x) + (minotaur.y - player.y) * (minotaur.y - player.y);
                renderList.push({
                    type: 'minotaur', depth: proj.rotZ, dist: distSq, isBehind: proj.rotZ < 0, proj, minotaur
                });
            }
        }
    }

    renderList.sort((a, b) => b.depth - a.depth);

    for (let item of renderList) {
        ctx.globalAlpha = item.isBehind ? 0.5 : 1.0;

        if (item.type === 'labyrinth_floor') {
            ctx.fillStyle = '#8a846c';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#57533f';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'labyrinth_ceiling') {
            ctx.fillStyle = '#d6d1b8'; 
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#57533f'; 
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'start_floor') {
            ctx.save();
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fb7185';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'exit_floor') {
            ctx.save();
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.moveTo(item.p1.x, item.p1.y);
            ctx.lineTo(item.p2.x, item.p2.y);
            ctx.lineTo(item.p3.x, item.p3.y);
            ctx.lineTo(item.p4.x, item.p4.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (item.type === 'labyrinth_wall') {
            drawClippedImage(ctx, item.texture, item.realP1, item.realP2, item.realT1, item.realT2);
        } else if (item.type === 'labyrinth_chest') {
            ctx.save();
            let imgW = item.pChest.scale * 60;
            let imgH = item.pChest.scale * 60;
            if (item.texture && item.texture.complete && item.texture.naturalWidth > 0) {
                ctx.drawImage(item.texture, item.pChest.x - imgW / 2, item.pChest.y - imgH / 2, imgW, imgH);
            }
            ctx.restore();
        } else if (item.type === 'plant') {
            draw_plant(item.plant);
        } else if (item.type === 'minotaur') {
            draw_minotaur(item.minotaur);
        }
    }

    ctx.globalAlpha = 1.0;
}

function draw3DView(level) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (level === 1) {
        draw3DView_level1();
    } else if (level === 2) {
        draw3DView_level2();
    } else if (level === 3) {
        draw3DView_level3();
    } else if (level === 4) {
        draw3DView_level4();
    } else if (level === 5) {
        draw3DView_level5();
    } else {
        draw3DView_level1();
    }
}

function draw2DView() {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let mapWidth = grid[0].length * TILE_SIZE;
    let mapHeight = grid.length * TILE_SIZE;
    let scaleX = (canvas.width * 0.8) / mapWidth;
    let scaleY = (canvas.height * 0.8) / mapHeight;
    let scale = Math.min(scaleX, scaleY);

    let offsetX = (canvas.width - mapWidth * scale) / 2;
    let offsetY = (canvas.height - mapHeight * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            let val = grid[r][c];
            ctx.fillStyle = getCellColor(val);
            ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = getCellStrokeColor(val);
            ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // --- Draw Killed Mobs ---
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    for (let cell of killedMobCells) {
        let cx = cell.c * TILE_SIZE;
        let cy = cell.r * TILE_SIZE;
        let pad = TILE_SIZE * 0.2;
        
        ctx.beginPath();
        ctx.moveTo(cx + pad, cy + pad);
        ctx.lineTo(cx + TILE_SIZE - pad, cy + TILE_SIZE - pad);
        ctx.moveTo(cx + TILE_SIZE - pad, cy + pad);
        ctx.lineTo(cx + pad, cy + TILE_SIZE - pad);
        ctx.stroke();
    }
    ctx.restore();

    // --- Draw Opened Chests ---
    ctx.save();
    for (let cell of openedChestCells) {
        let cx = cell.c * TILE_SIZE;
        let cy = cell.r * TILE_SIZE;
        let pad = TILE_SIZE * 0.15;
        if (chestAssets.open && chestAssets.open.complete && chestAssets.open.naturalWidth > 0) {
            ctx.drawImage(chestAssets.open, cx + pad, cy + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2);
        }
    }
    ctx.restore();

    if (trailPoints.length > 1) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
        for (let i = 1; i < trailPoints.length; i++) {
            ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
        }
        ctx.stroke();
    }

    if (optimalPath.length > 0) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        for (let i = 0; i < optimalPath.length; i++) {
            let [r, c] = optimalPath[i];
            let px = c * TILE_SIZE + TILE_SIZE / 2;
            let py = r * TILE_SIZE + TILE_SIZE / 2;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.restore();
}

function showZoomToast(pct) {
    let badge = document.getElementById('zoomToastBadge');
    if (!badge) return;
    badge.innerText = `${pct}%`;
    badge.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        badge.classList.remove('show');
    }, 1200);
}

document.getElementById('zoomInBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    minimapTool = (minimapTool === 'zoomIn') ? 'none' : 'zoomIn';
    updateMinimapToolUI();
});

document.getElementById('zoomOutBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    minimapTool = (minimapTool === 'zoomOut') ? 'none' : 'zoomOut';
    updateMinimapToolUI();
});

function updateMinimapToolUI() {
    let zoomInBtn = document.getElementById('zoomInBtn');
    let zoomOutBtn = document.getElementById('zoomOutBtn');
    
    zoomInBtn.classList.toggle('active', minimapTool === 'zoomIn');
    zoomOutBtn.classList.toggle('active', minimapTool === 'zoomOut');

    minimapCanvas.className = '';
    if (minimapTool === 'zoomIn') minimapCanvas.classList.add('zoom-in-cursor');
    else if (minimapTool === 'zoomOut') minimapCanvas.classList.add('zoom-out-cursor');
    else if (zoomIdx > 0) minimapCanvas.classList.add('grab-cursor');
}

// Click outside minimap canvas resets tool
document.addEventListener('click', (e) => {
    if (!document.getElementById('minimapContainer').contains(e.target)) {
        minimapTool = 'none';
        updateMinimapToolUI();
    }
});

// Mouse / Touch Panning (Drag to Move)
minimapCanvas.addEventListener('mousedown', (e) => {
    if (minimapTool === 'none' && zoomIdx > 0) {
        isDragging = true;
        startX = e.clientX - minimapPanX;
        startY = e.clientY - minimapPanY;
        minimapCanvas.classList.add('grabbing-cursor');
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    minimapPanX = e.clientX - startX;
    minimapPanY = e.clientY - startY;
    drawMinimap();
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        minimapCanvas.classList.remove('grabbing-cursor');
    }
});

// Touchscreen & Touchpad Support for Mobile
minimapCanvas.addEventListener('touchstart', (e) => {
    if (minimapTool === 'none' && zoomIdx > 0 && e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - minimapPanX;
        startY = e.touches[0].clientY - minimapPanY;
    }
});

window.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    minimapPanX = e.touches[0].clientX - startX;
    minimapPanY = e.touches[0].clientY - startY;
    drawMinimap();
});

window.addEventListener('touchend', () => {
    isDragging = false;
});

// Click-to-Zoom at Point with Continuous Tool Persistence
minimapCanvas.addEventListener('click', (e) => {
    if (minimapTool === 'none') return;

    let rect = minimapCanvas.getBoundingClientRect();
    let clickX = e.clientX - rect.left;
    let clickY = e.clientY - rect.top;

    let mapWidth = grid[0].length * TILE_SIZE;
    let mapHeight = grid.length * TILE_SIZE;
    let baseScale = Math.min(minimapCanvas.width / mapWidth, minimapCanvas.height / mapHeight);
    let oldScale = baseScale * (zoomLevels[zoomIdx] / 100);

    let worldX = (clickX - minimapPanX) / oldScale;
    let worldY = (clickY - minimapPanY) / oldScale;

    if (minimapTool === 'zoomIn') {
        if (zoomIdx < zoomLevels.length - 1) {
            zoomIdx++;
            showZoomToast(zoomLevels[zoomIdx]);
        }
        // If max zoom (500%) reached, automatically turn off tool
        if (zoomIdx === zoomLevels.length - 1) {
            minimapTool = 'none';
        }
    } else if (minimapTool === 'zoomOut') {
        if (zoomIdx > 0) {
            zoomIdx--;
            showZoomToast(zoomLevels[zoomIdx]);
        }
        // If min zoom (100%) reached, reset pan and turn off tool
        if (zoomIdx === 0) {
            minimapPanX = 0;
            minimapPanY = 0;
            minimapTool = 'none';
        }
    }

    let newScale = baseScale * (zoomLevels[zoomIdx] / 100);
    minimapPanX = clickX - worldX * newScale;
    minimapPanY = clickY - worldY * newScale;

    updateMinimapToolUI();
    drawMinimap();
});

function drawMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    let canvasParent = minimapCanvas.parentElement;
    canvasParent.style.position = 'relative';

    let overlay = document.getElementById('minimapIconOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'minimapIconOverlay';
        overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden;";
        canvasParent.appendChild(overlay);
    }
    overlay.innerHTML = '';

    if (!grid.length) return;

    let mapWidth = grid[0].length * TILE_SIZE;
    let mapHeight = grid.length * TILE_SIZE;
    let baseScale = Math.min(minimapCanvas.width / mapWidth, minimapCanvas.height / mapHeight);
    
    let currentZoomPct = zoomLevels[zoomIdx];
    let currentScale = baseScale * (currentZoomPct / 100);

    // Clamp pan offsets so the map stays within reachable bounds
    let renderedWidth = mapWidth * currentScale;
    let renderedHeight = mapHeight * currentScale;
    
    if (renderedWidth <= minimapCanvas.width) {
        minimapPanX = (minimapCanvas.width - renderedWidth) / 2;
    } else {
        minimapPanX = Math.max(minimapCanvas.width - renderedWidth, Math.min(0, minimapPanX));
    }

    if (renderedHeight <= minimapCanvas.height) {
        minimapPanY = (minimapCanvas.height - renderedHeight) / 2;
    } else {
        minimapPanY = Math.max(minimapCanvas.height - renderedHeight, Math.min(0, minimapPanY));
    }

    minimapCtx.save();
    minimapCtx.translate(minimapPanX, minimapPanY);
    minimapCtx.scale(currentScale, currentScale);

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            let val = grid[r][c];
            minimapCtx.fillStyle = getCellColor(val);            
            minimapCtx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
    minimapCtx.restore();

    // Render Overlay Icons
    if (hintActive && hintPos) {
        let cellSizeScreen = TILE_SIZE * currentScale;
        let pinSize = cellSizeScreen * 0.9;
        let hazardSize = cellSizeScreen * 0.75;
        let chestSize = cellSizeScreen * 0.8;

        function addOverlayIcon(worldX, worldY, srcPath, sizePx, transformStyle) {
            let screenX = (worldX * currentScale) + minimapPanX;
            let screenY = (worldY * currentScale) + minimapPanY;

            if (screenX >= -sizePx && screenX <= minimapCanvas.width + sizePx && screenY >= -sizePx && screenY <= minimapCanvas.height + sizePx) {
                let img = document.createElement('img');
                img.src = srcPath;
                img.style.position = 'absolute';
                img.style.left = `${screenX}px`;
                img.style.top = `${screenY}px`;
                img.style.width = `${sizePx}px`;
                img.style.height = `${sizePx}px`;
                img.style.transform = transformStyle;
                img.style.display = 'block';
                overlay.appendChild(img);
            }
        }

        addOverlayIcon(hintPos.x, hintPos.y, 'assets/sprites/location_pin.png', pinSize, 'translate(-50%, -100%)');

        for (let mobPos of hintMobPositions) {
            let cx = mobPos.c * TILE_SIZE + TILE_SIZE / 2;
            let cy = mobPos.r * TILE_SIZE + TILE_SIZE / 2;
            addOverlayIcon(cx, cy, 'assets/sprites/hazard_sign.png', hazardSize, 'translate(-50%, -50%)');
        }

        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (grid[r][c] === 4) {
                    let cx = c * TILE_SIZE + TILE_SIZE / 2;
                    let cy = r * TILE_SIZE + TILE_SIZE / 2;
                    addOverlayIcon(cx, cy, 'assets/chests/chest_close.png', chestSize, 'translate(-50%, -50%)');
                }
            }
        }
    }
}

function draw_player() {
    let playerHeightOffset = 0;
    if (currentLevel === 2 && waterHeight >= 1.0) {
        playerHeightOffset = Math.sin(frameCount * 0.1) * 4 + (waterHeight * 15);
    } else if (currentLevel === 3 && player.isToxicSwimming) {
        playerHeightOffset = -Math.sin(frameCount * 0.1) * 4 - 35;
    }

    let pBaseProj = project3D(player.x, player.y, playerHeightOffset);
    let pHeadProj = project3D(player.x, player.y, playerHeightOffset + 110);

    if (player.isGrabbed && activeEatenPlant !== null) return;
    if (player.isGrabbed || !pBaseProj || !pHeadProj) return;

    let charHeight = Math.abs(pBaseProj.y - pHeadProj.y);
    if (currentLevel === 5) charHeight *= 0.8;
    let charWidth = charHeight * 0.45;

    ctx.save();
    ctx.translate(pBaseProj.x, pBaseProj.y);
    
    if (player.isTransforming) {
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 30;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(0, -charHeight * 0.5, charWidth * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    let targetImg;
    let swimFrameIdx = 0;

    if (isDying) {
        targetImg = currentDeathImg;
    } else if (hurtPhase === 1) {
        targetImg = (currentLevel === 3 && player.isToxicSwimming) 
            ? hurtSceneAssets.toxicRed 
            : (player.hasWizardStaff ? hurtSceneAssets.blueStaffRed.hurt : hurtSceneAssets.blueRed.hurt);
    } else if (hurtPhase === 2) {
        targetImg = (currentLevel === 3 && player.isToxicSwimming) 
            ? hurtSceneAssets.toxicReg 
            : (player.hasWizardStaff ? hurtSceneAssets.blueStaffReg.hurt : hurtSceneAssets.blueReg.hurt);
    } else if (player.hasWizardHat) {
        if (player.isCasting) {
            targetImg = fireballCombatAssets.playerBlueStaff;
        } else if (currentLevel === 2 && waterHeight >= 1.0) {
            if (player.isMoving) {
                swimFrameIdx = Math.floor(frameCount / 6) % playerMovementExtraAssets.swimFrames.length;
                targetImg = playerMovementExtraAssets.swimFrames[swimFrameIdx];
            } else {
                let idleToggle = Math.floor(frameCount / 30) % 2;
                targetImg = idleToggle === 0 ? playerMovementExtraAssets.swimIdle : playerMovementExtraAssets.swimIdleExt;
            }
        } else if (currentLevel === 3 && player.isToxicSwimming) {
            targetImg = player.isMoving ? playerToxicAssets.walk[Math.floor(frameCount / 6) % 4] : playerToxicAssets.idle;
        } else {
            if (player.isMoving) {
                let frameIdx = Math.floor(frameCount / 6) % 4;
                targetImg = player.hasWizardStaff ? playerAssets.blueRobe.walkStaff[frameIdx] : playerAssets.blueRobe.walk[frameIdx];
            } else {
                targetImg = player.hasWizardStaff ? playerAssets.blueRobe.staffIdle : playerAssets.blueRobe.idle;
            }
        }
    } else {
        targetImg = player.isMoving ? playerAssets.grayRobe.walk[Math.floor(frameCount / 6) % 4] : playerAssets.grayRobe.idle;
    }

    if (player.isTransforming && playerAssets.transform.complete && playerAssets.transform.naturalWidth > 0) {
        targetImg = playerAssets.transform;
    }

    let frameTiltAngle = 0;
    if (currentLevel === 2 && waterHeight >= 1.0 && player.isMoving) {
        if (swimFrameIdx === 1 || swimFrameIdx === 4) frameTiltAngle = 0.08;
        else if (swimFrameIdx === 2 || swimFrameIdx === 5) frameTiltAngle = -0.06;
    }

    ctx.save();
    ctx.rotate(frameTiltAngle);

    let imgH = charHeight * 1.15;
    let imgW = imgH;
    if (targetImg && targetImg.complete && targetImg.naturalWidth > 0 && targetImg.naturalHeight > 0) {
        let aspect = targetImg.naturalWidth / targetImg.naturalHeight;
        imgW = imgH * aspect;
    }

    if (targetImg && targetImg.complete && targetImg.naturalWidth > 0) {
        ctx.drawImage(targetImg, -imgW / 2, -imgH, imgW, imgH);
    } else if (!isDying || currentDeathImg !== null) {
        ctx.fillStyle = player.hasWizardHat ? '#6d28d9' : '#be123c';
        ctx.fillRect(-charWidth * 0.4, -charHeight * 0.8, charWidth * 0.8, charHeight * 0.8);
    }

    ctx.restore(); 
    ctx.restore();
}

function draw_crab(crab) {
    let proj = project3D(crab.x, crab.y, 10); 
    if (!proj) return;

    let img;
    let facing = getCrabFacing(crab);

    if (crab.isDying) {
        img = crab.currentDeathImg;
    } else if (crab.hurtPhase === 1) {
        img = crabAssets.hurt.red;
    } else if (crab.hurtPhase === 2) {
        img = crabAssets.hurt.reg;
    } else if (player.isGrabbed && activeGrabCrab === crab) {
        let grabFrameIdx = Math.floor(frameCount / 20) % 2;
        img = crabAssets.grab[grabFrameIdx];
    } else if (crab.waitTimer > 0 || !crab.isMoving) {
        let attackFrameIdx = Math.floor(frameCount / 20) % 2;
        img = crabAssets.attack[attackFrameIdx];
    } else {
        let frameIdx = Math.floor(frameCount / 4) % 6;
        img = crabAssets.move[facing][frameIdx];
    }

    let crabWidth = proj.scale * TILE_SIZE * 2.5;
    let crabHeight = crabWidth * 0.85;

    ctx.save();
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, proj.x - crabWidth / 2, proj.y - crabHeight, crabWidth, crabHeight);
    }
    ctx.restore();
}

function draw_snake(snake) {
    let proj = project3D(snake.x, snake.y, 10);
    if (!proj) return;

    let img;
    let facing = getMobFacing(snake);
    let frameIdx = 0;

    if (snake.isDying) {
        img = snake.currentDeathImg;
    } else if (snake.hurtPhase === 1) {
        img = snakeAssets.hurt.red;
    } else if (snake.hurtPhase === 2) {
        img = snakeAssets.hurt.reg;
    } else if (player.r === snake.r && player.c === snake.c) {
        let biteIdx = Math.floor(frameCount / 15) % 2;
        img = snakeAssets.bite[biteIdx];
    } else if (snake.state === 'MOVING') {
        let cycleProgress = (snake.distanceTraveled * 2) % 1.0; 
        frameIdx = Math.floor(cycleProgress * 6);
        img = snakeAssets.movement[facing][frameIdx];
    } else {
        frameIdx = snake.turnFrameIndex;
        img = snakeAssets.movement[facing][frameIdx];
    }

    let snakeWidth = proj.scale * TILE_SIZE * 1.1;
    let snakeHeight = snakeWidth * 0.85;

    ctx.save();
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, proj.x - snakeWidth / 2, proj.y - snakeHeight, snakeWidth, snakeHeight);
    }
    ctx.restore();
}

function getBatFacing(bat) {
    let dr = Math.abs(bat.dr) > 0.5 ? Math.sign(bat.dr) : 0;
    let dc = Math.abs(bat.dc) > 0.5 ? Math.sign(bat.dc) : 0;

    let movementAngle = Math.atan2(-dr, dc);
    let rawFacing = getRelativeFacing(movementAngle, camAngle);

    // Invert the orientations (Front <-> Back, Left <-> Right)
    if (rawFacing === 'front') return 'back';
    if (rawFacing === 'back') return 'front';
    if (rawFacing === 'left') return 'right';
    if (rawFacing === 'right') return 'left';

    return rawFacing;
}

function draw_bat(bat) {
    ctx.save();
    let img;
    let verticalOffset = 10; // Default flying height offset

    if (bat.isDying) {
        img = bat.currentDeathImg;
    } else if (bat.hurtPhase === 1) {
        img = batAssets.hurt.red;
    } else if (bat.hurtPhase === 2) {
        img = batAssets.hurt.reg;
    } else if (bat.state === 'HIBERNATING') {
        img = batAssets.idle[0]; // sleeping1 asset image
        verticalOffset = 90;     // Rendered higher up (hanging upside down from ceiling)
    } else if (bat.state === 'SLEEPING') {
        let sleepFrameIdx = Math.floor(frameCount / 30) % 4;
        img = batAssets.idle[sleepFrameIdx];
        verticalOffset = 90;     // Rendered higher up (hanging upside down from ceiling)
    } else {
        let facing = getBatFacing(bat);
        let moveFrameIdx = Math.floor(frameCount / 4) % 6;
        img = batAssets.movement[facing][moveFrameIdx];
    }

    let batProj = project3D(bat.x, bat.y, verticalOffset);
    if (batProj) {
        let batWidth = batProj.scale * TILE_SIZE * 1.0;
        let batHeight = batWidth * 0.85;

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, batProj.x - batWidth / 2, batProj.y - batHeight, batWidth, batHeight);
        }
    }
    ctx.restore();
}

function draw_plant(plant) {
    let proj = project3D(plant.x, plant.y, -30);
    if (!proj) return;

    let img;
    let facing = getMobFacing(plant);

    if (plant.isDying) {
        img = plant.currentDeathImg;
    } else if (plant.hurtPhase === 1) {
        img = plantAssets.hurt.red;
    } else if (plant.hurtPhase === 2) {
        img = plantAssets.hurt.reg;
    } else if (plant.state === 'ATTACKING') {
        let attackIdx = Math.floor(frameCount / 6) % 6;
        img = plantAssets.attack[attackIdx];
    } else if (plant.state === 'ACTIVE') {
        let alertIdx = Math.floor(frameCount / 8) % 4;
        img = plantAssets.alert[facing][alertIdx];
    } else {
        let idleIdx = Math.floor(frameCount / 14) % 4;
        img = plantAssets.idle[facing][idleIdx];
    }

    let plantWidth = proj.scale * TILE_SIZE * 1.8; 
    let plantHeight = plantWidth * 1.5;            

    ctx.save();
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, proj.x - plantWidth / 2, proj.y - plantHeight, plantWidth, plantHeight);
    }
    ctx.restore();
}

function draw_minotaur(minotaur) { 
    let proj = project3D(minotaur.x, minotaur.y, 0);
    if (!proj) return;

    let img;
    let facing = getMinotaurFacing(minotaur);

    if (minotaur.isDying) {
        img = minotaur.currentDeathImg;
    } else if (minotaur.hurtPhase === 1) {
        img = minotaurAssets.hurt.red;
    } else if (minotaur.hurtPhase === 2) {
        img = minotaurAssets.hurt.reg;
    } else if (minotaur.state === 'ATTACKING') {
        let attackIdx = Math.floor(frameCount / 6) % 8;
        img = minotaurAssets.attack[facing][attackIdx];
    } else if (minotaur.state === 'CHASING') {
        let walkIdx = Math.floor(frameCount / 8) % 2;
        img = minotaurAssets.walk[facing][walkIdx];
    } else {
        img = minotaurAssets.idle[facing];
    }

    let minotaurWidth = proj.scale * TILE_SIZE * 2.2;
    let minotaurHeight = minotaurWidth * 1.5;

    ctx.save();
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, proj.x - minotaurWidth / 2, proj.y - minotaurHeight, minotaurWidth, minotaurHeight);
    }
    ctx.restore();
}

function draw_fireball() {
    if (!activeFireball || !activeFireball.active) return;

    let fbImg = fireballCombatAssets.tile1;
    if (activeFireball.state === 'flight') fbImg = fireballCombatAssets.flight;
    else if (activeFireball.state === 'impact') fbImg = fireballCombatAssets.impact;
    else if (activeFireball.state === 'ashMed') fbImg = fireballCombatAssets.ashMed;
    else if (activeFireball.state === 'ashLight') fbImg = fireballCombatAssets.ashLight;

    let fbProj = project3D(activeFireball.x, activeFireball.y, 60);
    if (fbProj && fbImg && fbImg.complete && fbImg.naturalWidth > 0) {
        ctx.save();
        let fbSize = fbProj.scale * 90;
        ctx.drawImage(fbImg, fbProj.x - fbSize / 2, fbProj.y - fbSize / 2, fbSize, fbSize);
        ctx.restore();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isGameFinished && !isDying) {
        draw2DView();
    } else {
        draw3DView(currentLevel);
        draw_fireball();
        draw_player();
    }

    // Render plant stomach view overlay when eaten
    if (activeEatenPlant && plantAssets.stomach && plantAssets.stomach.complete && plantAssets.stomach.naturalWidth > 0) {
        ctx.save();
        ctx.drawImage(plantAssets.stomach, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    drawMinimap();
}

function updateUI() {
    let deg = Math.round((player.angle * 180) / Math.PI);
    let compassDeg = (90 - deg) % 360;
    if (compassDeg < 0) compassDeg += 360;
    if (compassNeedle) {
        compassNeedle.style.transform = `translate(-50%, -50%) rotate(${compassDeg}deg)`;
    }

    let mins = Math.floor(elapsedTimeSec / 60).toString().padStart(2, '0');
    let secs = (elapsedTimeSec % 60).toString().padStart(2, '0');
    const timerTextEl = document.getElementById('hudTimerText');
    if (timerTextEl) {
        timerTextEl.innerText = `${mins}:${secs}`;
    }

    const healthFill = document.getElementById('healthFill');
    const magicFill = document.getElementById('magicFill');
    const healthHud = document.getElementById('healthHud');
    const magicHud = document.getElementById('magicHud');

    if (healthFill) healthFill.style.width = `${Math.max(0, Math.min(100, player.hp))}%`;
    if (magicFill) magicFill.style.width = `${Math.max(0, Math.min(100, player.mp))}%`;

    if (currentLevel === 1) {
        if (healthHud) healthHud.classList.add('disabled');
        if (magicHud) magicHud.classList.add('disabled');
    } else {
        if (healthHud) healthHud.classList.remove('disabled');
        
        if (currentLevel >= 3 || player.hasWizardStaff) {
            if (magicHud) magicHud.classList.remove('disabled');
        } else {
            if (magicHud) magicHud.classList.add('disabled');
        }
    }
}

function loop() {
    frameCount++;
    update();
    draw();
    requestAnimationFrame(loop);
}

loadLevel(1);
loop();