import math
from typing import Any

from services.SystemSettingService import 获取4P旋转中心的补偿值
from services.MotionService import MotionService
from services.program_control_4p.geometry import 计算钻石几何参数, 提取坐标
from services.PragramService import PragramService


async def _回到起点(运动服务: MotionService, StartX: float, StartY: float, StartZ: float) -> bool:
    try:
        await 运动服务.绝对运动("X", StartX)
        await 运动服务.绝对运动("Y", StartY)
        await 运动服务.绝对运动("Z", StartZ)
        await 运动服务.等待静止("X")
        await 运动服务.等待静止("Y")
        await 运动服务.等待静止("Z")
        return True
    except Exception as e:
        print(f"    回到起点失败: {e}, 失败原因: {e}")
        return False

# ======================================================================
# Runner
# ======================================================================

class ProgramRunnerFreeParam:

    def __init__(self) -> None:
        self._运动 = MotionService.获取实例()

    async def 执行自由编辑参数(self,*,配方数据: dict[str, Any],实体数据: list[dict[str, Any]],) -> dict[str, Any]:
        print(f"[4P] ====== 开始执行，共======")

        # 首先记录当前XYZ的坐标
        try:
            StartX, StartY= await self._运动.取_xy_实际位置()
            StartZ = await self._运动.取_z_实际位置()
        except Exception:
            return {"success": False, "message": "记录当前XYZ的坐标失败"}

        return {"success": True,}
