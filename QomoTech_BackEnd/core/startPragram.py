from __future__ import annotations

import asyncio
import math
from typing import Any

from core.calc_offset_ljs import OffsetEndpointCalculator
from services.MotionService import MotionService
from services.Rs232Service import Rs232Service
from core.program_status_ws import 推送改变的程序运行状态
from configs.product4P_config import 读取存储的4P旋转中心补偿值
from core.calc_rotation import 计算点绕坐标轴旋转,计算实体绕坐标轴旋转后的实体点
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序执行")
_program_running = False
_program_paused = False
_program_abort_requested = False
_program_skip_requested = False
# 暂停运动的激光状态
_laser_resume_required = False
_program_total_tasks = 0
_program_current_task_index = 0
_program_current_task_jindubaifenbi = 0.0
_ALARM_CLEAR_AXIS_NOS = (0, 1, 2, 3, 4)

# 轴号 → 轴名映射（从 sync_motion.py 迁移）
_轴号映射: dict[int, str] = {0: "X", 1: "Y", 2: "Z", 3: "U", 4: "R"}
# 阻塞操作锁：保护 program flag 读写（async 单线程下用 asyncio.Lock）
_ctrl_lock = asyncio.Lock()
_run_lock = asyncio.Lock()


def 获取设备运行状态() -> dict[str, Any]:
    进度百分比 = max(0.0, min(100.0, float(_program_current_task_jindubaifenbi)))
    return {
        "running": bool(_program_running),
        "paused": bool(_program_paused),
        "total_tasks": int(_program_total_tasks),
        "current_task_index": int(_program_current_task_index),
        "进度百分比": 进度百分比,
    }


async def 清除运行输出() -> None:
    运动服务 = MotionService.获取实例()
    try:
        await 运动服务.停止运动()
        await 运动服务.设置输出(0, False)
        await 运动服务.设置输出(2, False)
    except Exception:
        日志.exception("runtime_cleanup_outputs failed")


async def 跳过任务时处理并回到目标Z轴位置(
    *,
    z轴目标: float | None,
    速度: float,
) -> str:
    """
    统一处理"跳过任务"：
    1) 先执行停机和关闭输出；
    2) 若提供了目标 Z，则补一次 Z 轴定位，尽量与正常流程的首次目标位保持一致；
    3) 清除 skip 标记并返回 "skip"。
    """
    运动服务 = MotionService.获取实例()
    await 清除运行输出()
    if z轴目标 is not None:
        try:
            安全速度 = float(速度) if float(速度) > 0 else 10.0
        except Exception:
            安全速度 = 10.0
        try:
            await 运动服务.绝对运动并设速度("Z", float(z轴目标), 安全速度)
            等待计数 = 0
            while 等待计数 < 2000:
                if await 运动服务.读_idle("Z"):
                    break
                等待计数 += 1
                await asyncio.sleep(0.01)
        except Exception:
            日志.exception("skip_reposition_z failed")
    _clear_skip_request()
    return "skip"


async def 程序请求暂停() -> dict[str, Any]:
    global _program_paused, _laser_resume_required
    运动服务 = MotionService.获取实例()
    async with _ctrl_lock:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_paused = True
    if 运动服务.适配器 and 运动服务.适配器.已连接:
        激光之前开启 = await 运动服务.读_输出(2)
        _laser_resume_required = 激光之前开启
        if 激光之前开启:
            await 运动服务.设置输出(2, False)
        await 运动服务.急停()
    推送改变的程序运行状态(force=True)
    return {"success": True, "message": "已暂停"}


async def 程序请求恢复运行() -> dict[str, Any]:
    global _program_paused, _laser_resume_required
    运动服务 = MotionService.获取实例()
    async with _ctrl_lock:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_paused = False
    if 运动服务.适配器 and 运动服务.适配器.已连接 and _laser_resume_required:
        await 运动服务.设置输出(2, True)
        _laser_resume_required = False
    推送改变的程序运行状态(force=True)
    return {"success": True, "message": "已继续运行"}


async def 程序请求急停() -> dict[str, Any]:
    global _program_abort_requested, _program_paused, _laser_resume_required
    运动服务 = MotionService.获取实例()
    async with _ctrl_lock:
        _program_abort_requested = True
        _program_paused = False
        _laser_resume_required = False
    if 运动服务.适配器 and 运动服务.适配器.已连接:
        await 运动服务.设置输出(0, False)
        await 运动服务.设置输出(2, False)
        await 运动服务.急停()
    推送改变的程序运行状态(force=True)
    return {"success": True, "message": "已急停"}


async def 程序请求跳过任务() -> dict[str, Any]:
    global _program_skip_requested
    运动服务 = MotionService.获取实例()
    async with _ctrl_lock:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_skip_requested = True
    if 运动服务.适配器 and 运动服务.适配器.已连接:
        await 运动服务.急停()
    推送改变的程序运行状态(force=True)
    return {"success": True, "message": "已请求跳过当前任务"}


async def 程序请求复位() -> dict[str, Any]:
    try:
        运动服务 = MotionService.获取实例()
    except Exception:
        return {"success": False, "message": "MotionService 未启动"}
    if not 运动服务.适配器 or not 运动服务.适配器.已连接:
        return {"success": False, "message": "motion 控制器未连接"}
    失败列表: list[int] = []
    for 轴号 in _ALARM_CLEAR_AXIS_NOS:
        try:
            await 运动服务.清除轴错误(_轴号映射[int(轴号)])
        except Exception:
            失败列表.append(int(轴号))
    if 失败列表:
        return {"success": False, "message": f"部分轴清除报警失败: {失败列表}"}
    await 运动服务.复位()
    return {"success": True, "message": "报警已清除，状态机已复位"}


async def _abort_pending() -> bool:
    async with _ctrl_lock:
        return bool(_program_abort_requested)


async def _skip_requested() -> bool:
    async with _ctrl_lock:
        return bool(_program_skip_requested)


def _clear_skip_request() -> None:
    global _program_skip_requested
    _program_skip_requested = False


async def _paused() -> bool:
    async with _ctrl_lock:
        return bool(_program_paused)


def 更新程序任务运行进程(
    *,
    任务总数: int | None = None,
    当前任务序号: int | None = None,
    current_task_jindubaifenbi: float | None = None,
) -> None:
    global _program_total_tasks, _program_current_task_index, _program_current_task_jindubaifenbi
    if 任务总数 is not None:
        _program_total_tasks = max(0, int(任务总数))
    if 当前任务序号 is not None:
        _program_current_task_index = max(0, int(当前任务序号))
    if current_task_jindubaifenbi is not None:
        _program_current_task_jindubaifenbi = max(0.0, min(100.0, float(current_task_jindubaifenbi)))
    推送改变的程序运行状态()


async def _rebuild_xy_path_from_current(原始运行点位: list[dict[str, Any]]) -> list[dict[str, Any]]:
    运动服务 = MotionService.获取实例()
    x0, y0 = await 运动服务.取_xy_实际位置()

    转换点: list[tuple[float, float]] = []
    for p in 原始运行点位:
        if isinstance(p, dict):
            转换点.append((float(p["x"]), float(p["y"])))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            转换点.append((float(p[0]), float(p[1])))
        else:
            continue
    if not 转换点:
        return [{"x": x0, "y": y0}, {"x": x0, "y": y0}]
    最佳索引 = 0
    最小距离 = float("inf")
    for i, (x, y) in enumerate(转换点):
        d = math.hypot(x - x0, y - y0)
        if d < 最小距离:
            最小距离 = d
            最佳索引 = i
    剩余点 = [{"x": x, "y": y} for x, y in 转换点[最佳索引 + 1 :]]
    头部点 = [{"x": x0, "y": y0}]
    if not 剩余点:
        return 头部点 + [{"x": 转换点[最佳索引][0], "y": 转换点[最佳索引][1]}]
    return 头部点 + 剩余点

