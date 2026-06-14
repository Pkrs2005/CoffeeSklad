# CoffeeSklad — REST API кофейни

Серверная часть системы управления меню и запасами кофейни.  
Клиент-серверная архитектура: только REST API, фронтенд не включён — тестирование через Postman или аналог.

## Стек

- **Node.js** + **Express**
- **PostgreSQL** (Docker)
- **Prisma ORM**

## Структура проекта

```
CoffeeSklad/
├── server.js              # Express-приложение, все эндпоинты
├── docker-compose.yml     # PostgreSQL в Docker
├── .env                   # DATABASE_URL, PORT
├── prisma/
│   ├── schema.prisma      # Схема БД
│   └── seed.js            # Начальные данные
└── package.json
```

## Быстрый старт

### 1. Установить Docker (Arch Linux, один раз)

```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

После `usermod` перелогинься или перезагрузи систему.

### 2. Запустить проект

```bash
cd /path/to/CoffeeSklad

docker compose up -d
sleep 3

npm install
npx prisma migrate dev --name init
npm run db:seed
npm start
```

Сервер: **http://localhost:3000**

Альтернатива — миграция и сид одной командой:

```bash
npm run db:setup
```

## Переменные окружения

Файл `.env` (уже настроен под Docker):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coffee_sklad?schema=public"
PORT=3000
```

## Модели данных

| Модель | Описание |
|--------|----------|
| `Ingredient` | Ингредиенты на складе (name, quantity, unit) |
| `MenuItem` | Позиции меню (name, price) |
| `RecipeIngredient` | Тех. карта: menuItem + size (M/L/XL) + ingredient + amount |
| `Order` | Заказы (total, status, items JSON, createdAt) |

Статус заказа по умолчанию: `PENDING`. После выдачи клиенту: `COMPLETED`.

## API

### GET /api/menu

Все позиции меню с рецептами, сгруппированными по размеру.

```bash
curl http://localhost:3000/api/menu
```

### GET /api/ingredients

Остатки ингредиентов на складе.

```bash
curl http://localhost:3000/api/ingredients
```

### POST /api/orders

Оформление заказа. Проверяет наличие рецепта и достаточность ингредиентов, списывает со склада в транзакции.

**Тело запроса:**

```json
{
  "items": [
    { "menuItemId": 1, "size": "M", "quantity": 2 },
    { "menuItemId": 1, "size": "XL", "quantity": 1 }
  ]
}
```

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":1,"size":"M","quantity":2}]}'
```

При нехватке ингредиентов — **400** с текстом ошибки.

### PATCH /api/orders/:id/complete

Бариста отметил заказ выполненным.

```bash
curl -X PATCH http://localhost:3000/api/orders/1/complete
```

### GET /api/analytics/forecast

Прогноз расхода ингредиентов: сумма по всем заказам → среднее за день → × 1.2 (повышенный спрос).

```bash
curl http://localhost:3000/api/analytics/forecast
```

## Начальные данные (seed)

| Тип | Значения |
|-----|----------|
| Ингредиенты | Кофе в зернах (5000 гр), Молоко (10000 мл), Сироп ванильный (3000 мл) |
| Меню | Капучино (250₽), Латте (280₽) |
| Тех. карты | Капучино M (15 гр + 150 мл), Капучино XL (30 гр + 300 мл), Латте M (12 гр + 200 мл + 20 мл сиропа) |

Повторный seed:

```bash
npm run db:seed
```

## npm-скрипты

| Команда | Действие |
|---------|----------|
| `npm start` | Запуск сервера |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Заполнение БД тестовыми данными |
| `npm run db:setup` | Миграция + seed |

## Docker

```bash
docker compose up -d      # запустить PostgreSQL
docker compose down       # остановить
docker compose down -v    # остановить и удалить данные БД
```

Контейнер: `coffee_sklad_db`, образ `postgres:15-alpine`, порт `5432`.

## Тестирование в Postman

1. `GET http://localhost:3000/api/menu` — узнать `menuItemId`
2. `GET http://localhost:3000/api/ingredients` — проверить остатки
3. `POST http://localhost:3000/api/orders` — создать заказ
4. `GET http://localhost:3000/api/ingredients` — убедиться, что остатки уменьшились
5. `PATCH http://localhost:3000/api/orders/1/complete` — завершить заказ
6. `GET http://localhost:3000/api/analytics/forecast` — посмотреть прогноз
