# QomoTech 后端重构 —— 进度移交文档

> 创建时间：2026-05-08（多轮迭代更新）
> 适用对象：下一轮对话 / 接手开发的 AI Agent 或工程师
> 当前状态：PR-1 / PR-2 / PR-3 / PR-4 / PR-5 已完成，lint 全过

---

## 一、项目背景

把 `QomoTech_BackEnd/`（生产中的旧代码）按 `QomoTech_BackEnd_New/` 的分层架构重构。

旧后端痛点：

- 1685 行 `core/startPragram.py` 单文件，业务逻辑、流程控制、状态推送混在一起
- `drivers/zmotion_driver.py` 同步调用，未做 DLL 串行化
- 模块级全局变量（`api/dependencies.py` 副作用注入）
- 没有状态机、没有安全控制器、配置硬编码散落各处
- 路由层重复（http_api 同时承担多种职责）
- 状态推送方式不统一

---

## 二、不可违反的约束规则（用户明确指示）

1. **只能在 `configs/`、`services/`、`routers/` 三个目录下创建/修改代码**
2. **`config/`、`api/`、`core/`、`drivers/`、`utils/`、`libs/` 等已有目录** —— 完全不动（可读可引用，禁修改/删除）
3. **配置走代码硬编码默认值**（Pydantic `BaseModel`），不用 JSON 文件
4. **service 直接用 Pydantic 配置实例**，不做 dataclass 适配层
5. **`services/` 目录分层规则**：
   - `services/MotionService.py` / `Rs232Service.py` / `CameraService.py` / `PragramService.py` —— 4 个对外接口（路由层只 import 这 4 个）
   - `services/motion_control/`、`services/camera_control/` 等子目录 —— 组件层（私有实现）
6. **5 轴轴号映射**：`X=0, Y=1, Z=2, U=3, R=4`
   - 旧 `drivers/zmotion_driver.py:35` 的 `_AXIS_NAME_BY_NO` 把 R/U 写反了
   - 新代码按配置正确顺序
7. **`merge_params` 子模型**：原平铺的 `corner_mode/decel_angle/stop_angle/zxmooth` 4 个字段折成子模型；前端要相应改
8. **PR-1 当前不补软限位 / 进给倍率 / 是否要求先回零等字段**
   - `safe_controller` 留 hook：`# TODO(soft_limit)` / `# TODO(feed_override)` / `# TODO(require_home)`
9. **`safe_controller.py` 保留这个名字**，不改成 `safety_controller.py`
10. **回复使用简体中文**

---

## 三、已完成的 PR

### PR-1：配置层 + 数据模型

| 文件 | 行数 | 说明 |
|---|---|---|
| `configs/motion_config.py` | 95 | Pydantic：`MergeParams` 子模型 + `MotionAxisConfig`（13 主字段） + `MotionConfig`（5 轴 + `axes/axis_map/axis_no_to_name` 属性）+ `motion_config` 单例 |
| `configs/rs232_config.py` | 30 | Pydantic：`Rs232Config` + `rs232_config` 单例 |
| `configs/app_config.py` | 67 | 从 `config/app_config.py` 复制过来，未做改动 |
| `services/motion_control/config_loader.py` | 89 | 暴露 `加载运动配置/取配置` + `轴名列表/轴号列表/取轴/取轴号/取轴名/校验轴名集合` 等 helper |
| `services/motion_control/models.py` | 103 | `运动状态` 枚举（7 态）+ `轴快照` + `状态快照`（含 `to_dict()` 输出英文字段） |

`运动状态` 七态：`DISCONNECTED / IDLE / HOMING / MOVING / PAUSED / ESTOP / ALARM`

### PR-2：状态机 + 安全控制器

| 文件 | 行数 | 说明 |
|---|---|---|
| `services/motion_control/state_machine.py` | 170 | `状态事件` 枚举 + `_迁移表` + `_全局事件`（ESTOP/ALARM 任意状态可触发）+ `状态机` 类（`RLock` 线程安全，监听器在锁外回调） |
| `services/motion_control/safe_controller.py` | 316 | `SafetyViolation` 异常 + `安全控制器` 类：校验（轴名/列表/方向）+ 速度归一（`axis.speed` 兜底+clamp）+ 状态准入（运动指令/点动/回零/停止类/暂停/继续）+ 复合检查（单轴绝对/单轴相对/直线插补/点动/回零/合并）+ 3 处 hook 留接口 |

