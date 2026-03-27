from __future__ import annotations
from typing import Any


def ok_response(message: str, data: Any = None) -> dict[str, Any]:
    return {"success": True, "message": message, "data": data}


def err_response(message: str, data: Any = None) -> dict[str, Any]:
    return {"success": False, "message": message, "data": data}

