Param(
  [string]$OutFile
)
$ts  = Get-Date -Format "yyyyMMdd-HHmm"
$out = If ($OutFile) { $OutFile } Else { "repo_snapshot-$ts.txt" }

"=== REPO SNAPSHOT @ $ts ===`n" | Out-File $out -Encoding UTF8

"## git root" | Out-File $out -Encoding UTF8 -Append
(git rev-parse --show-toplevel) *>> $out
"`n## tree (depth=2)" | Out-File $out -Append
(Get-ChildItem -Depth 2 -Directory | Sort-Object FullName | ForEach-Object {$_.FullName}) *>> $out

"`n## CI workflows" | Out-File $out -Append
(Get-ChildItem .\.github\workflows -File -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out

"`n## package.json (все)" | Out-File $out -Append
(Get-ChildItem -Recurse -Filter package.json -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out

"`n## env-файлы" | Out-File $out -Append
(Get-ChildItem -Recurse -Filter ".env*" -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out

"`n## точки входа API и мидлвары" | Out-File $out -Append
(Get-ChildItem .\apps\api -Recurse -File -Include *main.*,*index.*,*middleware*,*guard*,*auth* -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out

"`n## точки входа WEB" | Out-File $out -Append
(Get-ChildItem .\apps\web -Recurse -File -Include next.config.*,vite.config.*,main.*,index.* -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out

"`n## поиск JWT/CSRF/Telegram/CORS (первые 200 совпадений)" | Out-File $out -Append
"`n# JWT:" | Out-File $out -Append
(Select-String -Path .\apps\* -Pattern "JWT|jsonwebtoken|jwt" -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 200) *>> $out
"`n# CSRF:" | Out-File $out -Append
(Select-String -Path .\apps\* -Pattern "csrf|CSRF" -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 200) *>> $out
"`n# Telegram:" | Out-File $out -Append
(Select-String -Path .\apps\* -Pattern "Telegram|telegraf|aiogram" -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 200) *>> $out
"`n# CORS:" | Out-File $out -Append
(Select-String -Path .\apps\* -Pattern "CORS|cors" -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 200) *>> $out

"`n## тесты" | Out-File $out -Append
(Get-ChildItem .\tests -Depth 2 -Directory -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out

"`n## scripts" | Out-File $out -Append
(Get-ChildItem .\scripts -Depth 2 -File -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out

"`n## важные файлы (первые 120 строк)" | Out-File $out -Append
$files = @("AGENTS.md","CHANGELOG.md","CONTRIBUTING.md","ROADMAP.md","Dockerfile")
foreach ($f in $files) {
  if (Test-Path $f) {
    "`n--- $f ---" | Out-File $out -Append
    (Get-Content $f -TotalCount 120) *>> $out
  }
}
"Снимок записан в $out"