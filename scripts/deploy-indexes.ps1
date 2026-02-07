$ErrorActionPreference = "Stop"

$aliases = @(
  "mrchefrrc",
  "jetdoner-rrc",
  "tatlidunyasirrc",
  "scecafe",
  "sceqr"
)

foreach ($alias in $aliases) {
  Write-Host "Deploying Firestore indexes for $alias"
  firebase use $alias
  if ($LASTEXITCODE -ne 0) {
    throw "firebase use failed for $alias"
  }

  firebase deploy --only firestore:indexes
  if ($LASTEXITCODE -ne 0) {
    throw "firebase deploy failed for $alias"
  }
}

Write-Host "All index deployments completed."