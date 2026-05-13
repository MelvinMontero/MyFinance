// Tipos TypeScript que reflejan el schema SQLite.
// SQLite no tiene booleanos: usamos 0 | 1 para flags.

export type CategoryType = 'income' | 'fixed_expense' | 'variable_expense';
export type IncomeFrequency = 'one_time' | 'biweekly' | 'monthly';
export type ThemePreference = 'system' | 'light' | 'dark';
export type SqliteBoolean = 0 | 1;

export interface Settings {
  id: 1;
  savings_percent: number;
  currency: string;
  theme: ThemePreference;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  is_archived: SqliteBoolean;
  created_at: string;
}

export interface Income {
  id: string;
  amount_cents: number;
  source: string | null;
  frequency: IncomeFrequency;
  start_date: string;
  end_date: string | null;
  is_active: SqliteBoolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncomeOccurrence {
  id: string;
  income_id: string;
  amount_cents: number;
  occurred_at: string;
  is_confirmed: SqliteBoolean;
  created_at: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount_cents: number;
  category_id: string;
  due_day: number;
  is_active: SqliteBoolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedExpensePayment {
  id: string;
  fixed_expense_id: string;
  amount_cents: number;
  paid_at: string;
  period: string; // "YYYY-MM"
  created_at: string;
}

export interface VariableExpense {
  id: string;
  amount_cents: number;
  category_id: string;
  occurred_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlySnapshot {
  period: string; // "YYYY-MM"
  total_income_cents: number;
  total_fixed_cents: number;
  total_variable_cents: number;
  savings_target_cents: number;
  free_money_cents: number;
  updated_at: string;
}
