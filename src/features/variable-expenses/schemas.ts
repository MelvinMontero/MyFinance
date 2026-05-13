import { z } from 'zod';

import { SUPPORTED_CURRENCIES } from '@/shared/utils/currency';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const variableExpenseFormSchema = z.object({
  amount: z
    .number({ message: 'El monto es requerido' })
    .positive('El monto debe ser mayor que cero')
    .finite(),
  currency: z.enum(SUPPORTED_CURRENCIES, {
    message: 'Moneda inválida',
  }),
  category_id: z.string().min(1, 'Elegí una categoría'),
  occurred_at: z
    .string()
    .regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)'),
  note: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
});

export type VariableExpenseFormValues = z.infer<typeof variableExpenseFormSchema>;
