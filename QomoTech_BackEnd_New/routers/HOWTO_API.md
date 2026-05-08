# 如何写一个新接口

## 项目分层架构

```
routers/   →  控制器层：定义路由、校验参数、调用 service、返回响应
services/  →  业务逻辑层：处理核心逻辑、与硬件交互
libs/      →  SDK 封装层：第三方 DLL 的 Python 包装
```

---

## HTTP REST 接口

### 1. 在 `routers/` 下新建路由文件

```python
"""你的模块 REST API 路由。"""
from __future__ import annotations

from typing import Optional, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from utils.logger import 获取日志记录器

日志 = 获取日志记录器("YourModule")

路由 = APIRouter(prefix="/api/your_module", tags=["你的模块"])
```

- `prefix` = 该文件下所有接口的 URL 前缀
- `tags` = Swagger 文档分组名

### 2. 定义请求模型（Pydantic）

```python
class YourRequest(BaseModel):
    name: str = Field(..., examples=["demo"], description="参数说明")
    value: Optional[float] = Field(None, gt=0, description="可选参数，大于0")
```

- `...` = 必填，`None` = 可选
- `Field` 里加校验（`gt`, `ge`, `le`, `min_length` 等）和 `examples`——自动生成到 `/docs` 文档

### 3. 定义异常转换辅助

```python
def _handle_exc(exc: Exception) -> HTTPException:
    if isinstance(exc, YourCustomError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
```

按业务异常类型映射到不同 HTTP 状态码（400/502/500）。

### 4. 导入 Service 并使用单例

```python
from services.your_module.your_service import YourService

def _service() -> YourService:
    return YourService.获取实例()
```

项目中 Service 统一使用 `获取实例()` 单例模式。

### 5. 写端点

```python
# 查询类 → GET
@路由.get("/state", summary="获取状态")
async def 获取状态():
    snap = _service().获取状态快照()
    return snap.to_dict()

# 操作类 → POST，用 Pydantic 模型接收参数
@路由.post("/action", summary="执行操作")
async def 执行操作(req: YourRequest):
    try:
        await _service().你的方法(req.name, req.value)
        return {"message": "操作成功"}
    except Exception as exc:
        raise _handle_exc(exc)
```

- 返回简单 dict：`{"message": "..."}` 或 `{"key": value}`
- 统一 `try/except` + `_handle_exc()` 转换异常

### 6. 注册路由

在 `routers/__init__.py` 中导出：

```python
from routers.your_module import 路由 as your_module_路由
```

在 `core/app.py` 中注册：

```python
from routers import your_module_路由
app.include_router(your_module_路由)
```

---

## WebSocket 接口

### 1. 新建 WebSocket 路由文件

```python
"""你的模块 WebSocket 路由。"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from utils.logger import 获取日志记录器

日志 = 获取日志记录器("YourModuleWS")
路由 = APIRouter(prefix="/ws", tags=["你的模块 WebSocket"])
```

### 2. 写 WebSocket 端点（双向通讯模板）

```python
@路由.websocket("/your_module/stream")
async def 你的流(websocket: WebSocket):
    await websocket.accept()
    svc = _service()
    queue = svc.订阅(maxsize=5)

    try:
        # 立即推送一次当前状态
        await websocket.send_text(json.dumps(svc.获取状态快照().to_dict()))

        # 双循环并行运行
        push_task = asyncio.create_task(_推送循环(websocket, queue))
        recv_task = asyncio.create_task(_接收循环(websocket, svc))

        done, pending = await asyncio.wait(
            [push_task, recv_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        日志.error(f"WebSocket 异常: {exc}")
    finally:
        svc.取消订阅(queue)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass
```

### 3. 推送循环（server → client）

```python
async def _推送循环(websocket: WebSocket, queue: asyncio.Queue) -> None:
    while True:
        snap = await queue.get()
        if websocket.client_state == WebSocketState.DISCONNECTED:
            break
        try:
            await websocket.send_text(json.dumps(snap.to_dict()))
        except Exception:
            break
```

### 4. 接收循环（client → server）

```python
async def _接收循环(websocket: WebSocket, svc: YourService) -> None:
    while True:
        try:
            raw = await websocket.receive_text()
        except WebSocketDisconnect:
            break
        except Exception:
            break

        try:
            data: Dict[str, Any] = json.loads(raw)
        except json.JSONDecodeError:
            await _send_error(websocket, "JSON 格式错误")
            continue

        cmd = data.get("cmd", "")
        try:
            await _执行指令(cmd, data, svc)
        except Exception as exc:
            await _send_error(websocket, str(exc))
```

客户端发送 JSON 格式：`{"cmd": "action_name", "param1": value1, ...}`

### 5. 指令分发

```python
async def _执行指令(cmd: str, data: Dict[str, Any], svc: YourService) -> None:
    if cmd == "action_a":
        await svc.方法A()
    elif cmd == "action_b":
        await svc.方法B()
    else:
        日志.warning(f"未知 WebSocket 指令: {cmd!r}")
```

---

## 快速参考

| 场景 | 示例代码 |
|------|----------|
| 查询 | `@路由.get("/xxx")` → `return snap.to_dict()` |
| 操作 | `@路由.post("/xxx")` → `return {"message": "ok"}` |
| 参数校验 | `Field(..., ge=0, le=100, description="范围0-100")` |
| 必填参数 | `Field(...)` |
| 可选参数 | `Field(None)` |
| Service 单例 | `YourService.获取实例()` |
| 异常转换 | `raise _handle_exc(exc)` |
| 日志 | `日志 = 获取日志记录器("模块名")` |

---

## 启动后验证

访问 `http://127.0.0.1:5000/docs` 查看自动生成的 Swagger 文档，直接在线测试接口。
