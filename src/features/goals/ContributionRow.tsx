import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2 } from 'lucide-react-native';
import { Alert, Pressable, Text, View } from 'react-native';

import type { GoalContribution } from '@/shared/db/types';
import { formatCents } from '@/shared/utils/money';

interface ContributionRowProps {
  contribution: GoalContribution;
  currency: string;
  onDelete?: (id: string) => void;
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: es });
  } catch {
    return iso;
  }
}

export function ContributionRow({ contribution, currency, onDelete }: ContributionRowProps) {
  const isAuto = contribution.source === 'auto';

  function confirmDelete() {
    Alert.alert(
      'Eliminar aporte',
      `¿Borrar el aporte de ${formatCents(contribution.amount_cents, { currency })}? El progreso de la meta se recalcula.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDelete?.(contribution.id) },
      ],
    );
  }

  return (
    <View className="flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold text-gray-900 dark:text-gray-100">
            {formatCents(contribution.amount_cents, { currency })}
          </Text>
          <View
            className={
              isAuto
                ? 'rounded-md bg-violet-100 dark:bg-violet-900 px-2 py-0.5'
                : 'rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5'
            }
          >
            <Text
              className={
                isAuto
                  ? 'text-xs font-semibold text-violet-800 dark:text-violet-200'
                  : 'text-xs font-semibold text-gray-600 dark:text-gray-300'
              }
            >
              {isAuto ? 'Automático' : 'Manual'}
            </Text>
          </View>
        </View>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {formatDate(contribution.occurred_at)}
        </Text>
        {contribution.note ? (
          <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500" numberOfLines={2}>
            {contribution.note}
          </Text>
        ) : null}
      </View>
      {onDelete && (
        <Pressable
          onPress={confirmDelete}
          accessibilityRole="button"
          accessibilityLabel="Eliminar aporte"
          className="ml-2 h-10 w-10 items-center justify-center rounded-xl active:bg-red-50 dark:active:bg-red-950"
        >
          <Trash2 size={18} color="#dc2626" strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}
