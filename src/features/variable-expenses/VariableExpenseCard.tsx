import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '@/features/categories/CategoryIcon';
import type { Category, VariableExpense } from '@/shared/db/types';
import { formatCents } from '@/shared/utils/money';

interface Props {
  expense: VariableExpense;
  category?: Category | null;
  onPress?: () => void;
}

export function VariableExpenseCard({ expense, category, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
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
          <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={1}>
            {category?.name ?? 'Gasto'}
          </Text>
          <Text className="ml-2 text-base font-bold text-amber-700">
            {formatCents(expense.amount_cents, { currency: expense.currency })}
          </Text>
        </View>
        <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
          {formatDateShort(expense.occurred_at)}
          {expense.note ? ` · ${expense.note}` : ''}
        </Text>
      </View>
      <ChevronRight size={18} color="#94a3b8" className="ml-2" />
    </Pressable>
  );
}

function formatDateShort(iso: string): string {
  try {
    return format(parseISO(iso), "EEE d 'de' MMM", { locale: es });
  } catch {
    return iso;
  }
}
