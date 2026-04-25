from flask import Flask, render_template, jsonify, request
from forward_kinematics import get_kinematic_coords

app = Flask(__name__)

L_DIMS = (1.5, 1.5, 1.3, 0.4)


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    data = request.json
    angles = data.get('angles', [0, 0, 0, 0, 0, 0])
    x, y, z = get_kinematic_coords(angles, L_DIMS)

    return jsonify({
        'status': 'success',
        'coords': {'x': round(x, 2), 'y': round(y, 2), 'z': round(z, 2)}
    })


if __name__ == '__main__':
    app.run(debug=True)