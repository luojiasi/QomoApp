"""路由模块 —— 导出所有子路由。"""

from routers.http import 路由 as http_路由
from routers.ws import 路由 as ws_路由
from routers.motion_http import 路由 as motion_http_路由
from routers.motion_ws import 路由 as motion_ws_路由
from routers.camera_ws import 路由 as camera_ws_路由
from routers.camera_http import 路由 as camera_http_路由
from routers.rs232_http import 路由 as rs232_http_路由
from routers.rs232_ws import 路由 as rs232_ws_路由

__all__ = [
    "http_路由",
    "ws_路由",
    "motion_http_路由",
    "motion_ws_路由",
    "camera_ws_路由",
    "camera_http_路由",
    "rs232_http_路由",
    "rs232_ws_路由",
]