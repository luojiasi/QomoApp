from __future__ import annotations

import logging
import math
import time
import threading
from typing import Any

from core.calc_offset_ljs import OffsetEndpointCalculator
from core.zmotion_adapter import ZMotionAdapter
from drivers.rs232_driver import Rs232Driver
from drivers.zmotion_driver import ZMotionDriver

logger = logging.getLogger("qomotech.start_program")
_PROGRAM_RUN_LOCK = threading.Lock()
_PROGRAM_CTRL_LOCK = threading.Lock()
_program_running = False
_program_paused = False
_program_abort_requested = False
_program_skip_requested = False
_current_motion_ref: ZMotionDriver | None = None
_program_total_tasks = 0
_program_current_task_index = 0
_program_current_task_jindubaifenbi = 0.0
_ALARM_CLEAR_AXIS_NOS = (0, 1, 2, 3, 4)


def get_program_status() -> dict[str, Any]:
    with _PROGRAM_CTRL_LOCK:
        jindubaifenbi = max(0.0, min(100.0, float(_program_current_task_jindubaifenbi)))
        return {
            "running": bool(_program_running),
            "paused": bool(_program_paused),
            "total_tasks": int(_program_total_tasks),
            "current_task_index": int(_program_current_task_index),
            # 当前任务进度（由后端计算得到）：jindubaifenbi 单位百分比（0-100）
            "jindubaifenbi": jindubaifenbi,
        }


def _runtime_cleanup_outputs(controller: ZMotionAdapter) -> None:
    try:
        controller.stop_axis_motion([0, 1, 2])
        controller.open_output(0, 0)
        controller.open_output(2, 0)
    except Exception:
        logger.exception("runtime_cleanup_outputs failed")


def program_request_pause(motion: ZMotionDriver | None = None) -> dict[str, Any]:
    global _program_paused
    with _PROGRAM_CTRL_LOCK:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_paused = True
    m = motion or _current_motion_ref
    if m and m.is_connected():
        m.emergency_stop_all_axes([0, 1, 2])
    return {"success": True, "message": "已暂停"}


def program_request_resume() -> dict[str, Any]:
    global _program_paused
    with _PROGRAM_CTRL_LOCK:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_paused = False
    return {"success": True, "message": "已继续运行"}


def program_request_estop(motion: ZMotionDriver | None = None) -> dict[str, Any]:
    global _program_abort_requested, _program_paused
    with _PROGRAM_CTRL_LOCK:
        _program_abort_requested = True
        _program_paused = False
    m = motion or _current_motion_ref
    if m and m.is_connected():
        m.emergency_stop_all_axes([0, 1, 2])
    return {"success": True, "message": "已急停"}


def program_request_skip(motion: ZMotionDriver | None = None) -> dict[str, Any]:
    global _program_skip_requested
    with _PROGRAM_CTRL_LOCK:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_skip_requested = True
    m = motion or _current_motion_ref
    if m and m.is_connected():
        m.emergency_stop_all_axes([0, 1, 2])
    return {"success": True, "message": "已请求跳过当前任务"}


def program_request_reset_clear_alarms(motion: ZMotionDriver) -> dict[str, Any]:
    if not motion.is_connected():
        return {"success": False, "message": "motion 控制器未连接"}
    failed: list[int] = []
    for axis_no in _ALARM_CLEAR_AXIS_NOS:
        if not motion.clear_axis_error(int(axis_no)):
            failed.append(int(axis_no))
    if failed:
        return {"success": False, "message": f"部分轴清除报警失败: {failed}"}
    return {"success": True, "message": "报警已清除"}


def _abort_pending() -> bool:
    with _PROGRAM_CTRL_LOCK:
        return bool(_program_abort_requested)


def _skip_requested() -> bool:
    with _PROGRAM_CTRL_LOCK:
        return bool(_program_skip_requested)


def _clear_skip_request() -> None:
    global _program_skip_requested
    with _PROGRAM_CTRL_LOCK:
        _program_skip_requested = False


def _paused() -> bool:
    with _PROGRAM_CTRL_LOCK:
        return bool(_program_paused)


