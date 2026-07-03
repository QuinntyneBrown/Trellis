@echo off
setlocal EnableExtensions
REM ============================================================================
REM  start-trellis.bat
REM
REM  Starts the Trellis backend (ASP.NET Core, http://localhost:5000) and the
REM  frontend (Angular dev server, http://localhost:4200), then opens the app
REM  in Google Chrome.
REM
REM  Safe to run repeatedly:
REM    - a service that is already running is detected via its port and left alone
REM    - a service that is still starting up is waited on, not started twice
REM    - a foreign process squatting on a required port aborts with a clear message
REM    - npm install runs automatically if frontend\node_modules is missing
REM
REM  Chrome is opened with a dedicated profile (%%LOCALAPPDATA%%\Trellis\chrome-profile)
REM  so that stop-trellis.bat can close ONLY the Trellis window without touching
REM  your personal browser windows. If Chrome is not installed, the default
REM  browser is used instead (and cannot be auto-closed later).
REM ============================================================================

set "BACKEND_PORT=5000"
set "FRONTEND_PORT=4200"
set "BACKEND_URL=http://localhost:%BACKEND_PORT%"
set "BACKEND_HEALTH_URL=%BACKEND_URL%/health"
set "FRONTEND_URL=http://localhost:%FRONTEND_PORT%"
set "CHROME_PROFILE=%LOCALAPPDATA%\Trellis\chrome-profile"

REM Resolve the repository root from this script's location (eng\scripts\..\..)
for %%i in ("%~dp0..\..") do set "REPO_ROOT=%%~fi"

REM Pause before closing the window when the script was double-clicked
echo %cmdcmdline% | findstr /i /c:"%~nx0" >nul 2>&1 && set "PAUSE_ON_EXIT=1"

echo ==============================================
echo   Starting Trellis
echo   Repo: %REPO_ROOT%
echo ==============================================

REM ---- Sanity checks ---------------------------------------------------------
if not exist "%REPO_ROOT%\backend\src\Trellis.Api\Trellis.Api.csproj" goto :bad_repo
if not exist "%REPO_ROOT%\frontend\package.json" goto :bad_repo

where dotnet >nul 2>&1
if errorlevel 1 goto :no_dotnet
where npm >nul 2>&1
if errorlevel 1 goto :no_npm

set "HAVE_CURL="
where curl >nul 2>&1 && set "HAVE_CURL=1"

REM ---- 1/3 Backend -----------------------------------------------------------
echo.
echo [1/3] Backend  %BACKEND_URL%
call :get_port_pid %BACKEND_PORT%
if not defined PORT_PID goto :start_backend

call :check_url "%BACKEND_HEALTH_URL%"
if not errorlevel 1 goto :backend_already_up

call :get_image_name %PORT_PID%
if /i "%IMG%"=="dotnet.exe" goto :backend_wait_existing
if /i "%IMG%"=="Trellis.Api.exe" goto :backend_wait_existing

echo    ERROR: Port %BACKEND_PORT% is in use by "%IMG%" ^(PID %PORT_PID%^), which is not
echo    the Trellis backend, and %BACKEND_HEALTH_URL% is not responding.
echo    Stop that process ^(or run stop-trellis.bat^) and try again.
goto :fail

:backend_already_up
echo    Already running and healthy - leaving it as is.
goto :frontend

:backend_wait_existing
echo    Port %BACKEND_PORT% is held by %IMG% - a backend seems to be starting already.
echo    Waiting for it to become healthy instead of starting a second one...
call :wait_url "%BACKEND_HEALTH_URL%" 60
if errorlevel 1 goto :backend_timeout
echo    Backend is up.
goto :frontend

:start_backend
echo    Starting backend in a new window ^("Trellis Backend"^)...
start "Trellis Backend" /D "%REPO_ROOT%" cmd /k "title Trellis Backend && dotnet run --project backend\src\Trellis.Api --urls=%BACKEND_URL%"
echo    Waiting for %BACKEND_HEALTH_URL% ^(first build can take a few minutes^)
call :wait_url "%BACKEND_HEALTH_URL%" 90
if errorlevel 1 goto :backend_timeout
echo    Backend is up.
goto :frontend

:backend_timeout
echo    ERROR: The backend did not become healthy in time.
echo    Check the "Trellis Backend" window for build or startup errors,
echo    then run stop-trellis.bat and try again.
goto :fail

REM ---- 2/3 Frontend ----------------------------------------------------------
:frontend
echo.
echo [2/3] Frontend  %FRONTEND_URL%
call :get_port_pid %FRONTEND_PORT%
if not defined PORT_PID goto :check_node_modules

call :check_url "%FRONTEND_URL%"
if not errorlevel 1 goto :frontend_already_up

call :get_image_name %PORT_PID%
if /i "%IMG%"=="node.exe" goto :frontend_wait_existing

echo    ERROR: Port %FRONTEND_PORT% is in use by "%IMG%" ^(PID %PORT_PID%^), which is not
echo    the Angular dev server, and %FRONTEND_URL% is not responding.
echo    Stop that process ^(or run stop-trellis.bat^) and try again.
goto :fail

:frontend_already_up
echo    Dev server already running - leaving it as is.
goto :browser

:frontend_wait_existing
echo    Port %FRONTEND_PORT% is held by node.exe - a dev server seems to be starting already.
echo    Waiting for it to finish compiling instead of starting a second one...
call :wait_url "%FRONTEND_URL%" 120
if errorlevel 1 goto :frontend_timeout
echo    Frontend is up.
goto :browser

:check_node_modules
if exist "%REPO_ROOT%\frontend\node_modules\" goto :start_frontend
echo    node_modules not found - running npm install first ^(one-time, may take a few minutes^)...
pushd "%REPO_ROOT%\frontend"
call npm install
if errorlevel 1 goto :npm_install_failed
popd
goto :start_frontend

:npm_install_failed
popd
echo    ERROR: npm install failed - see the output above.
goto :fail

:start_frontend
echo    Starting dev server in a new window ^("Trellis Frontend"^)...
set "NG_CLI_ANALYTICS=false"
start "Trellis Frontend" /D "%REPO_ROOT%\frontend" cmd /k "title Trellis Frontend && npm start"
echo    Waiting for %FRONTEND_URL% to respond ^(first compile can take a while^)
call :wait_url "%FRONTEND_URL%" 120
if errorlevel 1 goto :frontend_timeout
echo    Frontend is up.
goto :browser

:frontend_timeout
echo    ERROR: The frontend did not start serving in time.
echo    Check the "Trellis Frontend" window for compile errors,
echo    then run stop-trellis.bat and try again.
goto :fail

REM ---- 3/3 Browser -----------------------------------------------------------
:browser
echo.
echo [3/3] Browser
call :chrome_profile_running
if not errorlevel 1 goto :browser_already

call :find_chrome
if not defined CHROME_EXE goto :browser_fallback

if not exist "%CHROME_PROFILE%" mkdir "%CHROME_PROFILE%" >nul 2>&1
echo    Opening Chrome at %FRONTEND_URL% ...
start "" "%CHROME_EXE%" --user-data-dir="%CHROME_PROFILE%" --no-first-run --no-default-browser-check --start-maximized --new-window %FRONTEND_URL%
goto :done

:browser_already
echo    A Trellis Chrome window is already open - not opening another one.
goto :done

:browser_fallback
echo    Google Chrome was not found - opening the default browser instead.
echo    NOTE: stop-trellis.bat will not be able to close this window automatically.
start "" %FRONTEND_URL%
goto :done

REM ---- Done ------------------------------------------------------------------
:done
echo.
echo ==============================================
echo   Trellis is running
echo     Backend:   %BACKEND_URL%   ("Trellis Backend" window)
echo     Frontend:  %FRONTEND_URL%   ("Trellis Frontend" window)
echo   To stop everything: eng\scripts\stop-trellis.bat
echo ==============================================
if defined PAUSE_ON_EXIT pause
exit /b 0

REM ---- Error exits -------------------------------------------------------------
:bad_repo
echo ERROR: Could not find the Trellis backend/frontend under "%REPO_ROOT%".
echo This script must live in ^<repo^>\eng\scripts.
goto :fail

:no_dotnet
echo ERROR: The .NET SDK ^(dotnet^) was not found on PATH. Install it from https://dotnet.microsoft.com/download
goto :fail

:no_npm
echo ERROR: npm was not found on PATH. Install Node.js from https://nodejs.org
goto :fail

:fail
echo.
echo === Trellis start aborted ===
if defined PAUSE_ON_EXIT pause
exit /b 1

REM ============================================================================
REM  Subroutines
REM ============================================================================

REM Sets PORT_PID to the PID listening on port %1, or empty if none.
:get_port_pid
set "PORT_PID="
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /c:":%~1 " ^| findstr /c:"LISTENING"') do set "PORT_PID=%%a"
if "%PORT_PID%"=="0" set "PORT_PID="
exit /b 0

REM Sets IMG to the image name of PID %1 (or "unknown").
:get_image_name
set "IMG=unknown"
for /f "tokens=1 delims=," %%n in ('tasklist /FI "PID eq %~1" /FO CSV /NH 2^>nul ^| findstr /i ".exe"') do set "IMG=%%~n"
exit /b 0

REM Returns 0 if URL %1 answers with an HTTP success status.
:check_url
if not defined HAVE_CURL goto :check_url_ps
curl -s -o nul --fail --max-time 3 "%~1" >nul 2>&1
exit /b %errorlevel%
:check_url_ps
powershell -NoProfile -Command "try { [void](Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri '%~1'); exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

REM Polls URL %1 up to %2 times (about 2-5s apart). Returns 0 on success.
:wait_url
setlocal
set /a TRIES_LEFT=%~2
:wait_url_loop
call :check_url "%~1"
if not errorlevel 1 goto :wait_url_ok
set /a TRIES_LEFT-=1
if %TRIES_LEFT% leq 0 goto :wait_url_fail
<nul set /p "=."
call :sleep 2
goto :wait_url_loop
:wait_url_ok
echo.
endlocal & exit /b 0
:wait_url_fail
echo.
endlocal & exit /b 1

REM Sleeps for roughly %1 seconds without needing console input.
:sleep
set /a SLEEP_N=%~1+1
ping -n %SLEEP_N% 127.0.0.1 >nul 2>&1
exit /b 0

REM Returns 0 if a Chrome instance using the Trellis profile is running.
:chrome_profile_running
powershell -NoProfile -Command "if (Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*Trellis*chrome-profile*' }) { exit 0 } exit 1" >nul 2>&1
exit /b %errorlevel%

REM Sets CHROME_EXE to the Chrome executable path, or leaves it empty.
:find_chrome
set "CHROME_EXE="
call :try_chrome "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
call :try_chrome "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
call :try_chrome "%LocalAppData%\Google\Chrome\Application\chrome.exe"
if defined CHROME_EXE exit /b 0
for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| findstr /i "REG_SZ"') do set "CHROME_EXE=%%b"
if defined CHROME_EXE if not exist "%CHROME_EXE%" set "CHROME_EXE="
exit /b 0

:try_chrome
if defined CHROME_EXE exit /b 0
if exist "%~1" set "CHROME_EXE=%~1"
exit /b 0
