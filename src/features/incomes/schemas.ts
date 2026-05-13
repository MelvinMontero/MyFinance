import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const incomeFormSchema = z
  .object({
    /**
     * Monto en CRC con decimales (no centavos). Se convierte a centavos
     * con `toCents` antes de persistir.
     */
    amount: z
      .number({ message: 'El monto es requerido' })
      .positive('El monto debe ser mayor que cero')
      .finite(),
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

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;

export const occurrenceAmountSchema = z.object({
  amount: z
    .number({ message: 'El monto es requerido' })
    .positive('El monto debe ser mayor que cero')
    .finite(),
});

export type OccurrenceAmountValues = z.infer<typeof occurrenceAmountSchema>;