# TODO：现在想急停是不是需要将其放进去
async def 安全拉取是否空闲(轴号: int, 超时次数: int = 2000, 休眠秒: float = 0.02) -> dict[str, Any]:
    """安全轮询轴静止状态，返回 {"success": bool, "notMoving": bool, "skip": bool, "abort": bool}"""
    运动服务 = MotionService.获取实例()
    轴名 = _轴号映射.get(int(轴号))
    if 轴名 is None: return {"success": False, "notMoving": False, "message": f"未知轴号: {轴号}"}
    for _ in range(超时次数):
        if await _abort_pending():
            return {"success": False, "notMoving": False, "abort": True}
        if await _skip_requested():
            return {"success": False, "notMoving": False, "skip": True}
        if await _paused():
            await asyncio.sleep(0.05)
            continue
        try:
            是否空闲 = await 运动服务.读_idle(轴名)
            if 是否空闲: return {"success": True, "notMoving": True}
        except Exception:
            日志.exception("安全拉取是否空闲 axis=%s 失败列表", 轴号)
        await asyncio.sleep(休眠秒)
    return {"success": False, "notMoving": False, "message": "等待轴静止超时"}


async def 安全拉取xy轴是否空闲(超时次数: int = 2000, 休眠秒: float = 0.02) -> dict[str, Any]:
    """安全轮询 XY 双轴静止状态，返回 {"success": bool, "skip": bool, "abort": bool}"""
    运动服务 = MotionService.获取实例()
    for _ in range(超时次数):
        if await _abort_pending():
            return {"success": False, "abort": True}
        if await _skip_requested():
            return {"success": False, "skip": True}
        if await _paused():
            await asyncio.sleep(0.05)
            continue
        try:
            rx = await 运动服务.读_idle("X")
            ry = await 运动服务.读_idle("Y")
            if rx and ry:
                return {"success": True}
        except Exception:
            日志.exception("安全拉取xy轴是否空闲 失败列表")
        await asyncio.sleep(休眠秒)
    return {"success": False, "message": "等待 XY 轴静止超时"}


def 在配方中查找ID的配方(配方数据: Any, id: Any) -> dict[str, Any] | None:
    """
    在 配方数据 中查找具有 `id == id` 的 dict。
    - 配方数据 可以是 list[dict] / dict，且允许 dict 内嵌套 list/dict 继续递归查找
    - 找不到时返回 None
    """
    if 配方数据 is None:
        return None

    def _ids_equal(a: Any, b: Any) -> bool:
        if a is None or b is None:
            return a == b
        return str(a) == str(b)

    if isinstance(配方数据, (list, tuple)):
        for item in 配方数据:
            if isinstance(item, dict) and _ids_equal(item.get("id"), id):
                return item
            查找结果 = 在配方中查找ID的配方(item, id)
            if 查找结果 is not None:
                return 查找结果
        return None

    if isinstance(配方数据, dict):
        if _ids_equal(配方数据.get("id"), id):
            return 配方数据
        for value in 配方数据.values():
            查找结果 = 在配方中查找ID的配方(value, id)
            if 查找结果 is not None:
                return 查找结果
        return None

    return None


def 判断是否都是圆或者圆弧(*, 实体数据: Any) -> bool:
    """校验 实体数据 中每个实体的 type 是否都属于「圆 / 圆弧」。"""
    if not isinstance(实体数据, (list, tuple)) or len(实体数据) == 0:
        return False

    allowed_types = {"CIRCLE", "ARC", "圆", "圆弧"}
    for entity in 实体数据:
        if not isinstance(entity, dict):
            return False
        实体类型 = str(entity.get("type", "")).strip()
        if not 实体类型:
            return False
        if 实体类型.upper() not in {"CIRCLE", "ARC"} and 实体类型 not in allowed_types:
            return False
    return True


def 判断当前图形是否闭合(点位: list[dict[str, Any]], *, 误差: float = 0.001) -> bool:
    起始点, 结束点 = 点位[0], 点位[-1]
    return abs(float(起始点["x"]) - float(结束点["x"])) <= 误差 and abs(float(起始点["y"]) - float(结束点["y"])) <= 误差


