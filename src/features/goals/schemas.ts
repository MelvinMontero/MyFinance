import { z } from 'zod';

import { SUPPORTED_CURRENCIES } from '@/shared/utils/currency';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const goalFormSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
    amount: z
      .number({ message: 'El monto objetivo es requerido' })
      .positive('El monto debe ser mayor que cero')
      .finite(),
    currency: z.enum(SUPPORTED_CURRENCIES, { message: 'Moneda inválida' }),
    start_date: z.string().regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)'),
    deadline: z.string().regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)'),
    priority: z.enum(['high', 'medium', 'low'], { message: 'Prioridad inválida' }),
  })
  .refine((data) => data.deadline >= data.start_date, {
    message: 'La fecha límite no puede ser anterior a la fecha de inicio',
    path: ['deadline'],
  });

export type GoalFormValues = z.infer<typeof goalFormSchema>;
