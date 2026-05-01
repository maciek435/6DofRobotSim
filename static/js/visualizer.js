import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class RobotVisualizer {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.joints = [];

        // --- KONFIGURACJA WYMIARÓW ---
        this.D = {
            baseHeight: config.baseH,
            j1_tall: config.j1_tall,
            armBicepsLen: config.biceps,
            armForearmFullLen: config.forearm,
            wrist_off: config.wrist_off,
            effectorHeight: config.effector,

            baseRadius: 0.4,
            radius: 0.18,
            accentColor: 0x3498db,
            bodyColor: 0xeeeeee
        };
        this.j4_pos_factor = 0.7; // J4 jest na 70% długości przedramienia

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf4f4f4);
        this.camera = new THREE.PerspectiveCamera(60, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);
        new OrbitControls(this.camera, this.renderer.domElement);
        this.scene.add(new THREE.GridHelper(10, 20), new THREE.AmbientLight(0xffffff, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 1);
        sun.position.set(5, 10, 5);
        this.scene.add(sun);
        this.matBody = new THREE.MeshStandardMaterial({ color: this.D.bodyColor, roughness: 0.7 });
        this.matAccent = new THREE.MeshStandardMaterial({ color: this.D.accentColor, roughness: 0.4, metalness: 0.3 });
        this.createRobot();
        this.animate();
        window.addEventListener('resize', () => this.onResize());
    }

    createBox(w, h, d) {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.matBody);
    }

    createJointVisual(rad, isRoll = false) {
        const group = new THREE.Group();
        if (isRoll) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.05, rad * 1.05, 0.05, 32), this.matAccent));
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

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, this.D.baseHeight, 32), this.matBody);
        base.position.y = this.D.baseHeight / 2;
        robot.add(base);

        // J1
        const j1 = new THREE.Group();
        j1.position.y = this.D.baseHeight / 2;
        base.add(j1);
        const l1_link = this.createBox(0.36, this.D.j1_tall, 0.36);
        l1_link.position.y = this.D.j1_tall / 2;
        j1.add(l1_link);

        // J2
        const j2 = new THREE.Group();
        j2.position.y = this.D.j1_tall;
        j2.add(this.createJointVisual(0.18, false));
        j1.add(j2);
        const l2_link = this.createBox(0.3, this.D.armBicepsLen, 0.3);
        l2_link.position.y = this.D.armBicepsLen / 2;
        j2.add(l2_link);

        // J3
        const j3 = new THREE.Group();
        j3.position.y = this.D.armBicepsLen;
        j3.add(this.createJointVisual(0.16, false));
        j2.add(j3);

        // Przedramię z J4
        const j4_pos = this.D.armForearmFullLen * this.j4_pos_factor;
        const l3_fixed = this.createBox(0.25, j4_pos, 0.25);
        l3_fixed.position.y = j4_pos / 2;
        j3.add(l3_fixed);

        // J4
        const j4 = new THREE.Group();
        j4.position.y = j4_pos;
        j4.add(this.createJointVisual(0.14, true));
        j3.add(j4);
        const l4_rotating = this.createBox(0.25, this.D.armForearmFullLen - j4_pos, 0.25);
        l4_rotating.position.y = (this.D.armForearmFullLen - j4_pos) / 2;
        j4.add(l4_rotating);

        // J5
        const j5 = new THREE.Group();
        j5.position.y = this.D.armForearmFullLen - j4_pos;
        j5.add(this.createJointVisual(0.12, false));
        j4.add(j5);

        // J6
        const j6 = new THREE.Group();
        j6.position.y = 0.2; // Offset nadgarstka
        j6.add(this.createJointVisual(0.1, true));
        j5.add(j6);
        const effector = this.createBox(0.12, this.D.effectorHeight, 0.12);
        effector.material = this.matAccent;
        effector.position.y = this.D.effectorHeight / 2;
        j6.add(effector);

        // --- TCP MARKER ---
        this.tcpMarker = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({color: 0xff0000}));
        this.tcpMarker.position.y = this.D.effectorHeight;
        j6.add(this.tcpMarker);

        // Label
        this.tcpLabel = this.createLabelSprite("TCP: 0, 0, 0");
        this.tcpLabel.position.set(0.5, 0, 0);
        this.tcpMarker.add(this.tcpLabel);

        this.joints = [j1, j2, j3, j4, j5, j6];
    }

    createLabelSprite(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256; canvas.height = 64;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 24px Arial'; ctx.fillStyle = 'white'; ctx.textAlign = 'center';
        ctx.fillText(text, 128, 42);
        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
        sprite.scale.set(0.8, 0.2, 1);
        return sprite;
    }

    updateTCPText(coords) {
        if (!this.tcpLabel) return;
        const text = `X:${coords.x.toFixed(2)} Y:${coords.z.toFixed(2)} Z:${coords.y.toFixed(2)}`;
        const canvas = this.tcpLabel.material.map.image;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 22px Arial'; ctx.fillStyle = 'white'; ctx.textAlign = 'center';
        ctx.fillText(text, 128, 42);
        this.tcpLabel.material.map.needsUpdate = true;
    }

    update(anglesDeg) {
        if (this.joints.length < 6) return;
        const rad = anglesDeg.map(a => a * (Math.PI / 180));
        this.joints[0].rotation.y = rad[0];
        this.joints[1].rotation.z = rad[1];
        this.joints[2].rotation.z = rad[2];
        this.joints[3].rotation.y = rad[3];
        this.joints[4].rotation.z = rad[4];
        this.joints[5].rotation.y = rad[5];
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    animate() { requestAnimationFrame(() => this.animate()); this.renderer.render(this.scene, this.camera); }
}