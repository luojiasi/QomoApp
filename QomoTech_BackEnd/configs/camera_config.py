"""相机模块配置 —— Pydantic 硬编码默认值。

与 ``configs/motion_config.py`` 同风格：

- 顶层 ``CameraConfig`` 只有默认实例 ``camera_config``。
- 子模型分别承载：SDK 路径与连接默认值（``CameraSdkConfig``）、
  取帧默认值（``CameraFrameConfig``）、首次连接的引导参数（``CameraBootstrap``）。
- 所有字段都是默认值，业务代码可在运行时覆盖；不读取 JSON 文件。
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class CameraSdkConfig(BaseModel):
    """SDK 加载与连接默认值。"""

    dll_path: str = Field(
        default="CGDEVSDK.dll",
        description="CGImageTech SDK 动态库路径（相对路径会在 cwd 查找）",
    )
    default_index: int = Field(
        default=0, ge=0, description="默认相机设备序号（多相机场景使用）"
    )


class CameraFrameConfig(BaseModel):
    """取帧默认参数。"""

    default_timeout_ms: int = Field(
        default=1000, ge=1, le=10_000, description="单帧抓取超时（ms）"
    )
    default_quality: int = Field(
        default=90, ge=1, le=100, description="JPEG 编码质量（1~100）"
    )
    ws_push_quality: int = Field(
        default=85, ge=1, le=100, description="WebSocket 推流默认 JPEG 质量"
    )
    ws_push_timeout_ms: int = Field(
        default=600, ge=1, le=10_000, description="WebSocket 推流单帧超时"
    )


class CameraBootstrap(BaseModel):
    """首次连接相机时下发的初始化参数。

    字段语义对齐 ``drivers.camera_driver.CameraBootstrapSettings``。
    """

    auto_exposure: bool = True
    exposure_time: Optional[int] = Field(default=None, ge=0)

    speed_level: int = Field(
        default=0,
        ge=0,
        le=3,
        description="0=HIGHEST 1=HIGH 2=LOW 3=LOWEST",
    )
    auto_tune: bool = True
    tune: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    mirror_horizontal: bool = True
    mirror_vertical: bool = False

    auto_white_balance: bool = True
    r_gain: Optional[int] = Field(default=None, ge=0)
    g_gain: Optional[int] = Field(default=None, ge=0)
    b_gain: Optional[int] = Field(default=None, ge=0)


class CameraConfig(BaseModel):
    sdk: CameraSdkConfig = CameraSdkConfig()
    frame: CameraFrameConfig = CameraFrameConfig()
    bootstrap: CameraBootstrap = CameraBootstrap()


camera_config = CameraConfig()
