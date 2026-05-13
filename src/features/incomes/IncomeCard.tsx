import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatCents } from '@/shared/utils/money';

import type { Income } from '@/shared/db/types';

const FREQUENCY_LABEL: Record<Income['frequency'], string> = {
  one_time: 'Una vez',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
};

interface Props {
  income: Income;
  onPress?: () => void;
}

export function IncomeCard({ income, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
    >
      <View className="flex-1">
        <View className="flex-row items-baseline justify-between">
          <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={1}>
            {income.source ?? 'Ingreso sin nombre'}
          </Text>
          <Text className="ml-2 text-base font-bold text-emerald-700">
            {formatCents(income.amount_cents, { currency: income.currency })}
          </Text>
        </View>
        <Text className="mt-1 text-sm text-gray-500">
          {FREQUENCY_LABEL[income.frequency]} · desde {formatDateShort(income.start_date)}
          {income.end_date ? ` · hasta ${formatDateShort(income.end_date)}` : ''}
        </Text>
      </View>
      <ChevronRight size={18} color="#94a3b8" className="ml-2" />
    </Pressable>
  );
}

function formatDateShort(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}
