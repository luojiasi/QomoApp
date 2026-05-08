from __future__ import annotations

from typing import Optional, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from utils.logger import 获取日志记录器

日志 = 获取日志记录器("CGimagetechHTTP")

路由 = APIRouter(prefix="/api/CGimagetech", tags=["CGimagetech相机"])

# ------------------------------------------------------------------
# 请求 / 响应模型
# ------------------------------------------------------------------




# ------------------------------------------------------------------
# 辅助
# ------------------------------------------------------------------




# ------------------------------------------------------------------
# 端点
# ------------------------------------------------------------------
