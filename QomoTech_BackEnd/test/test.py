

import sys, os

# 把 QomoTech_BackEnd 目录和项目根目录加入 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from QomoTech_BackEnd.services.program_control_freeparam.geometry import 构建执行任务的参数
from QomoTech_BackEnd.core.calc_rotation import 计算点绕坐标轴旋转

# 设备的旋转中心     
product4p_center_rotation = {"X": 56.091, "Y": -123.291, "Z": -49.648}
旋转之后的点 = 计算点绕坐标轴旋转({"x": 1.4142, "y": 0, "z": 18.395}, 60, "y")
print(旋转之后的点)

print(f"计算的到的旋转切割点:{旋转之后的点.get("x")+product4p_center_rotation.get("X")}")
print(f"计算的到的旋转切割点Y:{旋转之后的点.get("y")+product4p_center_rotation.get("Y")}")
print(f"计算的到的旋转切割点Z:{旋转之后的点.get("z")+product4p_center_rotation.get("Z")}")
print(构建执行任务的参数({"直径": 4, "分割数":4, "角度": 30, "高度": 4}, -31.253))