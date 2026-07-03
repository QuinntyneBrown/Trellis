@echo off
setlocal EnableExtensions
REM ============================================================================
REM  stop-trellis.bat
REM
REM  Gracefully shuts down everything start-trellis.bat launched:
REM    1. The Trellis Chrome window (dedicated profile only - your personal
REM       browser windows are never touched)
REM    2. The frontend dev server (port 4200)
REM    3. The backend API (port 5000)
REM
REM  Shutdown strategy, gentlest first:
REM    - Chrome:   CloseMainWindow ^(like clicking X^), then force-kill leftovers
REM    - Services: close their console window ^(sends CTRL_CLOSE_EVENT^), then a
REM      plain taskkill, then taskkill /T /F as a last resort
REM
REM  Edge cases handled:
REM    - anything not running is reported and skipped, never an error
REM    - a port held by a process that is NOT Trellis ^(wrong image name^) is
REM      left alone with a warning instead of being killed
REM ============================================================================

set "BACKEND_PORT=5000"
set "FRONTEND_PORT=4200"

REM Pause before closing the window when the script was double-clicked
echo %cmdcmdline% | findstr /i /c:"%~nx0" >nul 2>&1 && set "PAUSE_ON_EXIT=1"

echo ==============================================
echo   Stopping Trellis
echo ==============================================

REM ---- 1/3 Browser -----------------------------------------------------------
echo.
echo [1/3] Browser
powershell -NoProfile -Command "$all = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*Trellis*chrome-profile*' }; if (-not $all) { Write-Host '   No Trellis browser window found - nothing to close.'; exit 0 }; $parents = $all | Where-Object { $_.CommandLine -notlike '*--type=*' }; foreach ($p in $parents) { $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue; if ($proc) { [void]$proc.CloseMainWindow() } }; Start-Sleep -Seconds 3; $left = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*Trellis*chrome-profile*' }; if ($left) { $left | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host '   Browser window did not close on its own - force-closed.' } else { Write-Host '   Browser window closed gracefully.' }"

REM ---- 2/3 Frontend ----------------------------------------------------------
echo.
echo [2/3] Frontend ^(port %FRONTEND_PORT%^)
call :stop_service "Trellis Frontend" %FRONTEND_PORT% "node.exe"

REM ---- 3/3 Backend -----------------------------------------------------------
echo.
echo [3/3] Backend ^(port %BACKEND_PORT%^)
call :stop_service "Trellis Backend" %BACKEND_PORT% "dotnet.exe Trellis.Api.exe"

echo.
echo ==============================================
echo   Trellis shutdown complete
echo ==============================================
if defined PAUSE_ON_EXIT pause
exit /b 0

REM ============================================================================
REM  Subroutines
REM ============================================================================

REM stop_service "Window Title" port "allowed image names"
REM Closes the service's console window first (graceful), then stops whatever
REM is still listening on the port - but only if its image name is in the
REM allowed list, so unrelated processes are never killed.
:stop_service
setlocal
set "WTITLE=%~1"
set "SPORT=%~2"
set "ALLOWED=%~3"
set "DID_ANY="

REM Step 1: gracefully close the launcher console window (if it exists).
REM Closing the console delivers CTRL_CLOSE_EVENT to the whole process tree.
tasklist /FI "WINDOWTITLE eq %WTITLE%*" /NH 2>nul | findstr /i /c:"cmd.exe" >nul
if errorlevel 1 goto :stop_service_port
set "DID_ANY=1"
echo    Closing the "%WTITLE%" window...
taskkill /FI "WINDOWTITLE eq %WTITLE%*" >nul 2>&1
call :sleep 2

:stop_service_port
REM Step 2: stop whatever still owns the port.
call :get_port_pid %SPORT%
if not defined PORT_PID goto :stop_service_done

call :get_image_name %PORT_PID%
echo %ALLOWED% | findstr /i /c:"%IMG%" >nul
if errorlevel 1 goto :stop_service_foreign

set "DID_ANY=1"
echo    Stopping %IMG% ^(PID %PORT_PID%^)...
taskkill /PID %PORT_PID% >nul 2>&1
call :sleep 2
call :get_port_pid %SPORT%
if not defined PORT_PID goto :stop_service_done

echo    Still running - force-stopping PID %PORT_PID% and its children...
taskkill /PID %PORT_PID% /T /F >nul 2>&1
call :sleep 1
goto :stop_service_done

:stop_service_foreign
echo    WARNING: Port %SPORT% is held by "%IMG%" ^(PID %PORT_PID%^), which does not
echo    look like a Trellis process. Leaving it alone - stop it manually if
echo    this is unexpected.
endlocal & exit /b 0

:stop_service_done
if defined DID_ANY (echo    Stopped.) else (echo    Was not running.)
endlocal & exit /b 0

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

REM Sleeps for roughly %1 seconds without needing console input.
:sleep
set /a SLEEP_N=%~1+1
ping -n %SLEEP_N% 127.0.0.1 >nul 2>&1
exit /b 0
