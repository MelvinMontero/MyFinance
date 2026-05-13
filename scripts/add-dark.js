// Script único para añadir `dark:` variants a classNames de Tailwind en bulk.
// Excluye via lookbehind las clases ya prefijadas (dark:, active:, hover:, etc).
// Usa word boundary (\b) con escape de backslash correcto.

const fs = require('fs');

const PREFIX_SKIP =
  '(?<!dark:|active:|hover:|focus:|disabled:|group-hover:|peer-hover:|enabled:|checked:|sm:|md:|lg:)';

function rule(cls, dark) {
  return [
    new RegExp(PREFIX_SKIP + '\\b' + cls + '\\b', 'g'),
    cls + ' dark:' + dark,
  ];
}

const replacements = [
  rule('bg-white', 'bg-gray-900'),
  rule('bg-gray-50', 'bg-gray-950'),
  rule('bg-gray-100', 'bg-gray-800'),
  rule('bg-gray-200', 'bg-gray-700'),

  rule('bg-emerald-50', 'bg-emerald-950'),
  rule('bg-emerald-100', 'bg-emerald-900'),
  rule('bg-amber-50', 'bg-amber-950'),
  rule('bg-amber-100', 'bg-amber-900'),
  rule('bg-blue-50', 'bg-blue-950'),
  rule('bg-blue-100', 'bg-blue-900'),
  rule('bg-red-50', 'bg-red-950'),
  rule('bg-red-100', 'bg-red-900'),

  rule('border-gray-100', 'border-gray-800'),
  rule('border-gray-200', 'border-gray-700'),
  rule('border-gray-300', 'border-gray-600'),
  rule('border-emerald-200', 'border-emerald-800'),
  rule('border-amber-200', 'border-amber-800'),
  rule('border-blue-200', 'border-blue-800'),
  rule('border-red-200', 'border-red-800'),

  rule('text-gray-900', 'text-gray-100'),
  rule('text-gray-800', 'text-gray-200'),
  rule('text-gray-700', 'text-gray-300'),
  rule('text-gray-600', 'text-gray-400'),
  rule('text-gray-500', 'text-gray-400'),
  rule('text-gray-400', 'text-gray-500'),

  rule('text-emerald-900', 'text-emerald-100'),
  rule('text-emerald-800', 'text-emerald-200'),
  rule('text-emerald-700', 'text-emerald-300'),
  rule('text-amber-900', 'text-amber-100'),
  rule('text-amber-800', 'text-amber-200'),
  rule('text-amber-700', 'text-amber-300'),
  rule('text-blue-900', 'text-blue-100'),
  rule('text-blue-800', 'text-blue-200'),
  rule('text-blue-700', 'text-blue-300'),
  rule('text-red-900', 'text-red-100'),
  rule('text-red-800', 'text-red-200'),
  rule('text-red-700', 'text-red-300'),
  rule('text-red-600', 'text-red-400'),
];

const files = [
  'src/app/(tabs)/index.tsx',
  'src/app/(tabs)/incomes.tsx',
  'src/app/(tabs)/fixed-expenses.tsx',
  'src/app/(tabs)/extras.tsx',
  'src/app/(tabs)/reports.tsx',
  'src/app/income/new.tsx',
  'src/app/income/[id].tsx',
  'src/app/fixed-expense/new.tsx',
  'src/app/fixed-expense/[id].tsx',
  'src/app/variable-expense/new.tsx',
  'src/app/variable-expense/[id].tsx',
  'src/app/onboarding.tsx',
  'src/features/incomes/IncomeForm.tsx',
  'src/features/incomes/IncomeCard.tsx',
  'src/features/incomes/OccurrencesList.tsx',
  'src/features/incomes/OverrideAmountModal.tsx',
  'src/features/fixed-expenses/FixedExpenseForm.tsx',
  'src/features/fixed-expenses/FixedExpenseCard.tsx',
  'src/features/variable-expenses/VariableExpenseForm.tsx',
  'src/features/variable-expenses/VariableExpenseCard.tsx',
  'src/features/budgets/BucketCard.tsx',
];

let total = 0;
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');
  const before = content;
  let n = 0;
  for (const [pattern, replacement] of replacements) {
    const matches = content.match(pattern);
    if (matches) n += matches.length;
    content = content.replace(pattern, replacement);
  }
  if (content !== before) {
    fs.writeFileSync(f, content);
    console.log('✓', f, '(' + n + ' changes)');
    total += n;
  } else {
    console.log('  ', f, '(no changes)');
  }
}
console.log('\nTotal: ' + total + ' dark: variants added.');
