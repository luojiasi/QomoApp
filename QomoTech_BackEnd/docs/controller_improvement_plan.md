# QomoTech 后端控制器架构改进方案

> 基于当前代码审查 + 行业最佳实践对照，生成日期：2026-05-07

---

## 当前架构总览

```
Frontend (Vue/Electron)
    │ HTTP REST
    ▼
┌─────────────────────────────────────────┐
│  api/driver_api.py    REST 端点          │
│  api/http_api.py      硬件连接/程序控制   │
│  api/websocket_api.py 状态推送            │
└──────────────┬──────────────────────────┘
               │ Depends()
    ┌──────────▼──────────┐
    │  api/dependencies.py │  全局单例
    │  motion_driver       │
    │  state_manager       │
    │  hardware_poller     │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┬──────────────────┐
    │  core/                │                  │
    │  zmotion_adapter.py   │  高级封装        │
    │  state_manager.py     │  状态存储        │
    │  status_poller.py     │  后台轮询(0.2s)  │
    │  startPragram.py      │  切割程序(1800行) │
    └──────────┬──────────┘                  │
               │                             │
    ┌──────────▼──────────┐                  │
    │  drivers/            │                  │
    │  zmotion_driver.py   │  ZMC DLL 直调    │
    │  base_driver.py      │  抽象基类        │
    └──────────┬──────────┘                  │
               │ ctypes
    ┌──────────▼──────────┐
    │  zauxdllPython.dll   │  ZMC 控制卡
    └─────────────────────┘
```

---

## 一、架构与设计模式

| # | 方面 | 当前实现 | 行业常见做法 | 差距/风险 | 建议改动 |
|---|------|---------|-------------|----------|---------|
| 1 | **分层架构** | 4 层：API → Adapter → Driver → DLL，Adapter 和 Driver 边界模糊 | 严格 5 层：API → Controller → HAL → Driver → Firmware | Adapter 既做业务逻辑又做底层转换，职责混杂 | 将 Adapter 拆为 `MotionController`(业务) + `HAL`(硬件抽象)，中间加接口约束 |
| 2 | **命令模式** | 无，API 直接调 `move_abs()` 同步返回 | Command Queue + Executor，命令对象序列化可重放 | 无命令队列，无法实现命令缓冲/预读/撤销 | 引入 `Command` 数据类 + `CommandQueue` + `CommandExecutor` |
| 3 | **依赖注入** | 模块级全局单例 `dependencies.py` + FastAPI Depends | DI 容器或工厂模式，统一生命周期管理 | 全局单例难以测试，启动顺序隐含依赖 | 引入 `Application` 类集中管理组件生命周期 |
| 4 | **插件/节点注册** | 硬编码 `nodeDefinitions.ts` + `NODE_API_MAP` | 注册表模式 + 发现机制，节点自描述 | 新增节点需改多处代码 | 后端建立 `NodeRegistry`，前端动态拉取能力列表 |
| 5 | **配置管理** | Pydantic `BaseSettings`，代码内默认值 | 配置分层：YAML → 环境变量 → CLI，支持运行时热重载 | 改参数需重启进程 | 加运行时配置更新接口 `/api/motion/config/reload` |

---

## 二、运动控制核心

| # | 方面 | 当前实现 | 行业常见做法 | 差距/风险 | 建议改动 |
|---|------|---------|-------------|----------|---------|
| 6 | **运动规划器** | 无独立规划器，加减速靠控制器固件 | 上位机做 S 曲线/T 曲线速度规划，带 jerk 控制 | 无加加速度控制，高速冲击大；无法预判路径可行性 | 引入 `TrajectoryPlanner`，至少支持梯形速度剖面 + look-ahead |
| 7 | **轴状态机** | 无，`moving` 标志在 `move_abs/move_rel` 中立即置 `False`，与真实状态脱节 | 每轴独立 FSM：DISABLED → STANDSTILL → ACCEL → CONST_VEL → DECEL → STANDSTILL | poller 回读 idle 和代码 moving 不一致 | 实现 6 状态 FSM：`DISABLED / STANDSTILL / ACCELERATING / CONSTANT_VELOCITY / DECELERATING / ERROR` |
| 8 | **运动队列** | 无，`move_abs/move_rel` 直接调用 DLL | 上位机维护运动缓冲队列，支持 Blending + Abort | 无法无缝衔接运动；急停后残留队列命令不清 | 加 `MotionBuffer` 类管理命令队列 |
| 9 | **坐标系变换** | 无，直接操作单轴 | 支持 MCS/WCS/TCS 坐标系定义 + FK/IK | 复杂工件需手动换算坐标 | 引入 `CoordinateSystem` + `Kinematics` 抽象 |
| 10 | **回零(Homing)** | 仅 `zero_axis_position()` 清零当前位置 | 完整 Homing 流程：高速找限位 → 回退 → 低速找 index → 设零点 | 无真正回零，开机后位置不可靠 | 实现 `HomingProcedure` 状态机 |
| 11 | **软限位** | `set_axis_limit()` 设硬限位，无软限位检查 | 上位机软限位 + 硬限位兜底，运动前校验 | 依赖控制器硬限位，上位机无保护 | `move_abs/move_rel` 前加软件位置边界检查 |
| 12 | **跟随误差检测** | 无 | 实时计算 `|commanded - actual| > threshold`，超出报警 | 运动丢步或碰撞无法检测 | poller 中加跟随误差计算和告警 |

