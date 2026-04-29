from flask import Flask, render_template, jsonify, request
import numpy as np
from kinematics_solver import solve_ik, P_tcp_func, generate_trajectory
import json

CONFIG_FILE = 'config.json'

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_config')
def get_config():
    try:
        with open(CONFIG_FILE, 'r') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        return jsonify({'error': 'Config file not found'}), 404

@app.route('/save_config', methods=['POST'])
def save_config():
    new_data = request.json
    config_to_save = {k: float(v) for k, v in new_data.items()}
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config_to_save, f, indent=4)

    return jsonify({"status":"success"})


@app.route('/calculate', methods=['POST'])
def calculate():
    data = request.json
    angles = np.radians(data.get('angles', [0]*6))
    coords = P_tcp_func(*angles).flatten()
    return jsonify({
        'status': 'success',
        'coords': {'x': round(coords[0], 3), 'y': round(coords[1], 3), 'z': round(coords[2], 3)}
    })

@app.route('/calculate_step', methods=['POST'])
def calculate_step():
    data = request.json
    new_angles = solve_ik(data['target_xyz'], data['current_angles'])
    return jsonify({'angles': new_angles}) if new_angles else (jsonify({'error': 'Limit'}), 400)

@app.route('/calculate_full_path', methods=['POST'])
def calculate_full_path():
    data = request.json
    path = generate_trajectory(data['start_angles'], data['target_xyz'], steps=60)
    if path:
        return jsonify({'status': 'success', 'path': path})
    return jsonify({'status': 'error'}), 400


if __name__ == '__main__':
    app.run(debug=True)