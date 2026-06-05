$token = "ATCTT3xFfGN0VCW0zWqb74ainlAlqrYIGK86zHZ7ahzU9Ufd6x81-vf7BCrM3bzP2dCVAPxMQprZvqePpcLmehcGp-r3nWSDhTHWNBLKJz1dly6somhEsrrqmd8Q3wzr1uJGJV2s-uNz_YEv1KJUzaQJ4akF7RanDElJrEpJgWmvC5iL1nXW-uk=49CCA10B"

$json = '{"target":{"ref_type":"branch","type":"pipeline_ref_target","ref_name":"master"}}'
$cmd = "curl -s -X POST " +
       "-H 'Authorization: Bearer " + $token + "' " +
       "-H 'Content-Type: application/json' " +
       "-d '" + $json + "' " +
       "https://api.bitbucket.org/2.0/repositories/lipl-dev/livguardsolar360/pipelines/"

$b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($cmd), [System.Base64FormattingOptions]::None)

# Split into 70-char chunks so Jenkins doesn't wrap them
$chunks = @()
$i = 0; $n = 1
while ($i -lt $b64.Length) {
    $chunk = $b64.Substring($i, [Math]::Min(70, $b64.Length - $i))
    $chunks += "P$n=$chunk"
    $i += 70; $n++
}
$echoLine = "echo " + ((1..($n-1) | ForEach-Object { '${P' + $_ + '}' }) -join "") + " | base64 -d | sh"

Write-Host ""
Write-Host "Paste ALL of this into Jenkins Post Build Task Script field:"
Write-Host ""
$chunks | ForEach-Object { Write-Host $_ }
Write-Host $echoLine
Write-Host ""
