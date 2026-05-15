


from configs import system_settings as 系统设置
from configs.system_settings import 中心旋转补偿请求模型

# =====================================================
# 设备旋转中心补偿值字段
旋转中心补偿值字段 = "product4p_center_rotation"
def 读取存储的4P旋转中心补偿值() -> 中心旋转补偿请求模型:
    raw = 系统设置.读取系统设置字段(旋转中心补偿值字段)
    if raw is None:
        return 中心旋转补偿请求模型()
    try:
        return 中心旋转补偿请求模型(
            X=float(raw.get("X", 0)),
            Y=float(raw.get("Y", 0)),
            Z=float(raw.get("Z", 0)),
        )
    except (TypeError, ValueError):
        return 中心旋转补偿请求模型()
# ——————————————————————————————————————————————————————
product4p_center_rotation = 读取存储的4P旋转中心补偿值()
# ——————————————————————————————————————————————————————

def 保存4P旋转中心的补偿值(payload: 中心旋转补偿请求模型) -> 中心旋转补偿请求模型:
    标准化 = 中心旋转补偿请求模型(
        X=round(float(payload.X), 4),
        Y=round(float(payload.Y), 4),
        Z=round(float(payload.Z), 4),
    )
    系统设置.保存系统设置字段(旋转中心补偿值字段, 标准化.model_dump())
    global product4p_center_rotation
    product4p_center_rotation = 标准化
    return 获取4P旋转中心的补偿值()

def 获取4P旋转中心的补偿值() -> 中心旋转补偿请求模型:
    return 中心旋转补偿请求模型(**product4p_center_rotation.model_dump())
# =====================================================
