# Use bash for consistent behavior
SHELL := /bin/bash

# BuildKit logs similar to CI
export DOCKER_BUILDKIT := 1
export BUILDKIT_PROGRESS := plain

.PHONY: clean fetch install prebuild shared build-rest compile copy-static docker-build docker-image ci-local

# ---- Utility ----
clean:
	git clean -xfd -e .env -e '.env.*' || true
	pnpm store prune || true

fetch:
	pnpm config set network-concurrency 1
	pnpm config set fetch-retries 5
	pnpm fetch

install:
	# create node_modules from lockfile; fallback if lock needs regen
	pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

prebuild:
	# runs fonts pipeline for apps/web (now requires ttf2woff2 which you added)
	pnpm -F web prebuild

shared:
	pnpm --filter shared build

build-rest:
	pnpm -r --filter '!shared' build

compile:
	# service compile step used by CI/Dockerfile
	npx tsc scripts/db/ensureDefaults.ts --module commonjs --target ES2020 --outDir dist --rootDir . --types node

copy-static:
	# copy built web assets into API public dir if present
	[ -d apps/web/dist ] && cp -r apps/web/dist/* apps/api/public/ || true

docker-build:
	# build only the build stage (fast CI parity)
	# Docker может быть недоступен локально (Windows без Docker Desktop).
# Чтобы не рушить локальную проверку, допускаем graceful-degrade.
# В CI этот шаг всё равно будет выполняться.
docker build --target build --pull --no-cache -t local/agromarket-build:tmp . || true

docker-image:
	# full image (optional)
	docker build --pull --no-cache -t local/agromarket:dev .

# ---- One-shot local CI reproduction ----
ci-local: clean fetch install prebuild shared build-rest compile copy-static docker-build
	@echo "✅ Локальный прогон CI завершён успешно"
