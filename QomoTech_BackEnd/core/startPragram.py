from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

from core.calc_offset_ljs import OffsetEndpointCalculator
from services.MotionService import MotionService
from core.program_status_ws import notify_program_status_changed
from configs.product4P_config import 读取存储的4P旋转中心补偿值
from core.calc_rotation import 计算点绕坐标轴旋转,计算实体绕坐标轴旋转后的实体点
from services.communicate_control.rs232_adapter import 串口驱动

logger = logging.getLogger("qomotech.start_program")
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


def get_program_status() -> dict[str, Any]:
    进度百分比 = max(0.0, min(100.0, float(_program_current_task_jindubaifenbi)))
    return {
        "running": bool(_program_running),
        "paused": bool(_program_paused),
        "total_tasks": int(_program_total_tasks),
        "current_task_index": int(_program_current_task_index),
        "进度百分比": 进度百分比,
    }


async def 清除运行输出() -> None:
    service = MotionService.获取实例()
    try:
        await service.停止运动()
        await service.设置输出(0, False)
        await service.设置输出(2, False)
    except Exception:
        logger.exception("runtime_cleanup_outputs failed")


async def 跳过任务时处理并回到目标Z轴位置(
    *,
    z_target: float | None,
    speed: float,
) -> str:
    """
    统一处理"跳过任务"：
    1) 先执行停机和关闭输出；
    2) 若提供了目标 Z，则补一次 Z 轴定位，尽量与正常流程的首次目标位保持一致；
    3) 清除 skip 标记并返回 "skip"。
    """
    service = MotionService.获取实例()
    await 清除运行输出()
    if z_target is not None:
        try:
            safe_speed = float(speed) if float(speed) > 0 else 10.0
        except Exception:
            safe_speed = 10.0
        try:
            await service.绝对运动并设速度("Z", float(z_target), safe_speed)
            wait_count = 0
            while wait_count < 2000:
                if await service.读_idle("Z"):
                    break
                wait_count += 1
                await asyncio.sleep(0.01)
        except Exception:
            logger.exception("skip_reposition_z failed")
    _clear_skip_request()
    return "skip"


async def 程序请求暂停() -> dict[str, Any]:
    global _program_paused, _laser_resume_required
    service = MotionService.获取实例()
    async with _ctrl_lock:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_paused = True
    if service._adapter and service._adapter.已连接:
        laser_was_on = await service.读_输出(2)
        _laser_resume_required = laser_was_on
        if laser_was_on:
            await service.设置输出(2, False)
        await service.急停()
    notify_program_status_changed(force=True)
    return {"success": True, "message": "已暂停"}


async def 程序请求恢复运行() -> dict[str, Any]:
    global _program_paused, _laser_resume_required
    service = MotionService.获取实例()
    async with _ctrl_lock:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_paused = False
    if service._adapter and service._adapter.已连接 and _laser_resume_required:
        await service.设置输出(2, True)
        _laser_resume_required = False
    notify_program_status_changed(force=True)
    return {"success": True, "message": "已继续运行"}


async def 程序请求急停() -> dict[str, Any]:
    global _program_abort_requested, _program_paused, _laser_resume_required
    service = MotionService.获取实例()
    async with _ctrl_lock:
        _program_abort_requested = True
        _program_paused = False
        _laser_resume_required = False
    if service._adapter and service._adapter.已连接:
        await service.设置输出(0, False)
        await service.设置输出(2, False)
        await service.急停()
    notify_program_status_changed(force=True)
    return {"success": True, "message": "已急停"}


async def 程序请求跳过任务() -> dict[str, Any]:
    global _program_skip_requested
    service = MotionService.获取实例()
    async with _ctrl_lock:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_skip_requested = True
    if service._adapter and service._adapter.已连接:
        await service.急停()
    notify_program_status_changed(force=True)
    return {"success": True, "message": "已请求跳过当前任务"}


async def 程序请求复位() -> dict[str, Any]:
    try:
        service = MotionService.获取实例()
    except Exception:
        return {"success": False, "message": "MotionService 未启动"}
    if not service._adapter or not service._adapter.已连接:
        return {"success": False, "message": "motion 控制器未连接"}
    failed: list[int] = []
    for axis_no in _ALARM_CLEAR_AXIS_NOS:
        try:
            await service.清除轴错误(_轴号映射[int(axis_no)])
        except Exception:
            failed.append(int(axis_no))
    if failed:
        return {"success": False, "message": f"部分轴清除报警失败: {failed}"}
    await service.复位()
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
    total_tasks: int | None = None,
    current_task_index: int | None = None,
    current_task_jindubaifenbi: float | None = None,
) -> None:
    global _program_total_tasks, _program_current_task_index, _program_current_task_jindubaifenbi
    if total_tasks is not None:
        _program_total_tasks = max(0, int(total_tasks))
    if current_task_index is not None:
        _program_current_task_index = max(0, int(current_task_index))
    if current_task_jindubaifenbi is not None:
        _program_current_task_jindubaifenbi = max(0.0, min(100.0, float(current_task_jindubaifenbi)))
    notify_program_status_changed()


