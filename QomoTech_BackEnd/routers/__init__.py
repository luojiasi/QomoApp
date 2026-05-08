"""routers 包导出 —— 各业务路由实例。

使用方式（在 ``core/app.py`` 中）：

    from routers import (
        motion_http_路由, motion_ws_路由,
        camera_http_路由, camera_ws_路由,
        rs232_http_路由,
    )
    app.include_router(motion_http_路由)
    app.include_router(motion_ws_路由)
    app.include_router(camera_http_路由)
    app.include_router(camera_ws_路由)
    app.include_router(rs232_http_路由)

注意：

- ``motion_*_路由`` / ``camera_*_路由`` 内部依赖 ``services.MotionService`` /
  ``services.CameraService``；二者皆为单例 + lifespan 管理；端点首次被调用时
  才会拿到运行时实例，import 阶段不会有副作用。
- 新版 ``camera_http_路由`` 路径为 ``/api/camera/*``，与旧 ``api/camera_api.py``
  的路由相同；core 中只能挂一套，迁移期请二选一。
- ``camera_ws_路由`` 端点为 ``/ws/camera/stream``，与旧 ``/api/camera/ws`` 不冲突，
  可以共存。
"""

from routers.http.camera_http import 路由 as camera_http_路由
from routers.http.motion_http import 路由 as motion_http_路由
from routers.http.rs232_http import 路由 as rs232_http_路由
from routers.websocket.camera_ws import 路由 as camera_ws_路由
from routers.websocket.motion_ws import 路由 as motion_ws_路由

__all__ = [
    "camera_http_路由",
    "camera_ws_路由",
    "motion_http_路由",
    "motion_ws_路由",
    "rs232_http_路由",
]
