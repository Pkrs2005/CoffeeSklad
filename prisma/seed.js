const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Очистка перед повторным сидированием
  await prisma.recipeIngredient.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.ingredient.deleteMany();

  const coffee = await prisma.ingredient.create({
    data: { name: 'Кофе в зернах', quantity: 5000, unit: 'гр' },
  });
  const milk = await prisma.ingredient.create({
    data: { name: 'Молоко', quantity: 10000, unit: 'мл' },
  });
  const syrup = await prisma.ingredient.create({
    data: { name: 'Сироп ванильный', quantity: 3000, unit: 'мл' },
  });

  const cappuccino = await prisma.menuItem.create({
    data: { name: 'Капучино', price: 250 },
  });
  const latte = await prisma.menuItem.create({
    data: { name: 'Латте', price: 280 },
  });

  // Капучино M
  await prisma.recipeIngredient.createMany({
    data: [
      { menuItemId: cappuccino.id, size: 'M', ingredientId: coffee.id, amount: 15 },
      { menuItemId: cappuccino.id, size: 'M', ingredientId: milk.id, amount: 150 },
    ],
  });

  // Капучино XL
  await prisma.recipeIngredient.createMany({
    data: [
      { menuItemId: cappuccino.id, size: 'XL', ingredientId: coffee.id, amount: 30 },
      { menuItemId: cappuccino.id, size: 'XL', ingredientId: milk.id, amount: 300 },
    ],
  });

  // Латте M (для разнообразия в тестах)
  await prisma.recipeIngredient.createMany({
    data: [
      { menuItemId: latte.id, size: 'M', ingredientId: coffee.id, amount: 12 },
      { menuItemId: latte.id, size: 'M', ingredientId: milk.id, amount: 200 },
      { menuItemId: latte.id, size: 'M', ingredientId: syrup.id, amount: 20 },
    ],
  });

  console.log('Seed OK: ингредиенты, меню и тех. карты созданы');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
