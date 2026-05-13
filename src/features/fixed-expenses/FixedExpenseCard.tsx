import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, Check, ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '@/features/categories/CategoryIcon';
import type { Category } from '@/shared/db/types';
import { formatCents } from '@/shared/utils/money';

import type { FixedExpenseWithPayment } from './repository';

interface Props {
  expense: FixedExpenseWithPayment;
  category?: Category | null;
  onPress?: () => void;
  onTogglePaid: (paid: boolean) => void;
}

/** Devuelve true si el gasto arranca en un mes futuro. */
function isFutureStart(startDate: string): boolean {
  const startMonth = startDate.slice(0, 7);
  const currentMonth = format(new Date(), 'yyyy-MM');
  return startMonth > currentMonth;
}

function formatStartMonth(iso: string): string {
  try {
    const label = format(parseISO(iso), 'MMM yyyy', { locale: es });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return iso;
  }
}

export function FixedExpenseCard({ expense, category, onPress, onTogglePaid }: Props) {
  const paid = expense.payment_id !== null;
  const isFuture = isFutureStart(expense.start_date);
  return (
    <View
      className={
        isFuture
          ? 'flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-4'
          : 'flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4'
      }
    >
      {/* Toggle pago */}
      <Pressable
        onPress={() => !isFuture && onTogglePaid(!paid)}
        disabled={isFuture}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: paid, disabled: isFuture }}
        accessibilityLabel={
          isFuture
            ? 'Este gasto todavía no está vigente'
            : paid
              ? 'Marcar como pendiente'
              : 'Marcar como pagado este mes'
        }
        className={
          isFuture
            ? 'mr-3 h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 opacity-50'
            : paid
              ? 'mr-3 h-9 w-9 items-center justify-center rounded-full bg-emerald-600'
              : 'mr-3 h-9 w-9 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600'
        }
      >
        {!isFuture && paid && <Check size={18} color="#fff" strokeWidth={3} />}
      </Pressable>

      {/* Contenido */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="flex-1 flex-row items-center active:opacity-70"
      >
        {category && (
          <View
            className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: category.color + '22' }}
          >
            <CategoryIcon name={category.icon} size={20} color={category.color} />
          </View>
        )}
        <View className="flex-1">
          <View className="flex-row items-baseline justify-between">
            <Text
              className={
                paid
                  ? 'flex-1 text-base font-semibold text-gray-500 dark:text-gray-400 line-through'
                  : 'flex-1 text-base font-semibold text-gray-900 dark:text-gray-100'
              }
              numberOfLines={1}
            >
              {expense.name}
            </Text>
            <Text
              className={
                paid
                  ? 'ml-2 text-base font-semibold text-gray-400 dark:text-gray-500'
                  : 'ml-2 text-base font-bold text-gray-900 dark:text-gray-100'
              }
            >
              {formatCents(expense.amount_cents, { currency: expense.currency })}
            </Text>
          </View>
          <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Vence el día {expense.due_day}
            {paid && !isFuture ? ' · Pagado este mes' : ''}
          </Text>
          {isFuture && (
            <View className="mt-1 flex-row items-center gap-1 self-start rounded-md bg-amber-100 dark:bg-amber-900 px-2 py-0.5">
              <CalendarClock size={12} color="#b45309" strokeWidth={2.5} />
              <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                Empieza en {formatStartMonth(expense.start_date)}
              </Text>
            </View>
          )}
        </View>
        <ChevronRight size={18} color="#94a3b8" className="ml-1" />
      </Pressable>
    </View>
  );
}