### PR-3：DLL 适配器 + 状态采集 + 编排门面

| 文件 | 行数 | 说明 |
|---|---|---|
| `services/motion_control/zmc_adapter.py` | 1912 | **完整覆盖** `drivers/zmotion_driver.py` + `core/zmotion_adapter.py` 全部方法 |
| `services/motion_control/status_monitor.py` | 175 | 50ms 采集 daemon 线程，调 `adapter._同步_批量读取`，全空闲触发 `状态机.触发(COMPLETE)`，发布回调投递 `MotionService._发布快照` |
| `services/MotionService.py` | 1075 | 对外单例门面 |

`zmc_adapter.py` 结构：

1. 常量 / 异常 / 数据载体
2. 异步桥（1-worker `ThreadPoolExecutor` + `RLock`）
3. 连接生命周期
4. 轴参数下发（含 merge 4 子参数 + 反向间隙）
5. IO
6. 单轴运动
7. 多轴插补（直线/圆弧/螺旋）
8. **五轴加工**（五轴联动直线 + 三加二定向加工）
9. 多轴/急停
10. 进给倍率
11. 状态读取（含 `读全部轴状态` 兼容老 dict）
12. 业务级方法（U/R 旋转/等待静止/xy/z 位置/绝对运动并设速度/连续插补 XY/连续插补运动/执行命令）

`MotionService.py` 结构：

- 单例（`获取实例 / 重置实例`）
- 生命周期（`启动 / 停止 / 连接 / 断开 / 复位`）
- 状态快照与订阅（`获取状态快照 / 订阅状态 / 取消订阅 / _发布快照`）
- 全部运动指令（绝对 / 相对 / 直线 / 圆弧 / 三点圆弧 / 螺旋 / 五轴联动直线 / 三加二定向加工 / 连续轨迹合并）
- 暂停控制（`暂停 / 继续 / 停止运动 / 急停`，软暂停走 FEED_OVERRIDE）
- U/R 业务旋转
- IO
- 轴参数
- 状态读取
- 等待静止
- 连续插补
- 执行命令

### PR-4：运动控制接入层（HTTP + WS）

| 文件 | 行数 | 说明 |
|---|---|---|
| `routers/http/motion_http.py` | 821 | `/api/motion/*` 全量端点，按 10 个业务分组覆盖 `MotionService` 全部 50+ 个方法（生命周期 / 状态 / 单轴 / 多轴插补 / 五轴 / 3+2 / 连续轨迹 / 暂停停止 / U-R / IO / 轴参数 / 工具）；统一 `{success, message, data}` 响应；`SafetyViolation→400` / `ZMCError→502` |
| `routers/websocket/motion_ws.py` | 194 | `WS /ws/motion/status`：50ms 推送状态快照 + 12 种客户端指令（`ping/connect/disconnect/reset/home/jog_start/jog_stop/move_abs/move_rel/pause/resume/stop/estop`）；错误回执带 `cmd` 字段 |
| `routers/__init__.py` | 25 | 暴露 `motion_http_路由 / motion_ws_路由 / camera_http_路由 / camera_ws_路由 / rs232_http_路由` |

### PR-5：相机模块全栈（配置 + 适配器 + 服务 + 路由）

| 文件 | 行数 | 说明 |
|---|---|---|
| `configs/camera_config.py` | 81 | Pydantic：`CameraSdkConfig`（dll 路径 / 默认设备号）+ `CameraFrameConfig`（取帧默认 timeout/quality + WS 推流默认值）+ `CameraBootstrap`（首次连接的镜像/帧率/曝光/白平衡）；`camera_config` 单例 |
| `services/camera_control/CGcamera_adapter.py` | 200 | 包装旧 `drivers.CameraDriver`，全 async（`asyncio.to_thread`）；统一异常 `CameraError`；归一化 `设备信息`；提供枚举/连接/断开/取帧/曝光/帧率/镜像/白平衡/诊断 |
| `services/CameraService.py` | 200 | 对外单例门面：默认复用 `api.dependencies.camera_driver` 全局单例避免 DLL 双实例化；`asyncio.Lock` 保护 service 级临界；启动时按 bootstrap 缓存默认参数 |
| `routers/http/camera_http.py` | 270 | `/api/camera/*` 端点：`devices / connect / disconnect / status / bootstrap-settings / frame / params(exposure/frame-speed/mirror/white-balance)`；`/frame` 返回 `image/jpeg` 字节流；与旧 `api/camera_api.py` 路径相同（迁移期二选一） |
| `routers/websocket/camera_ws.py` | 200 | `WS /ws/camera/stream`：循环抓帧 → `send_bytes`；客户端 JSON 指令 `ping/set_quality/set_timeout/pause/resume`；与旧 `/api/camera/ws` 不冲突，可共存 |

