$ports = 3000, 3001, 3002, 8080, 5173
foreach ($p in $ports) {
  try {
    $r = Invoke-WebRequest -Uri ("http://localhost:{0}/flow" -f $p) -UseBasicParsing -TimeoutSec 5
    Write-Output ("PORT {0} STATUS {1}" -f $p, $r.StatusCode)
  } catch {
    Write-Output ("PORT {0} ERR {1}" -f $p, $_.Exception.Response.StatusCode.value__)
  }
}