---

## 三、并发与线程安全

| # | 方面 | 当前实现 | 行业常见做法 | 差距/风险 | 建议改动 |
|---|------|---------|-------------|----------|---------|
| 13 | **线程模型** | Poller(daemon) + asyncio 主线程 + `asyncio.to_thread` 执行线程，三线程可能同时访问 DLL | 固定角色：Main(事件循环) + Realtime(运动) + Monitor(状态) + IO(通信) | Poller 和 Executor 同时访问 Driver，`_zaux_lock` 无事务保护 | **仅 Worker 线程读写 DLL**，Poller 只读 StateManager 缓存 |
| 14 | **DLL 隔离** | 主进程直接 `ctypes` 调 DLL | 实时部分放独立子进程，`multiprocessing.Queue` / 共享内存通信 | **DLL 段错误 → 整个进程崩溃** | `ZMotionDriver` 放入子进程，主进程通过 Pipe/Queue 通信 |
| 15 | **锁策略** | `_zaux_lock` 每调用一把锁 | 读写分离锁(RWLock) 或无锁(单写者模式) | 高频 poller 持锁阻塞运动指令下发 | Poller 不直接调 DLL，改为读 StateManager 缓存 |
| 16 | **异步/同步混用** | `asyncio.to_thread()` 桥接 | 实时路径全同步，非实时路径全 async | 混用增加调试难度 | 实时运动全同步 + 独立线程，HTTP/WS 层纯 async |

---

## 四、错误处理与安全

| # | 方面 | 当前实现 | 行业常见做法 | 差距/风险 | 建议改动 |
|---|------|---------|-------------|----------|---------|
| 17 | **错误分级** | `_last_error` / `_last_error_code` 字符串 | 错误分类：Fatal / Error / Warning / Info | 无法区分"轴故障"和"参数错误" | 定义 `ErrorSeverity` 枚举 + `MotionError` 异常体系 |
| 18 | **急停链路** | `emergency_stop_axis()` 调 DLL Cancel | 三级：硬件 ESTOP 线 → 软件快速减速 → 断电停止 | 仅有软件停止，无硬件急停集成 | 加硬件 ESTOP 信号监听 + 分级停止策略 |
| 19 | **看门狗** | `faulthandler` 写 crash 日志，无进程守护 | 硬件 WDT + 软件心跳 + Supervisor 进程守护 | DLL 崩溃进程直接消失 | 硬件 WDT 喂狗 + 外部 watchdog 脚本 |
| 20 | **异常恢复** | `startPragram.py` 中 `return False`，无重试 | 可恢复错误自动重试 N 次，不可恢复错误进 SAFE_STATE | 瞬态故障(网络抖动)导致整个程序失败 | 失效操作加重试策略(指数退避，最多 3 次) |
| 21 | **SAFE_STATE** | `清除运行输出()` 关闭激光和吹风 | 统一 SAFE_STATE 转换：停轴 → 关激光 → 关气 → 报告状态 | 紧急情况可能遗漏外设 | 定义 `enter_safe_state()` 统一入口 |

---

## 五、测试与仿真

| # | 方面 | 当前实现 | 行业常见做法 | 差距/风险 | 建议改动 |
|---|------|---------|-------------|----------|---------|
| 22 | **仿真模式** | `driver_mode="sim"` 所有方法返回 True，位置手动赋值 | 仿真模式模拟真实运动学：虚拟位置随时间变化 | 仿真太简单，无法验证程序逻辑 | 实现 `SimulatedAxis`：按速度和时间更新虚拟位置，模拟 idle 变化 |
| 23 | **硬件 Mock** | 无 | 接口抽象 + Mock 注入，单元测试覆盖 | 无法自动化测试运动逻辑 | 为 Driver 抽 Interface，写单元测试 |
| 24 | **回放/录制** | 无 | 录制真实运行数据，离线回放分析 | 问题复现困难 | poller 数据录制为 CSV，支持离线回放 |

---

## 六、日志与可观测性

