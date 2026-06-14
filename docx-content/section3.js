/** Раздел 3 — реализация прототипа */
const DOCKER = [
  'services:',
  '  postgres:',
  '    image: postgres:15-alpine',
  '    container_name: coffee_sklad_db',
  '    restart: unless-stopped',
  '    environment:',
  '      POSTGRES_USER: postgres',
  '      POSTGRES_PASSWORD: postgres',
  '      POSTGRES_DB: coffee_sklad',
  '    ports:',
  '      - "5432:5432"',
  '    volumes:',
  '      - postgres_data:/var/lib/postgresql/data',
  '',
  'volumes:',
  '  postgres_data:',
];

module.exports = [
  { type: 'h2', text: '3.1. Обоснование технологического стека' },
  {
    type: 'text',
    text: 'Node.js построен на движке V8 и использует однопоточную модель Event Loop с неблокирующим I/O. Когда server.js ожидает ответ PostgreSQL, поток не блокируется — обрабатываются другие HTTP-запросы. Для I/O-bound нагрузки REST API кофейни (короткие запросы, ожидание БД) это эффективная модель без overhead многопоточности.',
  },
  {
    type: 'text',
    text: 'Express минимизирует boilerplate: app.get/post/patch регистрируют маршруты; middleware express.json() ограничивает размер тела и парсит JSON. PostgreSQL выбран за ACID-транзакции, надёжность и тип jsonb для Order.items — бинарный JSON с возможностью индексирования и запросов при расширении analytics.',
  },
  {
    type: 'text',
    text: 'Prisma ORM генерирует клиент из schema.prisma, выполняет миграции и предоставляет $transaction. Docker изолирует СУБД; volume postgres_data монтирует /var/lib/postgresql/data хоста в контейнер — данные переживают docker compose down без флага -v.',
  },

  { type: 'h2', text: '3.2. Структура каталогов проекта' },
  {
    type: 'text',
    text: 'Корень содержит server.js (точка входа), package.json (зависимости express, @prisma/client, prisma), docker-compose.yml, .env (DATABASE_URL, PORT), public/index.html (UI), prisma/schema.prisma, prisma/seed.js, prisma/migrations/ (после migrate). Такая структура монорепозитория позволяет клонировать один репозиторий и выполнить полный цикл развёртывания.',
  },

  { type: 'h2', text: '3.3. Конфигурация Docker Compose' },
  {
    type: 'text',
    text: 'Ключ services объявляет контейнеры. postgres — имя сервиса. image: postgres:15-alpine — официальный лёгкий образ PostgreSQL 15 на Alpine Linux (~80 МБ против ~400 МБ у полного Debian-образа). container_name: coffee_sklad_db фиксирует имя для docker ps. restart: unless-stopped перезапускает контейнер после сбоя хоста, но не после ручного stop.',
  },
  {
    type: 'text',
    text: 'environment задаёт POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB — стандартные переменные entrypoint-скрипта образа postgres; при первом запуске создаётся роль postgres и база coffee_sklad. ports: "5432:5432" пробрасывает порт контейнера на localhost — Prisma подключается по DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coffee_sklad.',
  },
  {
    type: 'text',
    text: 'volumes: postgres_data:/var/lib/postgresql/data — именованный том Docker; секция volumes внизу файла объявляет postgres_data как managed volume. Без тома данные жили бы в writable layer контейнера и терялись при docker compose down -v.',
  },
  { type: 'code', title: 'Листинг docker-compose.yml', lines: DOCKER },

  { type: 'h2', text: '3.4. Миграции и скрипт seed.js' },
  {
    type: 'text',
    text: 'Команда npx prisma migrate dev --name init читает schema.prisma, генерирует SQL CREATE TABLE и применяет к PostgreSQL, создаёт папку migrations. prisma generate обновляет @prisma/client. npm run db:seed вызывает node prisma/seed.js через секцию "prisma": { "seed": ... } в package.json.',
  },
  {
    type: 'text',
    text: 'seed.js: new PrismaClient(); в main() последовательно deleteMany() для RecipeIngredient, Order, MenuItem, Ingredient — очистка в порядке, учитывающем FK (сначала зависимые). Затем create Ingredient: кофе 5000 гр, молоко 10000 мл, сироп 3000 мл. create MenuItem: Капучино 250₽, Латте 280₽. createMany RecipeIngredient: капучино M (15 гр + 150 мл), XL (30 + 300), латте M (12 + 200 + 20 сироп). Повторный seed восстанавливает демо-состояние после экспериментов Postman.',
  },

  { type: 'h2', text: '3.5. Сквозное тестирование в Postman' },

  { type: 'h2', text: 'Шаг 1. Проверка исходного состояния' },
  {
    type: 'text',
    text: 'GET http://localhost:3000/api/ingredients — ожидается 200 OK, массив из трёх элементов; молоко quantity: 10000, unit: "мл". GET /api/menu — капучино id:1 с sizes.M и sizes.XL. Фиксируем базовые остатки для сравнения после заказа.',
  },
  { type: 'marker', text: '[МЕСТО ДЛЯ СКРИНШОТА POSTMAN: GET /api/ingredients — исходные остатки]' },

  { type: 'h2', text: 'Шаг 2. Успешный заказ (201 Created)' },
  {
    type: 'text',
    text: 'POST http://localhost:3000/api/orders, Body raw JSON: {"items":[{"menuItemId":1,"size":"M","quantity":2}]}. Ожидание: 201 Created, тело { id: 1, total: 500, status: "PENDING", items: [...] } — две порции капучино M по 250₽. Списание: молоко −300 мл (2×150), кофе −30 гр (2×15). Повторный GET /api/ingredients: milk quantity = 9700.',
  },
  { type: 'marker', text: '[МЕСТО ДЛЯ СКРИНШОТА POSTMAN: POST /api/orders — 201 Created]' },
  { type: 'marker', text: '[МЕСТО ДЛЯ СКРИНШОТА POSTMAN: GET /api/ingredients — остатки после заказа]' },

  { type: 'h2', text: 'Шаг 3. Негативный тест — нехватка молока (400 Bad Request)' },
  {
    type: 'text',
    text: 'POST с {"items":[{"menuItemId":1,"size":"XL","quantity":100}]}. XL капучино требует 300 мл молока на порцию → 30000 мл total, при остатке ~9700 мл сервер возвращает 400 { "error": "Недостаточно \\"Молоко\\": нужно 30000 мл, на складе 9700 мл" }. Order не создаётся; quantity не меняется — проверка rollback транзакции.',
  },
  { type: 'marker', text: '[МЕСТО ДЛЯ СКРИНШОТА POSTMAN: POST /api/orders — 400 Bad Request]' },

  { type: 'h2', text: 'Шаг 4. Завершение заказа баристa' },
  {
    type: 'text',
    text: 'GET /api/orders?status=PENDING — заказ #1 в списке. PATCH http://localhost:3000/api/orders/1/complete — 200 OK, status: "COMPLETED". Повторный GET PENDING — массив пуст или без заказа #1. В UI кнопка «Приготовить» вызывает тот же PATCH через fetch.',
  },
  { type: 'marker', text: '[МЕСТО ДЛЯ СКРИНШОТА POSTMAN: PATCH /api/orders/1/complete]' },

  { type: 'h2', text: 'Шаг 5. Аналитический прогноз' },
  {
    type: 'text',
    text: 'GET /api/analytics/forecast — ответ содержит ordersCount, days, coefficient: 1.2, forecast: [{ name: "Молоко", totalConsumed: 300, avgPerDay: ..., forecast: ... }, ...]. Значения зависят от числа заказов в БД; после одного заказа days=1, avgPerDay равен totalConsumed.',
  },
  { type: 'marker', text: '[МЕСТО ДЛЯ СКРИНШОТА POSTMAN: GET /api/analytics/forecast]' },

  {
    type: 'text',
    text: 'Аналогичные сценарии воспроизводятся в браузере на http://localhost:3000 без Postman: меню → корзина → оформить → баристa → аналитика. Это подтверждает согласованность SPA и REST API.',
  },
];