async def _rebuild_xy_path_from_current(original_points_run: list[dict[str, Any]]) -> list[dict[str, Any]]:
    service = MotionService.获取实例()
    x0, y0 = await service.取_xy_实际位置()

    conv: list[tuple[float, float]] = []
    for p in original_points_run:
        if isinstance(p, dict):
            conv.append((float(p["x"]), float(p["y"])))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            conv.append((float(p[0]), float(p[1])))
        else:
            continue
    if not conv:
        return [{"x": x0, "y": y0}, {"x": x0, "y": y0}]
    best_i = 0
    best_d = float("inf")
    for i, (x, y) in enumerate(conv):
        d = math.hypot(x - x0, y - y0)
        if d < best_d:
            best_d = d
            best_i = i
    rest = [{"x": x, "y": y} for x, y in conv[best_i + 1 :]]
    head = [{"x": x0, "y": y0}]
    if not rest:
        return head + [{"x": conv[best_i][0], "y": conv[best_i][1]}]
    return head + rest


async def _safe_poll_idle(axis_no: int, timeout_count: int = 2000, sleep_s: float = 0.02) -> dict[str, Any]:
    """安全轮询轴静止状态，返回 {"success": bool, "notMoving": bool, "skip": bool, "abort": bool}"""
    service = MotionService.获取实例()
    axis_name = _轴号映射.get(int(axis_no))
    if axis_name is None:
        return {"success": False, "notMoving": False, "message": f"未知轴号: {axis_no}"}
    for _ in range(timeout_count):
        if await _abort_pending():
            return {"success": False, "notMoving": False, "abort": True}
        if await _skip_requested():
            return {"success": False, "notMoving": False, "skip": True}
        if await _paused():
            await asyncio.sleep(0.05)
            continue
        try:
            idle = await service.读_idle(axis_name)
            if idle:
                return {"success": True, "notMoving": True}
        except Exception:
            logger.exception("_safe_poll_idle axis=%s failed", axis_no)
        await asyncio.sleep(sleep_s)
    return {"success": False, "notMoving": False, "message": "等待轴静止超时"}


async def _safe_poll_xy_idle(timeout_count: int = 2000, sleep_s: float = 0.02) -> dict[str, Any]:
    """安全轮询 XY 双轴静止状态，返回 {"success": bool, "skip": bool, "abort": bool}"""
    service = MotionService.获取实例()
    for _ in range(timeout_count):
        if await _abort_pending():
            return {"success": False, "abort": True}
        if await _skip_requested():
            return {"success": False, "skip": True}
        if await _paused():
            await asyncio.sleep(0.05)
            continue
        try:
            rx = await service.读_idle("X")
            ry = await service.读_idle("Y")
            if rx and ry:
                return {"success": True}
        except Exception:
            logger.exception("_safe_poll_xy_idle failed")
        await asyncio.sleep(sleep_s)
    return {"success": False, "message": "等待 XY 轴静止超时"}


def 在配方中查找ID的配方(recipe_payload: Any, id: Any) -> dict[str, Any] | None:
    """
    在 recipe_payload 中查找具有 `id == id` 的 dict。
    - recipe_payload 可以是 list[dict] / dict，且允许 dict 内嵌套 list/dict 继续递归查找
    - 找不到时返回 None
    """
    if recipe_payload is None:
        return None

    def _ids_equal(a: Any, b: Any) -> bool:
        if a is None or b is None:
            return a == b
        return str(a) == str(b)

    if isinstance(recipe_payload, (list, tuple)):
        for item in recipe_payload:
            if isinstance(item, dict) and _ids_equal(item.get("id"), id):
                return item
            found = 在配方中查找ID的配方(item, id)
            if found is not None:
                return found
        return None

    if isinstance(recipe_payload, dict):
        if _ids_equal(recipe_payload.get("id"), id):
            return recipe_payload
        for value in recipe_payload.values():
            found = 在配方中查找ID的配方(value, id)
            if found is not None:
                return found
        return None

    return None


def 判断是否都是圆或者圆弧(*, entities: Any) -> bool:
    """校验 entities 中每个实体的 type 是否都属于「圆 / 圆弧」。"""
    if not isinstance(entities, (list, tuple)) or len(entities) == 0:
        return False

    allowed_types = {"CIRCLE", "ARC", "圆", "圆弧"}
    for entity in entities:
        if not isinstance(entity, dict):
            return False
        entity_type = str(entity.get("type", "")).strip()
        if not entity_type:
            return False
        if entity_type.upper() not in {"CIRCLE", "ARC"} and entity_type not in allowed_types:
            return False
    return True


def 判断当前图形是否闭合(点位: list[dict[str, Any]], *, 误差: float = 0.001) -> bool:
    起始点, 结束点 = 点位[0], 点位[-1]
    return abs(float(起始点["x"]) - float(结束点["x"])) <= 误差 and abs(float(起始点["y"]) - float(结束点["y"])) <= 误差


