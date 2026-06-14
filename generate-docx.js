const fs = require('fs');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  LineRuleType,
  VerticalAlign,
} = require('docx');
const S = require('./generate-docx-sections');

const FONT = 'Times New Roman';
const SIZE_BODY = 28;
const SIZE_H1 = 32;
const LINE = { line: 360, lineRule: LineRuleType.AUTO };
const INDENT_BODY = { firstLine: 720 };
const INDENT_H2 = { firstLine: 720 };
const MARGINS = {
  left: Math.round((25 / 25.4) * 1440),
  right: Math.round((15 / 25.4) * 1440),
  top: Math.round((20 / 25.4) * 1440),
  bottom: Math.round((20 / 25.4) * 1440),
};

const run = (text, o = {}) =>
  new TextRun({ text, font: FONT, size: o.size || SIZE_BODY, bold: !!o.bold, italics: !!o.italics });

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 240, ...LINE },
    alignment: AlignmentType.CENTER,
    children: [run(text.toUpperCase(), { size: SIZE_H1, bold: true })],
  });

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160, ...LINE },
    alignment: AlignmentType.LEFT,
    indent: INDENT_H2,
    children: [run(text, { bold: true })],
  });

const p = (text) =>
  new Paragraph({
    spacing: { after: 120, ...LINE },
    alignment: AlignmentType.JUSTIFY,
    indent: INDENT_BODY,
    children: [run(text)],
  });

const marker = (text) =>
  new Paragraph({
    spacing: { before: 160, after: 160, ...LINE },
    alignment: AlignmentType.CENTER,
    indent: {},
    children: [run(text, { bold: true, italics: true })],
  });

const ps = (arr) => arr.filter(Boolean).map((t) => p(t));

const codeLines = (lines) =>
  lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 0, ...LINE },
        alignment: AlignmentType.LEFT,
        indent: { left: 720 },
        children: [run(line)],
      })
  );

const cell = (text, bold = false) =>
  new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({ spacing: LINE, alignment: AlignmentType.LEFT, children: [run(text, { bold })] }),
    ],
  });

function makeTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((r, i) => new TableRow({ children: r.map((c) => cell(c, i === 0)) })),
  });
}

const dbTable = () => {
  const header = ['Таблица', 'Поле', 'Тип', 'Ключ', 'Nullable', 'Описание'];
  const rows = [
    header,
    ['Ingredient', 'id', 'Int', 'PK, autoincrement', 'NOT NULL', 'Сурrogate primary key склада'],
    ['Ingredient', 'name', 'String', '—', 'NOT NULL', 'Наименование сырья («Молоко», «Кофе в зернах»)'],
    ['Ingredient', 'quantity', 'Float', '—', 'NOT NULL', 'Остаток; атомарно уменьшается через decrement в POST /api/orders'],
    ['Ingredient', 'unit', 'String', '—', 'NOT NULL', 'Единица измерения: гр, мл'],
    ['MenuItem', 'id', 'Int', 'PK, autoincrement', 'NOT NULL', 'Идентификатор позиции; передаётся как menuItemId в заказе'],
    ['MenuItem', 'name', 'String', '—', 'NOT NULL', 'Название напитка в меню'],
    ['MenuItem', 'price', 'Float', '—', 'NOT NULL', 'Цена порции; участвует в расчёте поля total заказа'],
    ['RecipeIngredient', 'id', 'Int', 'PK, autoincrement', 'NOT NULL', 'Идентификатор строки технологической карты'],
    ['RecipeIngredient', 'menuItemId', 'Int', 'FK → MenuItem.id', 'NOT NULL', 'Ссылка на напиток; onDelete: Cascade'],
    ['RecipeIngredient', 'size', 'String', 'UNIQUE (menuItemId, size, ingredientId)', 'NOT NULL', 'Размер порции: M, L, XL'],
    ['RecipeIngredient', 'ingredientId', 'Int', 'FK → Ingredient.id', 'NOT NULL', 'Ссылка на ингредиент; onDelete: Cascade'],
    ['RecipeIngredient', 'amount', 'Float', '—', 'NOT NULL', 'Норма расхода на одну порцию; умножается на quantity'],
    ['Order', 'id', 'Int', 'PK, autoincrement', 'NOT NULL', 'Номер заказа для PATCH /api/orders/:id/complete'],
    ['Order', 'createdAt', 'DateTime', '—', 'NOT NULL', 'Время создания; @default(now()); нужно для расчёта days в analytics'],
    ['Order', 'total', 'Float', '—', 'NOT NULL', 'Сумма заказа: Σ(price × quantity)'],
    ['Order', 'status', 'String', '—', 'NOT NULL', 'PENDING по умолчанию; COMPLETED после бариста'],
    ['Order', 'items', 'Json', '—', 'NOT NULL', 'Массив [{ menuItemId, size, quantity }]; в PostgreSQL — jsonb'],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((r, i) => new TableRow({ children: r.map((c) => cell(c, i === 0)) })),
  });
};

function flattenBlocks(blocks) {
  return blocks.flatMap((block) => {
    if (block.type === 'h2') return [h2(block.text)];
    if (block.type === 'marker') return [marker(block.text)];
    if (block.type === 'table') return [h2(block.title || ''), dbTable()];
    if (block.type === 'traceTable') return [h2(block.title || ''), makeTable(block.rows)];
    if (block.type === 'code') return [h2(block.title), ...codeLines(block.lines)];
    if (block.type === 'text') return ps([block.text]);
    if (block.text) return ps([block.text]);
    return [];
  });
}

const children = [
  h1('Пояснительная записка'),
  p('к курсовому проекту по дисциплине «Технологии программирования»'),
  p('на тему: «Разработка информационной системы управления меню и запасами кофейни CoffeeSklad»'),
  p(''),
  h1('Введение'),
  ...flattenBlocks(S.intro),
  h1('Раздел 1. Описание предметной области'),
  ...flattenBlocks(S.section1),
  h1('Раздел 2. Разработка проекта системы'),
  ...flattenBlocks(S.section2),
  h1('Раздел 3. Реализация прототипа'),
  ...flattenBlocks(S.section3),
  h1('Заключение'),
  ...flattenBlocks(S.conclusion),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: SIZE_BODY } } },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: FONT, size: SIZE_H1, bold: true },
        paragraph: { spacing: LINE, alignment: AlignmentType.CENTER },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: FONT, size: SIZE_BODY, bold: true },
        paragraph: { spacing: LINE, alignment: AlignmentType.LEFT, indent: INDENT_H2 },
      },
    ],
  },
  sections: [{ properties: { page: { margin: MARGINS } }, children }],
});

const OUTPUT = 'Пояснительная_записка_CoffeeSklad_MAX.docx';

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log(`Создан: ${OUTPUT} (${(buf.length / 1024).toFixed(1)} КБ)`);
});
