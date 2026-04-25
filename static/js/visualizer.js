import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class RobotVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.joints = [];
        // --- KONFIGURACJA WYMIARÓW ---
        this.D = {
            baseRadius: 0.4,
            baseHeight: 0.8,
            j1_tall: 0.7,
            armBicepsLen: 1.5,
            armForearmFullLen: 1.3, // Całkowita długość członu 3
            radius: 0.18,
            accentColor: 0x3498db,
            bodyColor: 0xeeeeee
        };
        // Podział członu 3 (np. 70% to ramię stałe, 30% to obracany nadgarstek)
        this.l2_fixed_part = this.D.armForearmFullLen * 0.7;
        this.l3_rotating_part = this.D.armForearmFullLen * 0.3;

        this.init();
    }

    init() {
        // --- TŁO I SCENA ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf4f4f4);

        this.camera = new THREE.PerspectiveCamera(60, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5); // Pozycja startowa kamery

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.tcpPoint = null;
        this.tcpLabel = null;




        new OrbitControls(this.camera, this.renderer.domElement);

        // --- GRID I OŚWIETLENIE---
        this.scene.add(new THREE.GridHelper(10, 20), new THREE.AmbientLight(0xffffff, 0.8));

        const sun = new THREE.DirectionalLight(0xffffff, 1);
        sun.position.set(5, 10, 5);
        sun.castShadow = true;
        this.scene.add(sun);

        // --- MATERIAŁY ---
        this.matBody = new THREE.MeshStandardMaterial({ color: this.D.bodyColor, roughness: 0.7 });
        this.matAccent = new THREE.MeshStandardMaterial({ color: this.D.accentColor, roughness: 0.4, metalness: 0.3 });

        this.createRobot();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
    }

    // --- POMOCNIKI GEOMETRII ---
    createBox(w, h, d) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geometry, this.matBody);
        mesh.castShadow = true;
        return mesh;
    }

    createJointVisual(rad, isRoll = false) {
        const group = new THREE.Group();
        if (isRoll) {
            const geom = new THREE.CylinderGeometry(rad * 1.05, rad * 1.05, 0.05, 32);
            group.add(new THREE.Mesh(geom, this.matAccent));
        } else {
            const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.2, rad * 1.2, rad * 2.4, 32), this.matBody);
            cylinder.rotation.x = Math.PI / 2;
            const axis = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.6, rad * 0.6, rad * 2.5, 32), this.matAccent);
            axis.rotation.x = Math.PI / 2;
            group.add(cylinder, axis);
        }
        return group;
    }

    createRobot() {
        const robot = new THREE.Group();
        this.scene.add(robot);

        // Długości zgodne z kinematyką (L1, L2, L3... z Twojego Flaska)
        const L = {
            baseToJ2: this.D.baseHeight / 2 + this.D.j1_tall, // od ziemi do osi J2
            biceps: 1.5,   // od osi J2 do osi J3
            forearm: 1.3,  // od osi J3 do osi J5 (J4 jest w środku)
            wristToTCP: 0.2 + 0.4 // od osi J5 do czubka efektora
        };

        // 1. BASE -> J1 (Base Height)
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32), this.matBody);
        base.position.y = 0.4;
        robot.add(base);

        // 2. J1 (Roll) -> J2 (Pitch)
        const j1 = new THREE.Group();
        j1.position.y = 0.4; // środek bazy
        base.add(j1);

        const l1_link = this.createBox(0.36, 0.7, 0.36);
        l1_link.position.y = 0.35; // połowa j1_tall
        j1.add(l1_link);

        // 3. J2 (Pitch) -> J3 (Pitch)
        const j2 = new THREE.Group();
        j2.position.y = 0.7; // j1_tall
        j2.add(this.createJointVisual(0.18, false));
        j1.add(j2);

        const l2_link = this.createBox(0.3, 1.5, 0.3);
        l2_link.position.y = 0.75; // połowa bicepsa
        j2.add(l2_link);

        // 4. J3 (Pitch) -> J5 (Pitch)
        // J4 siedzi wewnątrz tej odległości
        const j3 = new THREE.Group();
        j3.position.y = 1.5; // Długość bicepsa
        j3.add(this.createJointVisual(0.16, false));
        j2.add(j3);

        // Przedramię cz. 1 (do przegubu Roll)
        const forearm_len = 1.3;
        const j4_pos = forearm_len * 0.7; // J4 jest na 70% długości

        const l3_fixed = this.createBox(0.25, j4_pos, 0.25);
        l3_fixed.position.y = j4_pos / 2;
        j3.add(l3_fixed);

        // 5. J4 (Roll)
        const j4 = new THREE.Group();
        j4.position.y = j4_pos;
        j4.add(this.createJointVisual(0.14, true));
        j3.add(j4);

        // Przedramię cz. 2 (od Roll do Pitch J5)
        const remaining_forearm = forearm_len - j4_pos;
        const l4_rotating = this.createBox(0.25, remaining_forearm, 0.25);
        l4_rotating.position.y = remaining_forearm / 2;
        j4.add(l4_rotating);

        // 6. J5 (Pitch) -> J6 (Roll)
        const j5 = new THREE.Group();
        j5.position.y = remaining_forearm;
        j5.add(this.createJointVisual(0.12, false));
        j4.add(j5);

        // 7. J6 (Roll) + Efektor -> TCP
        const j6 = new THREE.Group();
        j6.position.y = 0.2; // Offset nadgarstka
        j6.add(this.createJointVisual(0.1, true));
        j5.add(j6);

        const effectorHeight = 0.4;
        const effector = this.createBox(0.12, effectorHeight, 0.12);
        effector.material = this.matAccent;
        effector.position.y = effectorHeight / 2;
        j6.add(effector);

        // PUNKT TCP (Koniec końców)
        this.tcpPoint = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshBasicMaterial({color: 0xff0000}));
        this.tcpPoint.position.y = effectorHeight;
        j6.add(this.tcpPoint);

        // --- ETYKIETA XYZ ---
        this.tcpLabel = this.createLabelSprite("TCP: 0, 0, 0");
        this.tcpLabel.position.set(0.35, 0.1, 0);
        this.tcpPoint.add(this.tcpLabel);

        this.joints = [j1, j2, j3, j4, j5, j6];
    }
    createTCPMarker() {
    // 1. Mała czerwona sferka (Punkt TCP)
        const sphereGeom = new THREE.SphereGeometry(0.05, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.tcpPoint = new THREE.Mesh(sphereGeom, sphereMat);

        // Dodajemy punkt do ostatniego stawu (j6) z lekkim offsetem
        this.joints[5].add(this.tcpPoint);
        this.tcpPoint.position.y = 0.2; // Offset od osi J6 do faktycznego końca

        // 2. Etykieta Sprite
        this.tcpLabel = this.createLabelSprite("TCP: 0, 0, 0");
        this.tcpLabel.position.set(0.4, 0.2, 0); // Pozycja obok punktu
        this.tcpPoint.add(this.tcpLabel);
    }

// Pomocnicza metoda do tworzenia napisu na teksturze
    createLabelSprite(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Tło napisu
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 24px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(text, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.8, 0.2, 1);
        return sprite;
    }

    // Metoda do aktualizacji tekstu (wywoływana z main.js)
    updateTCPText(coords) {
        if (!this.tcpLabel) return;
        const text = `X:${coords.x} Y:${coords.y} Z:${coords.z}`;
        const canvas = this.tcpLabel.material.map.image;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(52, 152, 219, 0.8)'; // Kolor Twojego akcentu (blue)
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 24px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(text, 128, 40);

        this.tcpLabel.material.map.needsUpdate = true;
    }
    // Funkcja aktualizująca obroty
    update(anglesDeg) {
        if (this.joints.length < 6) return;
        const rad = anglesDeg.map(a => a * (Math.PI / 180));

        this.joints[0].rotation.y = rad[0]; // J1 ROLL (oś Y)
        this.joints[1].rotation.z = rad[1]; // J2 PITCH (oś Z)
        this.joints[2].rotation.z = rad[2]; // J3 PITCH (oś Z)
        this.joints[3].rotation.y = rad[3]; // J4 ROLL (oś Y)
        this.joints[4].rotation.z = rad[4]; // J5 PITCH (oś Z)
        this.joints[5].rotation.y = rad[5]; // J6 ROLL (oś Y)
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

}