def _update_program_task_progress(
    *,
    total_tasks: int | None = None,
    current_task_index: int | None = None,
    current_task_jindubaifenbi: float | None = None,
) -> None:
    global _program_total_tasks, _program_current_task_index, _program_current_task_jindubaifenbi
    with _PROGRAM_CTRL_LOCK:
        if total_tasks is not None:
            _program_total_tasks = max(0, int(total_tasks))
        if current_task_index is not None:
            _program_current_task_index = max(0, int(current_task_index))
        if current_task_jindubaifenbi is not None:
            _program_current_task_jindubaifenbi = max(0.0, min(100.0, float(current_task_jindubaifenbi)))


def _rebuild_xy_path_from_current(
    original_points_run: list[dict[str, Any]],
    controller: ZMotionAdapter,
) -> list[dict[str, Any]]:
    x0, y0 = controller.get_xy_dpos_mm()

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


def _safe_float(value: Any, *, default: float | None = None) -> float | None:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    if math.isfinite(v):
        return v
    return default

def searchIdInRecipe(recipe_payload: Any, id: Any) -> dict[str, Any] | None:
    """
    在 recipe_payload 中查找具有 `id == id` 的 dict。
    - recipe_payload 可以是 list[dict] / dict，且允许 dict 内嵌套 list/dict 继续递归查找
    - 找不到时返回 None
    """
    if recipe_payload is None:
        return None

    def _ids_equal(a: Any, b: Any) -> bool:
        # 容忍后端/前端传参时 id 的类型不同（例如 string vs number）
        if a is None or b is None:
            return a == b
        return str(a) == str(b)

    # list/tuple：遍历每个元素
    if isinstance(recipe_payload, (list, tuple)):
        for item in recipe_payload:
            if isinstance(item, dict) and _ids_equal(item.get("id"), id):
                return item
            found = searchIdInRecipe(item, id)
            if found is not None:
                return found
        return None

    # dict：如果自身是目标 dict，则直接返回；否则递归查找其 values
    if isinstance(recipe_payload, dict):
        if _ids_equal(recipe_payload.get("id"), id):
            return recipe_payload
        for value in recipe_payload.values():
            found = searchIdInRecipe(value, id)
            if found is not None:
                return found
        return None

    return None



def execute_start_program(*,motion: ZMotionDriver,recipe_payload: dict[str, Any],entities: list[dict[str, Any]],rs232: Rs232Driver | None = None,rs232_open: dict[str, Any] | None = None,) -> dict[str, Any]:
    """
    根据是否闭合来确定是往返运动？
    """
    global _program_running, _current_motion_ref, _program_abort_requested, _program_skip_requested, _program_paused
    global _program_total_tasks, _program_current_task_index, _program_current_task_jindubaifenbi
    if not motion.is_connected():
        return {"success": False, "message": "motion 控制器未连接", "data": {"connected": False}}

    if not _PROGRAM_RUN_LOCK.acquire(blocking=False):
        return {"success": False, "message": "程序正在执行中（重复触发被拒绝）", "data": None}

    try:
        if rs232_open is None and rs232 is not None:
            rs232_open = rs232.get_preferred_session()

        tasks = OffsetEndpointCalculator.calc_xy_points(entities,0)
        if not tasks:
            return {"success": False,"message": "没有可执行的任务，请检查实体几何","data": None,}

        with _PROGRAM_CTRL_LOCK:
            _program_running = True
            _program_paused = False
            _program_abort_requested = False
            _program_skip_requested = False
            _current_motion_ref = motion
        _update_program_task_progress(
            total_tasks=len(tasks),
            current_task_index=0,
            current_task_jindubaifenbi=0.0,
        )

        controller = ZMotionAdapter(motion)
        for _i in range(len(tasks)):
            _update_program_task_progress(
                current_task_index=_i + 1,
                current_task_jindubaifenbi=0.0,
            )
            if _abort_pending():
                _runtime_cleanup_outputs(controller)
                return {"success": False, "message": "程序已急停", "data": None}
            outcome = wangFuLoop(
                originalPointsNum=_i,
                recipe_payload=recipe_payload,
                controller=controller,
                entities=entities,
                rs232=rs232,
                rs232_open=rs232_open,
            )
            if outcome == "skip":
                continue
            if outcome == "abort":
                return {"success": False, "message": "程序已急停", "data": None}
            if outcome is False:
                return {"success": False,"message": "运动失败","data": None,}
        if _abort_pending():
            _runtime_cleanup_outputs(controller)
            return {"success": False, "message": "程序已急停", "data": None}
        return {"success": True, "message": "程序执行完成", "data": None}
    except Exception as exc:
        logger.exception("execute_start_program failed")
        return {"success": False,"message": f"程序执行异常","data": {"error": "运行报错"},}
    finally:
        with _PROGRAM_CTRL_LOCK:
            _program_running = False
            _current_motion_ref = None
            _program_paused = False
            _program_skip_requested = False
            _program_abort_requested = False
            _program_total_tasks = 0
            _program_current_task_index = 0
            _program_current_task_jindubaifenbi = 0.0
        _PROGRAM_RUN_LOCK.release()



