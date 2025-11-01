#!/usr/bin/env bash
# Назначение файла: обновление адресных данных из OSM и OpenAddresses с подготовкой тайлов MBTiles для Mapbox Tilesets.

set -euo pipefail

show_help() {
  cat <<'USAGE'
Использование: ./scripts/refresh_addresses.sh

Требуемые переменные окружения:
  OSM_PBF_URL        — ссылка на архив .osm.pbf (например, https://download.geofabrik.de/europe/ukraine-latest.osm.pbf)
  OPENADDR_URL       — ссылка на архив OpenAddresses .zip (например, https://results.openaddresses.io/latest/run/europe/ua/countrywide.zip)

Необязательные переменные:
  OUTPUT_MBTILES     — путь до итогового файла MBTiles (по умолчанию dist/addresses.mbtiles)
  TILESET_LAYER      — имя слоя в MBTiles (по умолчанию addresses)
  TILESET_NAME       — название набора (по умолчанию Address registry)
  WORKDIR            — временный каталог; если не указан, создаётся через mktemp
  KEEP_WORKDIR       — установить в 1, чтобы не удалять временный каталог после завершения
  MIN_ZOOM           — минимальный масштаб тайлов (по умолчанию 6)
  MAX_ZOOM           — максимальный масштаб тайлов (по умолчанию 16)

Скрипт требует установленные утилиты osmium, tippecanoe, unzip, python3 и curl.
USAGE
}

if [[ "${1:-}" == "--help" ]]; then
  show_help
  exit 0
fi

: "${OSM_PBF_URL:?Не задана переменная OSM_PBF_URL}"
: "${OPENADDR_URL:?Не задана переменная OPENADDR_URL}"

OUTPUT_MBTILES=${OUTPUT_MBTILES:-dist/addresses.mbtiles}
TILESET_LAYER=${TILESET_LAYER:-addresses}
TILESET_NAME=${TILESET_NAME:-"Address registry"}
MIN_ZOOM=${MIN_ZOOM:-6}
MAX_ZOOM=${MAX_ZOOM:-16}

if ! command -v osmium >/dev/null 2>&1; then
  echo "Ошибка: утилита osmium не найдена." >&2
  exit 1
fi

if ! command -v tippecanoe >/dev/null 2>&1; then
  echo "Ошибка: утилита tippecanoe не найдена." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Ошибка: утилита curl не найдена." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Ошибка: требуется python3." >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "Ошибка: утилита unzip не найдена." >&2
  exit 1
fi

WORKDIR=${WORKDIR:-$(mktemp -d)}
KEEP_WORKDIR=${KEEP_WORKDIR:-0}

cleanup() {
  if [[ "$KEEP_WORKDIR" != "1" ]]; then
    rm -rf "$WORKDIR"
  else
    echo "Временный каталог сохранён: $WORKDIR"
  fi
}
trap cleanup EXIT

mkdir -p "$WORKDIR"
mkdir -p "$(dirname "$OUTPUT_MBTILES")"

OSM_SOURCE="$WORKDIR/osm.pbf"
OSM_FILTERED="$WORKDIR/osm_addr.pbf"
OSM_GEOJSON="$WORKDIR/osm_addr.geojsonl"
OPENADDR_ARCHIVE="$WORKDIR/openaddresses.zip"
OPENADDR_DIR="$WORKDIR/openaddresses"
OPENADDR_GEOJSON="$WORKDIR/openaddresses.geojsonl"
COMBINED_GEOJSON="$WORKDIR/addresses.geojsonl"

echo "Скачиваю OSM: $OSM_PBF_URL"
curl -fsSL "$OSM_PBF_URL" -o "$OSM_SOURCE"

echo "Фильтрую адреса из OSM"
osmium tags-filter "$OSM_SOURCE" nwr/addr:housenumber -o "$OSM_FILTERED" --overwrite

echo "Конвертирую адреса OSM в GeoJSON Sequence"
osmium export "$OSM_FILTERED" \
  --output-format=geojsonseq \
  --geometry-types=point,linestring,multipolygon \
  --add-properties-from-tags \
  -o "$OSM_GEOJSON" --overwrite

echo "Скачиваю OpenAddresses: $OPENADDR_URL"
curl -fsSL "$OPENADDR_URL" -o "$OPENADDR_ARCHIVE"
mkdir -p "$OPENADDR_DIR"
unzip -qq "$OPENADDR_ARCHIVE" -d "$OPENADDR_DIR"

echo "Конвертирую OpenAddresses в GeoJSON Sequence"
OPENADDR_DIR="$OPENADDR_DIR" OPENADDR_GEOJSON="$OPENADDR_GEOJSON" python3 <<'PY'
import csv
import json
import math
import pathlib
import sys
import os

try:
    openaddr_dir = pathlib.Path(os.environ["OPENADDR_DIR"])
    output_path = pathlib.Path(os.environ["OPENADDR_GEOJSON"])
except KeyError as error:
    sys.stderr.write(f"Не найдена переменная окружения {error!s}.\n")
    sys.exit(1)

lon_keys = ("LON", "LONGITUDE", "X", "lon", "longitude")
lat_keys = ("LAT", "LATITUDE", "Y", "lat", "latitude")
number_keys = ("NUMBER", "HOUSENUM", "HOUSENUMBER", "addr:housenumber", "HOUSE_NUMBER")

rows_written = 0
with output_path.open("w", encoding="utf-8") as dst:
    for csv_path in openaddr_dir.rglob("*.csv"):
        with csv_path.open(newline="", encoding="utf-8") as src:
            reader = csv.DictReader(src)
            for row in reader:
                lon = next((row.get(k) for k in lon_keys if row.get(k)), None)
                lat = next((row.get(k) for k in lat_keys if row.get(k)), None)
                housenumber = next((row.get(k) for k in number_keys if row.get(k)), None)
                if not lon or not lat or not housenumber:
                    continue
                try:
                    lon_val = float(lon)
                    lat_val = float(lat)
                except (TypeError, ValueError):
                    continue
                if math.isnan(lon_val) or math.isnan(lat_val):
                    continue
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lon_val, lat_val],
                    },
                    "properties": {"addr:housenumber": housenumber, "source": "openaddresses", "file": csv_path.name},
                }
                dst.write(json.dumps(feature, ensure_ascii=False) + "\n")
                rows_written += 1

if rows_written == 0:
    sys.stderr.write("Не удалось сформировать данные из OpenAddresses.\n")
    sys.exit(1)
PY

cat "$OSM_GEOJSON" "$OPENADDR_GEOJSON" > "$COMBINED_GEOJSON"

echo "Собираю MBTiles через tippecanoe"
tippecanoe \
  --force \
  --read-parallel \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  -Z "$MIN_ZOOM" \
  -z "$MAX_ZOOM" \
  -l "$TILESET_LAYER" \
  -n "$TILESET_NAME" \
  -o "$OUTPUT_MBTILES" \
  "$COMBINED_GEOJSON"

echo "MBTiles сохранён: $OUTPUT_MBTILES"
