"""程序执行步骤枚举 —— 替换原 startPragram.py 中的魔术数字。"""

from __future__ import annotations

import enum


class ProgramStep(enum.IntEnum):
    """程序执行的步骤编号，语义化命名替代原有 0/10/20/... 魔术数字。"""

    # 初始化与连接
    CHECK_CONNECTION = 0
    MOVE_TO_START = 10
    WAIT_XY_IDLE = 20

    # 激光模式选择
    SELECT_LASER_MODE = 30
    SEND_BLACKENING_LASER = 31
    SEND_WORK_LASER = 32

    # 激光输出使能
    ENABLE_LASER_OUTPUT = 40
    START_R_AXIS_ROTATION = 41

    # 深度检查
    CHECK_DESCENT_LIMIT = 50

    # Z 轴下降
    DESCEND_Z = 60
    WAIT_Z_IDLE = 70

    # XY 运动 / 插补
    EXECUTE_XY_INTERPOLATION = 80
    CHECK_REPEAT_CUT = 81
    WAIT_XY_IDLE_POST_CUT = 82

    # 开口偏移
    UPDATE_OPENING_OFFSET = 90

    # R 轴切圆专用
    READ_R_POSITION = 90  # 与 UPDATE_OPENING_OFFSET 同值但不同上下文
    WAIT_R_ROTATION_COMPLETE = 90  # R 轴旋转等待循环

    # 降层计算
    CALCULATE_NEXT_LAYER = 100
    MOVE_TO_NEXT_LAYER_X = 100  # R 轴模式下的 X 移动
    CHECK_X_IDLE = 110

    # 4P 专用
    ROTATE_U_AXIS = 12
    WAIT_U_ROTATION = 13

    # 中转
    STEP_110 = 110
    STEP_120 = 120
    STEP_130 = 130
    STEP_140 = 140
    STEP_150 = 150

    # 清理
    CLEANUP = 300
    WAIT_Z_RETURN = 301

    # 终止
    DONE = 999
    TERMINAL = 9999
