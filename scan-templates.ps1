# 扫描所有 Angular 模板中的静态英文文本（未被 | tr 翻译的）
$dir = "g:\Fifth-Aeon\Fifth-Aeon-Web-Client\src\app"
$files = Get-ChildItem $dir -Recurse -Filter *.html | Where-Object { $_.FullName -notmatch 'game_model' }
foreach ($f in $files) {
    $lines = Get-Content $f.FullName
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match '\{\{' -or $line -match '<!--') { continue }
        if ($line -match '>\s*([A-Z][a-zA-Z'' ]{3,})\s*<') {
            if ($line -notmatch 'mat-icon') {
                Write-Host ("{0}:{1}: TXT {2}" -f $f.Name, ($i + 1), $Matches[1])
            }
        }
        if ($line -match '(placeholder|matTooltip|aria-label|title)="([A-Z][^"{]*[a-z]{3})"') {
            Write-Host ("{0}:{1}: ATTR {2}={3}" -f $f.Name, ($i + 1), $Matches[1], $Matches[2])
        }
    }
}
