FROM openjdk:17-jdk-slim

# Установка необходимых инструментов
RUN apt-get update && \
    apt-get install -y maven wget unzip && \
    rm -rf /var/lib/apt/lists/*

# Копирование исходного кода GraphHopper
WORKDIR /app/graphhopper
COPY . /app/graphhopper

# Сборка проекта
RUN mvn clean install -DskipTests

# Загрузка файла карты
RUN wget -O /app/graphhopper/odessa_oblast.osm.pbf "https://pub-d2e9e03579134f2c9561f9303b2112e7.r2.dev/odessa_oblast.osm.pbf"

# Копирование конфигурационного файла
COPY config.yml /app/graphhopper/config.yml

# Установка переменных окружения
ENV JAVA_OPTS="-Xms1g -Xmx1g"
ENV PORT=8989

# Открытие порта
EXPOSE ${PORT}

# Запуск сервера
CMD ["sh", "-c", "java -Ddw.graphhopper.config=/app/graphhopper/config.yml -jar /app/graphhopper/web/target/graphhopper-web-*.jar server /app/graphhopper/config.yml"]
