import type { SQLiteDatabase } from 'expo-sqlite';

import type { CategoryType } from '../types';

interface SeedCategory {
  id: string;
  name: string;
  icon: string; // nombre del icono lucide
  color: string; // hex
  type: CategoryType;
}

// IDs estables tipo slug — fáciles de referenciar en código y migraciones futuras.
const SEED_CATEGORIES: SeedCategory[] = [
  // Ingresos (verde)
  { id: 'cat-income-salary', name: 'Sueldo', icon: 'briefcase', color: '#10b981', type: 'income' },
  { id: 'cat-income-freelance', name: 'Freelance', icon: 'laptop', color: '#10b981', type: 'income' },
  { id: 'cat-income-bonus', name: 'Bono', icon: 'gift', color: '#10b981', type: 'income' },
  { id: 'cat-income-other', name: 'Otros', icon: 'dollar-sign', color: '#10b981', type: 'income' },

  // Gastos fijos (azul)
  { id: 'cat-fixed-housing', name: 'Vivienda', icon: 'home', color: '#3b82f6', type: 'fixed_expense' },
  { id: 'cat-fixed-utilities', name: 'Servicios', icon: 'zap', color: '#3b82f6', type: 'fixed_expense' },
  { id: 'cat-fixed-subscriptions', name: 'Suscripciones', icon: 'tv', color: '#3b82f6', type: 'fixed_expense' },
  { id: 'cat-fixed-transport', name: 'Transporte', icon: 'car', color: '#3b82f6', type: 'fixed_expense' },
  { id: 'cat-fixed-insurance', name: 'Seguros', icon: 'shield', color: '#3b82f6', type: 'fixed_expense' },

  // Gastos variables (ámbar)
  { id: 'cat-var-food', name: 'Comida', icon: 'utensils', color: '#f59e0b', type: 'variable_expense' },
  { id: 'cat-var-coffee', name: 'Café', icon: 'coffee', color: '#f59e0b', type: 'variable_expense' },
  { id: 'cat-var-outings', name: 'Salidas', icon: 'music', color: '#f59e0b', type: 'variable_expense' },
  { id: 'cat-var-shopping', name: 'Compras', icon: 'shopping-bag', color: '#f59e0b', type: 'variable_expense' },
  { id: 'cat-var-health', name: 'Salud', icon: 'heart', color: '#f59e0b', type: 'variable_expense' },
  { id: 'cat-var-other', name: 'Otros', icon: 'more-horizontal', color: '#f59e0b', type: 'variable_expense' },
];

/**
 * Inserta las categorías iniciales si la tabla está vacía.
 * Idempotente: no toca nada si ya hay registros (respeta ediciones del usuario).
 */
export async function seedCategories(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories',
  );
  if ((existing?.count ?? 0) > 0) return;

  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const cat of SEED_CATEGORIES) {
      await db.runAsync(
        `INSERT INTO categories (id, name, icon, color, type, is_archived, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        cat.id,
        cat.name,
        cat.icon,
        cat.color,
        cat.type,
        now,
      );
    }
  });
}