# ===============================================================================================================
def _ensure_rs232_before_laser(
    rs232: Rs232Driver | None,
    rs232_open: dict[str, Any] | None,
    power: str,
    frequency: str,
    current: str,
) -> bool:
    """
    激光前确保 RS232 可用并分段发送参数。
    - 未配置 rs232_open：无需处理，返回 True
    - 已连接：复用连接并直接发送
    - 未连接：先打开串口，再发送
    发送顺序：
      1) pow + power
      2) frequency + frequency
      3) current + current
    每次发送间隔 0.5 秒
    """
    if rs232 is None or rs232_open is None:
        return True

    port = rs232_open.get("port")
    receive = rs232_open.get("receive")
    if not isinstance(port, dict) or not isinstance(receive, dict):
        logger.error("rs232_open 缺少有效的 port 或 receive")
        return False

    target_port_name = str(port.get("portName", "")).strip()
    current_port_name = rs232.current_port_name() or ""
    need_reopen = (not rs232.is_connected()) or (bool(target_port_name) and current_port_name != target_port_name)
    if need_reopen:
        ok, msg = rs232.open_session(port, receive)
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
        ok2, msg2 = rs232.send(send_cfg)
        if not ok2:
            logger.error("RS232 参数发送失败（payload=%s）: %s", payload, msg2)
            return False
        if idx < len(send_payloads) - 1:
            time.sleep(0.5)
    rs232.close()
    return True