---

## 四、关键设计决策

1. **DLL 串行化**：`ZMC适配器` 内部 `ThreadPoolExecutor(max_workers=1)` + `RLock`；`status_monitor` 直接拿 `RLock`（不走 executor，省调度开销）
2. **状态机 `COMPLETE` 由采集线程驱动**：`MotionService` 下指令后立即返回，状态保持 `MOVING`；`status_monitor` 检测全空闲后自动归位 `IDLE`
3. **暂停 = `FEED_OVERRIDE = 0`**（适配纯 Direct API 模式，无 BAS 工程）；继续时恢复保存的倍率
4. **业务方法（U/R 旋转等）保留 dict 风格返回值**（`{success, message, data}`）兼容老业务；底层用异常驱动
5. **跨线程快照投递**：`_发布快照` 用 `loop.call_soon_threadsafe(_同步分发)`；`Queue` 满时丢最旧再 `put`
6. **错误码 → 异常**：`ZMCError`（502 BAD_GATEWAY） / `SafetyViolation`（400 BAD_REQUEST）
7. **轴名 ↔ 轴号转换**：service 层接收轴名（"X"/"Y"/...），内部转轴号（0-4）调 adapter
8. **三加二定向加工流程**：U/R 单轴绝对定位 → `等待静止`（最长 30s）→ 沿 xyz 路径逐段 3 轴联动直线
9. **路由层统一响应**：成功 `{success:true, message, data}`；错误用 FastAPI `HTTPException`（400/502/500）；`/frame` 直接返 `image/jpeg`，失败 503
10. **WS 双轨**：`motion_ws` 推 JSON 状态快照；`camera_ws` 推二进制 JPEG 字节，控制指令仍走 JSON
11. **相机 DLL 单例共享**：`CameraService` 默认从 `api.dependencies.camera_driver` 拿现有 `CameraDriver` 单例，避免迁移期新旧路由各持一个 SDK 实例导致的 DLL 状态冲突
12. **lint 全过**：所有 PR 完成后 `ReadLints` 全过

---

## 五、未完成的待办（下一步可选路径）

| 优先级 | 任务 | 说明 |
|---|---|---|
| 高 | `services/Rs232Service.py` + `services/communicate_control/rs232/*` | RS232 单例门面 + 组件层（驱动 + 状态机）；目前旧 `routers/http/rs232_http.py` 仍走旧体系 |
| 高 | `services/PragramService.py` | 拆分老 `core/startPragram.py`（1685 行）：`runner.py / recipe.py / progress_publisher.py / state_machine.py / geometry.py` |
| 中 | `routers/http/program_*.py` + `routers/websocket/program_ws.py` | 程序运行接入层，依赖 `PragramService` 完成后再做 |
| 中 | `core/app.py` 切到新路由 | 解注释 `from routers import ...`，把旧 `api/camera_api.py` / `api/http_api.py` 中已被新路由覆盖的部分关掉（**非本次约束目录，需用户手动操作**） |
| 低 | 给 `motion_config` 加 `safety / monitor` 子模型 | 然后启用 `safe_controller` 的 3 处 hook（软限位 / 进给倍率范围 / require_home） |
| 低 | `tests/` 单元测试 | 状态机迁移表 + `safe_controller` 准入逻辑 + camera adapter 错误翻译（不依赖 DLL） |

---

## 六、关键 import 路径备忘（避免循环依赖）

