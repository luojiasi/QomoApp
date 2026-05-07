# -*- mode: python ; coding: utf-8 -*-

import os

# SPECPATH 由 PyInstaller 在执行 spec 时自动注入，值为本文件所在目录的绝对路径。
# 所有本地文件路径都通过 SPECPATH 拼接，避免相对路径因工作目录不同而失效。

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        (os.path.join(SPECPATH, 'configs', 'app_config.json'), 'configs'),
    ],
    hiddenimports=[
        # uvicorn 通过字符串动态加载协议模块，静态分析无法自动发现
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.logging',
    ],
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
    name='main',
    icon=os.path.join(SPECPATH, 'resourse', 'icon.ico'),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='main',
)