async def 执行开始任务程序_最重要的(
    *,
    配方数据: dict[str, Any],
    实体数据: list[dict[str, Any]],
    串口配置: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """根据是否闭合来确定是往返运动？"""
    global _program_running, _program_abort_requested, _program_skip_requested, _program_paused, _laser_resume_required
    global _program_total_tasks, _program_current_task_index, _program_current_task_jindubaifenbi

    运动服务 = MotionService.获取实例()
    if not 运动服务.适配器 or not 运动服务.适配器.已连接:
        return {"success": False, "message": "motion 控制器未连接", "data": {"connected": False}}

    if _run_lock.locked():
        return {"success": False, "message": "程序正在执行中（重复触发被拒绝）", "data": None}

    async with _run_lock:
        await 运动服务.复位()
        try:
            # TODO：要不要删除？
            运动服务.暂停状态采集()
            if 串口配置 is None:
                串口配置 = Rs232Service.获取实例().获取首选会话()

            所有任务列表 = OffsetEndpointCalculator.calc_xy_points(实体数据, 0)
            if not 所有任务列表:
                return {"success": False, "message": "没有可执行的任务，请检查实体几何", "data": None}

            async with _ctrl_lock:
                _program_running = True
                _program_paused = False
                _program_abort_requested = False
                _program_skip_requested = False
                _laser_resume_required = False
            更新程序任务运行进程(任务总数=len(所有任务列表),当前任务序号=0,current_task_jindubaifenbi=0.0,)

            for 当前任务索引 in range(len(所有任务列表)):
                更新程序任务运行进程(当前任务序号=当前任务索引 + 1,current_task_jindubaifenbi=0.0,)
                if await _abort_pending():
                    await 清除运行输出()
                    return {"success": False, "message": "程序已急停", "data": None}

                主配方 = 配方数据.get("selectedMainRecipe") or {}
                加工工艺配方 = 在配方中查找ID的配方(配方数据.get("selectedMachiningRecipe"), 主配方.get("machiningRecipeId"),)
                加工工艺配方中的水平配方 = 在配方中查找ID的配方(配方数据.get("selectedHorizontal"), 加工工艺配方.get("horizontalFormulaId"),)
                加工工艺配方中的垂直配方 = 在配方中查找ID的配方(配方数据.get("selectedVertical"), 加工工艺配方.get("verticalFormulaId"),)
                垂直配方中的加工轴 = 加工工艺配方中的垂直配方.get("formula").get("cuttingAxis")
                判断是否都是圆或者圆弧的结果 = 判断是否都是圆或者圆弧(实体数据=实体数据)

                if 垂直配方中的加工轴 == 'R' and 判断是否都是圆或者圆弧的结果:
                    结果 = await 用旋转轴去切圆(
                        原始任务序号=当前任务索引,
                        配方数据=配方数据,
                        实体数据=实体数据,
                        串口配置=串口配置,
                    )
                if 垂直配方中的加工轴 == 'XY':
                    结果 = await 修面和切片的程序(
                        原始任务序号=当前任务索引,
                        配方数据=配方数据,
                        实体数据=实体数据,
                        串口配置=串口配置,
                    )
                # 结果 = await 进行4P切产品(原始任务序号=当前任务索引,配方数据=配方数据,实体数据=实体数据,串口配置=串口配置)

                if 结果 == "skip":
                    continue
                if 结果 == "abort":
                    return {"success": False, "message": "程序已急停", "data": None}
                if 结果 is False:
                    return {"success": False, "message": "运动失败", "data": None}

            if await _abort_pending():
                await 清除运行输出()
                return {"success": False, "message": "程序已急停", "data": None}
            return {"success": True, "message": "程序执行完成", "data": None}
        except Exception as 异常:
            日志.exception("执行开始任务程序_最重要的 失败列表")
            return {"success": False, "message": f"程序执行异常", "data": {"error": "运行报错"}}
        finally:
            运动服务.恢复状态采集()
            async with _ctrl_lock:
                _program_running = False
                _program_paused = False
                _program_skip_requested = False
                _program_abort_requested = False
                _laser_resume_required = False
                _program_total_tasks = 0
                _program_current_task_index = 0
                _program_current_task_jindubaifenbi = 0.0
            推送改变的程序运行状态(force=True)


# 每条直线切两次
async def 修面和切片的程序(
    原始任务序号: int,
    配方数据: dict[str, Any],
    实体数据: list[dict[str, Any]],
    *,
    串口配置: dict[str, Any] | None = None,
) -> bool | str:  # True / False / "skip" / "abort"
    """这个是单独拿出来的修面但是要和实际去相匹配"""
    运动服务 = MotionService.获取实例()

    主配方 = 配方数据.get("selectedMainRecipe") or {}
    主配方中的扫黑配方 = 在配方中查找ID的配方(配方数据.get("selectedBlackeningRecipe"), 主配方.get("blackeningRecipeId"))
    主配方中的工作配方 = 在配方中查找ID的配方(配方数据.get("selectedMachiningRecipe"), 主配方.get("machiningRecipeId"))

    if 主配方中的扫黑配方 is None or 主配方中的工作配方 is None:
        日志.warning("修面和切片的程序: 主配方 -> 子配方查找失败", extra={
            "mainRecipeId": 主配方.get("id"),
            "blackeningRecipeId": 主配方.get("blackeningRecipeId"),
            "machiningRecipeId": 主配方.get("machiningRecipeId"),
        })
        return False

    扫黑配方中的激光配方 = 在配方中查找ID的配方(配方数据.get("selectedLaserRecipe"), 主配方中的扫黑配方.get("laserPowerRecipeId"))
    
    工作配方中的激光配方 = 在配方中查找ID的配方(配方数据.get("selectedLaserRecipe"), 主配方中的工作配方.get("laserPowerRecipeId"))
    工作配方中的水平配方 = 在配方中查找ID的配方(配方数据.get("selectedHorizontal"), 主配方中的工作配方.get("horizontalFormulaId"))
    工作配方中的垂直配方 = 在配方中查找ID的配方(配方数据.get("selectedVertical"), 主配方中的工作配方.get("verticalFormulaId"))

    if (扫黑配方中的激光配方 is None or 工作配方中的激光配方 is None or 工作配方中的水平配方 is None or 工作配方中的垂直配方 is None):
        日志.warning("修面和切片的程序: 子配方 -> 公式/激光查找失败", extra={
            "blackeningRecipeId": 主配方中的扫黑配方.get("id"),
            "machiningRecipeId": 主配方中的工作配方.get("id"),
        })
        return False

    是否打开激光 = False
    是否打开扫黑功能 = bool(主配方中的扫黑配方.get("enabled"))
    扫黑上台的高度 = float(主配方中的扫黑配方.get("jiaojubuchang")) / 1000
    扫黑功率 = 扫黑配方中的激光配方.get("laserPower")
    扫黑频率 = 扫黑配方中的激光配方.get("laserFrequency")
    扫黑电流 = 扫黑配方中的激光配方.get("laserCurrent")
    工作功率 = 工作配方中的激光配方.get("laserPower")
    工作频率 = 工作配方中的激光配方.get("laserFrequency")
    工作电流 = 工作配方中的激光配方.get("laserCurrent")

    下开口K = float(工作配方中的水平配方.get('formula').get('lowerOpeningFormula').get('k'))
    下开口B = float(工作配方中的水平配方.get('formula').get('lowerOpeningFormula').get('b'))
    
    深度补偿K = float(工作配方中的水平配方.get('formula').get('depthCompensationFormula').get('k'))
    深度补偿B = float(工作配方中的水平配方.get('formula').get('depthCompensationFormula').get('b'))
    
    补偿角度K = float(工作配方中的水平配方.get('formula').get('compensationAngleFormula').get('k'))
    补偿角度B = float(工作配方中的水平配方.get('formula').get('compensationAngleFormula').get('b'))

    # TODO: 后续根据这些 recipe 对应字段执行真实运动逻辑
    当前步骤 = 0

    是否需要跳转计算下一层开口 = False
    进度百分比 = 0
    上层量 = 0
    变化百分比 = float(工作配方中的垂直配方.get("formula").get("changePercent"))

    累计下降量 = 0
    高度 = 总下降量 = float(配方数据.get('extraHeight'))
    角度K = float(工作配方中的水平配方.get('formula').get('angleFormula').get('k'))
    角度B = float(工作配方中的水平配方.get('formula').get('angleFormula').get('b'))
    角度 = 角度K * 高度 + 角度B
    tana = math.tan(math.radians(角度))

    当前开口值 = 0
    是否是从小到大的开口偏移 = True
    每次开口的偏移量 = float(工作配方中的垂直配方.get("formula").get("xFeed"))
    每次下降步长量 = float(工作配方中的垂直配方.get("formula").get("descentCutting").get("speed"))
    每次下降步长量减少量 = float(工作配方中的垂直配方.get("formula").get("descentCutting").get("zFeed"))

    当前切割次数 = 0
    是否在边缘位置 = True
    边缘切割次数 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("cutTimes"))
    中间切割次数 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("cutTimes"))

    每段子区间速度数量 = int(工作配方中的垂直配方.get("formula").get("edgeCutting").get("cutSpeedNums"))
    切割速度 = float(工作配方中的垂直配方.get("formula").get("xSpeed"))
    # 保留原始百分比值（0-100 范围），后续动态计算要用
    原始边缘切割速度百分比值 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("speed"))
    原始中间切割速度百分比值 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("speed"))
    边缘切割速度百分比 = 原始边缘切割速度百分比值 / 100
    中间切割速度百分比 = 原始中间切割速度百分比值 / 100
    边缘切割速度的变化K = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("change").get('k'))
    边缘切割速度的变化B = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("change").get('b'))
    中间切割速度的变化K = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("change").get('k'))
    中间切割速度的变化B = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("change").get('b'))

    开口形状 = 工作配方中的水平配方.get('formula').get('openingShape')

    最小的偏移 = 下开口值 = 下开口K * 高度 + 下开口B
    最大的偏移 = 上开口值 = 深度补偿K * 1000 * (高度 + 深度补偿B) * tana + 下开口值
    最小的偏移 = 0
    # 最大的偏移 = 最小的偏移+下开口B

    是否需要反转 = False
    当前没有偏移的点位 = OffsetEndpointCalculator.calc_xy_points(实体数据, 0)[原始任务序号]
    原始点数据_插补数据 = 当前没有偏移的点位.copy()
    上一轮是否需要闭合 = 判断当前图形是否闭合(原始点数据_插补数据)

    焦距补偿 = 工作配方中的水平配方.get('formula').get('focusCompensation')
    当前Z轴的位置 = await 运动服务.取_z_实际位置() + float(焦距补偿)
    首次目标Z轴位置 = float(当前Z轴的位置) - float(焦距补偿)

    while 当前步骤 <= 999:
        if await _skip_requested():
            return await 跳过任务时处理并回到目标Z轴位置(z轴目标=首次目标Z轴位置, 速度=切割速度)
        if await _abort_pending():
            当前步骤 = 999

        match 当前步骤:
            case 0:
                是否连上 = 运动服务.适配器.已连接 if 运动服务.适配器 else False
                if 是否连上:
                    await 运动服务.设置输出(0, True)
                    当前步骤 = 10
                else:
                    当前步骤 = 300
            case 10:
                起始点X = 当前没有偏移的点位[0].get('x')
                起始点Y = 当前没有偏移的点位[0].get('y')
                当前没有偏移的点位 = [{'x': 起始点X, 'y': 起始点Y}]
                try:
                    await 运动服务.绝对运动并设速度("X", 起始点X, 切割速度)
                    await 运动服务.绝对运动并设速度("Y", 起始点Y, 切割速度)
                    当前步骤 = 20
                except Exception:
                    当前步骤 = 300
            case 20:
                结果 = await 安全拉取xy轴是否空闲(超时次数=2000, 休眠秒=0.02)
                if 结果.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z轴目标=首次目标Z轴位置, 速度=切割速度)
                if 结果.get("abort"):
                    return "abort"
                if 结果.get("success"):
                    当前步骤 = 30
                else:
                    return False
            case 30:
                if 是否打开扫黑功能:
                    当前步骤 = 31
                    累计下降量 -= 扫黑上台的高度
                else:
                    当前步骤 = 32
            case 31:
                await Rs232Service.获取实例().发送激光数据(串口配置, str(扫黑功率), str(扫黑频率), str(扫黑电流))
                当前步骤 = 40
            case 32:
                await Rs232Service.获取实例().发送激光数据(串口配置, str(工作功率), str(工作频率), str(工作电流))
                当前步骤 = 40
            case 40:
                if not 是否打开激光:
                    await 运动服务.设置输出(2, True)
                    是否打开激光 = True
                当前步骤 = 50
            case 50:
                当前步骤 = 60 if 累计下降量 <= 总下降量 else 300
            case 60:
                目标高度 = -累计下降量 + 当前Z轴的位置
                try:
                    await 运动服务.绝对运动并设速度("Z", 目标高度, 切割速度)
                    当前步骤 = 70
                except Exception:
                    当前步骤 = 300
            case 70:
                目标高度 = -累计下降量 + 当前Z轴的位置
                结果 = await 安全拉取是否空闲(轴号=2, 超时次数=2000, 休眠秒=0.02)
                if 结果.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z轴目标=首次目标Z轴位置, 速度=切割速度)
                if 结果.get("abort"):
                    return "abort"
                if 结果.get("success"):
                    当前步骤 = 80
                else:
                    return False
            case 80:
                点位合集 = OffsetEndpointCalculator.calc_xy_points(实体数据, 当前开口值)
                当前运行点位: list[dict[str, Any]] = list(点位合集[原始任务序号])
                是否闭合 = 判断当前图形是否闭合(当前运行点位)
                上一轮是否需要闭合 = 是否闭合
                if 是否需要反转 and not 是否闭合:
                    当前运行点位 = list(reversed(当前运行点位))
                原始点数据_插补数据 = list(当前运行点位)

                当前速度百分比 = 边缘切割速度百分比 if 是否在边缘位置 else 中间切割速度百分比
                目标运行速度 = 切割速度 * 当前速度百分比

                try:
                    await 运动服务.连续插补XY(路径点=原始点数据_插补数据, 速度=目标运行速度, wait_until_done=True)
                    当前步骤 = 81
                except Exception:
                    当前步骤 = 300
            case 81:
                if 是否在边缘位置 and (当前切割次数 + 1) < 边缘切割次数:
                    当前切割次数 += 1
                    if not 上一轮是否需要闭合:
                        是否需要反转 = not 是否需要反转
                    当前步骤 = 80
                else:
                    当前切割次数 = 0
                    if 是否需要跳转计算下一层开口 and not 上一轮是否需要闭合:
                        是否需要反转 = not 是否需要反转
                    当前步骤 = 82 if not 是否需要跳转计算下一层开口 else 100
            case 82:
                结果 = await 安全拉取xy轴是否空闲(超时次数=2000, 休眠秒=0.01)
                if 结果.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z轴目标=首次目标Z轴位置, 速度=切割速度)
                if 结果.get("abort"):
                    return "abort"
                if 结果.get("success"):
                    当前步骤 = 90 if not 是否需要跳转计算下一层开口 else 100
                else:
                    return False
            case 90:
                当前开口值 = 当前开口值 + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - 每次开口的偏移量
                当前开口值是否在范围内 = round(当前开口值, 6) > round(最小的偏移 / 1000, 6) and round(当前开口值, 6) < round(最大的偏移 / 1000, 6)

                if 当前开口值是否在范围内:
                    是否在边缘位置 = False

                if 最大的偏移 / 1000 < 当前开口值 and 是否是从小到大的开口偏移 and not 是否需要跳转计算下一层开口:
                    当前开口值 = 最大的偏移 / 1000
                    是否在边缘位置 = True
                    是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                    是否需要跳转计算下一层开口 = True

                if 最小的偏移 / 1000 > 当前开口值 and not 是否是从小到大的开口偏移 and not 是否需要跳转计算下一层开口:
                    当前开口值 = 最小的偏移 / 1000
                    是否在边缘位置 = True
                    是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                    是否需要跳转计算下一层开口 = True

                if not 上一轮是否需要闭合:
                    是否需要反转 = not 是否需要反转
                当前步骤 = 80

            case 100:
                进度百分比 = 累计下降量 / 高度 * 100 if not 是否打开扫黑功能 else (累计下降量 + 扫黑上台的高度) / (高度) * 100

                当前量 = int(进度百分比 // 变化百分比)
                每次下降步长量 -= (当前量 - 上层量) * 每次下降步长量减少量
                上层量 = 当前量
                累计下降量 += round(每次下降步长量, 6)

                当前大区间索引 = int(进度百分比 // 变化百分比) if 变化百分比 > 0 else 0
                段内进度 = (进度百分比 % 变化百分比) // (变化百分比 // 每段子区间速度数量) if 变化百分比 > 0 else 0
                中间切割速度百分比 = min(1.1, max(0.3, round((原始中间切割速度百分比值 + 中间切割速度的变化B / 100 * (当前大区间索引 % (中间切割速度的变化K + 1))), 4)))
                边缘切割速度百分比 = min(1.0, max(0.3, round((原始边缘切割速度百分比值 + 边缘切割速度的变化B / 100 * 段内进度 + 边缘切割速度的变化K / 100 * 当前大区间索引), 4)))

                if 进度百分比 > (变化百分比) / 2 and 是否打开扫黑功能:
                    是否打开扫黑功能 = False
                    await 运动服务.设置输出(2, False)
                    是否打开激光 = False
                    累计下降量 = 0

                if 开口形状 == "V型":
                    新扫描长度 = 上开口值 - tana * 累计下降量 * 2 * 1000
                    扫描长度差值 = (上开口值 - 新扫描长度) / 2
                    最小的偏移 = round(扫描长度差值, 6)
                    最大的偏移 = round(上开口值 - 扫描长度差值, 6)
                if 开口形状 == "//型":
                    最小的偏移 = tana * 累计下降量 * 2 * 1000
                    最大的偏移 = tana * 累计下降量 * 2 * 1000 + 上开口值

                更新程序任务运行进程(current_task_jindubaifenbi=进度百分比)
                是否需要跳转计算下一层开口 = False
                当前步骤 = 30 if not 是否打开扫黑功能 and not 是否打开激光 else 50
            case 110:
                当前步骤 = 150
            case 150:
                当前步骤 = 300
            case 300:
                返回最原始的Z轴焦距位置 = 当前Z轴的位置 - float(焦距补偿)
                try:
                    await 运动服务.绝对运动并设速度("Z", 返回最原始的Z轴焦距位置, 切割速度)
                    当前步骤 = 301
                except Exception:
                    pass
            case 301:
                跳转计数 = 0
                目标位置 = 当前Z轴的位置 - float(焦距补偿)
                while 跳转计数 < 2000:
                    try:
                        实际位置 = await 运动服务.取_z_实际位置()
                        if abs(实际位置 - 目标位置) <= 0.001:
                            当前步骤 = 999
                            break
                    except Exception:
                        日志.exception("case 301 轮询 Z 轴位置异常")
                    跳转计数 += 1
                    await asyncio.sleep(0.02)
                else:
                    return False
            case 999:
                await 运动服务.停止运动()
                await 运动服务.设置输出(0, False)
                await 运动服务.设置输出(2, False)
                当前步骤 = 9999

    return True


async def 用旋转轴去切圆(
    原始任务序号: int,
    配方数据: dict[str, Any],
    实体数据: list[dict[str, Any]],
    *,
    串口配置: dict[str, Any] | None = None,
) -> bool | str:
    """这个是单独拿出来用作R轴切圆"""
    运动服务 = MotionService.获取实例()
    实体列表 = 实体数据
    当前任务索引 = 原始任务序号

    主配方 = 配方数据.get("selectedMainRecipe") or {}
    主配方中的扫黑配方 = 在配方中查找ID的配方(配方数据.get("selectedBlackeningRecipe"), 主配方.get("blackeningRecipeId"))
    主配方中的工作配方 = 在配方中查找ID的配方(配方数据.get("selectedMachiningRecipe"), 主配方.get("machiningRecipeId"))

    if 主配方中的扫黑配方 is None or 主配方中的工作配方 is None:
        日志.warning("用旋转轴去切圆: 主配方 -> 子配方查找失败", extra={
            "mainRecipeId": 主配方.get("id"),
            "blackeningRecipeId": 主配方.get("blackeningRecipeId"),
            "machiningRecipeId": 主配方.get("machiningRecipeId"),
        })
        return False

    扫黑配方中的激光配方 = 在配方中查找ID的配方(配方数据.get("selectedLaserRecipe"), 主配方中的扫黑配方.get("laserPowerRecipeId"))
    工作配方中的激光配方 = 在配方中查找ID的配方(配方数据.get("selectedLaserRecipe"), 主配方中的工作配方.get("laserPowerRecipeId"))
    工作配方中的水平配方 = 在配方中查找ID的配方(配方数据.get("selectedHorizontal"), 主配方中的工作配方.get("horizontalFormulaId"))
    工作配方中的垂直配方 = 在配方中查找ID的配方(配方数据.get("selectedVertical"), 主配方中的工作配方.get("verticalFormulaId"))

    if (扫黑配方中的激光配方 is None or 工作配方中的激光配方 is None or 工作配方中的水平配方 is None or 工作配方中的垂直配方 is None):
        日志.warning("用旋转轴去切圆: 子配方 -> 公式/激光查找失败", extra={
            "主配方中的扫黑配方ID": 主配方中的扫黑配方.get("id"),
            "主配方中的工作配方ID": 主配方中的工作配方.get("id"),
        })
        return False

    是否打开激光 = False
    是否打开扫黑功能 = bool(主配方中的扫黑配方.get("enabled"))
    扫黑上台的高度 = float(主配方中的扫黑配方.get("jiaojubuchang")) / 1000
    扫黑功率 = 扫黑配方中的激光配方.get("laserPower")
    扫黑频率 = 扫黑配方中的激光配方.get("laserFrequency")
    扫黑电流 = 扫黑配方中的激光配方.get("laserCurrent")
    工作功率 = 工作配方中的激光配方.get("laserPower")
    工作频率 = 工作配方中的激光配方.get("laserFrequency")
    工作电流 = 工作配方中的激光配方.get("laserCurrent")

    下开口K = float(工作配方中的水平配方.get('formula').get('lowerOpeningFormula').get('k'))
    下开口B = float(工作配方中的水平配方.get('formula').get('lowerOpeningFormula').get('b'))
    深度补偿K = float(工作配方中的水平配方.get('formula').get('depthCompensationFormula').get('k'))
    深度补偿B = float(工作配方中的水平配方.get('formula').get('depthCompensationFormula').get('b'))
    补偿角度K = float(工作配方中的水平配方.get('formula').get('compensationAngleFormula').get('k'))
    补偿角度B = float(工作配方中的水平配方.get('formula').get('compensationAngleFormula').get('b'))

    当前步骤 = 0

    是否需要跳转计算下一层开口 = False
    进度百分比 = 0
    上层量 = 0
    变化百分比 = float(工作配方中的垂直配方.get("formula").get("changePercent"))

    累计下降量 = 0
    高度 = 总下降量 = float(配方数据.get('extraHeight'))

    角度K = float(工作配方中的水平配方.get('formula').get('angleFormula').get('k'))
    角度B = float(工作配方中的水平配方.get('formula').get('angleFormula').get('b'))
    角度 = 角度K * 高度 + 角度B
    tan角度 = math.tan(math.radians(角度))

    当前开口值 = 0
    是否是从小到大的开口偏移 = True
    当前开口值是否在范围内 = True
    每次开口的偏移量 = float(工作配方中的垂直配方.get("formula").get("xFeed"))
    每次下降步长量 = float(工作配方中的垂直配方.get("formula").get("descentCutting").get("speed"))
    每次下降步长量减少量 = float(工作配方中的垂直配方.get("formula").get("descentCutting").get("zFeed"))

    当前切割次数 = 0
    是否在边缘位置 = True
    边缘切割次数 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("cutTimes"))
    中间切割次数 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("cutTimes"))
    旋转切割的次数 = max(边缘切割次数, 中间切割次数)

    切割速度 = float(工作配方中的垂直配方.get("formula").get("xSpeed"))
    边缘切割速度百分比 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("speed")) / 100
    中间切割速度百分比 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("speed")) / 100

    开口形状 = 工作配方中的水平配方.get('formula').get('openingShape')
    下开口值 = 下开口K * 高度 + 下开口B
    上开口值 = 深度补偿K * 1000 * (高度 + 深度补偿B) * tan角度 + 下开口值
    最小的偏移 = 0

    焦距补偿 = 工作配方中的水平配方.get("formula").get("focusCompensation")
    当前Z轴的位置 = await 运动服务.取_z_实际位置() + float(焦距补偿)
    首次目标Z轴位置 = float(当前Z轴的位置) - float(焦距补偿)
    R轴的圈数 = 0
    while 当前步骤 <= 300:
        match 当前步骤:
            case 0:
                是否连上 = 运动服务.适配器.已连接 if 运动服务.适配器 else False
                if 是否连上:
                    await 运动服务.设置输出(0, True)
                    当前步骤 = 10
                else:
                    当前步骤 = 300
            case 10:
                圆中心点X = 实体列表[当前任务索引].get('center').get('x') + 实体列表[当前任务索引].get('radius')
                圆中心点Y = 实体列表[当前任务索引].get('center').get('y')
                try:
                    await 运动服务.绝对运动并设速度("X", 圆中心点X, 10)
                    await 运动服务.绝对运动并设速度("Y", 圆中心点Y, 10)
                    当前步骤 = 20
                except Exception:
                    当前步骤 = 300
            case 20:
                结果 = await 安全拉取xy轴是否空闲(超时次数=2000, 休眠秒=0.02)
                if 结果.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z轴目标=首次目标Z轴位置, 速度=切割速度)
                if 结果.get("abort"):
                    return "abort"
                if 结果.get("success"):
                    当前步骤 = 30
                else:
                    return False
            case 30:
                if 是否打开扫黑功能:
                    当前步骤 = 31
                    累计下降量 -= 扫黑上台的高度
                else:
                    当前步骤 = 32
            case 31:
                await Rs232Service.获取实例().发送激光数据(串口配置, str(扫黑功率), str(扫黑频率), str(扫黑电流))
                当前步骤 = 40
            case 32:
                await Rs232Service.获取实例().发送激光数据(串口配置, str(工作功率), str(工作频率), str(工作电流))
                当前步骤 = 40
            case 40:
                if not 是否打开激光:
                    await 运动服务.设置输出(2, True)
                    是否打开激光 = True
                当前步骤 = 41
            case 41:
                R轴旋转结果 = await 运动服务.R轴一直进行旋转()
                当前步骤 = 50 if R轴旋转结果.get('success') else 300
            case 50:
                当前步骤 = 60 if 累计下降量 <= 总下降量 else 300
            case 60:
                Z轴目标位置 = -累计下降量 + 当前Z轴的位置
                try:
                    await 运动服务.绝对运动并设速度("Z", Z轴目标位置, 切割速度)
                    当前步骤 = 70
                except Exception:
                    当前步骤 = 300
            case 70:
                结果 = await 安全拉取是否空闲(轴号=2, 超时次数=2000, 休眠秒=0.02)
                if 结果.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z轴目标=首次目标Z轴位置, 速度=切割速度)
                if 结果.get("abort"):
                    return "abort"
                if 结果.get("success"):
                    当前步骤 = 80
                else:
                    return False
            case 80:
                R轴的圈数 = await 运动服务.获取R轴的当前位置()
                当前步骤 = 90 if R轴的圈数 is not None else 300
            case 90:
                目标圈数 = float(R轴的圈数) + 1.0
                跳出计数 = 0
                已见暂停 = False
                while 跳出计数 < 5000:
                    if await _abort_pending():
                        await 清除运行输出()
                        return "abort"
                    if await _skip_requested():
                        return await 跳过任务时处理并回到目标Z轴位置(z轴目标=首次目标Z轴位置, 速度=切割速度)
                    if await _paused():
                        已见暂停 = True
                        await asyncio.sleep(0.05)
                        continue
                    try:
                        R轴当前的圈数 = await 运动服务.获取R轴的当前位置()
                    except Exception:
                        日志.exception("case 90 获取R轴位置异常")
                        跳出计数 += 1
                        await asyncio.sleep(0.02)
                        continue
                    if 已见暂停:
                        try:
                            R轴恢复结果 = await 运动服务.R轴一直进行旋转()
                            if not R轴恢复结果 or not R轴恢复结果.get("success"):
                                return False
                        except Exception:
                            日志.exception("case 90 R轴恢复旋转异常")
                            return False
                        if R轴当前的圈数 is None:
                            return False
                        R轴的圈数 = float(R轴当前的圈数)
                        目标圈数 = R轴的圈数 + float(旋转切割的次数)
                        已见暂停 = False
                        continue
                    if R轴当前的圈数 is not None and float(R轴当前的圈数) >= (目标圈数 - 0.001):
                        try:
                            当前X, _ = await 运动服务.取_xy_实际位置()
                        except Exception:
                            日志.exception("case 90 获取XY位置异常")
                            return False
                        当前开口值 = 当前开口值 + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - 每次开口的偏移量
                        当前开口值是否在范围内 = round(当前开口值, 6) >= round(最小的偏移 / 1000, 6) and round(当前开口值, 6) <= round(最大的偏移 / 1000, 6)

                        if not 当前开口值是否在范围内 and 是否是从小到大的开口偏移:
                            X的目标距离 = 当前X + round(round(最大的偏移 / 1000, 6) - (当前开口值 - 每次开口的偏移量), 6)
                            当前开口值 = round(最大的偏移 / 1000, 6)
                            是否需要跳转计算下一层开口 = True
                        if not 当前开口值是否在范围内 and not 是否是从小到大的开口偏移:
                            X的目标距离 = 当前X - round(当前开口值 + 每次开口的偏移量 - round(最小的偏移 / 1000, 6), 6)
                            当前开口值 = round(最小的偏移 / 1000, 6)
                            是否需要跳转计算下一层开口 = True

                        if 当前开口值是否在范围内:
                            X的目标距离 = 当前X + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前X - 每次开口的偏移量

                        try:
                            await 运动服务.绝对运动并设速度("X", X的目标距离, 切割速度)
                            当前步骤 = 100
                        except Exception:
                            当前步骤 = 300
                        break

                    跳出计数 += 1
                    await asyncio.sleep(0.02)
                else:
                    当前步骤 = 300
            case 100:
                print(round(当前开口值, 6))
                if 是否需要跳转计算下一层开口:
                    是否是从小到大的开口偏移 = False if 是否是从小到大的开口偏移 else True
                当前步骤 = 80 if 当前开口值是否在范围内 and not 是否需要跳转计算下一层开口 else 110
            case 110:
                是否需要跳转计算下一层开口 = False
                进度百分比 = (累计下降量 + 扫黑上台的高度) / 高度 * 100 if 是否打开扫黑功能 else 累计下降量 / 高度 * 100
                当层量 = int(进度百分比 // 变化百分比)
                累计下降量 -= (当层量 - 上层量) * 每次下降步长量减少量
                上层量 = 当层量
                累计下降量 += round(每次下降步长量, 6)

                if 进度百分比 > 变化百分比 / 2 and 是否打开扫黑功能:
                    是否打开扫黑功能 = False
                    await 运动服务.设置输出(2, False)
                    是否打开激光 = False
                    累计下降量 = 0

                if 开口形状 == "V型":
                    新的开口 = 上开口值 - tan角度 * 累计下降量 * 2 * 1000
                    开口的差值 = (上开口值 - 新的开口) / 2
                    最小的偏移 = round(开口的差值, 6)
                    最大的偏移 = round(上开口值 - 开口的差值, 6)
                if 开口形状 == "//型" or 开口形状 == "||型":
                    最小的偏移 = tan角度 * 累计下降量 * 2 * 1000
                    最大的偏移 = tan角度 * 累计下降量 * 2 * 1000 + 上开口值
                更新程序任务运行进程(current_task_jindubaifenbi=进度百分比)
                当前步骤 = 30 if not 是否打开扫黑功能 and not 是否打开激光 else 50
            case 120:
                当前步骤 = 130
            case 130:
                当前步骤 = 140
            case 140:
                当前步骤 = 150
            case 150:
                当前步骤 = 300
            case 300:
                await 运动服务.停止运动()
                await 运动服务.设置输出(0, False)
                await 运动服务.设置输出(2, False)
                当前步骤 = 999

    return True


async def 进行4P切产品(
    原始任务序号: int,
    配方数据: dict[str, Any],
    实体数据: list[dict[str, Any]],
    *,
    串口配置: dict[str, Any] | None = None,
) -> bool | str:
    """这个是单独拿出来用作R轴切圆"""
    运动服务 = MotionService.获取实例()
    旋转中心补偿值 = 读取存储的4P旋转中心补偿值()
    print(旋转中心补偿值.Xoffset, "旋转中心补偿值.Xoffset")
    print(旋转中心补偿值.Yoffset, "旋转中心补偿值.Yoffset")
    print(旋转中心补偿值.Zoffset, "旋转中心补偿值.Zoffset")

    计算当前任务实体旋转后的点 = 计算实体绕坐标轴旋转后的实体点(所有实体数据=实体数据, 旋转轴="y")
    计算当前任务实体旋转后偏移的点 = OffsetEndpointCalculator.计算绕坐标轴旋转后的偏移点位(计算当前任务实体旋转后的点, 1)
    print(计算当前任务实体旋转后的点, "计算当前任务实体旋转后的点")
    print(计算当前任务实体旋转后偏移的点, "计算当前任务实体旋转后偏移的点")

    主配方 = 配方数据.get("selectedMainRecipe") or {}
    主配方中的扫黑配方 = 在配方中查找ID的配方(配方数据.get("selectedBlackeningRecipe"), 主配方.get("blackeningRecipeId"))
    主配方中的工作配方 = 在配方中查找ID的配方(配方数据.get("selectedMachiningRecipe"), 主配方.get("machiningRecipeId"))
    if 主配方中的扫黑配方 is None or 主配方中的工作配方 is None:
        日志.warning("用旋转轴去切圆: 主配方 -> 子配方查找失败", extra={
            "mainRecipeId": 主配方.get("id"),
            "blackeningRecipeId": 主配方.get("blackeningRecipeId"),
            "machiningRecipeId": 主配方.get("machiningRecipeId"),
        })
        return False
    扫黑配方中的激光配方 = 在配方中查找ID的配方(配方数据.get("selectedLaserRecipe"), 主配方中的扫黑配方.get("laserPowerRecipeId"))
    工作配方中的激光配方 = 在配方中查找ID的配方(配方数据.get("selectedLaserRecipe"), 主配方中的工作配方.get("laserPowerRecipeId"))
    工作配方中的水平配方 = 在配方中查找ID的配方(配方数据.get("selectedHorizontal"), 主配方中的工作配方.get("horizontalFormulaId"))
    工作配方中的垂直配方 = 在配方中查找ID的配方(配方数据.get("selectedVertical"), 主配方中的工作配方.get("verticalFormulaId"))
    if (扫黑配方中的激光配方 is None or 工作配方中的激光配方 is None or 工作配方中的水平配方 is None or 工作配方中的垂直配方 is None):
        日志.warning("用旋转轴去切圆: 子配方 -> 公式/激光查找失败", extra={
            "主配方中的扫黑配方ID": 主配方中的扫黑配方.get("id"),
            "主配方中的工作配方ID": 主配方中的工作配方.get("id"),
        })
        return False

    是否打开激光 = False
    是否打开扫黑功能 = bool(主配方中的扫黑配方.get("enabled"))
    扫黑上台的高度 = float(主配方中的扫黑配方.get("jiaojubuchang")) / 1000
    扫黑功率 = 扫黑配方中的激光配方.get("laserPower")
    扫黑频率 = 扫黑配方中的激光配方.get("laserFrequency")
    扫黑电流 = 扫黑配方中的激光配方.get("laserCurrent")
    工作功率 = 工作配方中的激光配方.get("laserPower")
    工作频率 = 工作配方中的激光配方.get("laserFrequency")
    工作电流 = 工作配方中的激光配方.get("laserCurrent")

    下开口K = float(工作配方中的水平配方.get('formula').get('lowerOpeningFormula').get('k'))
    下开口B = float(工作配方中的水平配方.get('formula').get('lowerOpeningFormula').get('b'))
    深度补偿K = float(工作配方中的水平配方.get('formula').get('depthCompensationFormula').get('k'))
    深度补偿B = float(工作配方中的水平配方.get('formula').get('depthCompensationFormula').get('b'))
    补偿角度K = float(工作配方中的水平配方.get('formula').get('compensationAngleFormula').get('k'))
    补偿角度B = float(工作配方中的水平配方.get('formula').get('compensationAngleFormula').get('b'))

    当前步骤 = 0
    是否需要跳转计算下一层开口 = False
    进度百分比 = 0
    上层量 = 0
    变化百分比 = float(工作配方中的垂直配方.get("formula").get("changePercent"))

    累计下降量 = 0
    高度 = 总下降量 = float(配方数据.get('extraHeight'))

    角度K = float(工作配方中的水平配方.get('formula').get('angleFormula').get('k'))
    角度B = float(工作配方中的水平配方.get('formula').get('angleFormula').get('b'))
    角度 = 角度K * 高度 + 角度B
    tan角度 = math.tan(math.radians(角度))

    当前开口值 = 0
    是否是从小到大的开口偏移 = True
    每次开口的偏移量 = float(工作配方中的垂直配方.get("formula").get("xFeed"))
    每次下降步长量 = float(工作配方中的垂直配方.get("formula").get("descentCutting").get("speed"))
    每次下降步长量减少量 = float(工作配方中的垂直配方.get("formula").get("descentCutting").get("zFeed"))

    当前切割次数 = 0
    是否在边缘位置 = True
    边缘切割次数 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("cutTimes"))
    中间切割次数 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("cutTimes"))

    切割速度 = float(工作配方中的垂直配方.get("formula").get("xSpeed"))
    边缘切割速度百分比 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("speed")) / 100
    中间切割速度百分比 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("speed")) / 100

    开口形状 = 工作配方中的垂直配方.get('formula').get('openingShape')
    下开口值 = 下开口K * 高度 + 下开口B
    上开口值 = 深度补偿K * 1000 * (高度 + 深度补偿B) * tan角度 + 下开口值
    最小的偏移 = 0

    计算当前任务实体旋转后的点 = 计算实体绕坐标轴旋转后的实体点(所有实体数据=实体数据, 旋转轴="y")
    计算当前任务实体旋转后偏移的点 = OffsetEndpointCalculator.计算绕坐标轴旋转后的偏移点位(计算当前任务实体旋转后的点, 1)
    print(计算当前任务实体旋转后的点, "计算当前任务实体旋转后的点")
    print(计算当前任务实体旋转后偏移的点, "计算当前任务实体旋转后偏移的点")
    下降的高度 = float(float(旋转中心补偿值.Zoffset) + float(计算当前任务实体旋转后的点[原始任务序号].get('points')[0].get('z')))

    焦距补偿 = 工作配方中的水平配方.get('formula').get('focusCompensation')
    Z轴原始初始位置 = await 运动服务.取_z_实际位置()
    首次目标Z轴位置 = float(Z轴原始初始位置) + float(焦距补偿)
    下降直到可以切产品的高度 = 首次目标Z轴位置 + 下降的高度

    当前没有偏移的点位 = 计算当前任务实体旋转后的点[原始任务序号].get('points')
    原始点数据_插补数据 = 当前没有偏移的点位.copy()
    是否需要反转点位 = False

    while 当前步骤 <= 999:
        if await _skip_requested():
            return await 跳过任务时处理并回到目标Z轴位置(z轴目标=Z轴原始初始位置, 速度=切割速度)
        if await _abort_pending():
            当前步骤 = 999

        match 当前步骤:
            case 0:
                是否连上 = 运动服务.适配器.已连接 if 运动服务.适配器 else False
                if 是否连上:
                    await 运动服务.设置输出(0, True)
                    当前步骤 = 10
                else:
                    当前步骤 = 300
            case 10:
                起始点X = 当前没有偏移的点位[0].get('x')
                起始点Y = 当前没有偏移的点位[0].get('y')
                try:
                    await 运动服务.绝对运动并设速度("X", 起始点X, 切割速度)
                    await 运动服务.绝对运动并设速度("Y", 起始点Y, 切割速度)
                    当前步骤 = 11
                except Exception:
                    当前步骤 = 300
            case 11:
                结果 = await 安全拉取xy轴是否空闲(超时次数=2000, 休眠秒=0.02)
                if 结果.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z轴目标=Z轴原始初始位置, 速度=切割速度)
                if 结果.get("abort"):
                    return "abort"
                if 结果.get("success"):
                    当前步骤 = 20
                else:
                    当前步骤 = 300
            case 12:
                旋转角度 = 实体数据[原始任务序号].get("surfaceAngle")
                旋转结果 = await 运动服务.U轴旋转角度(旋转角度=旋转角度)
                if not 旋转结果.get('success'):
                    当前步骤 = 300
                当前步骤 = 13
            case 13:
                跳出计数 = 0
                已见暂停 = False
                while True:
                    if await _abort_pending():
                        await 清除运行输出()
                        return "abort"
                    if await _skip_requested():
                        return await 跳过任务时处理并回到目标Z轴位置(z轴目标=Z轴原始初始位置, 速度=切割速度)
                    if await _paused():
                        已见暂停 = True
                        await asyncio.sleep(0.05)
                        continue
                    await asyncio.sleep(0.02)
                    是否到达旋转角度 = await 运动服务.U轴是否到达旋转角度(旋转角度=旋转角度)
                    if 已见暂停:
                        当前步骤 = 12
                        break
                    if 是否到达旋转角度:
                        当前步骤 = 12
                        break
                    if 跳出计数 >= 2000:
                        当前步骤 = 300
                    跳出计数 += 1
                当前步骤 = 30
            case 30:
                if 是否打开扫黑功能:
                    当前步骤 = 31
                    累计下降量 -= 扫黑上台的高度
                else:
                    当前步骤 = 32
            case 31:
                await Rs232Service.获取实例().发送激光数据(串口配置, str(扫黑功率), str(扫黑频率), str(扫黑电流))
                当前步骤 = 40
            case 32:
                await Rs232Service.获取实例().发送激光数据(串口配置, str(工作功率), str(工作频率), str(工作电流))
                当前步骤 = 40
            case 40:
                if not 是否打开激光:
                    await 运动服务.设置输出(2, True)
                    是否打开激光 = True
                当前步骤 = 50
            case 50:
                当前步骤 = 60 if 累计下降量 <= 总下降量 else 300
            case 60:
                Z轴目标位置 = -累计下降量 + 下降直到可以切产品的高度
                try:
                    await 运动服务.绝对运动并设速度("Z", Z轴目标位置, 切割速度)
                    当前步骤 = 70
                except Exception:
                    当前步骤 = 300
            case 70:
                结果 = await 安全拉取是否空闲(轴号=2, 超时次数=2000, 休眠秒=0.02)
                if 结果.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z轴目标=Z轴原始初始位置, 速度=切割速度)
                if 结果.get("abort"):
                    return "abort"
                if 结果.get("success"):
                    当前步骤 = 80
                else:
                    当前步骤 = 300
            case 80:
                计算所有实体旋转后偏移的点 = OffsetEndpointCalculator.计算绕坐标轴旋转后的偏移点位(计算当前任务实体旋转后的点, 当前开口值)
                当前运行点位: list[dict[str, Any]] = list(计算所有实体旋转后偏移的点[原始任务序号].get("points"))
                是否闭合 = True if abs(当前运行点位[0]['x'] - 当前运行点位[-1]['x']) <= 0.001 and abs(当前运行点位[0]['y'] - 当前运行点位[-1]['y']) <= 0.001 else False
                x, y = await 运动服务.取_xy_实际位置()
                是否需要反转点位 = abs(当前运行点位[0]['x'] - x) >= 0.06 or abs(当前运行点位[0]['y'] - y) >= 0.06
                if 是否需要反转点位 and not 是否闭合:
                    当前运行点位 = list(reversed(当前运行点位))
                原始点数据_插补数据 = list(当前运行点位)
                目标速度 = 切割速度 * 边缘切割速度百分比 if 是否在边缘位置 else 切割速度 * 中间切割速度百分比
                try:
                    await 运动服务.连续插补XY(路径点=原始点数据_插补数据, 速度=目标速度, wait_until_done=True)
                    当前步骤 = 81
                except Exception:
                    当前步骤 = 300
            case 81:
                if 是否在边缘位置 and (当前切割次数 + 1) < 边缘切割次数:
                    当前切割次数 += 1
                    当前步骤 = 80
                else:
                    当前切割次数 = 0
                    当前步骤 = 82 if not 是否需要跳转计算下一层开口 else 100
            case 82:
                结果 = await 安全拉取xy轴是否空闲(超时次数=2000, 休眠秒=0.01)
                if 结果.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z轴目标=Z轴原始初始位置, 速度=切割速度)
                if 结果.get("abort"):
                    return "abort"
                if 结果.get("success"):
                    当前步骤 = 90 if not 是否需要跳转计算下一层开口 else 100
                else:
                    当前步骤 = 300
            case 90:
                当前开口值 = 当前开口值 + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - 每次开口的偏移量
                结果1 = 最小的偏移 / 1000 < 当前开口值
                结果2 = 当前开口值 < 最大的偏移 / 1000
                if 结果1 and 结果2:
                    是否在边缘位置 = False
                if 最大的偏移 / 1000 < 当前开口值 and 是否是从小到大的开口偏移 and not 是否需要跳转计算下一层开口:
                    当前开口值 = 最大的偏移 / 1000
                    是否在边缘位置 = True
                    是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                    是否需要跳转计算下一层开口 = True
                if 最小的偏移 / 1000 > 当前开口值 and not 是否是从小到大的开口偏移 and not 是否需要跳转计算下一层开口:
                    当前开口值 = 最小的偏移 / 1000
                    是否在边缘位置 = True
                    是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                    是否需要跳转计算下一层开口 = True
                当前步骤 = 80
            case 100:
                进度百分比 = (累计下降量 + 扫黑上台的高度) / (高度) * 100 if 是否打开扫黑功能 else 累计下降量 / 高度 * 100
                当前量 = int(进度百分比 // 变化百分比)
                增量 = 当前量 - 上层量
                每次下降步长量 -= 增量 * 每次下降步长量减少量
                上层量 = 当前量
                累计下降量 += round(每次下降步长量, 6)

                if 进度百分比 > (变化百分比) / 2 and 是否打开扫黑功能:
                    是否打开扫黑功能 = False
                    await 运动服务.设置输出(2, False)
                    是否打开激光 = False
                    累计下降量 = 0
                if 开口形状 == "V型":
                    新的开口值 = 上开口值 - tan角度 * 累计下降量 * 2 * 1000
                    开口差值 = (上开口值 - 新的开口值) / 2
                    最小的偏移 = round(开口差值, 6)
                    最大的偏移 = round(上开口值 - 开口差值, 6)
                if 开口形状 == "//型":
                    最小的偏移 = tan角度 * 累计下降量 * 2 * 1000
                    最大的偏移 = tan角度 * 累计下降量 * 2 * 1000 + 上开口值
                更新程序任务运行进程(current_task_jindubaifenbi=进度百分比)
                是否需要跳转计算下一层开口 = False
                当前步骤 = 30 if not 是否打开扫黑功能 and not 是否打开激光 else 50
            case 110:
                当前步骤 = 150
            case 150:
                当前步骤 = 300
            case 300:
                try:
                    await 运动服务.绝对运动并设速度("Z", Z轴原始初始位置, 切割速度)
                    当前步骤 = 301
                except Exception:
                    pass
            case 301:
                跳转计数 = 0
                while 跳转计数 < 2000:
                    try:
                        实际位置 = await 运动服务.取_z_实际位置()
                        if abs(实际位置 - Z轴原始初始位置) <= 0.001:
                            当前步骤 = 999
                            break
                    except Exception:
                        日志.exception("4P case 301 轮询 Z 轴位置异常")
                    跳转计数 += 1
                    await asyncio.sleep(0.02)
                else:
                    当前步骤 = 300
            case 999:
                await 运动服务.停止运动()
                await 运动服务.设置输出(0, False)
                await 运动服务.设置输出(2, False)
                当前步骤 = 9999
    return True
