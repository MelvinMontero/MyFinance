import { z } from 'zod';

import { SUPPORTED_CURRENCIES } from '@/shared/utils/currency';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const incomeFormSchema = z
  .object({
    /**
     * Monto en la moneda elegida, con decimales (no centavos).
     * Se convierte a centavos con `toCents` antes de persistir.
     */
    amount: z
      .number({ message: 'El monto es requerido' })
      .positive('El monto debe ser mayor que cero')
      .finite(),
    currency: z.enum(SUPPORTED_CURRENCIES, {
      message: 'Moneda inválida',
    }),
    source: z
      .string()
      .trim()
      .max(100, 'Máximo 100 caracteres')
      .optional()
      .or(z.literal('')),
    frequency: z.enum(['one_time', 'biweekly', 'monthly'], {
      message: 'Elegí una frecuencia',
    }),
    start_date: z
      .string()
      .regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)'),
    end_date: z
      .string()
      .regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)')
      .optional()
      .or(z.literal('')),
    note: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
    // Días de pago (1–31) para frecuencia quincenal.
    payday_1: z.number().int().min(1, 'Día 1–31').max(31, 'Día 1–31').optional(),
    payday_2: z.number().int().min(1, 'Día 1–31').max(31, 'Día 1–31').optional(),
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
  )
  .refine(
    (data) => data.frequency !== 'biweekly' || (data.payday_1 != null && data.payday_2 != null),
    {
      message: 'Elegí los dos días de pago del mes',
      path: ['payday_1'],
    },
  )
  .refine(
    (data) =>
      data.frequency !== 'biweekly' ||
      data.payday_1 == null ||
      data.payday_2 == null ||
      data.payday_1 !== data.payday_2,
    {
      message: 'Los dos días de pago deben ser distintos',
      path: ['payday_2'],
    },
  );

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;

export const occurrenceAmountSchema = z.object({
  amount: z
    .number({ message: 'El monto es requerido' })
    .positive('El monto debe ser mayor que cero')
    .finite(),
});

export type OccurrenceAmountValues = z.infer<typeof occurrenceAmountSchema>;
