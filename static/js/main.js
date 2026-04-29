import { RobotVisualizer } from './visualizer.js';


const visualizer = new RobotVisualizer('visualization-canvas');
let currentCoords = { x: 0, y: 0, z: 0 };
let isLoaded = false;
let jogInterval = null;
let currentSpeed = 0.05;
let isAnimating = false;
let waypoints = [];
let isPaused = false;
let stopRequested = false;

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
    if (isAnimating) return;
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
    }, 50);
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
    const mapping = { 'x': 0, 'z': 1, 'y': 2 };
    const axisIdx = mapping[axis];
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

async function animatePath(path) {
    const numFrames = path[0].length;
    for (let i = 0; i < numFrames; i++) {

        if(stopRequested) return;

        while (isPaused) {
            if (stopRequested) return;
            await new Promise(r => setTimeout(r, 100));
        }

        const frameAngles = path.map(jointPath => jointPath[i]);
        updateUI(frameAngles);
        visualizer.update(frameAngles);
        await new Promise(r => setTimeout(r, 30));
    }
    const finalAngles = path.map(jointPath => jointPath[numFrames - 1]);
    isAnimating = false;
    await syncForward();
    isAnimating = true;
}

async function moveToPoint(targetXYZ) {
    const res = await fetch('/calculate_full_path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_angles: getCurrentAngles(), target_xyz: targetXYZ })
    });
    const data = await res.json();
    if (!data.path) throw new Error(`Punkt [${targetXYZ}] poza zasięgiem!`);
    // addLog(`Punkt [${targetXYZ}] poza zasięgiem!`);
    await animatePath(data.path);
}

window.executeGlobalStart = async function() {
    if (isAnimating) return;
    isAnimating = true;
    stopRequested = false;
    isPaused = false;

    const mode = document.querySelector('input[name="traj-mode"]:checked').value;
    const loopEnabled = document.getElementById('loop-enable')?.checked || false;
    const loopCount = parseInt(document.getElementById('loop-count')?.value) || 1;

    try {
        for (let cycle = 0; cycle < loopCount; cycle++) {
            if (stopRequested) break;

            addLog(`Rozpoczęto cykl ${cycle + 1}/${loopCount}`);

            if (mode === 'ab') {
                const pointA = [
                    parseFloat(document.getElementById('start-x').value),
                    parseFloat(document.getElementById('start-z').value),
                    parseFloat(document.getElementById('start-y').value)
                ];
                const pointB = [
                    parseFloat(document.getElementById('target-x').value),
                    parseFloat(document.getElementById('target-z').value),
                    parseFloat(document.getElementById('target-y').value)
                ];

                addLog("Jedzie do punktu A...");
                await moveToPoint(pointA);
                await new Promise(r => setTimeout(r, 500));

                addLog("Jedzie do punktu B...");
                await moveToPoint(pointB);
            }
            else if (mode === 'teach') {
                if (waypoints.length === 0) throw new Error("Lista punktów jest pusta! Nagraj punkty.");

                for (let i = 0; i < waypoints.length; i++) {
                    addLog(`Ruch do punktu P${i + 1}...`);
                    await moveToPoint([waypoints[i].x, waypoints[i].y, waypoints[i].z]);
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            if (!loopEnabled) break;
        }
        if (stopRequested) addLog("PROGRAM ZATRZYMANY", true);
        else addLog("Program zakończony.");

    } catch (e) {
        addLog(e.message, true);
    } finally {
        isAnimating = false;
        stopRequested = false;
        await syncForward();
    }
};

//przelaczanie trybow trajektorii
window.toggleTrajMode = function(mode) {
    const sectionAB = document.getElementById('section-ab');
    const sectionTeach = document.getElementById('section-teach');
    if (mode === 'teach') {
        sectionAB.classList.add('hidden');
        sectionTeach.classList.remove('hidden');
    } else {
        sectionAB.classList.remove('hidden');
        sectionTeach.classList.add('hidden');
    }
};

window.recordWaypoint = function() {
  const point = {
      x: currentCoords.x,
      y: currentCoords.y,
      z: currentCoords.z};
  waypoints.push(point);
  updateWaypointsList();
};

window.clearWaypoints = function() {
    waypoints = [];
    updateWaypointsList();
};

window.removeWaypoint = function(index) {
    waypoints.splice(index, 1);
    updateWaypointsList();
};

window.togglePause = function() {
    isPaused = !isPaused;
    const btn = document.querySelector('.btn-pause');
    if (isPaused) {
        btn.classList.add('bg-yellow-500');
        addLog("Program wstrzymany (PAUSE)");
    } else {
        btn.classList.remove('bg-yellow-500');
        addLog("Program wznowiony");
    }
}

window.stopProgram = function() {
    stopRequested = true;
    isPaused = false;
    addLog("Zatrzymywanie programu...", true);
};


function updateWaypointsList() {
    const list = document.getElementById('waypoints-list');
    if(!list) return;
    if (waypoints.length === 0) {
        list.innerHTML = "Brak nagranych punktów...";
        return;
    }
    list.innerHTML = waypoints.map((p, i) =>
        `<div class="border-b py-1">P${i+1}: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]</div>`
    ).join('');
}


document.getElementById('home-btn').onclick = () => {
    updateUI([0,16,-120,0,-45,0]);
    syncForward();
    addLog("Returned Home.");
};
// --- START ---
window.onload = async () => {
    await syncForward();
    isLoaded = true;
    if (isLoaded) {
        addLog("System Online. Initializing kinematics...");
    }
};