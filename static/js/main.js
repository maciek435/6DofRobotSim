import { RobotVisualizer } from './visualizer.js';

const visualizer = new RobotVisualizer('visualization-canvas');

const forwardBtn = document.getElementById('forward-nav-btn');
const inverseBtn = document.getElementById('inverse-nav-btn');
const logField = document.getElementById('log-field');
const homeBtn = document.getElementById('home-btn');

function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    logField.innerHTML += `\n[${time}] >>> ${msg}`;
    logField.scrollTop = logField.scrollHeight;
}

async function updateSimulation() {
   const angles = [];
   for (let i = 1; i <= 6; i++) {
       angles.push(parseFloat(document.getElementById(`s${i}`).value));
   }

   visualizer.update(angles);

   try{
       const response = await fetch('/calculate', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ angles: angles })
       });
       const data = await response.json();

       if (data.status === 'success') {
           visualizer.updateTCPText(data.coords);
       }
   } catch (err) {
       console.error("Communication error:", err);
       addLog("Communication error:", err);
   }
}

// Panele do przełączania
const panels = {
    forward: [
        document.getElementById('forward-controls'),
        document.getElementById('forward-traj')
    ],
    inverse: [
        document.getElementById('inverse-controls'),
        document.getElementById('inverse-traj')
    ]
};

// Funkcja przełączania paneli
function switchMode(mode) {
    if (mode === 'forward') {
        forwardBtn.classList.add('active');
        inverseBtn.classList.remove('active');
        panels.forward.forEach(p => p.classList.remove('hidden'));
        panels.inverse.forEach(p => p.classList.add('hidden'));
        addLog("Switched to FORWARD KINEMATICS mode.");
    } else {
        forwardBtn.classList.remove('active');
        inverseBtn.classList.add('active');
        panels.forward.forEach(p => p.classList.add('hidden'));
        panels.inverse.forEach(p => p.classList.remove('hidden'));
        addLog("Switched to INVERSE KINEMATICS mode.");
    }
}

// Generowanie suwaków
const container = document.getElementById('sliders-container');
for (let i = 1; i <= 6; i++) {
    const row = document.createElement('div');
    row.className = "flex items-center gap-4";
    row.innerHTML = `
        <label class="w-16 text-xs font-bold text-slate-500">Theta ${i}</label>
        <input type="range" id="s${i}" min="-180" max="180" value="0" step="0.1" class="flex-grow">
        <input type="number" id="b${i}" value="0" step="0.1" class="w-20 border border-slate-200 rounded p-1 text-sm text-center">
    `;
    container.appendChild(row);

    const slider = document.getElementById(`s${i}`);
    const box = document.getElementById(`b${i}`);

    slider.oninput = () => { box.value = slider.value; updateSimulation(); };
    box.onchange = () => { slider.value = box.value; updateSimulation(); };
}


forwardBtn.onclick = () => switchMode('forward');
inverseBtn.onclick = () => switchMode('inverse');

window.onload = () => addLog("System initialized. Ready for simulation.");
