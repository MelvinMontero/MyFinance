import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { convertCents } from '@/shared/utils/exchange';
import { formatCents } from '@/shared/utils/money';

import type { GoalWithPlan } from './repository';

interface Props {
  goal: GoalWithPlan;
  /** Moneda del presupuesto (la de los sobres). */
  viewCurrency: string;
  /** Tasa ₡ por $1 para convertir metas en otra moneda. */
  rate: number;
  /** Marca/desmarca el aporte de la quincena. askCents va en la moneda de la meta. */
  onToggle: (goalId: string, askCents: number, currentlyDone: boolean) => void;
}

/** Fila de meta en el desglose, con check para marcar "ya aparté esta cuota". */
export function GoalCheckRow({ goal, viewCurrency, rate, onToggle }: Props) {
  // Lo que FALTA apartar esta quincena (0 si el check o abonos ya la cubrieron).
  const ask = goal.quincena_ask_cents; // en la moneda de la meta
  const done = goal.contributed_this_quincena > 0 && ask === 0; // cuota cubierta
  const shown = done ? goal.contributed_this_quincena : ask;
  const converted = convertCents(shown, goal.currency, viewCurrency, rate);
  const isOther = goal.currency !== viewCurrency;

  // Sin cuota que apartar ni aporte esta quincena (completada/vencida): fila simple.
  if (ask <= 0 && goal.contributed_this_quincena === 0) {
    return (
      <View className="flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800 py-3">
        <Text className="flex-1 pr-3 text-base font-medium text-gray-400 dark:text-gray-500">{goal.name}</Text>
        <Text className="text-base font-semibold text-gray-400 dark:text-gray-500">
          {goal.plan.isComplete ? '✓ lista' : '—'}
        </Text>
      </View>
    );
  }

  const subtitle = done
    ? `✓ aportaste ${formatCents(goal.contributed_this_quincena, { currency: goal.currency })} esta quincena`
    : goal.contributed_this_quincena > 0
      ? `Aportaste ${formatCents(goal.contributed_this_quincena, { currency: goal.currency })} · tocá para apartar el resto`
      : isOther
        ? `Tocá para apartar · ≈ de ${formatCents(ask, { currency: goal.currency })}`
        : 'Tocá para marcar que ya lo apartaste';

  return (
    <Pressable
      onPress={() => onToggle(goal.id, ask, done)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? `Desmarcar aporte a ${goal.name}` : `Marcar aporte a ${goal.name}`}
      className="flex-row items-center border-b border-gray-100 dark:border-gray-800 py-3"
    >
      <View
        className={
          done
            ? 'mr-3 h-7 w-7 items-center justify-center rounded-full bg-emerald-600'
            : 'mr-3 h-7 w-7 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600'
        }
      >
        {done && <Check size={16} color="#fff" strokeWidth={3} />}
      </View>
      <View className="flex-1 pr-3">
        <Text
          className={
            done
              ? 'text-base font-medium text-gray-500 dark:text-gray-400'
              : 'text-base font-medium text-gray-900 dark:text-gray-100'
          }
        >
          {goal.name}
        </Text>
        <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</Text>
      </View>
      <Text
        className={
          done
            ? 'text-base font-semibold text-emerald-700 dark:text-emerald-300'
            : 'text-base font-semibold text-gray-900 dark:text-gray-100'
        }
      >
        {formatCents(converted, { currency: viewCurrency })}
      </Text>
    </Pressable>
  );
}
