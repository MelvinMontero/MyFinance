import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatCents } from '@/shared/utils/money';

import type { IncomeOccurrence } from '@/shared/db/types';

interface Props {
  occurrences: IncomeOccurrence[];
  /** Moneda del ingreso padre — todas las ocurrencias comparten esta moneda. */
  currency: string;
  onToggleConfirm: (id: string, newValue: boolean) => void;
  onPressAmount?: (occurrence: IncomeOccurrence) => void;
}

export function OccurrencesList({
  occurrences,
  currency,
  onToggleConfirm,
  onPressAmount,
}: Props) {
  if (occurrences.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-8">
        <Text className="text-base text-gray-500 dark:text-gray-400">No hay ocurrencias proyectadas</Text>
      </View>
    );
  }
  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {occurrences.map((occ, idx) => {
        const confirmed = occ.is_confirmed === 1;
        return (
          <View
            key={occ.id}
            className={
              idx > 0
                ? 'flex-row items-center border-t border-gray-100 dark:border-gray-800 px-4 py-3'
                : 'flex-row items-center px-4 py-3'
            }
          >
            <Pressable
              onPress={() => onToggleConfirm(occ.id, !confirmed)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
              accessibilityLabel={
                confirmed ? 'Marcar como pendiente' : 'Confirmar que llegó'
              }
              className={
                confirmed
                  ? 'mr-3 h-7 w-7 items-center justify-center rounded-full bg-emerald-600'
                  : 'mr-3 h-7 w-7 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600'
              }
            >
              {confirmed && <Check size={16} color="#fff" strokeWidth={3} />}
            </Pressable>

            <View className="flex-1">
              <Text
                className={
                  confirmed ? 'text-base text-gray-900 dark:text-gray-100' : 'text-base text-gray-700 dark:text-gray-300'
                }
              >
                {formatDateOccurrence(occ.occurred_at)}
              </Text>
              {confirmed && (
                <Text className="text-xs text-emerald-700 dark:text-emerald-300">Confirmado</Text>
              )}
            </View>

            <Pressable
              onPress={() => onPressAmount?.(occ)}
              accessibilityRole="button"
              accessibilityLabel="Editar monto de esta ocurrencia"
              className="ml-2 rounded-lg px-2 py-1 active:bg-gray-100"
            >
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {formatCents(occ.amount_cents, { currency })}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function formatDateOccurrence(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
}
