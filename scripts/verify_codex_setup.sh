#!/usr/bin/env bash
set -euo pipefail

# ---- helpers ----
pass(){ echo "✅ PASS: $1"; }
fail(){ echo "❌ FAIL: $1"; exit 1; }
warn(){ echo "⚠️ WARN:  $1"; }

# ---- 0. базовые файлы ----
test -f ".codex-pipeline.yaml" && pass ".codex-pipeline.yaml найден" || fail "нет .codex-pipeline.yaml (должен быть в корне)"
test -f ".github/workflows/ci.yml" && pass ".github/workflows/ci.yml найден" || fail "нет .github/workflows/ci.yml"
test -f "scripts/ci/ci-fast.sh" && pass "scripts/ci/ci-fast.sh найден" || fail "нет scripts/ci/ci-fast.sh"
test -f "scripts/ci/ci-full.sh" && pass "scripts/ci/ci-full.sh найден" || fail "нет scripts/ci/ci-full.sh"
test -f "tests/e2e/playwright.config.ts" && pass "tests/e2e/playwright.config.ts найден" || warn "нет tests/e2e/playwright.config.ts (e2e будут пропущены)"

# ---- 1. права на bash-скрипты ----
for f in scripts/ci/ci-fast.sh scripts/ci/ci-full.sh; do
  if [ -x "$f" ]; then pass "$f исполняемый"; else warn "$f не исполняемый → фикс: chmod +x $f"; fi
done

# ---- 2. GitHub Actions структура ----
if grep -qE 'jobs:\s*$' .github/workflows/ci.yml && grep -q 'ci_fast:' .github/workflows/ci.yml; then
  pass "ci.yml содержит job ci_fast"
else
  fail "в ci.yml нет job ci_fast"
fi
grep -q 'pnpm/action-setup@v4' .github/workflows/ci.yml && pass "ci.yml использует pnpm/action-setup@v4" || warn "в ci.yml не найден pnpm/action-setup@v4 (не критично)"
grep -q 'pnpm run ci:fast' .github/workflows/ci.yml && pass "ci.yml запускает pnpm run ci:fast" || fail "в ci.yml не найден запуск pnpm run ci:fast"

# ---- 3. package.json: наличие скриптов ----
node - <<'NODE'
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const need = ["lint","build","test:unit","ci:fast","ci:full"];
let ok = 0;
for (const k of need){
  if (p.scripts && p.scripts[k]) { console.log("✅ script:", k); ok++; }
  else { console.log("❌ script missing:", k); }
}
process.exit(ok===need.length?0:1);
NODE
[ $? -eq 0 ] && pass "package.json содержит нужные scripts" || fail "в package.json не хватает scripts (см. строки выше)"

# ---- 4. lint пишет артефакт? ----
node - <<'NODE'
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const s = p.scripts?.lint || "";
process.exit(/artifacts\/lint\.txt/.test(s) ? 0 : 1);
NODE
[ $? -eq 0 ] && pass "lint пишет в artifacts/lint.txt" || warn "lint не пишет в artifacts/lint.txt (не критично, но удобно для CI-артефактов)"

# ---- 5. проверка CSRF-флагов ----
if grep -RInq 'CSRF_ENABLED' . ; then
  warn "В репо встречается CSRF_ENABLED → рекомендую привести к одному флагу (DISABLE_CSRF)"
else
  pass "в коде не найден CSRF_ENABLED (используем единый DISABLE_CSRF)"
fi

# ---- 6. sanity-чек .env.example (дубликаты/битые строки) ----
awk -F= '
  /^[[:space:]]*#/ {next}
  /^[[:space:]]*$/ {next}
  NF<2 { bad++; print "Странная строка (нет KEY=VALUE):", NR, $0; next }
  { if (seen[$1]++) dup[$1]=1 }
  END{
    for (k in dup) print "Дубликат ключа:", k
    if (bad>0 || length(dup)>0) exit 1
  }
' .env.example >/dev/null \
  && pass ".env.example валиден (нет дубликатов/битых строк)" \
  || warn ".env.example: есть замечания (см. вывод выше, если запускали вручную)"

echo "———"
echo "Готово. Если есть WARN/FAIL — поправь по подсказкам выше."
