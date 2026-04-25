import sympy as sp
import numpy as np


def kinematics_func():
    # Deklaracja symboli kątów (q1-q6) i wymiarów ramion
    q = sp.symbols('q1:7')
    L_BASE, L_ARM1, L_ARM2, L_ARM3 = sp.symbols('L_BASE L_ARM1 L_ARM2 L_ARM3')

    # Funkcje pomocnicze dla macierzy transformacji jednorodnej 4x4
    def roty(a):
        return sp.Matrix([
            [sp.cos(a), 0, sp.sin(a), 0],
            [0, 1, 0, 0],
            [-sp.sin(a), 0, sp.cos(a), 0],
            [0, 0, 0, 1]
        ])

    def rotz(a):
        return sp.Matrix([
            [sp.cos(a), -sp.sin(a), 0, 0],
            [sp.sin(a), sp.cos(a), 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ])

    def translation(x, y, z):
        return sp.Matrix([
            [1, 0, 0, x],
            [0, 1, 0, y],
            [0, 0, 1, z],
            [0, 0, 0, 1]
        ])

    # Odtworzenie łańcucha kinematycznego z symulacji:
    # Start w (0,0,0) -> J1 (Z) -> Base Link
    M = rotz(q[0]) * translation(0, 0, L_BASE)

    # J2 (Y) -> Arm1
    M = M * roty(q[1]) * translation(0, 0, L_ARM1)

    # J3 (Y) -> Arm2/2
    M = M * roty(q[2]) * translation(0, 0, L_ARM2 / 2)

    # J4 (Z) -> Arm2/2
    M = M * rotz(q[3]) * translation(0, 0, L_ARM2 / 2)

    # J5 (Y) -> Arm3/2
    M = M * roty(q[4]) * translation(0, 0, L_ARM3 / 2)

    # J6 (Z) -> Arm3/2 (TCP)
    M = M * rotz(q[5]) * translation(0, 0, L_ARM3 / 2)

    # Wyciągnięcie pozycji końcowej (ostatnia kolumna, pierwsze 3 wiersze)
    pos = M[0:3, 3]

    # Generowanie funkcji numerycznej
    return sp.lambdify((q, L_BASE, L_ARM1, L_ARM2, L_ARM3), pos, 'numpy')


_numeric_engine = kinematics_func()


def get_kinematic_coords(angles_deg, dimensions):
    """
    angles_deg: lista/tuple 6 kątów w stopniach
    dimensions: tuple (L_BASE, L_ARM1, L_ARM2, L_ARM3)
    """
    angles_rad = np.radians(angles_deg)
    res = _numeric_engine(angles_rad, *dimensions)
    return res.flatten()