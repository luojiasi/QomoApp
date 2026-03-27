@echo off
setlocal

REM Always execute in this script's directory.
cd /d "%~dp0"

set "VENV_PY=.venv\Scripts\python.exe"
set "REQ_FILE=requirements-build.txt"
set "SPEC_FILE=run.spec"
set "DIST_DIR=dist"
set "WORK_DIR=build"
set "FRONTEND_DIR=..\QomoTech_FrontEnd"

echo [1/4] Checking virtual environment...
if not exist "%VENV_PY%" (
  echo Creating virtual environment: .venv
  python -m venv .venv
  if errorlevel 1 goto :error
)

echo [2/4] Installing build dependencies...
"%VENV_PY%" -m pip install -r "%REQ_FILE%"
if errorlevel 1 goto :error

echo [3/4] Building executable from %SPEC_FILE% ...
"%VENV_PY%" -m PyInstaller -y --distpath "%DIST_DIR%" --workpath "%WORK_DIR%" "%SPEC_FILE%"
if errorlevel 1 goto :error

echo [4/5] Backend build completed.
echo Backend output: %cd%\%DIST_DIR%\run\run.exe
echo.

echo [5/5] Building frontend Windows package...
if not exist "%FRONTEND_DIR%\package.json" (
  echo Frontend project not found: %FRONTEND_DIR%
  goto :error
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found in PATH.
  goto :error
)
pushd "%FRONTEND_DIR%"
call npm run build:onlywin
if errorlevel 1 (
  popd
  goto :error
)
popd

echo Frontend build completed.
echo Frontend output: %cd%\%FRONTEND_DIR%\dist
echo.
echo ============================================================
echo   ALL BUILD STEPS COMPLETED SUCCESSFULLY
echo   Backend:  %cd%\%DIST_DIR%\run\run.exe
echo   Frontend: %cd%\%FRONTEND_DIR%\dist
echo ============================================================
echo Press any key to close this window...
pause
exit /b 0

:error
echo.
echo Build failed. Please check the output above.
echo Press any key to close this window...
pause
exit /b 1