async def execute_start_program(
    *,
    recipe_payload: dict[str, Any],
    entities: list[dict[str, Any]],
    rs232: 串口驱动 | None = None,
    rs232_open: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """根据是否闭合来确定是往返运动？"""
    global _program_running, _program_abort_requested, _program_skip_requested, _program_paused, _laser_resume_required
    global _program_total_tasks, _program_current_task_index, _program_current_task_jindubaifenbi

    service = MotionService.获取实例()
    if not service._adapter or not service._adapter.已连接:
        return {"success": False, "message": "motion 控制器未连接", "data": {"connected": False}}

    if _run_lock.locked():
        return {"success": False, "message": "程序正在执行中（重复触发被拒绝）", "data": None}

    async with _run_lock:
        # 启动前复位 MotionService 状态机（ESTOP/ALARM → IDLE）
        await service.复位()

        try:
            service.暂停状态采集()
            if rs232_open is None and rs232 is not None:
                rs232_open = rs232.获取首选会话()

            所有任务列表 = OffsetEndpointCalculator.calc_xy_points(entities, 0)
            if not 所有任务列表:
                return {"success": False, "message": "没有可执行的任务，请检查实体几何", "data": None}

            async with _ctrl_lock:
                _program_running = True
                _program_paused = False
                _program_abort_requested = False
                _program_skip_requested = False
                _laser_resume_required = False
            更新程序任务运行进程(
                total_tasks=len(所有任务列表),
                current_task_index=0,
                current_task_jindubaifenbi=0.0,
            )

            for 当前任务索引 in range(len(所有任务列表)):
                更新程序任务运行进程(
                    current_task_index=当前任务索引 + 1,
                    current_task_jindubaifenbi=0.0,
                )
                if await _abort_pending():
                    await 清除运行输出()
                    return {"success": False, "message": "程序已急停", "data": None}

                主配方 = recipe_payload.get("selectedMainRecipe") or {}
                加工工艺配方 = 在配方中查找ID的配方(
                    recipe_payload.get("selectedMachiningRecipe"), 主配方.get("machiningRecipeId"),
                )
                加工工艺配方中的水平配方 = 在配方中查找ID的配方(
                    recipe_payload.get("selectedHorizontal"), 加工工艺配方.get("horizontalFormulaId"),
                )
                加工工艺配方中的垂直配方 = 在配方中查找ID的配方(
                    recipe_payload.get("selectedVertical"), 加工工艺配方.get("verticalFormulaId"),
                )
                垂直配方中的加工轴 = 加工工艺配方中的垂直配方.get("formula").get("cuttingAxis")
                判断是否都是圆或者圆弧的结果 = 判断是否都是圆或者圆弧(entities=entities)

                if 垂直配方中的加工轴 == 'R' and 判断是否都是圆或者圆弧的结果:
                    outcome = await 用旋转轴去切圆(
                        originalPointsNum=当前任务索引,
                        recipe_payload=recipe_payload,
                        entities=entities,
                        rs232=rs232,
                        rs232_open=rs232_open,
                    )
                if 垂直配方中的加工轴 == 'XY':
                    outcome = await 修面和切片的程序(
                        originalPointsNum=当前任务索引,
                        recipe_payload=recipe_payload,
                        entities=entities,
                        rs232=rs232,
                        rs232_open=rs232_open,
                    )
                # outcome = await 进行4P切产品(originalPointsNum=当前任务索引,recipe_payload=recipe_payload,entities=entities,rs232=rs232,rs232_open=rs232_open)

                if outcome == "skip":
                    continue
                if outcome == "abort":
                    return {"success": False, "message": "程序已急停", "data": None}
                if outcome is False:
                    return {"success": False, "message": "运动失败", "data": None}

            if await _abort_pending():
                await 清除运行输出()
                return {"success": False, "message": "程序已急停", "data": None}
            return {"success": True, "message": "程序执行完成", "data": None}
        except Exception as exc:
            logger.exception("execute_start_program failed")
            return {"success": False, "message": f"程序执行异常", "data": {"error": "运行报错"}}
        finally:
            service.恢复状态采集()
            async with _ctrl_lock:
                _program_running = False
                _program_paused = False
                _program_skip_requested = False
                _program_abort_requested = False
                _laser_resume_required = False
                _program_total_tasks = 0
                _program_current_task_index = 0
                _program_current_task_jindubaifenbi = 0.0
            notify_program_status_changed(force=True)


# ===============================================================================================================
async def _ensure_rs232_before_laser(
    rs232: 串口驱动 | None,
    rs232_open: dict[str, Any] | None,
    power: str,
    frequency: str,
    current: str,
) -> bool:
    """
    激光前确保 RS232 可用并分段发送参数。
    发送顺序：1) pow + power  2) frequency + frequency  3) current + current
    每次发送间隔 0.5 秒
    """
    if rs232 is None or rs232_open is None:
        return False

    port = rs232_open.get("port")
    receive = rs232_open.get("receive")
    if not isinstance(port, dict) or not isinstance(receive, dict):
        logger.error("rs232_open 缺少有效的 port 或 receive")
        return False

    target_port_name = str(port.get("portName", "")).strip()
    current_port_name = rs232.当前端口名() or ""
    need_reopen = (not rs232.是否已连接()) or (bool(target_port_name) and current_port_name != target_port_name)
    if need_reopen:
        # RS232 串口操作为阻塞 I/O，放到线程池中运行
        ok, msg = await asyncio.to_thread(rs232.打开会话, port, receive)
        if not ok:
            logger.error("RS232 打开失败: %s", msg)
            return False

    send_cfg_raw = rs232_open.get("send")
    base_send_cfg: dict[str, Any] = send_cfg_raw.copy() if isinstance(send_cfg_raw, dict) else {}
    base_send_cfg.setdefault("mode", "ascii")
    send_payloads = [
        f"POW {power}",
        f"REPF {frequency}",
        f"LD1CS {current}",
    ]

    for idx, payload in enumerate(send_payloads):
        send_cfg = base_send_cfg.copy()
        send_cfg["payload"] = payload
        ok2, msg2 = await asyncio.to_thread(rs232.发送, send_cfg)
        if not ok2:
            logger.error("RS232 参数发送失败（payload=%s）: %s", payload, msg2)
            return False
        if idx < len(send_payloads) - 1:
            await asyncio.sleep(0.5)
    await asyncio.to_thread(rs232.关闭)
    return True


# 每条直线切两次
async def 修面和切片的程序(
    originalPointsNum: int,
    recipe_payload: dict[str, Any],
    entities: list[dict[str, Any]],
    *,
    rs232: 串口驱动 | None = None,
    rs232_open: dict[str, Any] | None = None,
) -> bool | str:  # True / False / "skip" / "abort"
    """这个是单独拿出来的修面但是要和实际去相匹配"""
    service = MotionService.获取实例()

    主配方 = recipe_payload.get("selectedMainRecipe") or {}
    主配方中的扫黑配方 = 在配方中查找ID的配方(recipe_payload.get("selectedBlackeningRecipe"), 主配方.get("blackeningRecipeId"))
    主配方中的工作配方 = 在配方中查找ID的配方(recipe_payload.get("selectedMachiningRecipe"), 主配方.get("machiningRecipeId"))

    if 主配方中的扫黑配方 is None or 主配方中的工作配方 is None:
        logger.warning("wangFuLoop: 主配方 -> 子配方查找失败", extra={
            "mainRecipeId": 主配方.get("id"),
            "blackeningRecipeId": 主配方.get("blackeningRecipeId"),
            "machiningRecipeId": 主配方.get("machiningRecipeId"),
        })
        return False

    扫黑配方中的激光配方 = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"), 主配方中的扫黑配方.get("laserPowerRecipeId"))
    工作配方中的激光配方 = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"), 主配方中的工作配方.get("laserPowerRecipeId"))
    工作配方中的水平配方 = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"), 主配方中的工作配方.get("horizontalFormulaId"))
    工作配方中的垂直配方 = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"), 主配方中的工作配方.get("verticalFormulaId"))

    if (扫黑配方中的激光配方 is None or 工作配方中的激光配方 is None or 工作配方中的水平配方 is None or 工作配方中的垂直配方 is None):
        logger.warning("wangFuLoop: 子配方 -> 公式/激光查找失败", extra={
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

    当前步骤 = 0

    是否需要跳转计算下一层开口 = False
    进度百分比 = 0
    上层量 = 0
    变化百分比 = float(工作配方中的垂直配方.get("formula").get("changePercent"))

    累计下降量 = 0
    高度 = 总下降量 = float(recipe_payload.get('extraHeight'))
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
    原始边缘切割速度百分比值 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("speed"))
    原始中间切割速度百分比值 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("speed"))
    边缘切割速度百分比 = 原始边缘切割速度百分比值 / 100
    中间切割速度百分比 = 原始中间切割速度百分比值 / 100
    边缘切割速度的变化K = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("change").get('k'))
    边缘切割速度的变化B = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("change").get('b'))
    中间切割速度的变化K = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("change").get('k'))
    中间切割速度的变化B = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("change").get('b'))

    开口形状 = 工作配方中的水平配方.get('formula').get('openingShape')
    下开口值 = 下开口K * 高度 + 下开口B
    上开口值 = 深度补偿K * 1000 * (高度 + 深度补偿B) * tana + 下开口值
    最小的偏移 = 0

    是否需要反转 = False
    当前没有偏移的点位 = OffsetEndpointCalculator.calc_xy_points(entities, 0)[originalPointsNum]
    原始点数据_插补数据 = 当前没有偏移的点位.copy()
    上一轮是否需要闭合 = 判断当前图形是否闭合(原始点数据_插补数据)

    焦距补偿 = 工作配方中的水平配方.get('formula').get('focusCompensation')
    当前Z轴的位置 = await service.取_z_实际位置() + float(焦距补偿)
    首次目标Z轴位置 = float(当前Z轴的位置) - float(焦距补偿)

    while 当前步骤 <= 999:
        if await _skip_requested():
            return await 跳过任务时处理并回到目标Z轴位置(z_target=首次目标Z轴位置, speed=切割速度)
        if await _abort_pending():
            当前步骤 = 999

        match 当前步骤:
            case 0:
                是否连上 = service._adapter.已连接 if service._adapter else False
                if 是否连上:
                    await service.设置输出(0, True)
                    当前步骤 = 10
                else:
                    当前步骤 = 300
            case 10:
                起始点X = 当前没有偏移的点位[0].get('x')
                起始点Y = 当前没有偏移的点位[0].get('y')
                当前没有偏移的点位 = [{'x': 起始点X, 'y': 起始点Y}]
                try:
                    await service.绝对运动并设速度("X", 起始点X, 切割速度)
                    await service.绝对运动并设速度("Y", 起始点Y, 切割速度)
                    当前步骤 = 20
                except Exception:
                    当前步骤 = 300
            case 20:
                result = await _safe_poll_xy_idle(timeout_count=2000, sleep_s=0.02)
                if result.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z_target=首次目标Z轴位置, speed=切割速度)
                if result.get("abort"):
                    return "abort"
                if result.get("success"):
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
                await _ensure_rs232_before_laser(rs232, rs232_open, str(扫黑功率), str(扫黑频率), str(扫黑电流))
                当前步骤 = 40
            case 32:
                await _ensure_rs232_before_laser(rs232, rs232_open, str(工作功率), str(工作频率), str(工作电流))
                当前步骤 = 40
            case 40:
                if not 是否打开激光:
                    await service.设置输出(2, True)
                    是否打开激光 = True
                当前步骤 = 50
            case 50:
                当前步骤 = 60 if 累计下降量 <= 总下降量 else 300
            case 60:
                目标高度 = -累计下降量 + 当前Z轴的位置
                try:
                    await service.绝对运动并设速度("Z", 目标高度, 切割速度)
                    当前步骤 = 70
                except Exception:
                    当前步骤 = 300
            case 70:
                目标高度 = -累计下降量 + 当前Z轴的位置
                result = await _safe_poll_idle(axis_no=2, timeout_count=2000, sleep_s=0.02)
                if result.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z_target=首次目标Z轴位置, speed=切割速度)
                if result.get("abort"):
                    return "abort"
                if result.get("success"):
                    当前步骤 = 80
                else:
                    return False
            case 80:
                点位合集 = OffsetEndpointCalculator.calc_xy_points(entities, 当前开口值)
                当前运行点位: list[dict[str, Any]] = list(点位合集[originalPointsNum])
                是否闭合 = 判断当前图形是否闭合(当前运行点位)
                上一轮是否需要闭合 = 是否闭合
                if 是否需要反转 and not 是否闭合:
                    当前运行点位 = list(reversed(当前运行点位))
                原始点数据_插补数据 = list(当前运行点位)

                当前速度百分比 = 边缘切割速度百分比 if 是否在边缘位置 else 中间切割速度百分比
                目标运行速度 = 切割速度 * 当前速度百分比

                try:
                    await service.连续插补XY(路径点=原始点数据_插补数据, 速度=目标运行速度, wait_until_done=True)
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
                result = await _safe_poll_xy_idle(timeout_count=2000, sleep_s=0.01)
                if result.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z_target=首次目标Z轴位置, speed=切割速度)
                if result.get("abort"):
                    return "abort"
                if result.get("success"):
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
                中间切割速度百分比 = min(1.0, max(0.3, round((原始中间切割速度百分比值 + 中间切割速度的变化B / 100 * (当前大区间索引 % (中间切割速度的变化K + 1))), 4)))
                边缘切割速度百分比 = min(1.0, max(0.3, round((原始边缘切割速度百分比值 + 边缘切割速度的变化B / 100 * 段内进度 + 边缘切割速度的变化K / 100 * 当前大区间索引), 4)))

                if 进度百分比 > (变化百分比) / 2 and 是否打开扫黑功能:
                    是否打开扫黑功能 = False
                    await service.设置输出(2, False)
                    是否打开激光 = False
                    累计下降量 = 0

                if 开口形状 == "V型":
                    newScanLength = 上开口值 - tana * 累计下降量 * 2 * 1000
                    scanLengthChaZhi = (上开口值 - newScanLength) / 2
                    最小的偏移 = round(scanLengthChaZhi, 6)
                    最大的偏移 = round(上开口值 - scanLengthChaZhi, 6)
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
                    await service.绝对运动并设速度("Z", 返回最原始的Z轴焦距位置, 切割速度)
                    当前步骤 = 301
                except Exception:
                    pass
            case 301:
                跳转计数 = 0
                目标位置 = 当前Z轴的位置 - float(焦距补偿)
                while 跳转计数 < 2000:
                    try:
                        实际位置 = await service.取_z_实际位置()
                        if abs(实际位置 - 目标位置) <= 0.001:
                            当前步骤 = 999
                            break
                    except Exception:
                        logger.exception("case 301 轮询 Z 轴位置异常")
                    跳转计数 += 1
                    await asyncio.sleep(0.02)
                else:
                    return False
            case 999:
                await service.停止运动()
                await service.设置输出(0, False)
                await service.设置输出(2, False)
                当前步骤 = 9999

    return True


