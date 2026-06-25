import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatCents } from '@/shared/utils/money';

import type { OccurrenceWithSource } from './repository';

interface Props {
  /** Ocurrencias de ingreso del período (quincena en curso). */
  occurrences: OccurrenceWithSource[];
  currency: string;
  onToggle: (id: string, newValue: boolean) => void;
}

/**
 * Tarjeta del Inicio para confirmar ("darle un check") los ingresos del período.
 * Lo NO confirmado no cuenta como dinero disponible hasta marcarlo.
 */
export function IncomeConfirmCard({ occurrences, currency, onToggle }: Props) {
  if (occurrences.length === 0) return null;
  const pendingCount = occurrences.filter((o) => o.is_confirmed === 0).length;

  return (
    <View className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Ingresos de esta quincena</Text>
      <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {pendingCount > 0
          ? 'Marcá lo que ya te pagaron para que cuente como disponible.'
          : 'Todo confirmado. ✅'}
      </Text>

      <View className="mt-3">
        {occurrences.map((occ, idx) => {
          const confirmed = occ.is_confirmed === 1;
          return (
            <Pressable
              key={occ.id}
              onPress={() => onToggle(occ.id, !confirmed)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
              accessibilityLabel={confirmed ? 'Marcar como pendiente' : 'Confirmar que llegó'}
              className={
                idx > 0
                  ? 'flex-row items-center border-t border-gray-100 dark:border-gray-800 py-3'
                  : 'flex-row items-center py-1'
              }
            >
              <View
                className={
                  confirmed
                    ? 'mr-3 h-7 w-7 items-center justify-center rounded-full bg-emerald-600'
                    : 'mr-3 h-7 w-7 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600'
                }
              >
                {confirmed && <Check size={16} color="#fff" strokeWidth={3} />}
              </View>

              <View className="flex-1">
                <Text className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {occ.source ?? 'Ingreso'}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {confirmed ? 'Recibido' : 'Por confirmar'} · {formatDate(occ.occurred_at)}
                </Text>
              </View>

              <Text
                className={
                  confirmed
                    ? 'text-base font-semibold text-emerald-700 dark:text-emerald-300'
                    : 'text-base font-semibold text-gray-400 dark:text-gray-500'
                }
              >
                {formatCents(occ.amount_cents, { currency })}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMM", { locale: es });
  } catch {
    return iso;
  }
}
