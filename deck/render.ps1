param([string]$f,[string]$out)
$ppt = New-Object -ComObject PowerPoint.Application
$p = $ppt.Presentations.Open((Resolve-Path $f).Path, $true, $true, $false)
New-Item -ItemType Directory -Force $out | Out-Null
$p.Export((Resolve-Path $out).Path, "PNG", 1600, 900)
$p.Close(); $ppt.Quit()
