"""路由层统一 HTTP 响应体模型。"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ApiResponse(BaseModel):
    """标准 JSON 响应：success + message + 可选 data。"""

    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="说明信息")
    data: Any = Field(default=None, description="业务数据，可为对象/数组/字符串等")

    # 写入 JSON Schema 的 examples，/docs 里 200 响应会显示 Example #0、#1
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"success": True, "message": "OK", "data": {"ports": []}},
                {"success": False, "message": "错误原因", "data": None},
            ],
        },
    )
