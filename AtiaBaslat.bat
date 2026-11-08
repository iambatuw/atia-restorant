@echo off
setlocal
cd /d "%~dp0"

where dotnet >nul 2>&1
if errorlevel 1 (
    echo .NET 10 SDK bulunamadi. https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
)

set "ASPNETCORE_ENVIRONMENT=Development"
for /f "delims=" %%P in ('powershell.exe -NoProfile -Command "$bytes = New-Object byte[] 24; $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose(); [Convert]::ToBase64String($bytes)"') do set "Demo__WaiterPassword=%%P"
for /f "delims=" %%P in ('powershell.exe -NoProfile -Command "$bytes = New-Object byte[] 24; $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose(); [Convert]::ToBase64String($bytes)"') do set "Demo__KitchenPassword=%%P"

echo Atia Restoran baslatiliyor...
echo Yonetici: admin / demo123
echo Garson parolasi: %Demo__WaiterPassword%
echo Mutfak parolasi: %Demo__KitchenPassword%
echo.
echo Diger bilgisayarlardan sunucunun IP adresi ve 5080 portuyla baglanabilirsiniz.
echo Kapatmak icin bu pencerede Ctrl+C kullanin.

start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command "$health = 'http://127.0.0.1:5080/api/health'; for ($i = 0; $i -lt 120; $i++) { try { $response = Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:5080/login'; break } } catch { }; Start-Sleep -Seconds 1 }"
dotnet run --no-launch-profile --urls "http://0.0.0.0:5080"

echo.
echo Sunucu durdu.
pause
