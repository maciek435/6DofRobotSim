import numpy as np
import sympy as sp
from scipy.optimize import least_squares


q_sym = sp.symbols('q1:7', real=True)

# --- WYMIARY ---
D = {
    'baseH': 0.8,
    'j1_tall': 0.7,
    'biceps': 1.5,
    'forearm': 1.3,
    'wrist_off': 0.2, # Przesunięcie J6
    'effector': 0.4
}

def rot_y(q):
    return sp.Matrix([[sp.cos(q), 0, sp.sin(q), 0], [0, 1, 0, 0], [-sp.sin(q), 0, sp.cos(q), 0], [0, 0, 0, 1]])

def rot_z(q):
    return sp.Matrix([[sp.cos(q), -sp.sin(q), 0, 0], [sp.sin(q), sp.cos(q), 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])

def trans_y(l):
    return sp.Matrix([[1,0,0,0], [0,1,0,l], [0,0,1,0], [0,0,0,1]])

M = sp.eye(4)

M = M * trans_y(D['baseH']/2) * rot_y(q_sym[0])

M = M * trans_y(D['j1_tall']/2)

M = M * trans_y(D['j1_tall']/2) * rot_z(q_sym[1])

M = M * trans_y(D['biceps']/2)

M = M * trans_y(D['biceps']/2) * rot_z(q_sym[2])

M = M * trans_y(D['forearm'])

M = M * rot_y(q_sym[3]) * rot_z(q_sym[4])

M = M * trans_y(D['wrist_off']) * rot_y(q_sym[5])

M = M * trans_y(D['effector'])

P_tcp_func = sp.lambdify((q_sym), M[:3, 3], 'numpy')

def solve_ik(target_xyz, current_angles_deg):
    pos_target = np.array(target_xyz)
    init_guess = np.radians(current_angles_deg)
    def equations(q): return P_tcp_func(*q).flatten() - pos_target
    bounds = ([-np.pi, -np.pi/2, -np.pi, -np.pi, -np.pi/2, -np.pi],
              [np.pi, np.pi/2, np.pi, np.pi, np.pi/2, np.pi])
    res = least_squares(equations, init_guess, bounds=bounds, ftol=1e-3)
    return np.degrees(res.x).tolist() if res.success else None

# Dla app.py
def generate_trajectory(start_angles, target_xyz, steps=30):
    final_angles = solve_ik(target_xyz, start_angles)
    if not final_angles: return None
    return [np.linspace(s, f, steps).tolist() for s, f in zip(start_angles, final_angles)]