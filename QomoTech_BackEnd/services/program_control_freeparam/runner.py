from typing import Any

from services.MotionService import MotionService
from services.program_control_freeparam.geometry import 生成切割实体
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
        print(f"    回到起点失败: {e}")
        return False


def _构建配方数据(配方链: dict[str, Any], 切割高度: float) -> dict[str, Any]:
    """将前端解析的配方链转换为 PragramService/RecipeResolver 期望的格式。"""
    主配方 = 配方链.get("main") or {}
    加工配方 = 配方链.get("machining")
    扫黑配方 = 配方链.get("blackening")
    垂直配方 = 配方链.get("vertical")
    水平配方 = 配方链.get("horizontal")
    加工激光 = 配方链.get("machiningLaser")
    扫黑激光 = 配方链.get("blackeningLaser")

    激光配方列表 = [r for r in (加工激光, 扫黑激光) if r]

    return {
        "selectedMainRecipe": 主配方,
        "selectedMachiningRecipe": [加工配方] if 加工配方 else [],
        "selectedBlackeningRecipe": [扫黑配方] if 扫黑配方 else [],
        "selectedLaserRecipe": 激光配方列表,
        "selectedHorizontal": [水平配方] if 水平配方 else [],
        "selectedVertical": [垂直配方] if 垂直配方 else [],
        "extraHeight": 切割高度,
    }


# ======================================================================
# Runner
# ======================================================================

class ProgramRunnerFreeParam:

    def __init__(self) -> None:
        self._运动 = MotionService.获取实例()

    async def 执行自由编辑参数(self,*,配方数据: dict[str, Any],实体数据: list[dict[str, Any]]) -> dict[str, Any]:
        任务总数 = len(实体数据)
        print(f"[FreeParam] ====== 开始执行，共 {任务总数} 个任务 ======")

        # 记录当前 XYZ 坐标，执行完成后回到起点
        # try:
        #     StartX, StartY = await self._运动.取_xy_实际位置()
        #     StartZ = await self._运动.取_z_实际位置()
        # except Exception:
        #     return {"success": False, "message": "记录当前XYZ坐标失败"}

        for 序号, 行数据 in enumerate(实体数据):
            当前序号 = 序号 + 1
            直径 = float(行数据.get("diameter", 0))
            角度 = float(行数据.get("angle", 0))
            高度 = float(行数据.get("height", 0))
            分度 = int(行数据.get("divisions", 0))
            配方链 = 行数据.get("recipe") or {}

            print(f"\n[FreeParam] ======== 任务 {当前序号}/{任务总数} ========")
            print(f"    直径: {直径} mm, 角度: {角度}°, 高度: {高度} mm, 分度: {分度}")
            print(f"    U轴旋转角度:要去计算")

            for i in range(分度):
                print(f"    切割第{i}/{分度}个分度")

                print(f"    X轴移动")

                # 生成切割实体
                # 切割实体 = 生成切割实体(直径=直径)

                # 构建 PragramService 期望的配方数据格式
                # 行配方数据 = _构建配方数据(配方链, 高度)
                print(f"    开始切割")
                # 执行切割
                try:
                    # result = await PragramService.获取实例().执行程序(配方数据=行配方数据,实体数据=[切割实体])
                    # print(f"    切割结果: {result}")
                    print(f"    切割结果: ")
                except Exception as e:
                    print(f"    切割失败: {e}")
                    # await _回到起点(self._运动, StartX, StartY, StartZ)
                    return {"success": False, "message": f"任务 {当前序号} 执行失败: {e}"}

                # 每个任务完成后回到起点
                # await _回到起点(self._运动, StartX, StartY, StartZ)
                print(f"    旋转R轴开始切割下一个分度...")

        print(f"\n[FreeParam] ====== 全部完成，共处理 {任务总数} 个任务 =====")
        return {"success": True, "task_count": 任务总数}
