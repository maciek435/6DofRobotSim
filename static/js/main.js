import { RobotVisualizer } from './visualizer.js';


const visualizer = new RobotVisualizer('visualization-canvas');
let currentCoords = { x: 0, y: 0, z: 0 };
let isLoaded = false;
let jogInterval = null;
let currentSpeed = 0.05;

// --- GENEROWANIE SUWAKÓW ---
const container = document.getElementById('sliders-container');
if (container) {
    for (let i = 1; i <= 6; i++) {
        const row = document.createElement('div');
        row.className = "flex items-center gap-3 mb-3";
        row.innerHTML = `
            <label class="w-10 text-xs font-bold text-slate-500">J${i}</label>
            <input type="range" id="s${i}" min="-180" max="180" value="0" step="0.1" class="flex-grow accent-indigo-600">
            <input type="number" id="b${i}" value="0" step="0.1" class="w-16 border rounded text-xs text-center p-1">
        `;
        container.appendChild(row);
        const slider = document.getElementById(`s${i}`);
        const box = document.getElementById(`b${i}`);
        slider.oninput = () => { box.value = slider.value; if(isLoaded) syncForward(); };
        box.onchange = () => { slider.value = box.value; if(isLoaded) syncForward(); };
    }
}
function addLog(msg, isError = false) {
    const log = document.getElementById('log-field');
    if (!log) return;
    const div = document.createElement('div');
    div.className = isError ? "text-red-500" : "text-slate-600";
    div.textContent = `[${new Date().toLocaleTimeString()}] >>> ${msg}`;
    log.prepend(div);
}

function getCurrentAngles() {
    return Array.from({length: 6}, (_, i) => parseFloat(document.getElementById(`s${i+1}`).value) || 0);
}

function updateUI(angles) {
    angles.forEach((a, i) => {
        document.getElementById(`s${i+1}`).value = a.toFixed(1);
        document.getElementById(`b${i+1}`).value = a.toFixed(1);
    });
}

// --- SYNCHRONIZACJA FORWARD ---
async function syncForward() {
    const angles = getCurrentAngles();
    visualizer.update(angles);
    const res = await fetch('/calculate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({angles})
    });
    const data = await res.json();
    currentCoords = data.coords;
    visualizer.updateTCPText(data.coords);
}
// --- JOGGING ---
window.startJog = function(axis, direction) {
    if (jogInterval) return;
    performJogStep(axis, direction);
    jogInterval = setInterval(() => {
        performJogStep(axis, direction);
    }, 20);
};

window.stopJog = function() {
    if (jogInterval) {
        clearInterval(jogInterval);
        jogInterval = null;
    }
};

window.changeSpeed = function(delta) {
    let newSpeed = currentSpeed + delta;
    newSpeed = Math.round(newSpeed * 100) / 100;
    if (newSpeed >= 0.01 && newSpeed <= 0.50) {
        currentSpeed = newSpeed;
    }
    const display = document.getElementById('speed-display');
    if (display) {
        display.innerText = currentSpeed.toFixed(2);
    } else {
        console.error("Nie znaleziono elementu o id 'speed-display'!");
    }
};

async function performJogStep(axis, direction) {
    let target = [currentCoords.x, currentCoords.y, currentCoords.z];
    const axisIdx = ['x', 'y', 'z'].indexOf(axis);
    target[axisIdx] += (direction * currentSpeed);

    try {
        const res = await fetch('/calculate_step', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                target_xyz: target,
                current_angles: getCurrentAngles()
            })
        });
        const data = await res.json();

        if (data.angles) {
            updateUI(data.angles);
            visualizer.update(data.angles);
            currentCoords = { x: target[0], y: target[1], z: target[2] };
            visualizer.updateTCPText(currentCoords);
        } else {
            stopJog();
        }
    } catch (e) {
        stopJog();
    }
}

document.getElementById('home-btn').onclick = () => {
    updateUI([0,16,-120,0,-45,0]);
    syncForward();
};
// --- START ---
window.onload = async () => {
    await syncForward();
    isLoaded = true;
    if (isLoaded) {
        addLog("System Online. Initializing kinematics...");
    }
};