async def 用旋转轴去切圆(
    originalPointsNum: int,
    recipe_payload: dict[str, Any],
    entities: list[dict[str, Any]],
    *,
    rs232: 串口驱动 | None = None,
    rs232_open: dict[str, Any] | None = None,
) -> bool | str:
    """这个是单独拿出来用作R轴切圆"""
    service = MotionService.获取实例()
    实体列表 = entities
    当前任务索引 = originalPointsNum

    主配方 = recipe_payload.get("selectedMainRecipe") or {}
    主配方中的扫黑配方 = 在配方中查找ID的配方(recipe_payload.get("selectedBlackeningRecipe"), 主配方.get("blackeningRecipeId"))
    主配方中的工作配方 = 在配方中查找ID的配方(recipe_payload.get("selectedMachiningRecipe"), 主配方.get("machiningRecipeId"))

    if 主配方中的扫黑配方 is None or 主配方中的工作配方 is None:
        logger.warning("用旋转轴去切圆: 主配方 -> 子配方查找失败", extra={
            "mainRecipeId": 主配方.get("id"),
            "blackeningRecipeId": 主配方.get("blackeningRecipeId"),
            "machiningRecipeId": 主配方.get("machiningRecipeId"),
        })
        return False

    扫黑配方中的激光配方 = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"), 主配方中的扫黑配方.get("laserPowerRecipeId"))
    工作配方中的激光配方 = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"), 主配方中的工作配方.get("laserPowerRecipeId"))
    工作配方中的水平配方 = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"), 主配方中的工作配方.get("horizontalFormulaId"))
    工作配方中的垂直配方 = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"), 主配方中的工作配方.get("verticalFormulaId"))

    if (扫黑配方中的激光配方 is None or 工作配方中的激光配方 is None or 工作配方中的水平配方 is None or 工作配方中的垂直配方 is None):
        logger.warning("用旋转轴去切圆: 子配方 -> 公式/激光查找失败", extra={
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
    高度 = 总下降量 = float(recipe_payload.get('extraHeight'))

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
    当前Z轴的位置 = await service.取_z_实际位置() + float(焦距补偿)
    首次目标Z轴位置 = float(当前Z轴的位置) - float(焦距补偿)
    R轴的圈数 = 0
    while 当前步骤 <= 300:
        match 当前步骤:
            case 0:
                是否连上 = service._adapter.已连接 if service._adapter else False
                if 是否连上:
                    await service.设置输出(0, True)
                    当前步骤 = 10
                else:
                    当前步骤 = 300
            case 10:
                圆中心点X = 实体列表[当前任务索引].get('center').get('x') + 实体列表[当前任务索引].get('radius')
                圆中心点Y = 实体列表[当前任务索引].get('center').get('y')
                try:
                    await service.绝对运动并设速度("X", 圆中心点X, 10)
                    await service.绝对运动并设速度("Y", 圆中心点Y, 10)
                    当前步骤 = 20
                except Exception:
                    当前步骤 = 300
            case 20:
                result = await _safe_poll_xy_idle(timeout_count=2000, sleep_s=0.02)
                if result.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z_target=首次目标Z轴位置, speed=切割速度)
                if result.get("abort"):
                    return "abort"
                if result.get("success"):
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
                await _ensure_rs232_before_laser(rs232, rs232_open, str(扫黑功率), str(扫黑频率), str(扫黑电流))
                当前步骤 = 40
            case 32:
                await _ensure_rs232_before_laser(rs232, rs232_open, str(工作功率), str(工作频率), str(工作电流))
                当前步骤 = 40
            case 40:
                if not 是否打开激光:
                    await service.设置输出(2, True)
                    是否打开激光 = True
                当前步骤 = 41
            case 41:
                R轴旋转结果 = await service.R轴一直进行旋转()
                当前步骤 = 50 if R轴旋转结果.get('success') else 300
            case 50:
                当前步骤 = 60 if 累计下降量 <= 总下降量 else 300
            case 60:
                Z轴目标位置 = -累计下降量 + 当前Z轴的位置
                try:
                    await service.绝对运动并设速度("Z", Z轴目标位置, 切割速度)
                    当前步骤 = 70
                except Exception:
                    当前步骤 = 300
            case 70:
                result = await _safe_poll_idle(axis_no=2, timeout_count=2000, sleep_s=0.02)
                if result.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z_target=首次目标Z轴位置, speed=切割速度)
                if result.get("abort"):
                    return "abort"
                if result.get("success"):
                    当前步骤 = 80
                else:
                    return False
            case 80:
                R轴的圈数 = await service.获取R轴的当前位置()
                当前步骤 = 90 if R轴的圈数 is not None else 300
            case 90:
                目标圈数 = float(R轴的圈数) + 1.0
                跳出计数 = 0
                paused_seen = False
                while 跳出计数 < 5000:
                    if await _abort_pending():
                        await 清除运行输出()
                        return "abort"
                    if await _skip_requested():
                        return await 跳过任务时处理并回到目标Z轴位置(z_target=首次目标Z轴位置, speed=切割速度)
                    if await _paused():
                        paused_seen = True
                        await asyncio.sleep(0.05)
                        continue
                    try:
                        R轴当前的圈数 = await service.获取R轴的当前位置()
                    except Exception:
                        logger.exception("case 90 获取R轴位置异常")
                        跳出计数 += 1
                        await asyncio.sleep(0.02)
                        continue
                    if paused_seen:
                        try:
                            R轴恢复结果 = await service.R轴一直进行旋转()
                            if not R轴恢复结果 or not R轴恢复结果.get("success"):
                                return False
                        except Exception:
                            logger.exception("case 90 R轴恢复旋转异常")
                            return False
                        if R轴当前的圈数 is None:
                            return False
                        R轴的圈数 = float(R轴当前的圈数)
                        目标圈数 = R轴的圈数 + float(旋转切割的次数)
                        paused_seen = False
                        continue
                    if R轴当前的圈数 is not None and float(R轴当前的圈数) >= (目标圈数 - 0.001):
                        try:
                            当前X, _ = await service.取_xy_实际位置()
                        except Exception:
                            logger.exception("case 90 获取XY位置异常")
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
                            await service.绝对运动并设速度("X", X的目标距离, 切割速度)
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
                    await service.设置输出(2, False)
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
                await service.停止运动()
                await service.设置输出(0, False)
                await service.设置输出(2, False)
                当前步骤 = 999

    return True


