# -*- mode: python ; coding: utf-8 -*-
import sys
from PyInstaller.utils.hooks import collect_submodules
from pathlib import Path

# 所有需要额外声明的动态/隐式导入
hiddenimports = []
hiddenimports += collect_submodules('numpy._core')
hiddenimports += [
    # uvicorn — 动态加载内部协议
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.middleware',
    'uvicorn.middleware.asgi2',
    'uvicorn.middleware.wsgi',
    # serial — try/except 导入，PyInstaller 可能漏检
    'serial',
    'serial.tools',
    'serial.tools.list_ports',
]

a = Analysis(
    ['run.py'],
    pathex=[str(Path(__file__).parent)],
    binaries=[],
    datas=[
        # zauxdll + zmotion.dll（zauxdll 的 C 依赖）放到脚本同目录
        ('libs/zmcdll/zauxdll.dll', 'libs/zmcdll'),
        ('libs/zmcdll/zmotion.dll', 'libs/zmcdll'),
        # 相机 DLL
        ('libs/cameradll/CGDEVSDK.dll', 'libs/cameradll'),
    ],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='run',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,            # 你环境没装 UPX，先关掉
    console=True,          # 开发阶段保持控制台窗口方便看日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='run',
)
