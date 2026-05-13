import { Check, ChevronRight } from 'lucide-react-native';
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

export function FixedExpenseCard({ expense, category, onPress, onTogglePaid }: Props) {
  const paid = expense.payment_id !== null;
  return (
    <View className="flex-row items-center rounded-2xl border border-gray-200 bg-white p-4">
      {/* Toggle pago */}
      <Pressable
        onPress={() => onTogglePaid(!paid)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: paid }}
        accessibilityLabel={paid ? 'Marcar como pendiente' : 'Marcar como pagado este mes'}
        className={
          paid
            ? 'mr-3 h-9 w-9 items-center justify-center rounded-full bg-emerald-600'
            : 'mr-3 h-9 w-9 items-center justify-center rounded-full border-2 border-gray-300'
        }
      >
        {paid && <Check size={18} color="#fff" strokeWidth={3} />}
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
                  ? 'flex-1 text-base font-semibold text-gray-500 line-through'
                  : 'flex-1 text-base font-semibold text-gray-900'
              }
              numberOfLines={1}
            >
              {expense.name}
            </Text>
            <Text
              className={
                paid
                  ? 'ml-2 text-base font-semibold text-gray-400'
                  : 'ml-2 text-base font-bold text-gray-900'
              }
            >
              {formatCents(expense.amount_cents, { currency: expense.currency })}
            </Text>
          </View>
          <Text className="mt-0.5 text-sm text-gray-500">
            Vence el día {expense.due_day}
            {paid ? ' · Pagado este mes' : ''}
          </Text>
        </View>
        <ChevronRight size={18} color="#94a3b8" className="ml-1" />
      </Pressable>
    </View>
  );
}
