param(
  [string]$Alias
)

$ErrorActionPreference = "Stop"

if (-not $Alias) {
  $Alias = Read-Host "Proje alias"
}

if ([string]::IsNullOrWhiteSpace($Alias)) {
  throw "Alias bos olamaz."
}

Write-Host "Deploying Firestore indexes for $Alias"
firebase use $Alias
if ($LASTEXITCODE -ne 0) {
  throw "firebase use failed for $Alias"
}

firebase deploy --only firestore:indexes
if ($LASTEXITCODE -ne 0) {
  throw "firebase deploy failed for $Alias"
}

Write-Host "Index deployment completed for $Alias"