@echo off
chcp 65001 > nul
title 여행 플래너 실행기

echo ========================================================
echo   [여행 플래너] 프로그램을 로컬에서 시작합니다...
echo ========================================================
echo.

cd /d "%~dp0"

:: node_modules 확인 및 자동 설치
if not exist "node_modules" (
    echo [안내] 최초 실행에 필요한 라이브러리를 설치 중입니다.
    echo 잠시만 기다려주세요...
    call npm.cmd install
    if errorlevel 1 (
        echo.
        echo [오류] 설치 중 문제가 발생했습니다. Node.js 설치 상태를 확인해주세요.
        pause
        exit /b 1
    )
    echo.
)

echo [안내] 서버를 구동하고 인터넷 브라우저를 자동으로 엽니다.
echo [안내] 프로그램을 종료하려면 이 창을 닫으시면 됩니다.
echo ========================================================
echo.

:: Vite 개발 서버 실행 및 브라우저 자동 오픈
call npm.cmd run dev -- --open

pause
