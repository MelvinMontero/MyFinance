// Migraciones versionadas. Para añadir una nueva, empuja un objeto con la
// siguiente versión consecutiva — NUNCA modifiques una ya publicada.
// El migrator usa PRAGMA user_version para saber dónde quedó la DB.

export interface Migration {
  version: number;
  description: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'esquema inicial (settings, categories, incomes, gastos, snapshots)',
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        savings_percent REAL NOT NULL DEFAULT 20.0,
        currency TEXT NOT NULL DEFAULT 'CRC',
        theme TEXT NOT NULL DEFAULT 'system',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income','fixed_expense','variable_expense')),
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS incomes (
        id TEXT PRIMARY KEY,
        amount_cents INTEGER NOT NULL,
        source TEXT,
        frequency TEXT NOT NULL CHECK(frequency IN ('one_time','biweekly','monthly')),
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS income_occurrences (
        id TEXT PRIMARY KEY,
        income_id TEXT NOT NULL REFERENCES incomes(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,
        is_confirmed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fixed_expenses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id),
        due_day INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 31),
        is_active INTEGER NOT NULL DEFAULT 1,
        start_date TEXT NOT NULL,
        end_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fixed_expense_payments (
        id TEXT PRIMARY KEY,
        fixed_expense_id TEXT NOT NULL REFERENCES fixed_expenses(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        paid_at TEXT NOT NULL,
        period TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS variable_expenses (
        id TEXT PRIMARY KEY,
        amount_cents INTEGER NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id),
        occurred_at TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monthly_snapshots (
        period TEXT PRIMARY KEY,
        total_income_cents INTEGER NOT NULL,
        total_fixed_cents INTEGER NOT NULL,
        total_variable_cents INTEGER NOT NULL,
        savings_target_cents INTEGER NOT NULL,
        free_money_cents INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_income_occurrences_date ON income_occurrences(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_variable_expenses_date ON variable_expenses(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_fixed_payments_period ON fixed_expense_payments(period);
      CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active ON fixed_expenses(is_active);
      CREATE INDEX IF NOT EXISTS idx_incomes_active ON incomes(is_active);
    `,
  },
  {
    version: 2,
    description: 'moneda por fila en incomes, fixed_expenses y variable_expenses',
    sql: `
      ALTER TABLE incomes ADD COLUMN currency TEXT NOT NULL DEFAULT 'CRC';
      ALTER TABLE fixed_expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'CRC';
      ALTER TABLE variable_expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'CRC';
    `,
  },
  {
    version: 3,
    description: 'flags de Fase 7: biometría, notificaciones, onboarding completado',
    sql: `
      ALTER TABLE settings ADD COLUMN biometric_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE settings ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE settings ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;
    `,
  },
];
