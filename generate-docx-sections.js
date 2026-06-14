/**
 * Агрегатор контента пояснительной записки CoffeeSklad.
 * Структура выровнена под методичку «Содержание ТП 2026».
 */
const intro = require('./generate-docx-content');
const extra = require('./docx-content/extra-volume');
const section1raw = require('./docx-content/section1');
const section2base = require('./docx-content/section2');
const section2extra = require('./docx-content/section2-extra');
const section3raw = require('./docx-content/section3');
const conclusion = require('./docx-content/conclusion');
const meth = require('./docx-content/methodology-alignment');

// ─── Раздел 1: порядок по методичке ─────────────────────────────────────────
const idx11 = section1raw.findIndex((b) => b.type === 'h2' && b.text.startsWith('1.1.'));
const idx12 = section1raw.findIndex((b) => b.type === 'h2' && b.text.startsWith('1.2. Проблемы'));
const idx13 = section1raw.findIndex((b) => b.type === 'h2' && b.text.startsWith('1.3.'));
const idx14 = section1raw.findIndex((b) => b.type === 'h2' && b.text.startsWith('1.4.'));

const block11 = section1raw.slice(idx11, idx12);
const blockProblems = section1raw.slice(idx12, idx13).filter((b) => b.type !== 'marker');
const blockRequirements = section1raw.slice(idx14);

const section1 = [
  ...block11,
  ...meth.section1Prefix,
  ...meth.section1AsIsModel,
  { type: 'h2', text: '1.4. Формулировка проблем, существующих в предметной области' },
  ...blockProblems.slice(1),
  ...meth.section1ToBeModel,
  { type: 'h2', text: '1.6. Требования к ИТ-решению (3 вида × 5 требований)' },
  {
    type: 'text',
    text: 'Ниже сформулированы пятнадцать требований трёх видов: функциональные (FR) — что система должна делать для пользователя; технические (TR) — как это реализовано архитектурно; к данным (DR) — ограничения модели PostgreSQL/Prisma. Каждое требование опирается на целевой процесс TO-BE и устраняет конкретную проблему AS-IS.',
  },
  ...blockRequirements.slice(1),
  ...meth.section1Traceability,
];

// ─── Раздел 2: диаграммы по методичке + детальный текст ─────────────────────
const erIdx = section2base.findIndex((b) => b.type === 'marker' && b.text.includes('ER'));
const section2body =
  erIdx >= 0
    ? [...section2base.slice(0, erIdx), ...section2extra, ...section2base.slice(erIdx)]
    : [...section2base, ...section2extra];

const section2 = [...meth.section2Diagrams, ...section2body];

// ─── Раздел 3: методичка + существующий контент ─────────────────────────────
const section3 = [...meth.section3Methodology, ...section3raw, ...extra.section3Extra];

module.exports = {
  intro: [...intro, ...extra.introExtra],
  section1: [...section1, ...extra.section1Extra],
  section2,
  section3,
  conclusion: [...conclusion, ...extra.conclusionExtra],
};
