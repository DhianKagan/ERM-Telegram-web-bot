# Генерация локальных PMTiles

Этот каталог предназначен для офлайн-тайлов, которые используются MapLibre.
В production-режиме необходимо собрать два файла:

- `maplibre-style.json` — локальный стиль карты; если файл присутствует, веб-клиент использует его вместо удалённого пресета
  OpenFreeMap Liberty. Обновляйте стиль вместе с другими тайлами.

- `basemap.pmtiles` — базовая карта (векторные тайлы OpenStreetMap);
- `addresses.pmtiles` — слой с адресами и номерами домов (`addr:housenumber`).

## Требования

- Java 17+ или Docker;
- [Planetiler](https://github.com/onthegomap/planetiler) или [OpenMapTiles](https://github.com/openmaptiles/openmaptiles);
- [pmtiles CLI](https://github.com/protomaps/PMTiles) (`npm install -g pmtiles`).

## Сборка базовой карты через Planetiler

```bash
curl -L -o planetiler.jar https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar
curl -L -o ukraine-latest.osm.pbf https://download.geofabrik.de/europe/ukraine-latest.osm.pbf
java -Xmx16g -jar planetiler.jar \
  --download=false \
  --osm-path=ukraine-latest.osm.pbf \
  --mbtiles=basemap.mbtiles
pmtiles convert basemap.mbtiles basemap.pmtiles
```

## Сборка базовой карты через OpenMapTiles

```bash
git clone https://github.com/openmaptiles/openmaptiles.git
cd openmaptiles
make download area=ukraine
make generate area=ukraine
pmtiles convert data/tiles.mbtiles ../basemap.pmtiles
```

## Сборка адресного слоя

```bash
curl -L -o ukraine-latest.osm.pbf https://download.geofabrik.de/europe/ukraine-latest.osm.pbf
osmium tags-filter -o addresses.osm.pbf ukraine-latest.osm.pbf n/addr:housenumber w/addr:housenumber
osmium export addresses.osm.pbf -o addresses.geojson --add-unique-id --overwrite
tippecanoe -o addresses.mbtiles -zg -Z14 -z22 \
  --layer=addresses \
  --include=addr:housenumber \
  --include=addr:street \
  addresses.geojson
pmtiles convert addresses.mbtiles addresses.pmtiles
```

Переместите `basemap.pmtiles` и `addresses.pmtiles` в этот каталог. Файлы считываются как статика Vite.

## Автоматизация обновлений

- Пересобирайте тайлы не реже одного раза в неделю;
- Храните итоговые `.pmtiles` в артефактах CI или в отдельном хранилище;
- После обновления файлов перезапустите фронтенд и сервер OSRM.

## Лицензия

Данные взяты из OpenStreetMap и распространяются под лицензией ODbL. Не забывайте отображать атрибуцию «© OpenStreetMap contributors, ODbL» на карте.
