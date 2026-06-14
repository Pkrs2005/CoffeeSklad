const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// --- GET /api/menu — меню с рецептами по размерам ---
app.get('/api/menu', async (_req, res) => {
  try {
    const menu = await prisma.menuItem.findMany({
      include: {
        recipes: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
      },
    });

    // Группируем рецепты по size для удобства клиента
    const result = menu.map((item) => {
      const sizes = {};
      for (const r of item.recipes) {
        if (!sizes[r.size]) sizes[r.size] = [];
        sizes[r.size].push({
          ingredientId: r.ingredientId,
          ingredientName: r.ingredient.name,
          unit: r.ingredient.unit,
          amount: r.amount,
        });
      }
      return { id: item.id, name: item.name, price: item.price, sizes };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/ingredients — остатки на складе ---
app.get('/api/ingredients', async (_req, res) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(ingredients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/orders — оформление заказа с проверкой и списанием склада ---
app.post('/api/orders', async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Передайте массив items: [{ menuItemId, size, quantity }]' });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      let total = 0;

      // 1. Проверяем наличие рецептов и достаточность ингредиентов
      for (const item of items) {
        const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } });
        if (!menuItem) {
          throw Object.assign(new Error(`Позиция меню #${item.menuItemId} не найдена`), { status: 400 });
        }

        const recipes = await tx.recipeIngredient.findMany({
          where: { menuItemId: item.menuItemId, size: item.size },
          include: { ingredient: true },
        });

        if (recipes.length === 0) {
          throw Object.assign(
            new Error(`Рецепт не найден для "${menuItem.name}" размер "${item.size}"`),
            { status: 400 }
          );
        }

        for (const recipe of recipes) {
          const needed = recipe.amount * item.quantity;
          if (recipe.ingredient.quantity < needed) {
            throw Object.assign(
              new Error(
                `Недостаточно "${recipe.ingredient.name}": нужно ${needed} ${recipe.ingredient.unit}, ` +
                  `на складе ${recipe.ingredient.quantity} ${recipe.ingredient.unit}`
              ),
              { status: 400 }
            );
          }
        }

        total += menuItem.price * item.quantity;
      }

      // 2. Списываем ингредиенты
      for (const item of items) {
        const recipes = await tx.recipeIngredient.findMany({
          where: { menuItemId: item.menuItemId, size: item.size },
        });

        for (const recipe of recipes) {
          await tx.ingredient.update({
            where: { id: recipe.ingredientId },
            data: { quantity: { decrement: recipe.amount * item.quantity } },
          });
        }
      }

      // 3. Создаём заказ
      return tx.order.create({
        data: {
          total,
          status: 'PENDING',
          items,
        },
      });
    });

    res.status(201).json(order);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- GET /api/orders — список заказов (фильтр ?status=PENDING) ---
app.get('/api/orders', async (req, res) => {
  try {
    const where = req.query.status ? { status: req.query.status } : {};
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PATCH /api/orders/:id/complete — бариста выдал заказ ---
app.patch('/api/orders/:id/complete', async (req, res) => {
  const id = Number(req.params.id);

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: `Заказ #${id} не найден` });

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/analytics/forecast — прогноз расхода ингредиентов ---
app.get('/api/analytics/forecast', async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({ orderBy: { createdAt: 'asc' } });

    if (orders.length === 0) {
      return res.json({ message: 'Нет заказов для прогноза', forecast: [] });
    }

    // Суммируем потраченные ингредиенты по всем заказам
    const consumed = {}; // ingredientId -> total amount

    for (const order of orders) {
      const items = order.items;
      for (const item of items) {
        const recipes = await prisma.recipeIngredient.findMany({
          where: { menuItemId: item.menuItemId, size: item.size },
          include: { ingredient: true },
        });

        for (const recipe of recipes) {
          const used = recipe.amount * item.quantity;
          if (!consumed[recipe.ingredientId]) {
            consumed[recipe.ingredientId] = {
              ingredientId: recipe.ingredientId,
              name: recipe.ingredient.name,
              unit: recipe.ingredient.unit,
              total: 0,
            };
          }
          consumed[recipe.ingredientId].total += used;
        }
      }
    }

    // Среднее за день: делим на кол-во дней между первым и последним заказом
    const firstDay = new Date(orders[0].createdAt);
    firstDay.setHours(0, 0, 0, 0);
    const lastDay = new Date(orders[orders.length - 1].createdAt);
    lastDay.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((lastDay - firstDay) / 86400000) + 1);

    const forecast = Object.values(consumed).map((ing) => ({
      ingredientId: ing.ingredientId,
      name: ing.name,
      unit: ing.unit,
      totalConsumed: ing.total,
      ordersCount: orders.length,
      days,
      avgPerDay: +(ing.total / days).toFixed(2),
      forecast: +((ing.total / days) * 1.2).toFixed(2), // +20% на повышенный спрос
    }));

    res.json({ ordersCount: orders.length, days, coefficient: 1.2, forecast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`CoffeeSklad API: http://localhost:${PORT}`);
});