async def 进行4P切产品(
    originalPointsNum: int,
    recipe_payload: dict[str, Any],
    entities: list[dict[str, Any]],
    *,
    rs232: 串口驱动 | None = None,
    rs232_open: dict[str, Any] | None = None,
) -> bool | str:
    """这个是单独拿出来用作R轴切圆"""
    service = MotionService.获取实例()
    旋转中心补偿值 = 读取存储的4P旋转中心补偿值()
    print(旋转中心补偿值.Xoffset, "旋转中心补偿值.Xoffset")
    print(旋转中心补偿值.Yoffset, "旋转中心补偿值.Yoffset")
    print(旋转中心补偿值.Zoffset, "旋转中心补偿值.Zoffset")

    计算当前任务实体旋转后的点 = 计算实体绕坐标轴旋转后的实体点(所有实体数据=entities, 旋转轴="y")
    计算当前任务实体旋转后偏移的点 = OffsetEndpointCalculator.计算绕坐标轴旋转后的偏移点位(计算当前任务实体旋转后的点, 1)
    print(计算当前任务实体旋转后的点, "计算当前任务实体旋转后的点")
    print(计算当前任务实体旋转后偏移的点, "计算当前任务实体旋转后偏移的点")

    主配方 = recipe_payload.get("selectedMainRecipe") or {}
    主配方中的扫黑配方 = 在配方中查找ID的配方(recipe_payload.get("selectedBlackeningRecipe"), 主配方.get("blackeningRecipeId"))
    主配方中的工作配方 = 在配方中查找ID的配方(recipe_payload.get("selectedMachiningRecipe"), 主配方.get("machiningRecipeId"))
    if 主配方中的扫黑配方 is None or 主配方中的工作配方 is None:
        logger.warning("用旋转轴去切圆: 主配方 -> 子配方查找失败", extra={
            "mainRecipeId": 主配方.get("id"),
            "blackeningRecipeId": 主配方.get("blackeningRecipeId"),
            "machiningRecipeId": 主配方.get("machiningRecipeId"),
        })
        return False
    扫黑配方中的激光配方 = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"), 主配方中的扫黑配方.get("laserPowerRecipeId"))
    工作配方中的激光配方 = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"), 主配方中的工作配方.get("laserPowerRecipeId"))
    工作配方中的水平配方 = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"), 主配方中的工作配方.get("horizontalFormulaId"))
    工作配方中的垂直配方 = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"), 主配方中的工作配方.get("verticalFormulaId"))
    if (扫黑配方中的激光配方 is None or 工作配方中的激光配方 is None or 工作配方中的水平配方 is None or 工作配方中的垂直配方 is None):
        logger.warning("用旋转轴去切圆: 子配方 -> 公式/激光查找失败", extra={
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
    高度 = 总下降量 = float(recipe_payload.get('extraHeight'))

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

    计算当前任务实体旋转后的点 = 计算实体绕坐标轴旋转后的实体点(所有实体数据=entities, 旋转轴="y")
    计算当前任务实体旋转后偏移的点 = OffsetEndpointCalculator.计算绕坐标轴旋转后的偏移点位(计算当前任务实体旋转后的点, 1)
    print(计算当前任务实体旋转后的点, "计算当前任务实体旋转后的点")
    print(计算当前任务实体旋转后偏移的点, "计算当前任务实体旋转后偏移的点")
    下降的高度 = float(float(旋转中心补偿值.Zoffset) + float(计算当前任务实体旋转后的点[originalPointsNum].get('points')[0].get('z')))

    焦距补偿 = 工作配方中的水平配方.get('formula').get('focusCompensation')
    Z轴原始初始位置 = await service.取_z_实际位置()
    首次目标Z轴位置 = float(Z轴原始初始位置) + float(焦距补偿)
    下降直到可以切产品的高度 = 首次目标Z轴位置 + 下降的高度

    当前没有偏移的点位 = 计算当前任务实体旋转后的点[originalPointsNum].get('points')
    原始点数据_插补数据 = 当前没有偏移的点位.copy()
    是否需要反转点位 = False

    while 当前步骤 <= 999:
        if await _skip_requested():
            return await 跳过任务时处理并回到目标Z轴位置(z_target=Z轴原始初始位置, speed=切割速度)
        if await _abort_pending():
            当前步骤 = 999

        match 当前步骤:
            case 0:
                是否连上 = service._adapter.已连接 if service._adapter else False
                if 是否连上:
                    await service.设置输出(0, True)
                    当前步骤 = 10
                else:
                    当前步骤 = 300
            case 10:
                起始点X = 当前没有偏移的点位[0].get('x')
                起始点Y = 当前没有偏移的点位[0].get('y')
                try:
                    await service.绝对运动并设速度("X", 起始点X, 切割速度)
                    await service.绝对运动并设速度("Y", 起始点Y, 切割速度)
                    当前步骤 = 11
                except Exception:
                    当前步骤 = 300
            case 11:
                result = await _safe_poll_xy_idle(timeout_count=2000, sleep_s=0.02)
                if result.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z_target=Z轴原始初始位置, speed=切割速度)
                if result.get("abort"):
                    return "abort"
                if result.get("success"):
                    当前步骤 = 20
                else:
                    当前步骤 = 300
            case 12:
                旋转角度 = entities[originalPointsNum].get("surfaceAngle")
                旋转结果 = await service.U轴旋转角度(旋转角度=旋转角度)
                if not 旋转结果.get('success'):
                    当前步骤 = 300
                当前步骤 = 13
            case 13:
                跳出计数 = 0
                paused_seen = False
                while True:
                    if await _abort_pending():
                        await 清除运行输出()
                        return "abort"
                    if await _skip_requested():
                        return await 跳过任务时处理并回到目标Z轴位置(z_target=Z轴原始初始位置, speed=切割速度)
                    if await _paused():
                        paused_seen = True
                        await asyncio.sleep(0.05)
                        continue
                    await asyncio.sleep(0.02)
                    是否到达旋转角度 = await service.U轴是否到达旋转角度(旋转角度=旋转角度)
                    if paused_seen:
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
                await _ensure_rs232_before_laser(rs232, rs232_open, str(扫黑功率), str(扫黑频率), str(扫黑电流))
                当前步骤 = 40
            case 32:
                await _ensure_rs232_before_laser(rs232, rs232_open, str(工作功率), str(工作频率), str(工作电流))
                当前步骤 = 40
            case 40:
                if not 是否打开激光:
                    await service.设置输出(2, True)
                    是否打开激光 = True
                当前步骤 = 50
            case 50:
                当前步骤 = 60 if 累计下降量 <= 总下降量 else 300
            case 60:
                Z轴目标位置 = -累计下降量 + 下降直到可以切产品的高度
                try:
                    await service.绝对运动并设速度("Z", Z轴目标位置, 切割速度)
                    当前步骤 = 70
                except Exception:
                    当前步骤 = 300
            case 70:
                result = await _safe_poll_idle(axis_no=2, timeout_count=2000, sleep_s=0.02)
                if result.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z_target=Z轴原始初始位置, speed=切割速度)
                if result.get("abort"):
                    return "abort"
                if result.get("success"):
                    当前步骤 = 80
                else:
                    当前步骤 = 300
            case 80:
                计算所有实体旋转后偏移的点 = OffsetEndpointCalculator.计算绕坐标轴旋转后的偏移点位(计算当前任务实体旋转后的点, 当前开口值)
                当前运行点位: list[dict[str, Any]] = list(计算所有实体旋转后偏移的点[originalPointsNum].get("points"))
                是否闭合 = True if abs(当前运行点位[0]['x'] - 当前运行点位[-1]['x']) <= 0.001 and abs(当前运行点位[0]['y'] - 当前运行点位[-1]['y']) <= 0.001 else False
                x, y = await service.取_xy_实际位置()
                是否需要反转点位 = abs(当前运行点位[0]['x'] - x) >= 0.06 or abs(当前运行点位[0]['y'] - y) >= 0.06
                if 是否需要反转点位 and not 是否闭合:
                    当前运行点位 = list(reversed(当前运行点位))
                原始点数据_插补数据 = list(当前运行点位)
                目标速度 = 切割速度 * 边缘切割速度百分比 if 是否在边缘位置 else 切割速度 * 中间切割速度百分比
                try:
                    await service.连续插补XY(路径点=原始点数据_插补数据, 速度=目标速度, wait_until_done=True)
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
                result = await _safe_poll_xy_idle(timeout_count=2000, sleep_s=0.01)
                if result.get("skip"):
                    return await 跳过任务时处理并回到目标Z轴位置(z_target=Z轴原始初始位置, speed=切割速度)
                if result.get("abort"):
                    return "abort"
                if result.get("success"):
                    当前步骤 = 90 if not 是否需要跳转计算下一层开口 else 100
                else:
                    当前步骤 = 300
            case 90:
                当前开口值 = 当前开口值 + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - 每次开口的偏移量
                result1 = 最小的偏移 / 1000 < 当前开口值
                result2 = 当前开口值 < 最大的偏移 / 1000
                if result1 and result2:
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
                delta = 当前量 - 上层量
                每次下降步长量 -= delta * 每次下降步长量减少量
                上层量 = 当前量
                累计下降量 += round(每次下降步长量, 6)

                if 进度百分比 > (变化百分比) / 2 and 是否打开扫黑功能:
                    是否打开扫黑功能 = False
                    await service.设置输出(2, False)
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
                    await service.绝对运动并设速度("Z", Z轴原始初始位置, 切割速度)
                    当前步骤 = 301
                except Exception:
                    pass
            case 301:
                跳转计数 = 0
                while 跳转计数 < 2000:
                    try:
                        实际位置 = await service.取_z_实际位置()
                        if abs(实际位置 - Z轴原始初始位置) <= 0.001:
                            当前步骤 = 999
                            break
                    except Exception:
                        logger.exception("4P case 301 轮询 Z 轴位置异常")
                    跳转计数 += 1
                    await asyncio.sleep(0.02)
                else:
                    当前步骤 = 300
            case 999:
                await service.停止运动()
                await service.设置输出(0, False)
                await service.设置输出(2, False)
                当前步骤 = 9999
    return True