```python
# configs/ 是叶节点，不依赖任何 services 内容
from configs.motion_config import motion_config, MotionConfig, MotionAxisConfig, MergeParams
from configs.rs232_config import rs232_config, Rs232Config
from configs.camera_config import camera_config, CameraConfig

# services/motion_control/ 内部组件互相依赖
from services.motion_control.config_loader import 加载运动配置, 取轴, 校验轴名集合
from services.motion_control.models import 运动状态, 状态快照, 轴快照
from services.motion_control.state_machine import 状态机, 状态事件
from services.motion_control.safe_controller import 安全控制器, SafetyViolation
from services.motion_control.zmc_adapter import (
    ZMC适配器, ZMCError, 轴读数,
    取消_当前, 取消_缓冲, 取消_全部, 取消_立即,
    圆弧_逆时针, 圆弧_顺时针,
    轴_X, 轴_Y, 轴_Z, 轴_U, 轴_R,
)
from services.motion_control.status_monitor import StatusMonitor

# services/camera_control/ 组件层
from services.camera_control.CGcamera_adapter import 相机适配器, CameraError, 设备信息

# 路由层只需要这两行
from services.MotionService import MotionService
from services.CameraService import CameraService

# routers 包导出（在 core/app.py 中使用）
from routers import (
    motion_http_路由, motion_ws_路由,
    camera_http_路由, camera_ws_路由,
    rs232_http_路由,
)
```

---

## 七、新对话开场提示词建议

```text
继续 QomoTech_BackEnd 重构。
已完成：
- PR-1 配置层（Pydantic 硬编码默认）
- PR-2 状态机 + 安全控制器
- PR-3 ZMC 适配器 + 状态采集 + MotionService 门面（1075 行，覆盖 zmotion_driver/zmotion_adapter
       全部方法 + 五轴联动 + 3+2 定向加工）
- PR-4 运动接入层（routers/http/motion_http.py 821 行 50+ 端点 + routers/websocket/motion_ws.py 12 指令）
- PR-5 相机模块全栈（configs/camera_config.py + services/camera_control/CGcamera_adapter.py
       + services/CameraService.py + routers/http/camera_http.py + routers/websocket/camera_ws.py）

约束：
- 只能改 configs/、services/、routers/
- 其他目录不动（core/app.py 当前没解注释新路由，用户需手动 include_router）
- 配置硬编码默认值（Pydantic）
- 轴号 X=0,Y=1,Z=2,U=3,R=4
- merge 子参数已折成 merge_params 子模型
- 相机 service 复用 api.dependencies.camera_driver 全局单例（避免 DLL 双实例）

下一步建议（任选其一）：
1. services/Rs232Service.py + services/communicate_control/rs232/*（RS232 门面 + 组件）
2. services/PragramService.py（拆 1685 行 startPragram.py）+ routers/http/program_*.py
3. core/app.py 整合：解注释新路由 + 关掉旧 api/* 的重复路由（需用户手动）

详见 QomoTech_BackEnd/REFACTOR_HANDOVER.md
```

---

## 八、文件清单速查

```text
QomoTech_BackEnd/
├── configs/                              # 配置层
│   ├── app_config.py                     # ✅ 67 行
│   ├── motion_config.py                  # ✅ 95 行
│   ├── rs232_config.py                   # ✅ 30 行
│   └── camera_config.py                  # ✅ 81 行（PR-5）
├── services/
│   ├── MotionService.py                  # ✅ 1075 行（PR-3）
│   ├── CameraService.py                  # ✅ 200 行（PR-5）
│   ├── Rs232Service.py                   # ⏸ 空壳
│   ├── PragramService.py                 # ⏸ 空壳
│   ├── motion_control/                   # 组件层（PR-1/2/3）
│   │   ├── config_loader.py              # ✅ 89 行
│   │   ├── models.py                     # ✅ 103 行
│   │   ├── state_machine.py              # ✅ 170 行
│   │   ├── safe_controller.py            # ✅ 316 行
│   │   ├── zmc_adapter.py                # ✅ 1912 行
│   │   └── status_monitor.py             # ✅ 175 行
│   └── camera_control/                   # 组件层（PR-5）
│       └── CGcamera_adapter.py           # ✅ 200 行
└── routers/                              # 接入层
    ├── __init__.py                       # ✅ 25 行（PR-4/5：路由注册导出）
    ├── apiresponse.py                    # ✅ ApiResponse 共享模型
    ├── http/
    │   ├── motion_http.py                # ✅ 821 行（PR-4，50+ 端点）
    │   ├── camera_http.py                # ✅ 270 行（PR-5）
    │   ├── rs232_http.py                 # ⏸ 旧体系，待重构
    │   └── program_http.py               # ⏸ 空壳
    └── websocket/
        ├── motion_ws.py                  # ✅ 194 行（PR-4，12 指令）
        ├── camera_ws.py                  # ✅ 200 行（PR-5）
        ├── rs232_ws.py                   # ⏸ 空壳
        └── program_ws.py                 # ⏸ 空壳
```

