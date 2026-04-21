import math
from typing import Any, Dict, List, Optional, TypedDict, Union
from core.calc_offset_ljs import 采样圆弧上的点
from config.product4P_config import 读取存储的4P旋转中心补偿值


class Point3DDict(TypedDict):
    x: float
    y: float
    z: float
def 安全转化三维点(obj: Any,默认的Z轴高度:float = 37) -> Optional[Point3DDict]:
    """
    作用：把任意对象安全转换为三维点。
    规则：
        - 必须为 dict，且包含数值型 x/y；
        - z 可缺省，缺省时按 0.0 处理；
        - 任一坐标为 NaN/Inf 时返回 None。
    """
    if not isinstance(obj, dict):return None

    x = obj.get("x")
    y = obj.get("y")
    z = obj.get("z", 默认的Z轴高度)
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)) or not isinstance(z, (int, float)):return None

    xf = float(x)
    yf = float(y)
    zf = float(z)
    if not math.isfinite(xf) or not math.isfinite(yf) or not math.isfinite(zf):return None

    return {"x": xf, "y": yf, "z": zf}


def 规范旋转轴(axis: Any) -> str:
    """
    作用：规范旋转轴，只允许 x/y/z。
    """
    if isinstance(axis, str):
        normalized = axis.strip().lower()
        if normalized in {"x", "y", "z"}:
            return normalized
    raise ValueError("rotation_axis 仅支持 'x'、'y'、'z'")


def 构建绕坐标轴旋转矩阵(rotation_axis: str, angle_deg: float) -> List[List[float]]:
    """
    作用：构建 4x4 齐次旋转矩阵（绕原点）。
    输入角度为度数，内部自动转弧度。
    """
    rad = math.radians(float(angle_deg))
    c = math.cos(rad)
    s = math.sin(rad)

    if rotation_axis == "x":
        return [
            [1.0, 0.0, 0.0, 0.0],
            [0.0, c, -s, 0.0],
            [0.0, s, c, 0.0],
            [0.0, 0.0, 0.0, 1.0],
        ]
    if rotation_axis == "y":
        return [
            [c, 0.0, s, 0.0],
            [0.0, 1.0, 0.0, 0.0],
            [-s, 0.0, c, 0.0],
            [0.0, 0.0, 0.0, 1.0],
        ]
    return [
        [c, -s, 0.0, 0.0],
        [s, c, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def _旋转单个点(point: Dict[str, Any], matrix: List[List[float]] , 默认的Z轴高度:float = 36.8) -> Point3DDict:
    normalized_point = 安全转化三维点(point,默认的Z轴高度)
    if normalized_point is None:
        raise ValueError("point 非法：需为包含数值 x/y（可选 z）的字典")

    vec = [normalized_point["x"], normalized_point["y"], normalized_point["z"], 1.0]
    x = round(matrix[0][0] * vec[0] + matrix[0][1] * vec[1] + matrix[0][2] * vec[2] + matrix[0][3] * vec[3],4)
    y = round(matrix[1][0] * vec[0] + matrix[1][1] * vec[1] + matrix[1][2] * vec[2] + matrix[1][3] * vec[3],4)
    z = round(matrix[2][0] * vec[0] + matrix[2][1] * vec[1] + matrix[2][2] * vec[2] + matrix[2][3] * vec[3],4)
    return {"x": x, "y": y, "z": z}


def 计算点绕坐标轴旋转(
    point_or_points: Union[Dict[str, Any], List[Dict[str, Any]]],
    angle_deg: float,
    rotation_axis: str,
) -> Union[Point3DDict, List[Point3DDict]]:
    """
    作用：对点执行矩阵旋转，返回旋转后的三维点（支持单点和点列表）。

    参数：
        point_or_points:
            - 单点：{"x":..,"y":..,"z":..}（z 可省略）；
            - 点列表：[{"x":..,"y":..}, ...]。
        angle_deg: 旋转角度（度）。
        rotation_axis: 旋转轴，仅支持 'x'/'y'/'z'。
    """
    if not isinstance(angle_deg, (int, float)) or not math.isfinite(float(angle_deg)):
        raise ValueError("angle_deg 非法：需为有限数值")

    axis = 规范旋转轴(rotation_axis)
    matrix = 构建绕坐标轴旋转矩阵(axis, float(angle_deg))
    Z轴中心点的高度 = abs(读取存储的4P旋转中心补偿值().Zoffset)

    if isinstance(point_or_points, list):
        return [_旋转单个点(item, matrix , Z轴中心点的高度) for item in point_or_points]

    return _旋转单个点(point_or_points, matrix)


def 计算实体绕坐标轴旋转后的实体点(所有实体数据:list[dict[str, Any]],旋转轴: str) -> list[dict[str,Any]]:
    返回实体数据点列表:list[dict[str,Any]] = []
    for 实体索引 in range(len(所有实体数据)):
        当前实体数据= 所有实体数据[实体索引]
        # 与前端 threeGeometry.ts 的 makeSurfaceAngleRotation 保持一致：
        # 前端按产品约定对 surfaceAngle 取反后再参与旋转
        当前实体数据角度 = (当前实体数据.get('surfaceAngle') or 0.0)
        当前实体数据类型 = 当前实体数据.get('type')
        当前实体开口方向 = 当前实体数据.get('openDirection')
        计算后的点: list[Point3DDict] = []
        if 当前实体数据类型 == 'LINE':
            计算后的点 = 计算点绕坐标轴旋转([当前实体数据.get('start'),当前实体数据.get('end')],当前实体数据角度,旋转轴)
        elif 当前实体数据类型 == 'ARC':
            # 先计算点3
            圆弧的点 = 采样圆弧上的点(center=当前实体数据.get('center'),radius=当前实体数据.get('radius'),start_angle=当前实体数据.get('startAngle'),end_angle=当前实体数据.get('endAngle'),segments=96)
            计算后的点 = 计算点绕坐标轴旋转(圆弧的点,当前实体数据角度,旋转轴)
            if len(计算后的点) > 0:
                最大z值 = max(point.get('z', 0.0) for point in 计算后的点)
                for point in 计算后的点:
                    point['z'] = 最大z值

        实体点数据字典 = {'type': 当前实体数据类型,'openDirection':当前实体开口方向,'points': 计算后的点}
        返回实体数据点列表.append(实体点数据字典)
    return 返回实体数据点列表