| # | 方面 | 当前实现 | 行业常见做法 | 差距/风险 | 建议改动 |
|---|------|---------|-------------|----------|---------|
| 25 | **结构化日志** | `logging` + 部分 `extra` 字典 | 全结构化日志(JSON)，带 trace_id/run_id | 多任务并行时日志无法关联 | 每次 `startProgram` 生成 `run_id`，全部日志带此 ID |
| 26 | **指标(Metrics)** | 无 | Prometheus/Grafana：轴位置、速度、跟随误差、温度 | 无法监控长期趋势 | 暴露 `/metrics` 端点 |
| 27 | **运动轨迹记录** | 无 | 记录 commanded vs actual 轨迹 | 质量追溯和故障分析无法进行 | poller 中采样位置数据存入环形缓冲区 |

---

## 七、API 设计

| # | 方面 | 当前实现 | 行业常见做法 | 差距/风险 | 建议改动 |
|---|------|---------|-------------|----------|---------|
| 28 | **批量操作** | 单轴操作，无事务保证 | 批量命令原子提交(Transaction) | 多轴同步运动可能部分成功 | 加 `/api/motion/batch` 端点，原子执行 |
| 29 | **操作幂等性** | 未保证 | 命令带 `request_id`，服务端去重 | 网络重试可能重复执行运动 | 命令带唯一 ID，服务端去重 |
| 30 | **长连接推送** | WebSocket + HTTP Poll 混合 | WebSocket 为主，HTTP 仅用于命令 | HTTP Poll 高频率浪费带宽 | 状态变更全部走 WebSocket push |
| 31 | **版本化 API** | 无 | `/api/v1/motion/...` | 前后端强绑定，升级困难 | URL 加版本前缀 |

---

## 八、代码质量

| # | 方面 | 当前实现 | 行业常见做法 | 差距/风险 | 建议改动 |
|---|------|---------|-------------|----------|---------|
| 32 | **类型标注** | 大量 `dict[str, Any]` | 全面使用 TypedDict/dataclass/Pydantic model | `.get()` 链式调用无编译检查 | `get_axes_status()` 返回值用 TypedDict |
| 33 | **魔法数字** | `2000`(超时)、`0.02`(sleep)、`1000000`(旋转位移) | 命名常量集中管理 | 分散各文件，调整困难 | 建立 `MotionConstants` 类统一管理 |
| 34 | **中文标识符** | 大量中文变量名 | 英文标识符，中文仅注释/日志 | IDE 兼容性差、国际化困难 | 逐步迁移为英文 |
| 35 | **重复代码** | `修面和切片的程序` / `用旋转轴去切圆` / `进行4P切产品` / `wangFuLoop` 高度相似 | 提取公共状态机框架，策略模式注入具体实现 | 4 份代码大量重复 polling/pause/abort 处理 | 提取 `RecipeExecutor` 基类 + `CuttingStrategy` 策略 |

---

## 实施优先级

### P0 — 立即修复（稳定性/安全性）

```
┌──────┬──────────────────────────────────────┬──────────────────────────────┐
│ 编号 │ 改动                                  │ 预期收益                      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  14  │ DLL 放入子进程                        │ 根除 DLL 崩溃拖死主进程        │
│  13  │ 线程角色明确化(仅 Worker 写 DLL)       │ 根除 DLL 竞态条件              │
│   7  │ 轴状态机                              │ 消除 moving 与实际不符的 bug    │
└──────┴──────────────────────────────────────┴──────────────────────────────┘
```

### P1 — 近期完成（质量/可维护性）

```
┌──────┬──────────────────────────────────────┬──────────────────────────────┐
│ 编号 │ 改动                                  │ 预期收益                      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  21  │ 统一 SAFE_STATE 入口                  │ 安全兜底                      │
│  25  │ 结构化日志 + run_id                    │ 问题定位提速 10x              │
│  22  │ 仿真模式模拟真实运动                    │ 可离线验证切割程序逻辑         │
│  17  │ 错误分级体系                           │ 精准判断故障类型               │
│  20  │ 失效重试策略                           │ 减少瞬态故障导致的程序中断      │
│  35  │ 提取公共切割框架                       │ 4→1 份代码，减少维护成本       │
│  33  │ 魔法数字常量化                         │ 参数调整不再靠搜索全项目        │
└──────┴──────────────────────────────────────┴──────────────────────────────┘
```

### P2 — 中期规划（功能增强）

