/** Раздел 2 — разработка проекта системы */
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
  { type: 'h2', text: '2.1. Клиент-серверная архитектура и паттерн SPA' },
  {
    type: 'text',
    text: 'Система CoffeeSklad построена по классической клиент-серверной схеме. Сервер — процесс Node.js, слушающий PORT (по умолчанию 3000), принимающий HTTP-запросы. Клиент — браузер пользователя, загружающий public/index.html с того же origin, что и API; это упрощает вызовы fetch(\'/api/menu\') без CORS-настроек.',
  },
  {
    type: 'text',
    text: 'Архитектуру можно описать тремя логическими слоями. Presentation Layer — HTML/CSS/JS в public/, отображающий меню, корзину, очередь баристa и склад. Business Logic Layer — маршруты Express в server.js, содержащие правила валидации, расчёт total, транзакции списания и алгоритм прогноза. Data Access Layer — Prisma Client, транслирующий операции findMany, update, create в SQL-запросы PostgreSQL.',
  },
  {
    type: 'text',
    text: 'Паттерн SPA (Single Page Application) реализован без фреймворка: одна HTML-страница, перерисовка секций через innerHTML после асинхронных fetch. Состояние корзины хранится в массиве cart в памяти браузера; selectedSize — объект, запоминающий выбранный размер для каждого menuItemId. При submitOrder() массив преобразуется в items и отправляется POST /api/orders.',
  },
  {
    type: 'text',
    text: 'Строка app.use(express.static(\'public\')) в server.js регистрирует middleware для раздачи статики. Запрос GET / возвращает index.html; запросы /api/* обрабатываются маршрутами, объявленными выше или ниже — порядок важен: express.json() и static подключены до API-роутов, что корректно, поскольку /api/menu не конфликтует с файлами public.',
  },

  { type: 'h2', text: '2.2. Эндпоинт GET /api/menu' },
  {
    type: 'text',
    text: 'Обработчик app.get(\'/api/menu\', async (_req, res) => { ... }) не принимает параметров. Внутри try/catch вызывается prisma.menuItem.findMany({ include: { recipes: { include: { ingredient: { select: { id, name, unit } } } } } }). Prisma генерирует SQL с LEFT JOIN к RecipeIngredient и Ingredient. Результат — массив объектов MenuItem, каждый с массивом recipes.',
  },
  {
    type: 'text',
    text: 'Серверная трансформация: для каждого item создаётся пустой объект sizes. Цикл for (const r of item.recipes) добавляет в sizes[r.size] элемент { ingredientId, ingredientName, unit, amount }. Клиент получает, например, капучино с sizes.M = [{ кофе 15 гр }, { молоко 150 мл }] и sizes.XL = [{ кофе 30 гр }, { молоко 300 мл }]. Ошибки Prisma перехватываются и возвращаются как res.status(500).json({ error: err.message }).',
  },

  { type: 'h2', text: '2.3. Эндпоинт GET /api/ingredients' },
  {
    type: 'text',
    text: 'Эндпоинт выполняет prisma.ingredient.findMany({ orderBy: { id: \'asc\' } }). Ответ — JSON-массив [{ id, name, quantity, unit }, ...]. Сортировка по id обеспечивает стабильный порядок в UI и Postman. Данный ресурс read-only; изменение quantity происходит только через POST /api/orders (decrement) или внешнее пополнение склада, которое в прототипе выполняется через seed или прямой SQL.',
  },

  { type: 'h2', text: '2.4. Эндпоинт GET /api/orders' },
  {
    type: 'text',
    text: 'const where = req.query.status ? { status: req.query.status } : {} — динамическое построение фильтра Prisma. Для баристa вызывается /api/orders?status=PENDING. findMany с orderBy: { createdAt: \'desc\' } отдаёт новые заказы первыми. Поле items Prisma десериализует из jsonb в JavaScript-массив автоматически.',
  },

  { type: 'h2', text: '2.5. Эндпоинт POST /api/orders — валидация и транзакция' },
  {
    type: 'text',
    text: 'Тело запроса парсится express.json(). Первая проверка: items — непустой массив, иначе HTTP 400 «Передайте массив items». Основная логика в prisma.$transaction(async (tx) => { ... }) — интерактивная транзакция Prisma, внутри которой все запросы идут через объект tx, а не prisma.',
  },
  {
    type: 'text',
    text: 'Фаза проверки (первый цикл for (const item of items)): шаг A — tx.menuItem.findUnique({ where: { id: item.menuItemId } }); отсутствие → Error с status 400. Шаг B — tx.recipeIngredient.findMany({ where: { menuItemId, size: item.size }, include: { ingredient: true } }); recipes.length === 0 → «Рецепт не найден». Шаг C — для каждого recipe: const needed = recipe.amount * item.quantity; if (recipe.ingredient.quantity < needed) throw с детализацией имени, needed и фактического остатка. Шаг D — total += menuItem.price * item.quantity.',
  },
  {
    type: 'text',
    text: 'Математическая модель потребности: для заказа из n позиций и техкарты с m ингредиентами на позицию, суммарная потребность в ингредиенте k равна Σ(amount_k × quantity) по всем позициям, где amount_k берётся из RecipeIngredient для пары (menuItemId, size). Если один ингredient используется в двух позициях одного заказа, проверки выполняются последовательно в одной транзакции — важно, что обе позиции учтены до декремента.',
  },
  {
    type: 'text',
    text: 'Фаза списания (второй цикл): повторный findMany рецептов без include (достаточно ingredientId и amount). tx.ingredient.update({ where: { id: recipe.ingredientId }, data: { quantity: { decrement: recipe.amount * item.quantity } } }). Prisma транслирует decrement в UPDATE "Ingredient" SET quantity = quantity - $1 WHERE id = $2 — атомарная операция на уровне строки СУБД.',
  },
  {
    type: 'text',
    text: 'Фаза создания заказа: tx.order.create({ data: { total, status: \'PENDING\', items } }). items сохраняется как JSON; PostgreSQL хранит в jsonb. Успех — res.status(201).json(order). catch: err.status || 500.',
  },
  {
    type: 'text',
    text: 'ACID в PostgreSQL: Atomicity — при throw внутри $transaction Prisma выполняет ROLLBACK; Consistency — FK и CHECK (если заданы) сохраняются; Isolation — по умолчанию READ COMMITTED: параллельные транзакции не видят незакоммиченный decrement; Durability — после COMMIT данные на диске (WAL). Race condition: два одновременных заказа на последние 150 мл молока — одна транзакция успеет commit, вторая получит quantity < needed и вернёт 400 без отрицательного остатка, если проверка и decrement в одной транзакции.',
  },

  { type: 'h2', text: '2.6. Эндпоинт PATCH /api/orders/:id/complete' },
  {
    type: 'text',
    text: 'const id = Number(req.params.id). findUnique — 404 если null. update status COMPLETED. Списание не повторяется: ингредиенты уже уменьшены при POST. Семантика статусов разделяет «принят и оплачен» (PENDING) и «выдан клиенту» (COMPLETED) для очереди баристa.',
  },

  { type: 'h2', text: '2.7. Эндпоинт GET /api/analytics/forecast' },
  {
    type: 'text',
    text: 'orders = await prisma.order.findMany({ orderBy: { createdAt: \'asc\' } }). Пустой массив → { message, forecast: [] }. Инициализируется объект consumed = {} — хэш-таблица (plain object) в оперативной памяти Node.js, ключ — ingredientId.',
  },
  {
    type: 'text',
    text: 'Двойной цикл: for (order of orders) for (item of order.items). Для каждой позиции findMany RecipeIngredient с include ingredient. used = recipe.amount * item.quantity. Если consumed[recipe.ingredientId] отсутствует — создаётся запись { ingredientId, name, unit, total: 0 }; total += used.',
  },
  {
    type: 'text',
    text: 'Расчёт days: firstDay = new Date(orders[0].createdAt); firstDay.setHours(0,0,0,0) — обнуление времени до полуночи UTC/local. Аналогично lastDay. days = Math.max(1, Math.round((lastDay - firstDay) / 86400000) + 1). Выражение (lastDay - firstDay) в JavaScript возвращает разницу в миллисекундах; 86400000 = 24 × 60 × 60 × 1000 — число миллисекунд в сутках. +1 включает оба крайних дня; max(1, ...) защищает от деления на ноль при одном заказе.',
  },
  {
    type: 'text',
    text: 'avgPerDay = total / days; forecast = avgPerDay × 1.2. Коэффициент 1.2 (20 % запас) выбран как простая модель «повышенного спроса»: выходные, акции или погожий день могут увеличить продажи относительно среднего; 20 % — эвристика, приемлемая для учебного прототипа без ML. Ответ: { ordersCount, days, coefficient: 1.2, forecast: [{ name, unit, totalConsumed, avgPerDay, forecast }, ...] }.',
  },

  { type: 'h2', text: '2.8. Логика веб-интерфейса (public/index.html)' },
  {
    type: 'text',
    text: 'Функция api(url, options) оборачивает fetch: Content-Type application/json, парсит res.json(), при !res.ok бросает Error(data.error). loadMenu() заполняет #menu-list; addToCart() мутирует cart; submitOrder() POST и refreshAll(). loadPendingOrders() — GET ?status=PENDING; completeOrder(id) — PATCH. loadIngredients и loadForecast — параллельно через Promise.all. Ошибки заказа показываются в #order-msg красным текстом.',
  },

  { type: 'h2', text: '2.9. Проектирование базы данных' },
  {
    type: 'text',
    text: 'Концептуальная модель включает сущности «Ингредиент», «Позиция меню», «Строка техкарты», «Заказ» и связи «меню имеет many техкарт», «ингredient входит в many техкарт», «заказ содержит позиции (JSON)». Логическая модель — таблицы Ingredient, MenuItem, RecipeIngredient, Order с FK и UNIQUE. Физическая модель — реализация в PostgreSQL через Prisma migrate: integer serial PK, double precision для Float, jsonb для Json, timestamp for DateTime.',
  },
  {
    type: 'text',
    text: 'Составной индекс @@unique([menuItemId, size, ingredientId]) создаёт уникальное ограничение в БД. Попытка insert дубликата завершится ошибкой P2002 Prisma. onDelete: Cascade на FK RecipeIngredient → MenuItem и → Ingredient означает ON DELETE CASCADE в SQL: DELETE FROM MenuItem WHERE id=1 удалит все RecipeIngredient с menuItemId=1.',
  },

  { type: 'marker', text: '[МЕСТО ДЛЯ ER-ДИАГРАММЫ]' },

  { type: 'h2', text: '2.10. Физическая схема таблиц' },
  { type: 'table', title: 'Описание полей реляционной базы данных CoffeeSklad' },
];

module.exports.DOCKER = DOCKER;
