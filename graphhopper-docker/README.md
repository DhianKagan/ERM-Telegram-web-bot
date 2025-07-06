<!-- Назначение файла: инструкция по использованию Dockerfile GraphHopper. -->

# Dockerfile для GraphHopper

## Локальная сборка
1. Клонируйте исходники GraphHopper:
   ```bash
   git clone https://github.com/graphhopper/graphhopper.git
   ```
2. Выполните предварительную сборку сервера:
   ```bash
   cd graphhopper
   ./graphhopper.sh -a web
   ```
3. Скопируйте полученную папку `graphhopper` рядом с этим Dockerfile.
4. Постройте образ:
   ```bash
   docker build -t <имя>/graphhopper .
   ```
5. Запустите контейнер:
   ```bash
   docker run -p 8989:8989 <имя>/graphhopper --url https://download.geofabrik.de/europe/andorra-latest.osm.pbf --host 0.0.0.0
   ```

## Деплой на Railway
1. Создайте новый сервис типа «Deploy from Dockerfile».
2. Укажите каталог `graphhopper-docker` этого репозитория.
3. В поле `Start Command` передавайте только параметры, например:
   ```bash
   --url https://download.geofabrik.de/europe/andorra-latest.osm.pbf --host 0.0.0.0
   ```
4. Через переменную `JAVA_OPTS` настройте память (`-Xms1g -Xmx2g`).
5. После импорта карты сервис будет доступен по выдаваемому Railway адресу. Его нужно указать в переменной `ROUTING_URL` основного приложения.