```
┌──────┬──────────────────────────────────────┬──────────────────────────────┐
│ 编号 │ 改动                                  │ 预期收益                      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│   6  │ 速度规划器(S曲线)                     │ 运动更平滑，减少机械冲击        │
│   2  │ 命令队列 + 执行器                     │ 支持命令缓冲/预读/撤销          │
│  10  │ 完整 Homing 流程                      │ 开机后位置准确可靠             │
│  11  │ 软限位检查                            │ 上位机兜底防碰撞               │
│  24  │ 运动数据录制/回放                      │ 故障复现不再靠运气             │
│  28  │ 批量命令事务                          │ 多轴同步运动原子性保证          │
└──────┴──────────────────────────────────────┴──────────────────────────────┘
```

### P3 — 长期规划（架构优化）

```
┌──────┬──────────────────────────────────────┬──────────────────────────────┐
│ 编号 │ 改动                                  │ 预期收益                      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│   1  │ 拆分层(MotionController + HAL)        │ 职责清晰，可替换控制器型号      │
│   4  │ 节点注册表 + 动态能力发现               │ 新增节点类型不再改多处代码      │
│   9  │ 坐标系 + 运动学                        │ 支持复杂空间加工               │
│  26  │ Metrics + Grafana                     │ 长期运行状态可监控             │
│  29  │ API 幂等性                            │ 网络重试安全                  │
│  31  │ API 版本化                            │ 前后端解耦升级                │
│  32  │ 全面类型标注                           │ 编译时发现问题                │
│  34  │ 中文标识符→英文                        │ IDE 兼容 + 国际化             │
└──────┴──────────────────────────────────────┴──────────────────────────────┘
```

---

## P0 项详细实施指南

### #14 — DLL 进程隔离

**目标架构：**

```
Main Process (asyncio)          Worker Process (sync)
┌─────────────────────┐         ┌──────────────────────┐
│  FastAPI             │  Pipe   │  MotionWorker        │
│  HTTP/WS 路由        │◄───────►│  ├─ ZMotionDriver    │
│  StateManager        │  Queue  │  ├─ zauxdllPython    │
│  StatusPoller(只读)  │         │  └─ 命令处理循环      │
└─────────────────────┘         └──────────────────────┘
```

**关键点：**
- Worker 崩溃 → 主进程检测 pipe 断开 → 自动重启 Worker + 通知前端
- 命令通过 `multiprocessing.Queue` 下发，结果通过另一个 Queue 返回
- Poller 周期从 Worker 拉取状态快照，写入 StateManager

---

### #13 — 线程角色明确化

**当前问题：**

```
Poller 线程 ──get_axes_status()──► DLL
Worker 线程 ──move_abs()─────────► DLL    ← 竞态！
```

**目标：**

```
Poller 线程 ──读 StateManager 缓存──► 不接触 DLL
Worker 线程 ──唯一读写 DLL──────────► 独占访问
```

**改动点：**
1. `status_poller.py` 中 `_build_driver_status()` 改为读 `StateManager` 缓存
2. 新增 `MotionWorker` 线程，独占 `ZMotionDriver`
3. Worker 线程每次完成状态采集后，写入 `StateManager`

---

### #7 — 轴状态机

**定义：**

```python
from enum import Enum

class AxisState(Enum):
    DISABLED = "disabled"          # 轴未使能
    STANDSTILL = "standstill"      # 静止
    ACCELERATING = "accelerating"  # 加速中
    CONST_VELOCITY = "const_vel"   # 匀速
    DECELERATING = "decelerating"  # 减速中
    ERROR = "error"                # 故障

class AxisStateMachine:
    def __init__(self, axis_no: int):
        self.state = AxisState.DISABLED
        self.target_pos: float = 0.0
        self.current_pos: float = 0.0
        self.commanded_velocity: float = 0.0

    def command_move(self, target: float, speed: float):
        """下发运动命令 → ACCELERATING"""
        ...

    def update_from_feedback(self, dpos: float, idle: int, velocity: float):
        """根据反馈更新状态 → CONST_VELOCITY / DECELERATING / STANDSTILL"""
        ...

    @property
    def is_in_motion(self) -> bool:
        return self.state in (AxisState.ACCELERATING, AxisState.CONST_VELOCITY, AxisState.DECELERATING)
```

---

## 改动文件清单

| 优先级 | 新建文件 | 修改文件 |
|--------|---------|---------|
| P0 | `core/axis_state_machine.py` | `drivers/zmotion_driver.py` |
| P0 | `core/motion_worker.py` | `core/status_poller.py` |
| P0 | `core/motion_constants.py` | `core/zmotion_adapter.py` |
| P1 | `core/error_types.py` | `core/startPragram.py` |
| P1 | `core/safe_state.py` | `api/dependencies.py` |
| P1 | `core/trajectory_planner.py` | `api/driver_api.py` |
| P2 | `core/command_queue.py` | `core/state_manager.py` |
| P2 | `core/homing_procedure.py` | |
| P3 | `core/coordinate_system.py` | |
| P3 | `core/node_registry.py` | |
