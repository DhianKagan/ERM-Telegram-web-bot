SHELL := /bin/bash
export DOCKER_BUILDKIT := 1
export BUILDKIT_PROGRESS := plain

.PHONY: clean fetch prebuild build shared build-rest compile copy-static install docker-build docker-image ci-local

clean:
	git clean -xfd -e .env -e '.env.*' || true
	pnpm store prune || true

fetch:
	pnpm config set network-concurrency 1
	pnpm config set fetch-retries 5
	pnpm fetch

prebuild:
	pnpm -F web prebuild

shared:
	pnpm --filter shared build

build-rest:
	pnpm -r --filter '!shared' build

compile:
	npx tsc scripts/db/ensureDefaults.ts --module commonjs --target ES2020 --outDir dist --rootDir . --types node

copy-static:
	[ -d apps/web/dist ] && cp -r apps/web/dist/* apps/api/public/ || true

install:
	pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

docker-build:
	docker build --target build --pull --no-cache -t local/agromarket-build:tmp .

docker-image:
	docker build --pull --no-cache -t local/agromarket:dev .

ci-local: clean fetch prebuild shared build-rest compile copy-static install docker-build
	@echo "✅ Локальный прогон CI завершён успешно"
