/** Дополнительные абзацы раздела 2 для объёма 25–30 стр. */
module.exports = [
  {
    type: 'text',
    text: 'Протокол HTTP 1.1 используется в идempotent-режиме для GET-запросов: повторный вызов /api/menu не изменяет состояние сервера. POST /api/orders не идемпотентен — каждый вызов создаёт новый Order и списывает склад; клиент не должен автоматически повторять POST при таймауте без понимания, был ли заказ создан. PATCH /complete идемпотентен в практическом смысле: повторное завершение уже COMPLETED заказа снова установит COMPLETED без побочных эффектов.',
  },
  {
    type: 'text',
    text: 'Формат JSON выбран за универсальность: Postman, браузер, мобильное приложение и будущая касса могут использовать один контракт. Структура items [{ menuItemId: number, size: string, quantity: number }] минимальна и достаточна для однозначного восстановления рецепта через RecipeIngredient. Расширение (комментарий клиента, скидка) потребует миграции схемы или дополнительных полей в JSON без ломки существующих клиентов, если новые ключи optional.',
  },
  {
    type: 'text',
    text: 'Экземпляр PrismaClient создаётся один раз на уровне модуля server.js: const prisma = new PrismaClient(). При старте приложения Prisma открывает пул соединений к PostgreSQL (параметр connection_limit в URL при необходимости). Каждый await prisma.* заимствует соединение из пула и возвращает после завершения запроса. При npm start в учебном режиме одного инстанса этого достаточно; при горизontal scaling потребовался бы PgBouncer.',
  },
  {
    type: 'text',
    text: 'Обработка ошибок в GET-эндпоинтах унифицирована: try/catch оборачивает await, catch отдаёт 500 и message. Для POST бизнес-ошибки создаются через throw Object.assign(new Error("..."), { status: 400 }), что позволяет в catch различать err.status. Такой паттерн избегает вложенных if/res.status внутри транзакции и централизует ответ клиенту.',
  },
  {
    type: 'text',
    text: 'Расчёт total в POST не обращается к клиенту за суммой — сервер пересчитывает price × quantity по данным MenuItem из БД. Это защита от манипуляции: злоумышленник не может отправить total: 1 при заказе десяти капучино. Принцип «не доверяй клиенту в финансовых полях» — базовый для любого серверного API.',
  },
  {
    type: 'text',
    text: 'При проверке остатков сравнение recipe.ingredient.quantity < needed использует значение quantity, прочитанное в той же транзакции до любого decrement. PostgreSQL при READ COMMITTED видит снимок строки на момент начала statement; последовательные update в одной транзакции видят собственные изменения. Поэтому две позиции в одном заказе, обе требующие молока, корректно суммируются: если после первой проверки в цикле theoretical остаток не пересчитывается в переменной, важно, что decrement выполняется только после полного первого прохода — в текущей реализации проверяется полная потребность каждой позиции против текущего snapshot quantity; при двух позициях с молоком в одном заказе обе проверки используют один и тот же начальный quantity, что может theoretically пропустить суммарный дефicit. Для курсового прототипа типичные заказы малы; улучшение — агрегировать needed по ingredientId перед проверкой.',
  },
  {
    type: 'text',
    text: 'Метод decrement в Prisma Client генерирует параметризованный SQL, что предотвращает SQL-injection. amount * item.quantity вычисляется в JavaScript как число с плавающей точкой; для микролитровых норм возможны ошибки округления 0.0000001 — в кофейном контексте несущественно.',
  },
  {
    type: 'text',
    text: 'Поле Order.items сохраняет исходный массив из тела запроса без denormalization имён напитков. Analytics при каждом расчёте join-ит menuItemId и size к RecipeIngredient — trade-off «экономия места vs скорость отчёта». Для объёма курсовой БД join дешёв; при миллионах заказов потребовался бы денormalized snapshot состава на момент продажи.',
  },
  {
    type: 'text',
    text: 'GET /api/analytics/forecast выполняет N+1 запросов: для каждой позиции каждого заказа отдельный findMany RecipeIngredient. Для демонстрации с десятками заказов приемлемо; оптимизация — один findMany всех RecipeIngredient с фильтром menuItemId in (...) и кэш в Map по ключу `${menuItemId}-${size}`.',
  },
  {
    type: 'text',
    text: 'Объект consumed в памяти Node.js — обычный {} с ключами-ingredientId. V8 оптимизирует hidden class для таких объектов; итерация Object.values(consumed) формирует массив forecast. Garbage collector освобождает consumed после завершения HTTP-запроса — stateless analytics без побочных эффектов.',
  },
  {
    type: 'text',
    text: 'Коэффициент 1.2 можно интерпретировать как safety stock в терминах управления запасами: если avgPerDay отражает средний расход, forecast на «завтра с запасом» = avgPerDay × (1 + 0.2). Альтернативы: фиксированные +500 мл молока или сезонные коэффициенты по дню недели — оставлены для future work.',
  },
  {
    type: 'text',
    text: 'Функция setHours(0,0,0,0) на Date в JavaScript мутирует объект и обнуляет время по локальному timezone сервера. Если сервер в UTC, а кофейня в UTC+3, границы «дня» могут смещаться — для production следует использовать timezone-aware библиотеку (date-fns-tz) или хранить businessDate отдельно.',
  },
  {
    type: 'text',
    text: 'В public/index.html переменная menu кэширует ответ GET /api/menu для отображения имён в loadPendingOrders без повторного запроса. refreshAll() последовательно await loadMenu(), затем Promise.all для pending, ingredients, forecast — menu всегда актуально перед рендером очереди.',
  },
  {
    type: 'text',
    text: 'pickSize(itemId, size) обновляет selectedSize[itemId] и вызывает loadMenu() для перерисовки кнопок размеров — простейший reactive pattern без Virtual DOM. addToCart объединяет одинаковые menuItemId+size increment quantity — соответствует одной строке в POST items.',
  },
  {
    type: 'text',
    text: 'Tailwind CDN генерирует utility-классы на лету; для production рекомендуется build-step, но для курсовой CDN снижает время настройки. Цветовая схема coffee-* задана в tailwind.config inline в index.html.',
  },
  {
    type: 'text',
    text: 'express.static отдаёт файлы с MIME text/html для index.html. Браузер кэширует статику; при разработке Ctrl+F5 обновляет. API-ответы не кэшируются по умолчанию — актуальность остатков критична.',
  },
  {
    type: 'text',
    text: 'Модель Ingredient не содержит поля minThreshold — порог «мало молока» в UI реализован эвристикой quantity < 500 в loadIngredients(). Расширение схемы: minQuantity Float optional для настраиваемых алертов управляющим.',
  },
  {
    type: 'text',
    text: 'RecipeIngredient.size хранится как String, не enum Prisma — допускает добавление размера «S» без миграции enum type в PostgreSQL. Валидация допустимых size на уровне приложения при POST — если рецепта нет, 400.',
  },
  {
    type: 'text',
    text: 'Связь MenuItem 1—N RecipeIngredient  N—1 Ingredient образует типичную схему «рецепт как BOM (bill of materials)» из ERP. Количество amount — норма на output unit (одну порцию), не на batch.',
  },
  {
    type: 'text',
    text: 'Order.status String вместо enum — упрощение прототипа; опечатка "PENDNG" не отловится compile-time. Prisma enum OrderStatus { PENDING COMPLETED } улучшит типобезопасность в v2.',
  },
  {
    type: 'text',
    text: 'Миграция Prisma создаёт таблицы с именами по умолчанию совпадающими с именами моделей (PascalCase → "MenuItem" в PostgreSQL с кавычками). FK имена генерируются Prisma автоматически.',
  },
  {
    type: 'text',
    text: 'При docker compose up PostgreSQL инициализирует data directory в volume; первое подключение Prisma migrate может занять секунды. sleep 3 в инструкции README покрывает cold start.',
  },
  {
    type: 'text',
    text: 'Листенер app.listen(PORT) регистрирует callback без async — сервер готов принимать соединения после синхронной инициализации маршрутов. Prisma подключается lazy при первом запросе.',
  },
  {
    type: 'text',
    text: 'Сравнение архитектуры CoffeeSklad с микросервисами: выделение «Inventory Service» и «Order Service» потребовало бы распределённых транзакций (Saga) для POST /api/orders — избыточно для одной точки. Монolith + модульный server.js оправдан.',
  },
  {
    type: 'text',
    text: 'Безопасность прототипа: нет auth; любой клиент localhost может PATCH complete. Для production — API key или session для роли barista/manager. CORS не настроен — same-origin SPA достаточно.',
  },
  {
    type: 'text',
    text: 'Логирование ограничено console.log при старте; structured logging (pino) добавил бы traceId per request для отладки транзакций в production.',
  },
  {
    type: 'text',
    text: 'Тестовые данные seed: капучино M 15 гр / 150 мл согласуются с industry-like пропорциями; XL удваивает относительно M по кофе (30) и молоку (300) — демонстрирует size-логику для комиссии.',
  },
  {
    type: 'text',
    text: 'Латте M включает сироп 20 мл — третий ingredient в RecipeIngredient; POST корректно декрементирует три строки склада при заказе латте.',
  },
  {
    type: 'text',
    text: 'deleteMany порядок в seed: RecipeIngredient перед MenuItem, Order перед items dependency — Order не FK на MenuItem напрямую, но очистка Order перед MenuItem логична для чистого demo.',
  },
  {
    type: 'text',
    text: 'Итог проектирования API: шесть маршрутов покрывают CRUD-подмножество для меню (R), склада (R), заказов (C,R,U partial), analytics (R). Полноценный CRUD MenuItem/Ingredient в прототипе не реализован — управление через seed и Prisma Studio.',
  },
];
