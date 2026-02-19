param(
  [string]$ProjectName,
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

if (-not $ProjectName) {
  $ProjectName = Read-Host "Proje adi"
}

$slug = $ProjectName.ToLowerInvariant()
$slug = $slug -replace "[^a-z0-9]+", "-"
$slug = $slug.Trim("-")

if ([string]::IsNullOrWhiteSpace($slug)) {
  throw "Gecersiz proje adi."
}

$projectId = "rrc-$slug"
$alias = $slug

Write-Host "Project ID: $projectId"
Write-Host "Alias: $alias"

firebase projects:create $projectId --display-name "$ProjectName"
if ($LASTEXITCODE -ne 0) {
  throw "firebase projects:create failed"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$rcPath = Join-Path $repoRoot ".firebaserc"

if (Test-Path $rcPath) {
  $rc = Get-Content $rcPath -Raw | ConvertFrom-Json
} else {
  $rc = [pscustomobject]@{}
}

if (-not $rc.projects) {
  $rc | Add-Member -NotePropertyName projects -NotePropertyValue @{}
}

$rc.projects | Add-Member -NotePropertyName $alias -NotePropertyValue $projectId -Force

if (-not $rc.projects.default) {
  $rc.projects | Add-Member -NotePropertyName default -NotePropertyValue $projectId -Force
}

$rc | ConvertTo-Json -Depth 5 | Set-Content $rcPath -Encoding UTF8

$appCreateJson = firebase apps:create web "$ProjectName" --project $projectId --json
if ($LASTEXITCODE -ne 0) {
  throw "firebase apps:create web failed"
}

$appCreate = $appCreateJson | ConvertFrom-Json
$appId = $appCreate.result.appId
if (-not $appId) {
  $appId = $appCreate.appId
}
if (-not $appId) {
  throw "Web app ID bulunamadi"
}

$sdkJson = firebase apps:sdkconfig web $appId --project $projectId --json
if ($LASTEXITCODE -ne 0) {
  throw "firebase apps:sdkconfig failed"
}

$sdk = $sdkJson | ConvertFrom-Json
$sdkConfig = $sdk.result.sdkConfig
if (-not $sdkConfig) {
  $sdkConfig = $sdk.sdkConfig
}

# Project number ve API URL hesapla
$projectNumber = gcloud projects describe $projectId --format="value(projectNumber)"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($projectNumber)) {
  throw "Project number alinamadi"
}

$region = "europe-west1"
$serviceName = "${projectId}_rrcapi"
$apiUrl = "https://$serviceName-$projectNumber.$region.run.app"

$genDir = Join-Path $repoRoot "scripts\generated"
New-Item -ItemType Directory -Force -Path $genDir | Out-Null
$sdkPath = Join-Path $genDir "firebaseConfig-$alias.json"

$sdkConfig | ConvertTo-Json -Depth 10 | Set-Content $sdkPath -Encoding UTF8

Write-Host "firebaseConfig kaydedildi: $sdkPath"

# .env dosyalari olustur (.env.<alias> ve root .env)
$envPath = Join-Path $genDir ".env.$alias"
$envContent = @(
  "VITE_FIREBASE_API_KEY=$($sdkConfig.apiKey)",
  "VITE_FIREBASE_AUTH_DOMAIN=$($sdkConfig.authDomain)",
  "VITE_FIREBASE_PROJECT_ID=$($sdkConfig.projectId)",
  "VITE_FIREBASE_STORAGE_BUCKET=$($sdkConfig.storageBucket)",
  "VITE_FIREBASE_MESSAGING_SENDER_ID=$($sdkConfig.messagingSenderId)",
  "VITE_FIREBASE_APP_ID=$($sdkConfig.appId)",
  "VITE_API_URL=$apiUrl",
  "SECRETS_SCAN_ENABLED=false",
  ""
)

$envContent | Set-Content $envPath -Encoding UTF8
Write-Host ".env kaydedildi: $envPath"

$rootEnvPath = Join-Path $repoRoot ".env"
Copy-Item -Path $envPath -Destination $rootEnvPath -Force
Write-Host "Root .env guncellendi: $rootEnvPath"

Write-Host "Auth (Email/Password) icin Firebase Console uzerinden etkinlestirme gerekir."
Write-Host "Billing gerekirse, Firebase Console da plan degistirmeniz istenebilir."

if (-not $SkipDeploy) {
  firebase deploy --only firestore:rules,firestore:indexes,storage,functions --project $projectId
  if ($LASTEXITCODE -ne 0) {
    throw "firebase deploy failed"
  }
} else {
  Write-Host "Deploy adimi atlandi."
}

Write-Host "Tamamlandi."
