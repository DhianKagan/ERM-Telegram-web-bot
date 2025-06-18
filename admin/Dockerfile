# Назначение файла: сборка панели администратора на Node.js.
# Используются Yarn Berry (v4), TypeScript и Prisma.
FROM node:18

WORKDIR /admin

ENV NODE_ENV="production"
ENV TZ="UTC"

COPY package.json ./
COPY yarn.lock ./

RUN corepack enable && corepack prepare yarn@stable --activate
RUN yarn install --immutable --mode=skip-build
COPY . .

RUN npm i -g typescript
RUN yarn build
RUN npx prisma generate
RUN rm -rf src

ENV ADMIN_JS_SKIP_BUNDLE="true"

EXPOSE 3000
CMD yarn start
