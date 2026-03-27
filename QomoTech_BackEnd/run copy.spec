# -*- mode: python ; coding: utf-8 -*-
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules
from pathlib import Path

hiddenimports = collect_submodules('numpy._core')
cv2_datas = collect_data_files('cv2', includes=['config.py', 'config-3.py', 'load_config_py3.py'])
cv2_binaries = collect_dynamic_libs('cv2')

a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=cv2_binaries,
    datas=[('libs/zmcdll/zauxdll.dll', '.')] + [('libs/cameradll/CGDEVSDK.dll', '.')]+ cv2_datas,
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
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico'
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='run',
)
