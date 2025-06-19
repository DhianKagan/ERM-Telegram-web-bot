# Назначение файла: единый контейнер для бота и панели
# Модули: admin и bot
FROM node:18
WORKDIR /app

# Установка зависимостей
COPY bot/package*.json ./bot/
COPY admin/package.json ./admin/
COPY admin/yarn.lock ./admin/
COPY admin/.yarnrc.yml ./admin/
RUN cd admin && corepack enable && corepack prepare yarn@stable --activate && yarn install --immutable && cd .. && cd bot && npm install && cd ..

# Копирование исходников
COPY bot ./bot
COPY admin ./admin

# Сборка панели
RUN cd admin && npx prisma generate && npm i -g typescript && yarn build && rm -rf src && cd ..

EXPOSE 3000
CMD sh -c 'node admin/dist/index.js & npm --prefix bot start'
