param(
  [string]$HostAddress
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

$mkcert = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcert) {
  throw "mkcert is required. Install it with: winget install --id FiloSottile.mkcert -e"
}

if (-not $HostAddress) {
  $wifiAdapters = Get-NetAdapter -Physical -ErrorAction SilentlyContinue |
    Where-Object { $_.Status -eq "Up" -and $_.Name -match "Wi-Fi|Wireless|WLAN" }

  foreach ($adapter in $wifiAdapters) {
    $address = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($address) {
      $HostAddress = $address
      break
    }
  }
}

if (-not $HostAddress) {
  $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric, InterfaceMetric |
    Select-Object -First 1
  if ($defaultRoute) {
    $HostAddress = Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
      Select-Object -First 1 -ExpandProperty IPAddress
  }
}

$parsedAddress = $null
if (
  -not $HostAddress -or
  -not [System.Net.IPAddress]::TryParse($HostAddress, [ref]$parsedAddress) -or
  $parsedAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
  [System.Net.IPAddress]::IsLoopback($parsedAddress)
) {
  throw "Could not determine a usable Wi-Fi IPv4 address. Re-run with -HostAddress <laptop-wifi-ipv4>."
}

$certificateDirectory = Join-Path $projectRoot ".local-certs"
New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null
$certificatePath = Join-Path $certificateDirectory "havestra-dev.pem"
$privateKeyPath = Join-Path $certificateDirectory "havestra-dev-key.pem"

& $mkcert.Source -install
if ($LASTEXITCODE -ne 0) {
  throw "mkcert could not install its local development CA."
}

& $mkcert.Source -cert-file $certificatePath -key-file $privateKeyPath localhost 127.0.0.1 $HostAddress
if ($LASTEXITCODE -ne 0) {
  throw "mkcert could not create the HTTPS certificate."
}

$caRoot = (& $mkcert.Source -CAROOT | Select-Object -Last 1).Trim()
$androidCaPath = Join-Path $certificateDirectory "rootCA.crt"
Copy-Item -Path (Join-Path $caRoot "rootCA.pem") -Destination $androidCaPath -Force

$envPath = Join-Path $projectRoot ".env.local"
$existingLines = if (Test-Path $envPath) {
  [System.IO.File]::ReadAllLines($envPath)
} else {
  @()
}
$updatedLines = @(
  $existingLines | Where-Object {
    $_ -notmatch '^\s*DEV_HOST\s*=' -and
    $_ -notmatch '^\s*DEV_HTTPS_CERT\s*=' -and
    $_ -notmatch '^\s*DEV_HTTPS_KEY\s*='
  }
)
$updatedLines += "DEV_HOST=$HostAddress"
$updatedLines += "DEV_HTTPS_CERT=$certificatePath"
$updatedLines += "DEV_HTTPS_KEY=$privateKeyPath"
[System.IO.File]::WriteAllLines(
  $envPath,
  $updatedLines,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Local HTTPS is configured for this Wi-Fi address:"
Write-Host "  https://${HostAddress}:5173/register"
Write-Host ""
Write-Host "Copy this CA certificate to Android (do not copy any *key.pem file):"
Write-Host "  $androidCaPath"
Write-Host ""
Write-Host "The Vite server will bind only to $HostAddress. Re-run this script if your Wi-Fi IP changes."
