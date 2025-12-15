#!/usr/bin/env bash
set -euo pipefail

# Требуемые переменные окружения:
# - GITHUB_TOKEN (PAT с правами write на repo)
# - REPO_FULL_NAME (например: DhianKagan/ERM-Telegram-web-bot)
# Необязательные:
# - BRANCH (по умолчанию main)
# - COMMIT_MESSAGE (по умолчанию "chore(patches): apply patch set")
# - GIT_AUTHOR_NAME (по умолчанию patch-bot)
# - GIT_AUTHOR_EMAIL (по умолчанию patch-bot@users.noreply.github.com)

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${REPO_FULL_NAME:?REPO_FULL_NAME is required}"

BRANCH="${BRANCH:-main}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore(patches): apply patch set}"
GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-patch-bot}"
GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-patch-bot@users.noreply.github.com}"

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "Cloning repo: ${REPO_FULL_NAME} (branch: ${BRANCH})"
git config --global user.name "$GIT_AUTHOR_NAME"
git config --global user.email "$GIT_AUTHOR_EMAIL"

# Безопаснее для GitHub: x-access-token
git clone --depth 50 --branch "$BRANCH" "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_FULL_NAME}.git" "$WORKDIR/repo"
cd "$WORKDIR/repo"

echo "Enabling corepack (pnpm)"
corepack enable >/dev/null 2>&1 || true

echo "Installing dependencies (best-effort)"
pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

echo "Applying patches via patch_cjs/apply-all.cjs"
node patch_cjs/apply-all.cjs

echo "Checking changes"
if git diff --quiet; then
  echo "No changes after applying patches. Exiting."
  exit 0
fi

# Не коммитим сами патчи — только результат применения
git reset -- patch_cjs || true

if git diff --quiet; then
  echo "Only patch files changed; skipping commit."
  exit 0
fi

# Защита от циклов: если последний коммит уже от patch-bot — не продолжаем
LAST_AUTHOR="$(git log -1 --pretty=format:%an || true)"
if [ "$LAST_AUTHOR" = "$GIT_AUTHOR_NAME" ]; then
  echo "Last commit author is ${GIT_AUTHOR_NAME}; skipping to avoid loops."
  exit 0
fi

echo "Committing changes"
git add -A
git commit -m "$COMMIT_MESSAGE"

echo "Pushing to ${BRANCH}"
git push origin "$BRANCH"

echo "Done."
