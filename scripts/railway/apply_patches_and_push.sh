#!/usr/bin/env bash
set -euo pipefail

# Required env:
# - GITHUB_TOKEN (PAT with write access to repo)
# - REPO_FULL_NAME (e.g. DhianKagan/ERM-Telegram-web-bot)
# Optional:
# - BRANCH (default: main)
# - COMMIT_MESSAGE (default: "chore(patches): apply patch set")
# - GIT_AUTHOR_NAME (default: patch-bot)
# - GIT_AUTHOR_EMAIL (default: patch-bot@users.noreply.github.com)

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${REPO_FULL_NAME:?REPO_FULL_NAME is required}"

BRANCH="${BRANCH:-main}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore(patches): apply patch set}"
GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-patch-bot}"
GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-patch-bot@users.noreply.github.com}"

ensure_git() {
  if command -v git >/dev/null 2>&1; then
    return 0
  fi

  echo "git not found; attempting to install..."

  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y --no-install-recommends git ca-certificates
    rm -rf /var/lib/apt/lists/*
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache git ca-certificates
  else
    echo "ERROR: git is not installed and no supported package manager found (apt-get/apk)." >&2
    echo "Fix: run patcer in an image that includes git or add install step in build." >&2
    exit 1
  fi

  command -v git >/dev/null 2>&1 || { echo "ERROR: failed to install git"; exit 1; }
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi

  echo "pnpm not found; attempting to enable via corepack..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi

  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi

  echo "pnpm still not found; installing pnpm globally..."
  if command -v npm >/dev/null 2>&1; then
    npm i -g pnpm
  else
    echo "ERROR: pnpm missing and npm not available." >&2
    exit 1
  fi
}

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

ensure_git
ensure_pnpm

echo "Cloning repo: ${REPO_FULL_NAME} (branch: ${BRANCH})"
git config --global user.name "$GIT_AUTHOR_NAME"
git config --global user.email "$GIT_AUTHOR_EMAIL"

git clone --depth 50 --branch "$BRANCH" "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_FULL_NAME}.git" "$WORKDIR/repo"
cd "$WORKDIR/repo"

echo "Installing dependencies (best-effort)"
pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

echo "Applying patches via patch_cjs/apply-all.cjs"
node patch_cjs/apply-all.cjs

echo "Checking changes"
if git diff --quiet; then
  echo "No changes after applying patches. Exiting."
  exit 0
fi

# Do not commit patch files themselves (avoid loops)
git reset -- patch_cjs || true

if git diff --quiet; then
  echo "Only patch files changed; skipping commit."
  exit 0
fi

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
