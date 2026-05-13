import { getDb } from '@/shared/db';
import type { Category, CategoryType } from '@/shared/db/types';

export async function listCategories(
  opts: { type?: CategoryType; includeArchived?: boolean } = {},
): Promise<Category[]> {
  const db = await getDb();
  const conds: string[] = [];
  const args: (string | number)[] = [];

  if (opts.type) {
    conds.push('type = ?');
    args.push(opts.type);
  }
  if (!opts.includeArchived) {
    conds.push('is_archived = 0');
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db.getAllAsync<Category>(
    `SELECT * FROM categories ${where} ORDER BY name ASC`,
    ...args,
  );
}

export async function getCategory(id: string): Promise<Category | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Category>(
    'SELECT * FROM categories WHERE id = ?',
    id,
  );
  return row ?? null;
}
