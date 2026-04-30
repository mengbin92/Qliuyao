@echo off
REM 量子六爻一键安装 (Windows)
REM 用法：双击 setup.bat 或在 cmd 里运行

setlocal enabledelayedexpansion
set ENV_NAME=qliuyao
set PY_VERSION=3.11

echo ===============================================
echo   量子六爻 . 一键安装
echo ===============================================
echo.

REM 1. 检查 conda
where conda >nul 2>nul
if errorlevel 1 (
    echo [X] 没找到 conda 命令
    echo     请先装 Miniconda: https://docs.conda.io/projects/miniconda/en/latest/
    pause
    exit /b 1
)
echo [v] conda 已就位

REM 2. 创建环境
conda env list | findstr /B "%ENV_NAME% " >nul
if errorlevel 1 (
    echo.
    echo -^> 创建 conda 环境 '%ENV_NAME%' ^(Python %PY_VERSION%^)...
    call conda create -n %ENV_NAME% python=%PY_VERSION% -y
    echo [v] 环境已创建
) else (
    echo [v] conda 环境 '%ENV_NAME%' 已存在，跳过创建
)

REM 3. 装依赖
echo.
echo -^> 安装 pyqpanda3...
call conda run -n %ENV_NAME% pip install -r requirements.txt
echo [v] 依赖装好

REM 4. 验证
echo.
echo -^> 验证安装...
call conda run -n %ENV_NAME% python -c "import pyqpanda3.core; print('OK')"

echo.
echo ===============================================
echo   安装完成！下一步：
echo ===============================================
echo.
echo   conda activate %ENV_NAME%
echo   python main.py
echo.
echo   或者直接传问题：
echo   python main.py -q "今年是否适合换工作？"
echo.
pause
