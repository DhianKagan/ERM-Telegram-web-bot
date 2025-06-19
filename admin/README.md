## Пример приложения AdminJS

Пример приложения на основе [adminjs](https://github.com/SoftwareBrothers/adminjs)

## Демонстрация

Актуальная демонстрация доступна по адресу: https://demo.adminjs.co

Логин: admin@example.com
Пароль: password

## Предварительные требования

Установите Docker, если его нет: https://docs.docker.com/desktop/#download-and-install

Запустите:
```bash
$ docker-compose up -d
```
для запуска баз данных.

При сборке контейнера интерфейс AdminJS компилируется автоматически.

Убедитесь, что файл `.env` настроен. Если вы не изменяли `docker-compose.yml`,
значения по умолчанию из `.env` подойдут.

## Запуск приложения

Сначала установите все зависимости
```bash
yarn install --frozen-lockfile
```

Убедитесь, что все переменные окружения заданы (см. предыдущий раздел).

Затем создайте базу postgres и выполните миграции:
```bash
$ npx prisma generate     # создаёт Prisma Client в node_modules
$ yarn migration:up
```

После этого можно запустить приложение
```bash
$ yarn build:watch      # оставьте команду запущенной при разработке
$ yarn start:dev        # во второй вкладке терминала
```

По умолчанию приложение доступно по адресу: `http://localhost:3000/admin`

## Разработка приложения

Лучший способ разработки — использовать https://github.com/SoftwareBrothers/adminjs-dev.

Также можно форкнуть и клонировать каждый репозиторий отдельно и связать их с помощью:

* `yarn link`
* `npm link`

чтобы видеть локальные изменения.

#### Sequelize
##### миграции
- `yarn sequelize migration:generate --name init`
- `yarn sequelize db:migrate`
- `yarn sequelize db:migrate:undo`

#### Typeorm
##### миграции
- `yarn typeorm migration:generate -n init`
- `yarn typeorm migration:run`
- `yarn typeorm migration:revert`

#### mikro-orm
##### миграции
- `yarn mikro-orm migration:create`
- `yarn mikro-orm migration:up`
- `yarn mikro-orm migration:down`

#### prisma
- `npx prisma migrate dev --schema prisma/schema.prisma`

## Лицензия

AdminJS © 2023 rst.software. Это свободное ПО, распространяемое на условиях, указанных в файле [LICENSE](LICENSE.md).

## О компании rst.software

<img src="https://pbs.twimg.com/profile_images/1367119173604810752/dKVlj1YY_400x400.jpg" width=150>

Мы открытая и дружелюбная команда, помогающая клиентам по всему миру трансформировать бизнес и создавать отличные продукты.

* Мы открыты для [нанятия](https://www.rst.software/estimate-your-project).
* Если хотите работать у нас — загляните на [страницу вакансий](https://www.rst.software/join-us).
