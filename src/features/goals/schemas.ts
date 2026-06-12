// src/features/goals/schemas.ts
import { z } from 'zod';

import { isSupportedCurrency } from '@/shared/utils/currency';

export const goalFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Poné un nombre'),
    target_amount_cents: z.number().int().positive('El objetivo debe ser mayor a 0'),
    initial_amount_cents: z.number().int().min(0, 'No puede ser negativo'),
    currency: z.string().refine(isSupportedCurrency, 'Moneda no soportada'),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    funding_source: z.enum(['off_top', 'from_savings']),
    category_id: z.string().nullable().optional(),
    note: z.string().trim().nullable().optional(),
  })
  .refine((v) => v.initial_amount_cents <= v.target_amount_cents, {
    message: 'La prima no puede superar el objetivo',
    path: ['initial_amount_cents'],
  });

export type GoalFormValues = z.infer<typeof goalFormSchema>;

export const manualContributionSchema = z.object({
  amount_cents: z.number().int().positive('El aporte debe ser mayor a 0'),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  note: z.string().trim().nullable().optional(),
});

export type ManualContributionValues = z.infer<typeof manualContributionSchema>;
