$path = "version.js"
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$content = "const BUILD_INFO = {`r`n    time: ""$date""`r`n};"
Set-Content -Path $path -Value $content -Encoding UTF8
Write-Host "Updated version.js to $date"

# Add the updated file to the commit
git add $path
