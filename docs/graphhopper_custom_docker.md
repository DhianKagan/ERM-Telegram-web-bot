<!-- Назначение файла: инструкция по сборке собственного Docker-образа GraphHopper. -->

# Сборка собственного образа GraphHopper

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/graphhopper/graphhopper.git
   ```
2. Перейдите в папку проекта и выполните предварительную сборку:
   ```bash
   ./graphhopper.sh -a web
   ```
   Эта команда загрузит зависимости и соберёт сервер.
3. Постройте Docker-образ с помощью Dockerfile из репозитория:
   ```bash
   docker build -t <username>/graphhopper .
   ```
4. Опубликуйте образ в Docker Hub и используйте его имя в Railway вместо `israelhikingmap/graphhopper`.

