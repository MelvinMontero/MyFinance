import { z } from 'zod';

import { SUPPORTED_CURRENCIES } from '@/shared/utils/currency';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const fixedExpenseFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'El nombre es requerido')
      .max(100, 'Máximo 100 caracteres'),
    amount: z
      .number({ message: 'El monto es requerido' })
      .positive('El monto debe ser mayor que cero')
      .finite(),
    currency: z.enum(SUPPORTED_CURRENCIES, {
      message: 'Moneda inválida',
    }),
    category_id: z.string().min(1, 'Elegí una categoría'),
    due_day: z
      .number({ message: 'El día de pago es requerido' })
      .int('Debe ser un número entero')
      .min(1, 'Día mínimo 1')
      .max(31, 'Día máximo 31'),
    start_date: z
      .string()
      .regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)'),
    end_date: z
      .string()
      .regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => {
      if (!data.end_date) return true;
      return data.end_date >= data.start_date;
    },
    {
      message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
      path: ['end_date'],
    },
  );

export type FixedExpenseFormValues = z.infer<typeof fixedExpenseFormSchema>;
