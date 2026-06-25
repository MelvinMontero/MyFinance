import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pressable, Text, View } from 'react-native';

import type { GoalPriority } from '@/shared/db/types';
import { formatCents } from '@/shared/utils/money';

import type { GoalWithPlan } from './repository';

const PRIORITY_TONE: Record<GoalPriority, { label: string; chip: string; text: string }> = {
  high: { label: 'Alta', chip: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-300' },
  medium: {
    label: 'Media',
    chip: 'bg-amber-100 dark:bg-amber-950',
    text: 'text-amber-700 dark:text-amber-300',
  },
  low: { label: 'Baja', chip: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
};

export function GoalCard({ goal, onPress }: { goal: GoalWithPlan; onPress: () => void }) {
  const tone = PRIORITY_TONE[goal.priority];
  const pct = Math.round(goal.plan.progress * 100);
  const cuota = goal.plan.perQuincenaCents;

  const statusLine = goal.plan.isComplete
    ? '¡Meta completada! 🎉'
    : goal.plan.isOverdue
      ? `Fecha vencida — faltan ${formatCents(goal.plan.remainingCents, { currency: goal.currency })}`
      : `Apartá ${formatCents(cuota, { currency: goal.currency })} por quincena · faltan ${goal.plan.remainingQuincenas}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-2 text-lg font-bold text-gray-900 dark:text-gray-100">{goal.name}</Text>
        <View className={`rounded-full px-2.5 py-1 ${tone.chip}`}>
          <Text className={`text-xs font-semibold ${tone.text}`}>{tone.label}</Text>
        </View>
      </View>

      <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {formatCents(goal.saved_cents, { currency: goal.currency })} de{' '}
        {formatCents(goal.target_cents, { currency: goal.currency })} · límite {formatDeadline(goal.deadline)}
      </Text>

      {/* PROGRESO */}
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <View
          className={goal.plan.isComplete ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-blue-500'}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </View>

      <Text className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">{statusLine}</Text>
    </Pressable>
  );
}

function formatDeadline(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}
