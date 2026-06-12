import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Target } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatCents } from '@/shared/utils/money';

import type { GoalWithProgress } from './repository';

interface GoalCardProps {
  goal: GoalWithProgress;
  perPaycheck: number; // centavos (de calculateGoalPlan(asOf=hoy))
  isOverdue: boolean;
  isUrgent: boolean;
  onPress: () => void;
}

function formatDueDate(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export function GoalCard({ goal, perPaycheck, isOverdue, isUrgent, onPress }: GoalCardProps) {
  const completed = goal.status === 'completed';
  const pct =
    goal.target_amount_cents > 0
      ? Math.min(100, Math.max(0, (goal.saved_cents / goal.target_amount_cents) * 100))
      : 100;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Meta ${goal.name}`}
      className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 p-4 active:opacity-70"
    >
      <View className="flex-row items-center">
        <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900">
          <Target size={22} color="#7c3aed" strokeWidth={2} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100"
              numberOfLines={1}
            >
              {goal.name}
            </Text>
            {completed && (
              <View className="rounded-md bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5">
                <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  Completada
                </Text>
              </View>
            )}
            {!completed && isOverdue && (
              <View className="rounded-md bg-red-100 dark:bg-red-900 px-2 py-0.5">
                <Text className="text-xs font-semibold text-red-800 dark:text-red-200">Vencida</Text>
              </View>
            )}
            {!completed && !isOverdue && isUrgent && (
              <View className="rounded-md bg-amber-100 dark:bg-amber-900 px-2 py-0.5">
                <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  Urgente
                </Text>
              </View>
            )}
          </View>
          <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Para el {formatDueDate(goal.due_date)}
          </Text>
        </View>
        <ChevronRight size={18} color="#94a3b8" />
      </View>

      {/* Barra de progreso */}
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <View className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
      </View>
      <View className="mt-2 flex-row items-baseline justify-between">
        <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {formatCents(goal.saved_cents, { currency: goal.currency })} de{' '}
          {formatCents(goal.target_amount_cents, { currency: goal.currency })}
        </Text>
        {!completed && perPaycheck > 0 && (
          <Text className="text-sm font-bold text-violet-700 dark:text-violet-300">
            {formatCents(perPaycheck, { currency: goal.currency })}{' '}
            <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">por quincena</Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
}
