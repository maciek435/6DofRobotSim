import { RobotVisualizer } from './visualizer.js';
const visualizer = new RobotVisualizer('visualization-canvas');
let currentCoords = { x: 0, y: 0, z: 0 };
let isLoaded = false;

// 1. GENEROWANIE SUWAKÓW
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

// POMOCNIKI
function getCurrentAngles() {
    return Array.from({length: 6}, (_, i) => parseFloat(document.getElementById(`s${i+1}`).value) || 0);
}

function updateUI(angles) {
    angles.forEach((a, i) => {
        document.getElementById(`s${i+1}`).value = a.toFixed(1);
        document.getElementById(`b${i+1}`).value = a.toFixed(1);
    });
}

// 2. SYNCHRONIZACJA (Forward)
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

// 3. JOGGING (Inverse)
window.jog = async function(axis, dir) {
    const step = 0.1;
    let target = [currentCoords.x, currentCoords.y, currentCoords.z];
    target[['x','y','z'].indexOf(axis)] += (dir * step);

    const res = await fetch('/calculate_step', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({target_xyz: target, current_angles: getCurrentAngles()})
    });
    const data = await res.json();
    if(data.angles) {
        updateUI(data.angles);
        await syncForward();
    }
};

// 4. NAV I HOME
document.getElementById('forward-nav-btn').onclick = () => {
    addLog("Switched to forward kinematics mode.");
    document.getElementById('forward-controls').classList.remove('hidden');
    document.getElementById('inverse-controls').classList.add('hidden');
};
document.getElementById('inverse-nav-btn').onclick = () => {
    addLog("Switched to inverse kinematics mode.");
    document.getElementById('forward-controls').classList.add('hidden');
    document.getElementById('inverse-controls').classList.remove('hidden');
};
document.getElementById('home-btn').onclick = () => {
    updateUI([0,0,0,0,0,0]);
    syncForward();
};

// START
window.onload = async () => {
    await syncForward();
    isLoaded = true;
    if (isLoaded) {
        addLog("System Online. Initializing kinematics...");
    }
};