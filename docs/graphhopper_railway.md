<!-- Назначение файла: инструкция по развертыванию GraphHopper на Railway. -->

# Запуск GraphHopper на Railway

1. Создайте новый проект и добавьте сервис типа «Deploy from Docker».
2. Укажите образ `israelhikingmap/graphhopper` из Docker Hub.
3. В поле `Start Command` укажите только параметры запуска (образ уже содержит
   необходимую точку входа):
   ```bash
   --url https://download.geofabrik.de/europe/andorra-latest.osm.pbf --host 0.0.0.0
   ```
4. Через переменную `JAVA_OPTS` установите объём памяти, например `-Xms1g -Xmx2g`.
5. Первый запуск скачает карту и подготовит граф. Дождитесь сообщения `Server - Started`.
6. Сервис будет доступен по адресу `https://<имя>.up.railway.app`. API маршрутов находится по пути `/route`.
7. Укажите этот адрес в `.env` переменной `ROUTING_URL`.

