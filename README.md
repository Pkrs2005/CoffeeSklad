# CoffeeSklad — система управления меню и запасами кофейни

Клиент-серверное приложение для кофейни: REST API на Express + PostgreSQL и простой веб-интерфейс для демонстрации.

## Стек

| Слой | Технологии |
|------|------------|
| Backend | Node.js, Express, Prisma ORM |
| База данных | PostgreSQL 15 (Docker) |
| Frontend | HTML, Tailwind CSS (CDN), vanilla JavaScript |

## Структура проекта

```
CoffeeSklad/
├── server.js              # Express: API + раздача статики
├── docker-compose.yml     # PostgreSQL в Docker
├── .env                   # DATABASE_URL, PORT
├── public/
│   └── index.html         # Веб-интерфейс (SPA)
├── prisma/
│   ├── schema.prisma      # Схема БД
│   └── seed.js            # Начальные данные
└── package.json
```

## Быстрый старт

### 1. Docker (Arch Linux, один раз)

```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

После `usermod` перелогиниться или перезагрузить систему.

### 2. Запуск

```bash
cd /path/to/CoffeeSklad

docker compose up -d
sleep 3

npm install
npx prisma migrate dev --name init
npm run db:seed
npm start
```

Откройте в браузере: **http://localhost:3000**

Миграция и seed одной командой:

```bash
npm run db:setup
```

## Веб-интерфейс

Одностраничное приложение в `public/index.html`. При переходе на `http://localhost:3000` открывается автоматически.

| Секция | Что делает |
|--------|------------|
| **Меню кофейни** | Список позиций, выбор размера (M / XL), добавление в корзину |
| **Текущий заказ** | Корзина, итоговая сумма, кнопка «Оформить заказ» |
| **Активные заказы (Для бариста)** | Заказы со статусом `PENDING`, кнопка «Приготовить» |
| **Склад и Аналитика** | Остатки ингредиентов и прогноз трат на завтра |

Данные обновляются через `fetch` без перезагрузки страницы.

## Переменные окружения

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coffee_sklad?schema=public"
PORT=3000
```

## Модели данных

| Модель | Поля | Назначение |
|--------|------|------------|
| `Ingredient` | name, quantity, unit | Ингредиенты на складе |
| `MenuItem` | name, price | Позиции меню |
| `RecipeIngredient` | menuItemId, size, ingredientId, amount | Тех. карта по размерам (M, L, XL) |
| `Order` | total, status, items (JSON), createdAt | История заказов |

Статусы заказа: `PENDING` (по умолчанию) → `COMPLETED`.

## REST API

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/menu` | Меню с рецептами по размерам |
| GET | `/api/ingredients` | Остатки на складе |
| GET | `/api/orders?status=PENDING` | Список заказов (фильтр по статусу опционален) |
| POST | `/api/orders` | Оформление заказа, списание со склада |
| PATCH | `/api/orders/:id/complete` | Заказ выполнен (бариста) |
| GET | `/api/analytics/forecast` | Прогноз расхода ингредиентов |

### POST /api/orders

```json
{
  "items": [
    { "menuItemId": 1, "size": "M", "quantity": 2 }
  ]
}
```

Логика в `$transaction`: поиск рецепта по `menuItemId` + `size` → проверка остатков → декремент ингредиентов → создание заказа. При нехватке — **400** с понятным сообщением.

### GET /api/analytics/forecast

Суммирует расход ингредиентов по всем заказам, делит на число дней (от первого до последнего заказа), умножает на **1.2** — прогноз на период повышенного спроса.

## Начальные данные (seed)

| Тип | Значения |
|-----|----------|
| Ингредиенты | Кофе в зернах (5000 гр), Молоко (10000 мл), Сироп ванильный (3000 мл) |
| Меню | Капучино (250₽), Латте (280₽) |
| Тех. карты | Капучино M (15 гр + 150 мл), Капучино XL (30 гр + 300 мл), Латте M (12 гр + 200 мл + 20 мл сиропа) |

```bash
npm run db:seed
```

## npm-скрипты

| Команда | Действие |
|---------|----------|
| `npm start` | Запуск сервера |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Заполнение БД |
| `npm run db:setup` | Миграция + seed |

## Docker

```bash
docker compose up -d      # запустить PostgreSQL
docker compose down       # остановить
docker compose down -v    # остановить и удалить данные БД
```

Контейнер: `coffee_sklad_db` · образ: `postgres:15-alpine` · порт: `5432`

## Тестирование

**Через браузер:** http://localhost:3000 — полный сценарий: заказ → бариста → склад → аналитика.

**Через Postman / curl:**

```bash
curl http://localhost:3000/api/menu
curl http://localhost:3000/api/ingredients
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":1,"size":"M","quantity":1}]}'
curl "http://localhost:3000/api/orders?status=PENDING"
curl -X PATCH http://localhost:3000/api/orders/1/complete
curl http://localhost:3000/api/analytics/forecast
```
