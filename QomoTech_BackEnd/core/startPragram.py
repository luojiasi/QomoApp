from __future__ import annotations

import logging
import math
import time
import threading
from typing import Any

from core.calc_offset_ljs import OffsetEndpointCalculator
from core.program_status_ws import notify_program_status_changed
from core.zmotion_adapter import ZMotionAdapter
from config.product4P_config import 读取存储的4P旋转中心补偿值
from core.calc_rotation import 计算点绕坐标轴旋转,计算实体绕坐标轴旋转后的实体点
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
# 暂停运动的激光状态
_laser_resume_required = False
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


def 清除运行输出(controller: ZMotionAdapter) -> None:
    try:
        controller.stop_axis_motion([0, 1, 2, 3, 4 ,5 ])
        controller.open_output(0, 0)
        controller.open_output(2, 0)
    except Exception:
        logger.exception("runtime_cleanup_outputs failed")


def 程序请求暂停(motion: ZMotionDriver | None = None) -> dict[str, Any]:
    global _program_paused, _laser_resume_required
    with _PROGRAM_CTRL_LOCK:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_paused = True
    m = motion or _current_motion_ref
    if m and m.is_connected():
        # 记录暂停前激光状态：仅当暂停前激光已开，恢复时才重开，避免误触发。
        laser_was_on = bool(m.get_output(2))
        _laser_resume_required = laser_was_on
        if laser_was_on:
            m.set_output(2, False)
        m.emergency_stop_all_axes([0, 1, 2, 3 , 4 , 5])
    notify_program_status_changed(force=True)
    return {"success": True, "message": "已暂停"}


def 程序请求恢复运行() -> dict[str, Any]:
    global _program_paused, _laser_resume_required
    with _PROGRAM_CTRL_LOCK:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_paused = False
    m = _current_motion_ref
    if m and m.is_connected() and _laser_resume_required:
        m.set_output(2, True)
        _laser_resume_required = False
    notify_program_status_changed(force=True)
    return {"success": True, "message": "已继续运行"}


def 程序请求急停(motion: ZMotionDriver | None = None) -> dict[str, Any]:
    global _program_abort_requested, _program_paused, _laser_resume_required
    with _PROGRAM_CTRL_LOCK:
        _program_abort_requested = True
        _program_paused = False
        _laser_resume_required = False
    m = motion or _current_motion_ref
    if m and m.is_connected():
        m.set_output(2, False)
        m.emergency_stop_all_axes([0, 1, 2, 3 , 4 , 5])
    notify_program_status_changed(force=True)
    return {"success": True, "message": "已急停"}


def 程序请求跳过任务(motion: ZMotionDriver | None = None) -> dict[str, Any]:
    global _program_skip_requested
    with _PROGRAM_CTRL_LOCK:
        if not _program_running:
            return {"success": False, "message": "当前没有运行中的程序"}
        _program_skip_requested = True
    m = motion or _current_motion_ref
    if m and m.is_connected():
        m.emergency_stop_all_axes([0, 1, 2, 3 , 4 , 5])
    notify_program_status_changed(force=True)
    return {"success": True, "message": "已请求跳过当前任务"}


def 程序请求复位(motion: ZMotionDriver) -> dict[str, Any]:
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


