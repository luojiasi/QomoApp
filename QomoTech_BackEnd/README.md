# QomoTech_BackEnd

基于 FastAPI 的运动控制（ZMotion）后端。
采用分层架构：

- `config/`：配置（运行时/参数默认值）
- `drivers/`：硬件驱动封装（运动控制器、串口等）
- `core/`：业务逻辑（运动控制、协同）
- `api/`：HTTP 接口（当前未启用 WebSocket）
- `utils/`：日志与通用工具

## 快速启动

```bash
pip install -r requirements.txt
python run.py
```

服务监听：`http://{host}:{port}`
- 默认 `host=0.0.0.0`、`port=5000`，本机可用 `http://127.0.0.1:5000`
- 可通过环境变量 `QOMO_HOST`、`QOMO_PORT`、`QOMO_DEBUG`、`QOMO_LOG_LEVEL` 覆盖配置（见 `config/app_config.py`）

日志目录：`logs/backend.log`

## 已实现的 HTTP 接口

### 健康检查
- `GET /api/health`：服务健康检查

### 硬件（运动控制器）
- `POST /api/hardware/connect`：连接运动控制器（使用当前默认/已配置参数）
- `POST /api/hardware/disconnect`：断开运动控制器
- `POST /api/hardware/reconnect`：重连全局运动控制器单例

### 相机（CGImageTech 单例）
- `GET /api/camera/devices`：初始化 SDK 并枚举相机
- `POST /api/camera/connect`：连接相机单例（Body: `{"index": 0}`）
- `POST /api/camera/disconnect`：断开相机
- `GET /api/camera/status`：读取相机状态/最近错误
- `GET /api/camera/frame`：抓取单帧 JPEG（query: `timeout_ms`、`quality`）
- `POST /api/camera/params/exposure`：设置曝光参数
- `POST /api/camera/params/frame-speed`：设置帧率参数
- `POST /api/camera/params/mirror`：设置镜像参数
- `POST /api/camera/params/white-balance`：设置白平衡参数

### 全局状态
- `GET /api/state`：获取全局状态（连接标记、最近时间、运动位置缓存等）

### 运动控制
- `POST /api/motion/connect`：连接运动控制器并下发轴参数
  - Body：`MotionConnectRequest`
  - `communication`：当前只读取 `ipAddress`/`controller_ip`
  - `axes`：每个轴包含 `axisNo`（约定 0=X、1=Y、2=Z）与 `units`
- `GET /api/motion/diagnostics`：获取运动驱动模式与错误码
- `GET /api/motion/position/{axis}`：读取单轴位置（`axis` 为 `X/Y/Z/U/R`）

### 日志
- `GET /api/logs/download`：下载 `logs/backend.log`（`text/plain`）

## WebSocket 状态

当前 `run.py` 中 WebSocket 路由被注释掉（不存在启用的 `api.websocket_api`），因此 README 不再列举 `WS /ws/*` 接口。

## 驱动实现说明（用于适配真实硬件）

- `drivers/zmotion_driver.py`：
  - 优先加载 `libs/zmcdll/zauxdllPython.py`（zauxdll 方式）
  - 若加载/连接失败则回退到内存模拟（`driver_mode="sim"`）
  - 通过 `axis_units`（前端的 `units`）把 mm 映射到控制器输入单位

## 下一步建议

1. 在 `core/vision_process.py` 中接入你的目标检测/识别模型，并同步更新 `VisionConfig` 与像素到 mm 标定参数。
2. 将 `drivers/zmotion_driver.py` 的模拟回退替换为真实 ZMC SDK/TCP 通讯实现（确保错误码与状态查询可用）。
3. 将硬件侧串口/激光等外设驱动接入到对应 API 中（如需要）。