def wangFuLoop(
    originalPointsNum: int,
    recipe_payload: dict[str, Any],
    controller: ZMotionAdapter,
    entities: list[dict[str, Any]],
    *,
    rs232: Rs232Driver | None = None,
    rs232_open: dict[str, Any] | None = None,
) -> bool | str:  # True / False / "skip" / "abort"
    """
    这个目的是进行往复运动，而不是到下一个的起始点
    """

    mainRecipe = recipe_payload.get("selectedMainRecipe") or {}

    # 子配方对象在前端 payload 中是“数组形式”（例如 selectedBlackeningRecipe: [blackening]）
    blackeningRecipe = searchIdInRecipe(recipe_payload.get("selectedBlackeningRecipe"),mainRecipe.get("blackeningRecipeId"),)
    machiningRecipe = searchIdInRecipe(recipe_payload.get("selectedMachiningRecipe"),mainRecipe.get("machiningRecipeId"),)
    cleaningRecipe = searchIdInRecipe(recipe_payload.get("selectedCleaningRecipe"),mainRecipe.get("cleaningRecipeId"),)

    if blackeningRecipe is None or machiningRecipe is None or cleaningRecipe is None:
        logger.warning("wangFuLoop: mainRecipe -> 子配方查找失败",extra={"mainRecipeId": mainRecipe.get("id"),"blackeningRecipeId": mainRecipe.get("blackeningRecipeId"),"machiningRecipeId": mainRecipe.get("machiningRecipeId"),"cleaningRecipeId": mainRecipe.get("cleaningRecipeId"),},)
        return False
    # 激光/公式对象在前端 payload 中是数组合并后的结果
    blackeningLaserPowerRecipe = searchIdInRecipe(recipe_payload.get("selectedLaserRecipe"),blackeningRecipe.get("laserPowerRecipeId"),)
    machiningLaserPowerRecipe = searchIdInRecipe(recipe_payload.get("selectedLaserRecipe"),machiningRecipe.get("laserPowerRecipeId"),)

    machiningHorizontalFormula = searchIdInRecipe(recipe_payload.get("selectedHorizontal"),machiningRecipe.get("horizontalFormulaId"))
    machiningVerticalFormula = searchIdInRecipe(recipe_payload.get("selectedVertical"),machiningRecipe.get("verticalFormulaId"))
    cleaningHorizontalFormula = searchIdInRecipe(recipe_payload.get("selectedHorizontal"),cleaningRecipe.get("horizontalFormulaId"))
    cleaningVerticalFormula = searchIdInRecipe(recipe_payload.get("selectedVertical"),cleaningRecipe.get("verticalFormulaId"))

    if ( blackeningLaserPowerRecipe is None or machiningLaserPowerRecipe is None or machiningHorizontalFormula is None or machiningVerticalFormula is None or cleaningHorizontalFormula is None or cleaningVerticalFormula is None ):
        logger.warning("wangFuLoop: 子配方 -> 公式/激光查找失败",extra={"blackeningRecipeId": blackeningRecipe.get("id"),"machiningRecipeId": machiningRecipe.get("id"),"cleaningRecipeId": cleaningRecipe.get("id"),},)
        return False

    saoheiPower = blackeningLaserPowerRecipe.get("laserPower")
    saoheiFrequency = blackeningLaserPowerRecipe.get("laserFrequency")
    saoheiCurrent = blackeningLaserPowerRecipe.get("laserCurrent")

    workPower = machiningLaserPowerRecipe.get("laserPower")
    workFrequency = machiningLaserPowerRecipe.get("laserFrequency")
    workCurrent = machiningLaserPowerRecipe.get("laserCurrent")



    # TODO: 后续根据这些 recipe 对应字段执行真实运动逻辑
    step=0
    needJump = False
    isPaddingFlag = True
    jindubaifenbi = 0
    previous_increments =0
    pointOffset = 0
    minToMax = True
    _depth = 0
    cutTime=0
    openLaser = False

    height = depth = float(recipe_payload.get('extraHeight')) 
    decreasingRate = float(machiningVerticalFormula.get("formula").get("changePercent"))#变化百分比
    offsetStep = float(machiningVerticalFormula.get("formula").get("xFeed"))#X-FEED


    depthStep = float(machiningVerticalFormula.get("formula").get("descentCutting").get("speed"))#下降速度
    decreasingRateReduce = float(machiningVerticalFormula.get("formula").get("descentCutting").get("zFeed"))#Z-FEED

    
    cutTimes = float(machiningVerticalFormula.get("formula").get("edgeCutting").get("cutTimes"))#边缘切割次数
    middleCutTimes = float(machiningVerticalFormula.get("formula").get("middleCutting").get("cutTimes"))#中间切割次数

    runSpeed = float(machiningVerticalFormula.get("formula").get("xSpeed"))#X-SPEED
    edgeCuttingSpeedRate = float(machiningVerticalFormula.get("formula").get("edgeCutting").get("speed"))/100#边缘切割速度百分比
    middleCuttingSpeedRate = float(machiningVerticalFormula.get("formula").get("middleCutting").get("speed"))/100#中间切割速度百分比

    saoheiFlag = bool(blackeningRecipe.get("enabled"))
    saoheishangtaigaodu = float(blackeningRecipe.get("jiaojubuchang"))/1000

    jiaoduK  = float(machiningHorizontalFormula.get('formula').get('angleFormula').get('k'))
    jiaoduB = float(machiningHorizontalFormula.get('formula').get('angleFormula').get('b'))

    tana = math.tan(math.radians(jiaoduK))

    lowerOpeningK = float(machiningHorizontalFormula.get('formula').get('lowerOpeningFormula').get('k'))
    lowerOpeningB = float(machiningHorizontalFormula.get('formula').get('lowerOpeningFormula').get('b'))

    depthCompensationK = float(machiningHorizontalFormula.get('formula').get('depthCompensationFormula').get('k'))
    depthCompensationB = float(machiningHorizontalFormula.get('formula').get('depthCompensationFormula').get('b'))

    compensationAngleK = float(machiningHorizontalFormula.get('formula').get('compensationAngleFormula').get('k'))
    compensationAngleB = float(machiningHorizontalFormula.get('formula').get('compensationAngleFormula').get('b'))
    
    # 下开口
    minOffset = lowerOpening = lowerOpeningK * height + lowerOpeningB
    maxoffset = upperOpening = depthCompensationK * 2000 * (height+depthCompensationB) * tana + lowerOpening

    originalPoints = OffsetEndpointCalculator.calc_xy_points(entities,0)[originalPointsNum]
    originalPoints_run = originalPoints.copy()
    isneedReceive = False
    originalPoints_receive = originalPoints.copy()




    while step <= 300:
        if _skip_requested():
            _runtime_cleanup_outputs(controller)
            _clear_skip_request()
            return "skip"
        if _abort_pending():
            step = 300

        match step:
            case 0:
                # 获取是否连接上控制器
                result = controller.get_status()
                if  result.get('connected'):
                    controller.open_output(0, 1)#打开吹风
                    step = 10
                else:
                    return False


            case 10:
                # 移动到起点
                startX = originalPoints[0].get('x')
                startY = originalPoints[0].get('y')
                resultX = controller.absolute_move_speed({'axis':0,'moveDistance':startX,'speed':runSpeed*middleCuttingSpeedRate})
                resultY = controller.absolute_move_speed({'axis':1,'moveDistance':startY,'speed':runSpeed*middleCuttingSpeedRate})
                if not resultX.get('success') or not resultY.get('success') or resultX is None or resultY is None:
                    return False
                step = 20
            case 20:
                jumpOutCount = 0
                paused_seen = False
                while True:
                    if _abort_pending():
                        _runtime_cleanup_outputs(controller)
                        return False
                    if _skip_requested():
                        _runtime_cleanup_outputs(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    resultX = controller.get_notIsMoving(0)
                    resultY = controller.get_notIsMoving(1)
                    if resultX.get('success') and resultY.get('success'):
                        if paused_seen:
                            step = 20
                            break
                        step =21
                        break
                    if jumpOutCount>=2000:
                        controller.open_output(2, 0)#关闭激光
                        openLaser = False
                        return False
                    jumpOutCount+=1
                    time.sleep(0.5)
            
            case 21:
                if saoheiFlag:
                    step = 31
                    openLaser = False
                else:
                    step = 32
            case 31:
                # 发送扫黑的的参数
                if not openLaser:
                    _ensure_rs232_before_laser(rs232, rs232_open, str(saoheiPower), str(saoheiFrequency), str(saoheiCurrent))
                    controller.open_output(2, 1)  # 打开激光
                    openLaser = True
                step = 40
            case 32:
                if not openLaser:
                    # 发送正常工作的rs232参数
                    _ensure_rs232_before_laser(rs232, rs232_open, str(workPower), str(workFrequency), str(workCurrent))
                    controller.open_output(2, 1)  # 打开激光
                    openLaser = True
                step = 40



                    
            case 40:
                # 判断是否超过深度
                if  _depth <= depth:
                    step = 50
                else:
                    step = 150 
            case 50:
                if saoheiFlag:
                    #上抬一定高度进行扫黑
                    _depth -= saoheishangtaigaodu
                    
                __depth = -_depth
                result = controller.absolute_move_speed({'axis':2,'moveDistance':__depth,'speed':runSpeed})
                if result.get('success') and result is not None:
                    step = 51
                else:
                    return False
            case 51:
                # 判断是否z轴到达位置
                jumpOutCount = 0
                paused_seen = False
                z_target_depth = -_depth
                while True:
                    if _abort_pending():
                        _runtime_cleanup_outputs(controller)
                        return False
                    if _skip_requested():
                        _runtime_cleanup_outputs(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    result = controller.get_notIsMoving(2)
                    if result.get('success') and result is not None:
                        if paused_seen:
                            r_z = controller.absolute_move_speed({'axis': 2, 'moveDistance': float(z_target_depth), 'speed': runSpeed*middleCuttingSpeedRate})
                            if not r_z.get('success'):
                                return False
                            paused_seen = False
                            continue
                        step = 60
                        break
                    if jumpOutCount>=50:
                        return False
                    jumpOutCount+=1
                    time.sleep(0.05)






            case 60:
                # 连续运动（不下发 wait_until_done，便于暂停/急停时在 case 70 轮询）
                if isPaddingFlag:
                    speed = runSpeed*edgeCuttingSpeedRate
                else:
                    speed = runSpeed*middleCuttingSpeedRate

                r_ip = controller.continuous_interpolation_move_adapter(
                    originalPoints_run,
                    speed=speed,
                    wait_until_done=True,
                )
                if not r_ip.get('success'):
                    return False
                step = 70
            case 70:
                # 判断是否还在运动（支持暂停后从当前位接续剩余路径）
                jumpOutCount = 0
                paused_seen = False
                while True:
                    if _abort_pending():
                        _runtime_cleanup_outputs(controller)
                        return False
                    if _skip_requested():
                        _runtime_cleanup_outputs(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    resultX = controller.get_notIsMoving(0)
                    resultY = controller.get_notIsMoving(1)
                    if resultX.get('success') and resultY.get('success'):
                        if paused_seen:
                            originalPoints_run = _rebuild_xy_path_from_current(originalPoints_run, controller)
                            if len(originalPoints_run) < 2:
                                step = 80
                                break
                            step = 60
                            break
                        step = 80
                        break
                    if jumpOutCount>=2000:
                        controller.open_output(2, 0)#关闭激光
                        return False
                    jumpOutCount+=1
                    time.sleep(0.05)
            case 80:
                if isPaddingFlag and cutTime < cutTimes:
                    # TODO:出现一个问题就是当我切割边缘的时候还是会移动到到起点进行切割
                    cutTime += 1
                    step = 60
                else:
                    cutTime = 0
                    step = 90
                    if needJump:
                        needJump = False
                        step = 110
            case 90:
                # 计算缩放值
                if minToMax:
                    pointOffset +=offsetStep 
                    isPaddingFlag = False
                    isneedReceive = not isneedReceive
                    step = 100
                elif not minToMax:
                    pointOffset -=offsetStep 
                    isPaddingFlag = False
                    isneedReceive = not isneedReceive
                    step = 100
            case 100:
                if pointOffset > maxoffset/1000 and minToMax:
                    pointOffset = maxoffset/1000
                    isPaddingFlag = True
                    minToMax = False
                    needJump = True
                if pointOffset < minOffset/1000 and not minToMax:
                    pointOffset = minOffset/1000
                    isPaddingFlag = True
                    minToMax = True
                    needJump = True

                if (pointOffset <= maxoffset/1000 and minToMax) or isPaddingFlag:
                    isPaddingFlag =False
                    step = 101
                elif (pointOffset >=minOffset/1000 and not minToMax) or isPaddingFlag:
                    isPaddingFlag =False
                    step = 101
            case 101:
                # 按当前 pointOffset 计算偏移轨迹；若 isneedReceive 则需反转点序（首点变末点）
                path_groups = OffsetEndpointCalculator.calc_xy_points(entities, pointOffset)
                pts: list[dict[str, Any]] = list(path_groups[originalPointsNum])
                if isneedReceive:
                    pts = list(reversed(pts))
                originalPoints_run = list(pts)
                step = 60
            case 110:
                if saoheiFlag:
                    jindubaifenbi = (_depth+saoheishangtaigaodu)/(height)*100
                else:
                    jindubaifenbi = _depth/height*100

                if jindubaifenbi > 5 and saoheiFlag:
                    saoheiFlag = False
                    controller.open_output(2, 0)#关闭激光
                    openLaser = False
                    _depth = 0


                current_increments = int(jindubaifenbi // decreasingRate)
                delta = current_increments - previous_increments
                depthStep -= delta * decreasingRateReduce
                previous_increments = current_increments
                _depth += round(depthStep,4)
                # 用更新后的累计下降量计算当前百分比（避免显示落后一拍）
                if saoheiFlag:
                    task_jindubaifenbi = (_depth + saoheishangtaigaodu) / (height) * 100
                else:
                    task_jindubaifenbi = _depth / height * 100
                _update_program_task_progress(
                    current_task_jindubaifenbi=task_jindubaifenbi,
                )
                # 下降一层计算新开口 = 初始上开口 - tan（角度） *累计下降量um * 2 //单位um
                newScanLength = upperOpening - tana * _depth * 2 * 1000
                scanLengthChaZhi = (upperOpening - newScanLength)/2

                if minOffset  < maxoffset:
                    minOffset = round(scanLengthChaZhi, 4)
                    maxoffset = round(upperOpening - scanLengthChaZhi, 4)
                else:
                    step = 300
                    return False
                step = 21
            case 150 :
                step = 300
            case 300:
                controller.stop_axis_motion([0, 1, 2])
                controller.open_output(0, 0)#关闭吹风
                controller.open_output(2, 0)#关闭激光
                step = 999
                if _abort_pending():
                    return "abort"
    return True

def xunhuaiLoop():
    return True