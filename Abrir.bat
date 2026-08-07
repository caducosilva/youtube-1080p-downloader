@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Video Downloader 1080p - API + Front + Chrome

rem Pasta do projeto = pasta deste .bat (nao hardcodar usuario)
cd /d "%~dp0"

set "FRONT_DIR=%~dp0front"
set "FRONT_URL=http://127.0.0.1:5173/"
set "API_URL=http://127.0.0.1:8765/api/health"

echo.
echo ========================================
echo  Video Downloader 1080p
echo  API Python + Front Vite + Chrome
echo ========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo ERRO: Python nao encontrado no PATH.
  echo Instale Python 3 e marque "Add to PATH".
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERRO: npm nao encontrado no PATH.
  echo Instale Node.js LTS.
  pause
  exit /b 1
)

if not exist "%FRONT_DIR%\package.json" (
  echo ERRO: pasta front\ nao encontrada.
  pause
  exit /b 1
)

echo [1/4] Subindo API Python em outra janela...
start "Baixador API" /D "%~dp0" cmd /k "python server.py"

echo [2/4] Aguardando API em 127.0.0.1:8765 ...
set /a "tentativas=0"
:wait_api
set /a "tentativas+=1"
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%API_URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto api_ok
if %tentativas% GEQ 30 (
  echo AVISO: API ainda nao respondeu em 8765. Continuando mesmo assim.
  echo        Se a porta mudou, ajuste no modal do front.
  goto deps
)
timeout /t 1 /nobreak >nul
goto wait_api

:api_ok
echo       API pronta.

:deps
echo [3/4] Dependencias do front...
cd /d "%FRONT_DIR%"
if not exist "node_modules\" (
  echo       npm install...
  call npm install
  if errorlevel 1 (
    echo ERRO: npm install falhou.
    pause
    exit /b 1
  )
)

echo [4/4] Subindo front Vite e abrindo Chrome...
start "Baixador Front" /D "%FRONT_DIR%" cmd /k "npm run dev"

echo       Aguardando http://127.0.0.1:5173 ...
set /a "tentativas=0"
:wait_front
set /a "tentativas+=1"
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%FRONT_URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto front_ok
if %tentativas% GEQ 60 (
  echo AVISO: Front demorou. Abrindo Chrome mesmo assim.
  goto open_chrome
)
timeout /t 1 /nobreak >nul
goto wait_front

:front_ok
echo       Front pronto.

:open_chrome
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
  start "" "%CHROME%" "%FRONT_URL%"
  echo.
  echo Chrome aberto em %FRONT_URL%
) else (
  start "" "%FRONT_URL%"
  echo.
  echo Chrome nao encontrado. Abrindo no navegador padrao: %FRONT_URL%
)

echo.
echo Janelas abertas:
echo   - Baixador API   (python server.py, porta tipica 8765)
echo   - Baixador Front (vite, porta 5173)
echo.
echo Pode fechar esta janela. Para parar, feche as outras duas.
echo.
pause
endlocal
exit /b 0
