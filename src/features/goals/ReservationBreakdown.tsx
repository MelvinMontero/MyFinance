import { AlertTriangle, Target } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { formatCents } from '@/shared/utils/money';

interface ReservationBreakdownProps {
  lines: { goalId: string; name: string; amount: number; isUrgent: boolean }[];
  currency: string;
  /** Dinero libre estimado tras reservar (centavos). */
  freeAfter: number;
  onConfirm: () => Promise<void>;
  onSkip: () => void;
  confirming: boolean;
}

/** Desglose "Apartá ₡X para cada meta" que se muestra al registrar un ingreso. */
export function ReservationBreakdown({
  lines,
  currency,
  freeAfter,
  onConfirm,
  onSkip,
  confirming,
}: ReservationBreakdownProps) {
  if (lines.length === 0) {
    return (
      <View className="items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-8">
        <Target size={48} color="#cbd5e1" strokeWidth={1.5} />
        <Text className="mt-4 text-center text-base font-semibold text-gray-700 dark:text-gray-300">
          No tenés metas activas en esta moneda
        </Text>
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-5 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 active:bg-gray-50"
        >
          <Text className="text-sm font-bold text-gray-700 dark:text-gray-200">Cerrar</Text>
        </Pressable>
      </View>
    );
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <View className="gap-4">
      <View className="gap-2">
        {lines.map((line) => (
          <View
            key={line.goalId}
            className="flex-row items-center rounded-2xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 p-4"
          >
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900">
              <Target size={20} color="#7c3aed" strokeWidth={2} />
            </View>
            <View className="flex-1 flex-row items-center gap-2">
              <Text
                className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100"
                numberOfLines={1}
              >
                {line.name}
              </Text>
              {line.isUrgent && (
                <View className="flex-row items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900 px-2 py-0.5">
                  <AlertTriangle size={12} color="#b45309" strokeWidth={2.5} />
                  <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    Urgente
                  </Text>
                </View>
              )}
            </View>
            <Text className="ml-2 text-base font-bold text-violet-700 dark:text-violet-300">
              {formatCents(line.amount, { currency })}
            </Text>
          </View>
        ))}
      </View>

      {/* TOTAL */}
      <View className="rounded-3xl bg-violet-50 dark:bg-violet-950 p-6">
        <Text className="text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Total a reservar
        </Text>
        <Text className="mt-1 text-4xl font-bold text-violet-900 dark:text-violet-100">
          {formatCents(total, { currency })}
        </Text>
        <Text className="mt-2 text-sm text-violet-800 dark:text-violet-200">
          Te queda libre: {formatCents(freeAfter, { currency })}
        </Text>
      </View>

      {/* ACCIONES */}
      <Pressable
        onPress={onConfirm}
        disabled={confirming}
        accessibilityRole="button"
        className={
          confirming
            ? 'items-center rounded-2xl bg-violet-300 px-6 py-4'
            : 'items-center rounded-2xl bg-violet-600 px-6 py-4 active:bg-violet-700'
        }
      >
        {confirming ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-bold text-white">Confirmar reservas</Text>
        )}
      </Pressable>
      <Pressable
        onPress={onSkip}
        disabled={confirming}
        accessibilityRole="button"
        className="items-center rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 active:bg-gray-50"
      >
        <Text className="text-base font-bold text-gray-700 dark:text-gray-200">Ahora no</Text>
      </Pressable>
    </View>
  );
}