def 更新程序任务运行进程(
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
    notify_program_status_changed()


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

def 在配方中查找ID的配方(recipe_payload: Any, id: Any) -> dict[str, Any] | None:
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
            found = 在配方中查找ID的配方(item, id)
            if found is not None:
                return found
        return None

    # dict：如果自身是目标 dict，则直接返回；否则递归查找其 values
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
    """
    校验 entities 中每个实体的 type 是否都属于「圆 / 圆弧」。
    只要有一个不是，立即返回 False。
    """
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



def execute_start_program(*,motion: ZMotionDriver,recipe_payload: dict[str, Any],entities: list[dict[str, Any]],rs232: Rs232Driver | None = None,rs232_open: dict[str, Any] | None = None,) -> dict[str, Any]:
    """
    根据是否闭合来确定是往返运动？
    """
    global _program_running, _current_motion_ref, _program_abort_requested, _program_skip_requested, _program_paused, _laser_resume_required
    global _program_total_tasks, _program_current_task_index, _program_current_task_jindubaifenbi
    if not motion.is_connected():
        return {"success": False, "message": "motion 控制器未连接", "data": {"connected": False}}

    if not _PROGRAM_RUN_LOCK.acquire(blocking=False):
        return {"success": False, "message": "程序正在执行中（重复触发被拒绝）", "data": None}

    try:
        if rs232_open is None and rs232 is not None:
            rs232_open = rs232.get_preferred_session()

        所有任务列表 = OffsetEndpointCalculator.calc_xy_points(entities,0)
        if not 所有任务列表:
            return {"success": False,"message": "没有可执行的任务，请检查实体几何","data": None,}

        with _PROGRAM_CTRL_LOCK:
            _program_running = True
            _program_paused = False
            _program_abort_requested = False
            _program_skip_requested = False
            _laser_resume_required = False
            _current_motion_ref = motion
        更新程序任务运行进程(
            total_tasks=len(所有任务列表),
            current_task_index=0,
            current_task_jindubaifenbi=0.0,
        )

        controller = ZMotionAdapter(motion)
        for 当前任务索引 in range(len(所有任务列表)):
            更新程序任务运行进程(
                current_task_index=当前任务索引 + 1,
                current_task_jindubaifenbi=0.0,
            )
            if _abort_pending():
                清除运行输出(controller)
                return {"success": False, "message": "程序已急停", "data": None}
            # 根据recip选择然后选择切的类型
            主配方 = recipe_payload.get("selectedMainRecipe") or {}
            加工工艺配方 = 在配方中查找ID的配方(recipe_payload.get("selectedMachiningRecipe"),主配方.get("machiningRecipeId"),)
            加工工艺配方中的水平配方 = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"),加工工艺配方.get("horizontalFormulaId"))
            加工工艺配方中的垂直配方 = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"),加工工艺配方.get("verticalFormulaId"))
            垂直配方中的加工轴 = 加工工艺配方中的垂直配方.get("formula").get("cuttingAxis")
            # 首先获取实体中的所有type必须都是圆
            判断是否都是圆或者圆弧的结果 = 判断是否都是圆或者圆弧(entities = entities)

            # 我的想法是将切割轴进行分类切割，然后进行不同的处理
            # 现在只能一个一个切圆
            if 垂直配方中的加工轴 == 'R' and 判断是否都是圆或者圆弧的结果:
                outcome =  用旋转轴去切圆(originalPointsNum=当前任务索引,recipe_payload=recipe_payload,controller=controller,entities=entities,rs232=rs232,rs232_open=rs232_open)
            if 垂直配方中的加工轴 == 'XY':
                outcome = 修面和切片的程序(originalPointsNum=当前任务索引,recipe_payload=recipe_payload,controller=controller,entities=entities,rs232=rs232,rs232_open=rs232_open)
            # outcome = 进行4P切产品(originalPointsNum=当前任务索引,recipe_payload=recipe_payload,controller=controller,entities=entities,rs232=rs232,rs232_open=rs232_open)
            
            
            
            
            if outcome == "skip":
                continue
            if outcome == "abort":
                return {"success": False, "message": "程序已急停", "data": None}
            if outcome is False:
                return {"success": False,"message": "运动失败","data": None,}
        if _abort_pending():
            清除运行输出(controller)
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
            _laser_resume_required = False
            _program_total_tasks = 0
            _program_current_task_index = 0
            _program_current_task_jindubaifenbi = 0.0
        _PROGRAM_RUN_LOCK.release()
        notify_program_status_changed(force=True)



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
        return False

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

# 暂时弃用方法，因为和xiumianLoop功能重复
def wangFuLoop(originalPointsNum: int,recipe_payload: dict[str, Any],controller: ZMotionAdapter,entities: list[dict[str, Any]],*,rs232: Rs232Driver | None = None,rs232_open: dict[str, Any] | None = None,) -> bool | str:  # True / False / "skip" / "abort"
    """
    这个目的是进行往复运动，而不是到下一个的起始点
    """

    mainRecipe = recipe_payload.get("selectedMainRecipe") or {}

    # 子配方对象在前端 payload 中是“数组形式”（例如 selectedBlackeningRecipe: [blackening]）
    blackeningRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedBlackeningRecipe"),mainRecipe.get("blackeningRecipeId"),)
    machiningRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedMachiningRecipe"),mainRecipe.get("machiningRecipeId"),)
    cleaningRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedCleaningRecipe"),mainRecipe.get("cleaningRecipeId"),)

    if blackeningRecipe is None or machiningRecipe is None or cleaningRecipe is None:
        logger.warning("wangFuLoop: mainRecipe -> 子配方查找失败",extra={"mainRecipeId": mainRecipe.get("id"),"blackeningRecipeId": mainRecipe.get("blackeningRecipeId"),"machiningRecipeId": mainRecipe.get("machiningRecipeId"),"cleaningRecipeId": mainRecipe.get("cleaningRecipeId"),},)
        return False
    # 激光/公式对象在前端 payload 中是数组合并后的结果
    blackeningLaserPowerRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"),blackeningRecipe.get("laserPowerRecipeId"),)
    machiningLaserPowerRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"),machiningRecipe.get("laserPowerRecipeId"),)

    machiningHorizontalFormula = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"),machiningRecipe.get("horizontalFormulaId"))
    machiningVerticalFormula = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"),machiningRecipe.get("verticalFormulaId"))
    cleaningHorizontalFormula = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"),cleaningRecipe.get("horizontalFormulaId"))
    cleaningVerticalFormula = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"),cleaningRecipe.get("verticalFormulaId"))

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
    maxoffset = upperOpening = depthCompensationK * 1000 * (height+depthCompensationB) * tana + lowerOpening
    # 这个是偏移的最小开口
    minOffset = 0
    # maxOffset = minOffset+lowerOpeningB

    originalPoints = OffsetEndpointCalculator.calc_xy_points(entities,0)[originalPointsNum]
    originalPoints_run = originalPoints.copy()
    isneedReceive = False
    # 如果是封闭的那我isneedReceive就可以不需要翻转
    isClosed = False
    originalPoints_receive = originalPoints.copy()
    z_original_position = controller.get_z_mpos_mm()
    while step <= 300:
        if _skip_requested():
            清除运行输出(controller)
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
                    step = 1
                else:
                    return False
            case 1:
                if saoheiFlag:
                    #上抬一定高度进行扫黑
                    _depth -= saoheishangtaigaodu
                step =10
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
                        清除运行输出(controller)
                        return False
                    if _skip_requested():
                        清除运行输出(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    resultX = controller.get_notIsMoving(0)
                    resultY = controller.get_notIsMoving(1)
                    print(resultY)
                    if paused_seen:
                        step = 20
                        break
                    if resultX.get('success') and resultY.get('success'):
                        if resultX.get('notMoving') and resultY.get('notMoving'):
                            step =21
                            break
                        else:
                            if jumpOutCount>=2000:
                                controller.open_output(2, 0)#关闭激光
                                openLaser = False
                                return False
                            jumpOutCount+=1
                            time.sleep(0.02)
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
                __depth = -_depth + z_original_position
                result = controller.absolute_move_speed({'axis':2,'moveDistance':__depth,'speed':runSpeed})
                if result.get('success') and result is not None:
                    step = 51
                else:
                    return False
            case 51:
                # 判断是否z轴到达位置
                jumpOutCount = 0
                paused_seen = False
                z_target_depth = -_depth + z_original_position
                while True:
                    if _abort_pending():
                        清除运行输出(controller)
                        return False
                    if _skip_requested():
                        清除运行输出(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    result = controller.get_notIsMoving(2)
                    if result.get('success'):
                        if paused_seen:
                            r_z = controller.absolute_move_speed({'axis': 2, 'moveDistance': float(z_target_depth), 'speed': runSpeed})
                            if not r_z.get('success'):
                                return False
                            paused_seen = False
                            continue
                        if result.get('notMoving'):
                            step = 60
                            break
                    if jumpOutCount>=50:
                        return False
                    jumpOutCount+=1
                    time.sleep(0.02)

            case 60:
                # 连续运动（不下发 wait_until_done，便于暂停/急停时在 case 70 轮询）
                if isPaddingFlag:
                    speed = runSpeed*edgeCuttingSpeedRate
                else:
                    speed = runSpeed*middleCuttingSpeedRate

                r_ip = controller.continuous_interpolation_move_adapter(originalPoints_run,speed=speed,wait_until_done=True,)
                if not r_ip.get('success'):
                    return False
                step = 70
            case 70:
                # 判断是否还在运动（支持暂停后从当前位接续剩余路径）
                jumpOutCount = 0
                paused_seen = False
                while True:
                    if _abort_pending():
                        清除运行输出(controller)
                        return False
                    if _skip_requested():
                        清除运行输出(controller)
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
                        if resultX.get('notMoving') and resultY.get('notMoving'):
                            step = 80
                            break
                        else:
                            if jumpOutCount>=2000:
                                controller.open_output(2, 0)#关闭激光
                                return False
                            jumpOutCount+=1
                            time.sleep(0.01)
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


                # 判断是否闭合我需要有一些参数比如说他是不是圆,如果是圆则是闭合,如果不是则要判断
                isClosed = True if path_groups[originalPointsNum][0]['x'] == path_groups[originalPointsNum][-1]['x'] and path_groups[originalPointsNum][0]['y'] == path_groups[originalPointsNum][-1]['y'] else False
                pts: list[dict[str, Any]] = list(path_groups[originalPointsNum])
                if isneedReceive and not isClosed:
                    pts = list(reversed(pts))
                originalPoints_run = list(pts)
                step = 60
            case 110:
                if saoheiFlag:
                    jindubaifenbi = (_depth+saoheishangtaigaodu)/(height)*100
                else:
                    jindubaifenbi = _depth/height*100

                if jindubaifenbi > (decreasingRate)/2 and saoheiFlag:
                    saoheiFlag = False
                    controller.open_output(2, 0)#关闭激光
                    openLaser = False
                    _depth = 0


                current_increments = int(jindubaifenbi // decreasingRate)
                delta = current_increments - previous_increments
                depthStep -= delta * decreasingRateReduce
                previous_increments = current_increments
                _depth += round(depthStep,6)
                # 用更新后的累计下降量计算当前百分比（避免显示落后一拍）
                if saoheiFlag:
                    task_jindubaifenbi = (_depth + saoheishangtaigaodu) / (height) * 100
                else:
                    task_jindubaifenbi = _depth / height * 100
                更新程序任务运行进程(
                    current_task_jindubaifenbi=task_jindubaifenbi,
                )
                # 下降一层计算新开口 = 初始上开口 - tan（角度） *累计下降量um * 2 //单位um
                newScanLength = upperOpening - tana * _depth * 2 * 1000
                scanLengthChaZhi = (upperOpening - newScanLength)/2

                if minOffset  < maxoffset:
                    minOffset = round(scanLengthChaZhi, 6)
                    maxoffset = round(upperOpening - scanLengthChaZhi, 6)
                else:
                    step = 300
                    return False
                step = 21
            case 150 :
                step = 300
            case 300:
                controller.stop_axis_motion([0, 1, 2, 3, 4, 5])
                controller.open_output(0, 0)#关闭吹风
                controller.open_output(2, 0)#关闭激光
                step = 999
                if _abort_pending():
                    return "abort"
    return True
# 每条直线切两次
def 修面和切片的程序(originalPointsNum: int,recipe_payload: dict[str, Any],controller: ZMotionAdapter,entities: list[dict[str, Any]],*,rs232: Rs232Driver | None = None,rs232_open: dict[str, Any] | None = None,) -> bool | str:  # True / False / "skip" / "abort"
    """
    这个是单独拿出来的修面但是要和实际去相匹配
    """
    
    mainRecipe = recipe_payload.get("selectedMainRecipe") or {}

    # 子配方对象在前端 payload 中是“数组形式”（例如 selectedBlackeningRecipe: [blackening]）
    blackeningRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedBlackeningRecipe"),mainRecipe.get("blackeningRecipeId"),)
    machiningRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedMachiningRecipe"),mainRecipe.get("machiningRecipeId"),)
    cleaningRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedCleaningRecipe"),mainRecipe.get("cleaningRecipeId"),)

    if blackeningRecipe is None or machiningRecipe is None or cleaningRecipe is None:
        logger.warning("wangFuLoop: mainRecipe -> 子配方查找失败",extra={"mainRecipeId": mainRecipe.get("id"),"blackeningRecipeId": mainRecipe.get("blackeningRecipeId"),"machiningRecipeId": mainRecipe.get("machiningRecipeId"),"cleaningRecipeId": mainRecipe.get("cleaningRecipeId"),},)
        return False
    # 激光/公式对象在前端 payload 中是数组合并后的结果
    blackeningLaserPowerRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"),blackeningRecipe.get("laserPowerRecipeId"),)
    machiningLaserPowerRecipe = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"),machiningRecipe.get("laserPowerRecipeId"),)

    machiningHorizontalFormula = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"),machiningRecipe.get("horizontalFormulaId"))
    machiningVerticalFormula = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"),machiningRecipe.get("verticalFormulaId"))
    cleaningHorizontalFormula = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"),cleaningRecipe.get("horizontalFormulaId"))
    cleaningVerticalFormula = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"),cleaningRecipe.get("verticalFormulaId"))

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
    
    openingShape = machiningHorizontalFormula.get('formula').get('openingShape')
    # 下开口============如果是修面就直接用B
    minOffset = lowerOpening = lowerOpeningK * height + lowerOpeningB
    maxOffset = upperOpening = depthCompensationK * 1000 * (height+depthCompensationB) * tana + lowerOpening
    # 这个是偏移的最小开口
    minOffset = 0
    # maxOffset = minOffset+lowerOpeningB

    焦距补偿 = machiningHorizontalFormula.get('formula').get('focusCompensation')

    originalPoints = OffsetEndpointCalculator.calc_xy_points(entities,0)[originalPointsNum]
    originalPoints_run = originalPoints.copy()
    isneedReceive = False
    originalPoints_receive = originalPoints.copy()
    z_original_position = controller.get_z_mpos_mm() + float(焦距补偿)
    # TODO:有个问题就是在且边缘的时候会直接跳过去切
    while step <= 300:
        if _skip_requested():
            清除运行输出(controller)
            _clear_skip_request()
            return "skip"
        if _abort_pending():
            step = 300

        match step:
            case 0:
                # 判断控制器是否连上
                result = controller.get_status()
                if result.get('connected'):
                    controller.open_output(0, 1)#打开吹风
                    step = 10
                else:
                    step = 300
            case 10:
                # 首先移动到起点
                startX = originalPoints[0].get('x')
                startY = originalPoints[0].get('y')
                originalPoints = [{'x': startX, 'y': startY}]
                resultX = controller.absolute_move_speed({'axis':0,'moveDistance':startX,'speed':runSpeed})
                resultY = controller.absolute_move_speed({'axis':1,'moveDistance':startY,'speed':runSpeed})
                if resultX.get('success') and resultY.get('success') and resultX is not None and resultY is not None:
                    step = 20
                else:
                    step = 300

            case 20:
                jumpOutCount = 0
                paused_seen = False
                while True:
                    if _abort_pending():
                        清除运行输出(controller)
                        return "abort"
                    if _skip_requested():
                        清除运行输出(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    resultX = controller.get_notIsMoving(0)
                    resultY = controller.get_notIsMoving(1)
                    if paused_seen:
                        # 从暂停恢复后重新走一次状态确认
                        step = 20
                        break
                    if resultX.get('success') and resultY.get('success'):
                        if resultX.get('notMoving') and resultY.get('notMoving'):
                            step = 30
                            break
                    if jumpOutCount >= 2000:
                        return False
                    jumpOutCount += 1
                    time.sleep(0.02)
            case 30:
                # 判断是否打开扫黑功能
                if saoheiFlag:
                    step = 31
                    _depth -= saoheishangtaigaodu
                else:
                    step=32
            case 31:
                # 发送扫黑的的参数
                _ensure_rs232_before_laser(rs232, rs232_open, str(saoheiPower), str(saoheiFrequency), str(saoheiCurrent))
                step = 40
            case 32:
                # 发送工作参数
                _ensure_rs232_before_laser(rs232, rs232_open, str(workPower), str(workFrequency), str(workCurrent))
                step = 40
            case 40:
                if not openLaser:
                    controller.open_output(2, 1)  # 打开激光
                    openLaser = True
                step=50
            case 50:
                # 判断是否到达深度
                if  _depth <= depth:
                    step = 60
                else:
                    step = 300
            case 60:
                targetDepth = -_depth + z_original_position
                result= controller.absolute_move_speed({'axis':2,'moveDistance':targetDepth,'speed':runSpeed})
                if result.get('success') and result is not None:
                    step = 70
                else:
                    step = 300
            case 70:
                # 判断是否到达目标位置（支持暂停后重下发当前目标深度）
                jumpOutCount = 0
                paused_seen = False
                z_target_depth = -_depth + z_original_position
                while True:
                    if _abort_pending():
                        清除运行输出(controller)
                        return "abort"
                    if _skip_requested():
                        清除运行输出(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    result = controller.get_notIsMoving(2)
                    if result.get('success'):
                        if paused_seen:
                            r_z = controller.absolute_move_speed({'axis': 2, 'moveDistance': float(z_target_depth), 'speed': runSpeed})
                            if not r_z.get('success'): return False
                            paused_seen = False
                            continue
                        if result.get('notMoving'):
                            step = 80
                            break
                    if jumpOutCount >= 2000:
                        return False
                    jumpOutCount += 1
                    time.sleep(0.02)

            case 80:
                # 计算偏移并连续运动（暂停后可从当前位重建剩余轨迹）
                path_groups = OffsetEndpointCalculator.calc_xy_points(entities, pointOffset)
                pts: list[dict[str, Any]] = list(path_groups[originalPointsNum])
                isClosed = True if abs(pts[0]['x'] - pts[-1]['x']) <= 0.001 and abs(pts[0]['y'] - pts[-1]['y']) <= 0.001 else False
                if isneedReceive and not isClosed:
                    pts = list(reversed(pts))
                originalPoints_run = list(pts)
                if isPaddingFlag:
                    targetSpeed = runSpeed*edgeCuttingSpeedRate
                else:
                    targetSpeed = runSpeed*middleCuttingSpeedRate
                
                result = controller.continuous_interpolation_move_adapter(originalPoints_run,speed=targetSpeed,wait_until_done=True)
                if result.get('success') and result is not None:
                    step = 81
                else:
                    step = 300
            case 81:
                # 判断是否在边缘
                if isPaddingFlag and (cutTime+1)<cutTimes:
                    cutTime += 1
                    step = 80
                else:
                    cutTime = 0
                    step = 82 if not needJump else 100
            case 82:
                # 判断 XY 是否结束（支持暂停后从当前位置接续）
                jumpOutCount = 0
                paused_seen = False
                while True:
                    if _abort_pending():
                        清除运行输出(controller)
                        return "abort"
                    if _skip_requested():
                        清除运行输出(controller)
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
                                step = 90 if not needJump else 100
                                break
                            step = 80
                            break
                        if resultX.get('notMoving') and resultY.get('notMoving'):
                            step = 90 if not needJump else 100
                            break
                    if jumpOutCount >= 2000:
                        return False
                    jumpOutCount += 1
                    time.sleep(0.01)
            case 90:
                # 计算偏移值
                pointOffset = pointOffset+offsetStep if minToMax else pointOffset-offsetStep

                result1 = minOffset/1000 < pointOffset
                result2 = pointOffset < maxOffset/1000
                if result1 and result2:
                    isneedReceive = not isneedReceive
                    isPaddingFlag = False
                if maxOffset/1000 < pointOffset and minToMax and not needJump:
                    pointOffset = maxOffset/1000
                    isPaddingFlag = True
                    minToMax = not minToMax
                    needJump = True

                if minOffset/1000 > pointOffset and not minToMax and not needJump:
                    pointOffset = minOffset/1000
                    isPaddingFlag = True
                    minToMax = not minToMax
                    needJump = True

                step = 80

            case 100:
                if saoheiFlag:
                    jindubaifenbi = (_depth+saoheishangtaigaodu)/(height)*100
                else:
                    jindubaifenbi = _depth/height*100

                # 计算下一层的偏移开口
                current_increments = int(jindubaifenbi // decreasingRate)
                delta = current_increments - previous_increments
                depthStep -= delta * decreasingRateReduce
                previous_increments = current_increments
                _depth += round(depthStep,6)

                # 我将其移动到下面是为了防止_depth
                if jindubaifenbi > (decreasingRate)/2 and saoheiFlag:
                    saoheiFlag = False
                    controller.open_output(2, 0)#关闭激光
                    openLaser = False
                    _depth = 0

                # 下降一层计算新开口 = 初始上开口 - tan（角度） *累计下降量um * 2 //单位um
                if openingShape == "V型":
                    newScanLength = upperOpening - tana * _depth * 2 * 1000
                    scanLengthChaZhi = (upperOpening - newScanLength)/2
                    minOffset = round(scanLengthChaZhi, 6)
                    maxOffset = round(upperOpening - scanLengthChaZhi, 6)
                if openingShape == "//型":
                    minOffset = tana * _depth * 2 * 1000
                    maxOffset = tana * _depth * 2 * 1000 + upperOpening


                # 写入然后回传给前端的进度
                task_jindubaifenbi =jindubaifenbi
                更新程序任务运行进程(current_task_jindubaifenbi=task_jindubaifenbi)
                needJump = False
                if not saoheiFlag and not openLaser:
                    step = 30
                else:
                    step = 50
            case 110:
                step=150
            case 150:
                step = 300
            case 300:
                controller.stop_axis_motion([0, 1, 2, 3 , 4 , 5])
                controller.open_output(0, 0)#关闭吹风
                controller.open_output(2, 0)#关闭激光
                step = 999
            case 999:
                step = 9999

    return True

def 用旋转轴去切圆(originalPointsNum: int,recipe_payload: dict[str, Any],controller: ZMotionAdapter,entities: list[dict[str, Any]],*,rs232: Rs232Driver | None = None,rs232_open: dict[str, Any] | None = None,) -> bool | str:  # True / False / "skip" / "abort"
    """
    这个是单独拿出来用作R轴切圆
    """
    实体列表 = entities
    当前任务索引 = originalPointsNum

    主配方 = recipe_payload.get("selectedMainRecipe") or {}

    # 子配方对象在前端 payload 中是“数组形式”（例如 selectedBlackeningRecipe: [blackening]）
    主配方中的扫黑配方 = 在配方中查找ID的配方(recipe_payload.get("selectedBlackeningRecipe"),主配方.get("blackeningRecipeId"),)
    主配方中的工作配方 = 在配方中查找ID的配方(recipe_payload.get("selectedMachiningRecipe"),主配方.get("machiningRecipeId"),)
    主配方中的清洗配方 = 在配方中查找ID的配方(recipe_payload.get("selectedCleaningRecipe"),主配方.get("cleaningRecipeId"),)

    if 主配方中的扫黑配方 is None or 主配方中的工作配方 is None or 主配方中的清洗配方 is None:
        logger.warning("用旋转轴去切圆: mainRecipe -> 子配方查找失败",extra={"mainRecipeId": 主配方.get("id"),"blackeningRecipeId": 主配方.get("blackeningRecipeId"),"machiningRecipeId": 主配方.get("machiningRecipeId"),"cleaningRecipeId": 主配方.get("cleaningRecipeId"),},)
        return False    
    # 激光/公式对象在前端 payload 中是数组合并后的结果
    扫黑配方中的激光配方 = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"),主配方中的扫黑配方.get("laserPowerRecipeId"),)
    工作配方中的激光配方 = 在配方中查找ID的配方(recipe_payload.get("selectedLaserRecipe"),主配方中的工作配方.get("laserPowerRecipeId"),)

    工作配方中的水平配方 = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"),主配方中的工作配方.get("horizontalFormulaId"))
    工作配方中的垂直配方 = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"),主配方中的工作配方.get("verticalFormulaId"))
    清洗配方中的水平配方 = 在配方中查找ID的配方(recipe_payload.get("selectedHorizontal"),主配方中的清洗配方.get("horizontalFormulaId"))
    清洗配方中的垂直配方 = 在配方中查找ID的配方(recipe_payload.get("selectedVertical"),主配方中的清洗配方.get("verticalFormulaId"))

    if ( 扫黑配方中的激光配方 is None or 工作配方中的激光配方 is None or 工作配方中的水平配方 is None or 工作配方中的垂直配方 is None or 清洗配方中的水平配方 is None or 清洗配方中的垂直配方 is None ):
        logger.warning("用旋转轴去切圆: 子配方 -> 公式/激光查找失败",extra={"主配方中的扫黑配方ID": 主配方中的扫黑配方.get("id"),"主配方中的工作配方ID": 主配方中的工作配方.get("id"),"主配方中的清洗配方ID": 主配方中的清洗配方.get("id"),},)
        return False


    # 配方中的详细参数
    是否打开激光 = False
    是否打开扫黑功能 = bool(主配方中的扫黑配方.get("enabled"))
    扫黑上台的高度 = float(主配方中的扫黑配方.get("jiaojubuchang"))/1000
    扫黑功率 = 扫黑配方中的激光配方.get("laserPower")
    扫黑频率 = 扫黑配方中的激光配方.get("laserFrequency")
    扫黑电流 = 扫黑配方中的激光配方.get("laserCurrent")
    工作功率 = 工作配方中的激光配方.get("laserPower")
    工作频率 = 工作配方中的激光配方.get("laserFrequency")
    工作电流 = 工作配方中的激光配方.get("laserCurrent")



    角度K  = float(工作配方中的水平配方.get('formula').get('angleFormula').get('k'))
    角度B = float(工作配方中的水平配方.get('formula').get('angleFormula').get('b'))
    tan角度 = math.tan(math.radians(角度K))

    下开口K = float(工作配方中的水平配方.get('formula').get('lowerOpeningFormula').get('k'))
    下开口B = float(工作配方中的水平配方.get('formula').get('lowerOpeningFormula').get('b'))

    深度补偿K = float(工作配方中的水平配方.get('formula').get('depthCompensationFormula').get('k'))
    深度补偿B = float(工作配方中的水平配方.get('formula').get('depthCompensationFormula').get('b'))

    补偿角度K = float(工作配方中的水平配方.get('formula').get('compensationAngleFormula').get('k'))
    补偿角度B = float(工作配方中的水平配方.get('formula').get('compensationAngleFormula').get('b'))

    # TODO: 后续根据这些 recipe 对应字段执行真实运动逻辑
    当前步骤=0


    是否需要跳转计算下一层开口 = False
    进度百分比 = 0   #累计下降量/总下降量
    上层量 =0
    变化百分比 = float(工作配方中的垂直配方.get("formula").get("changePercent"))

    

    累计下降量 = 0
    高度 = 总下降量 = float(recipe_payload.get('extraHeight'))
    
    
    
    当前开口值 = 0
    是否是从小到大的开口偏移 = True
    当前开口值是否在范围内 = True
    每次开口的偏移量 = float(工作配方中的垂直配方.get("formula").get("xFeed"))
    每次下降步长量 = float(工作配方中的垂直配方.get("formula").get("descentCutting").get("speed"))
    每次下降步长量减少量 = float(工作配方中的垂直配方.get("formula").get("descentCutting").get("zFeed"))
    
    当前切割次数=0
    是否在边缘位置 = True
    边缘切割次数 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("cutTimes"))
    中间切割次数 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("cutTimes"))

    切割速度 = float(工作配方中的垂直配方.get("formula").get("xSpeed"))
    边缘切割速度百分比 = float(工作配方中的垂直配方.get("formula").get("edgeCutting").get("speed"))/100
    中间切割速度百分比 = float(工作配方中的垂直配方.get("formula").get("middleCutting").get("speed"))/100


    开口形状 = 工作配方中的水平配方.get('formula').get('openingShape')
    # 下开口============如果是修面就直接用B
    最小的偏移 = 下开口值 = 下开口K * 高度 + 下开口B
    最大的偏移 = 上开口值 = 深度补偿K * 1000 * (高度+深度补偿B) * tan角度 + 下开口值
    最小的偏移 = 0

    焦距补偿 = 工作配方中的水平配方.get("formula").get("focusCompensation")
    当前Z轴的位置 = controller.get_z_mpos_mm() + float(焦距补偿)
    R轴的圈数 = 0
    while 当前步骤<=300:
        match 当前步骤:
            case 0:
                #判断是否控制器连上
                是否连上 = controller.get_status()
                if 是否连上.get('connected'):
                    controller.open_output(0, 1)#打开吹风
                    当前步骤 = 10
                else:
                    当前步骤 = 300
            case 10:
                # 首先移动到圆中心点然后再加半径的位置
                圆中心点X = 实体列表[当前任务索引].get('center').get('x')+实体列表[当前任务索引].get('radius')
                圆中心点Y = 实体列表[当前任务索引].get('center').get('y')
                X移动结果 = controller.absolute_move_speed({'axis':0,'moveDistance':圆中心点X,'speed':10})
                Y移动结果 = controller.absolute_move_speed({'axis':1,'moveDistance':圆中心点Y,'speed':10})
                当前步骤 = 20 if X移动结果.get('success') and Y移动结果.get('success') else 300
            case 20:
                跳出计数 = 0
                paused_seen = False
                while True:
                    if _abort_pending():
                        清除运行输出(controller)
                        return "abort"
                    if _skip_requested():
                        清除运行输出(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    X是否在移动 = controller.get_notIsMoving(0)
                    Y是否在移动 = controller.get_notIsMoving(1)
                    if paused_seen:
                        # 暂停时会急停所有轴；恢复后需要重新下发 XY 目标位，避免卡在等待循环
                        X恢复结果 = controller.absolute_move_speed({'axis':0,'moveDistance':圆中心点X,'speed':10})
                        Y恢复结果 = controller.absolute_move_speed({'axis':1,'moveDistance':圆中心点Y,'speed':10})
                        if not X恢复结果.get('success') or not Y恢复结果.get('success'):
                            return False
                        paused_seen = False
                        continue
                    if X是否在移动.get('success') and Y是否在移动.get('success'):
                        if X是否在移动.get('notMoving') and Y是否在移动.get('notMoving'):
                            当前步骤 = 30
                            break
                    if 跳出计数>=2000:
                        return False
                    跳出计数+=1
                    time.sleep(0.02)
            case 30:
                # 判断是否打开扫黑功能
                if 是否打开扫黑功能:
                    当前步骤 = 31
                    累计下降量 -= 扫黑上台的高度
                else:
                    当前步骤 = 32
            case 31:
                # 发送扫黑的的参数
                _ensure_rs232_before_laser(rs232, rs232_open, str(扫黑功率), str(扫黑频率), str(扫黑电流))
                当前步骤 = 40
            case 32:
                # 发送工作参数
                _ensure_rs232_before_laser(rs232, rs232_open, str(工作功率), str(工作频率), str(工作电流))
                当前步骤 = 40
            case 40:
                # 判断是否打开激光
                if not 是否打开激光:
                    controller.open_output(2, 1)  # 打开激光
                    是否打开激光 = True
                当前步骤 = 41
            case 41:
                # 开始R轴一直旋转
                R轴旋转结果 = controller.R轴一直进行旋转()
                当前步骤 = 50 if R轴旋转结果.get('success') else 300
            case 50:
                # 判断是否达到深度
                当前步骤 = 60 if 累计下降量 <= 总下降量 else 300
            case 60:
                # 移动Z轴到达位置
                Z轴目标位置 = -累计下降量 + 当前Z轴的位置
                Z轴移动结果 = controller.absolute_move_speed({'axis':2,'moveDistance':Z轴目标位置,'speed':切割速度})
                当前步骤 = 70 if Z轴移动结果.get('success')and Z轴移动结果 is not None else 300
            case 70:
                # 判断是否到达目标位置
                跳出计数 = 0
                paused_seen = False
                while True:
                    if _abort_pending():
                        清除运行输出(controller)
                        return "abort"
                    if _skip_requested():
                        清除运行输出(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    Z轴是否在移动 = controller.get_notIsMoving(2)

                    if Z轴是否在移动.get('success'):
                        if paused_seen:
                            # 暂停恢复后重发当前 Z 轴目标
                            Z恢复结果 = controller.absolute_move_speed({'axis':2,'moveDistance':Z轴目标位置,'speed':切割速度})
                            if not Z恢复结果.get('success'):
                                return False
                            paused_seen = False
                            continue
                        if Z轴是否在移动.get('notMoving'):
                            当前步骤 = 80
                            break
                    if 跳出计数>=2000: return False
                    跳出计数+=1
                    time.sleep(0.02)
            case 80:
                # 获取当前R轴的圈数
                R轴的圈数 = controller.获取R轴的当前位置()
                当前步骤 = 90 if R轴的圈数 is not None else 300
            case 90:
                # 等待 R 轴恰好多转 1 圈后，再让 X 轴做一次开口偏移
                目标圈数 = float(R轴的圈数) + 1.0
                跳出计数 = 0
                paused_seen = False
                while True:
                    if _abort_pending():
                        清除运行输出(controller)
                        return "abort"
                    if _skip_requested():
                        清除运行输出(controller)
                        _clear_skip_request()
                        return "skip"
                    if _paused():
                        paused_seen = True
                        time.sleep(0.05)
                        continue
                    R轴当前的圈数 = controller.获取R轴的当前位置()
                    if paused_seen:
                        # 暂停会急停 R 轴，恢复后需重新启动持续旋转，并从当前位置重算“再转 1 圈”的目标
                        R轴恢复结果 = controller.R轴一直进行旋转()
                        if not R轴恢复结果 or not R轴恢复结果.get('success'):
                            return False
                        if R轴当前的圈数 is None:
                            return False
                        R轴的圈数 = float(R轴当前的圈数)
                        目标圈数 = R轴的圈数 + 1.0
                        paused_seen = False
                        continue
                    # 采用微小容差，避免采样周期导致“正好 +1 圈”被跨过
                    if R轴当前的圈数 is not None and float(R轴当前的圈数) >= (目标圈数 - 0.001):
                        当前X, _ = controller.get_xy_dpos_mm()
                        当前开口值 = 当前开口值+每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - 每次开口的偏移量
                        当前开口值是否在范围内 = round(当前开口值, 6) >= round(最小的偏移/1000, 6) and round(当前开口值, 6) <= round(最大的偏移/1000, 6)
                        
                        if not 当前开口值是否在范围内 and 是否是从小到大的开口偏移:
                            X的目标距离 = 当前X + round(round(最大的偏移/1000, 6) - (当前开口值 - 每次开口的偏移量),6)
                            当前开口值 = round(最大的偏移/1000, 6)
                            是否需要跳转计算下一层开口 = True
                        if not 当前开口值是否在范围内 and not 是否是从小到大的开口偏移:
                            X的目标距离 = 当前X - round(当前开口值 + 每次开口的偏移量 - round(最小的偏移/1000, 6),6)
                            当前开口值 = round(最小的偏移/1000, 6)
                            是否需要跳转计算下一层开口 = True

                        if 当前开口值是否在范围内:
                            X的目标距离 = 当前X + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前X - 每次开口的偏移量

                        X移动结果 = controller.absolute_move_speed({'axis': 0, 'moveDistance': X的目标距离, 'speed': 切割速度})
                        当前步骤 = 100 if X移动结果.get('success') else 300
                        break

                    if 跳出计数 >= 5000:
                        当前步骤 = 300
                        break
                    跳出计数 += 1
                    time.sleep(0.02)
            case 100:
                # 判断当前开口值是否在范围内
                print(round(当前开口值,6))
                if 是否需要跳转计算下一层开口:
                    是否是从小到大的开口偏移 = False if 是否是从小到大的开口偏移 else True
                当前步骤 = 80 if 当前开口值是否在范围内 and not 是否需要跳转计算下一层开口 else 110
            case 110:
                是否需要跳转计算下一层开口 = False
                进度百分比 = (累计下降量+扫黑上台的高度)/ 高度 *100 if 是否打开扫黑功能 else 累计下降量/高度 *100
                # 计算下一层的偏移开口
                当层量 = int(进度百分比 // 变化百分比)
                累计下降量 -= (当层量 - 上层量) * 每次下降步长量减少量
                上层量 = 当层量
                累计下降量 += round(每次下降步长量,6)

                if 进度百分比 > 变化百分比/2 and 是否打开扫黑功能:
                    是否打开扫黑功能 = False
                    controller.open_output(2, 0)#关闭激光
                    是否打开激光 = False
                    累计下降量 = 0

                if 开口形状 == "V型":
                    新的开口 = 上开口值 - tan角度 * 累计下降量 * 2 * 1000
                    开口的差值 = (上开口值 - 新的开口)/2
                    最小的偏移 = round(开口的差值, 6)
                    最大的偏移 = round(上开口值 - 开口的差值, 6)
                if 开口形状 == "//型" or 开口形状 == "||型" :
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
                # 结束运动
                当前步骤 = 300
            case 300:
                controller.stop_axis_motion([0, 1, 2, 3 , 4 , 5])
                controller.open_output(0, 0)#关闭吹风
                controller.open_output(2, 0)#关闭激光
                # 移动到边缘位置
                当前步骤 = 999

    return True

def 进行4P切产品(originalPointsNum: int,recipe_payload: dict[str, Any],controller: ZMotionAdapter,entities: list[dict[str, Any]],*,rs232: Rs232Driver | None = None,rs232_open: dict[str, Any] | None = None,) -> bool | str:  # True / False / "skip" / "abort"
    """
    这个是单独拿出来用作R轴切圆
    """
    旋转中心补偿值 = 读取存储的4P旋转中心补偿值()
    print(旋转中心补偿值.Xoffset,"旋转中心补偿值.Xoffset")
    print(旋转中心补偿值.Yoffset,"旋转中心补偿值.Yoffset")
    print(旋转中心补偿值.Zoffset,"旋转中心补偿值.Zoffset")
    # 根据实体类型进行计算旋转后的偏移点
    计算当前任务实体旋转后的点 = 计算实体绕坐标轴旋转后的实体点(所有实体数据 = entities,旋转轴 ="y")
    print(计算当前任务实体旋转后的点,"计算当前任务实体旋转后的点")
    return True


