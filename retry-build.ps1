# retry-build.ps1 - Retry electron-builder with automatic cleanup between attempts
$ErrorActionPreference = "Continue"
$maxRetries = 4

for ($i = 1; $i -le $maxRetries; $i++) {
    Write-Host "`n=== ATTEMPT $i of $maxRetries ===" -ForegroundColor Cyan
    
    # Kill any lingering electron-builder processes
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { 
        $_.CommandLine -match 'electron-builder' 
    } | ForEach-Object { 
        Write-Host "Killing PID $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue 
    }
    
    # Also kill any electron processes
    Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 5
    
    # Clean output directory
    if (Test-Path dist-electron-builder) {
        Remove-Item -Recurse -Force dist-electron-builder -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
        if (Test-Path dist-electron-builder) {
            Write-Host "WARNING: dist-electron-builder still exists, trying again..."
            Remove-Item -Recurse -Force dist-electron-builder -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
        }
    }
    
    # Run electron-builder
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    Write-Host "Running electron-builder..."
    $output = & npx electron-builder --win --publish never 2>&1
    $exitCode = $LASTEXITCODE
    
    # Show last 30 lines of output
    $output | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
    
    if ($exitCode -eq 0) {
        Write-Host "`n=== SUCCESS! ===" -ForegroundColor Green
        # Verify the installer exists
        $installer = Get-ChildItem "dist-electron-builder\*Setup*.exe" -ErrorAction SilentlyContinue
        if ($installer) {
            Write-Host "Installer found: $($installer.Name) ($([math]::Round($installer.Length / 1MB, 2)) MB)"
        }
        exit 0
    }
    
    Write-Host "Attempt $i failed with exit code $exitCode" -ForegroundColor Yellow
    
    if ($i -lt $maxRetries) {
        Write-Host "Waiting 15 seconds before retry..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
    }
}

Write-Host "`n=== ALL ATTEMPTS FAILED ===" -ForegroundColor Red
exit 1
