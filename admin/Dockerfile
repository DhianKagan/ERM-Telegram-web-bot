# Назначение файла: сборка панели администратора на Node.js.
# Используются Yarn Berry (v4), TypeScript, Prisma и bundler AdminJS.
FROM node:18

WORKDIR /admin

ENV NODE_ENV="production"
ENV TZ="UTC"

COPY package.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./

RUN corepack enable && corepack prepare yarn@stable --activate
RUN yarn install --immutable
COPY . .

RUN npx prisma generate
RUN npm i -g typescript
RUN yarn build
RUN node bundle.mjs
RUN rm -rf src

EXPOSE 3000
CMD yarn start
