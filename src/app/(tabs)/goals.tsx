import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Target } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateGoalPlan } from '@/features/goals/calculate';
import { GoalCard } from '@/features/goals/GoalCard';
import { nextPaydayOnOrAfter } from '@/features/goals/paydays';
import { computeReservations } from '@/features/goals/reservations';
import { useGoals } from '@/features/goals/store';
import { useSettings } from '@/features/settings/store';
import { formatCents } from '@/shared/utils/money';

export default function GoalsScreen() {
  const router = useRouter();
  const goals = useGoals((s) => s.goals);
  const loaded = useGoals((s) => s.loaded);
  const currency = useSettings((s) => s.currency);

  useFocusEffect(
    useCallback(() => {
      void useGoals.getState().load();
    }, []),
  );

  const today = format(new Date(), 'yyyy-MM-dd');

  const { reservation, nextPayday, activeCount } = useMemo(() => {
    const active = goals.filter((g) => g.status === 'active');
    const payday = nextPaydayOnOrAfter(today);
    const res = computeReservations({
      asOf: payday,
      currency,
      goals: active.map((g) => ({
        id: g.id,
        name: g.name,
        currency: g.currency,
        targetAmount: g.target_amount_cents,
        initialAmount: g.initial_amount_cents,
        contributedAmount: g.contributed_cents,
        dueDate: g.due_date,
        fundingSource: g.funding_source,
      })),
    });
    return {
      reservation: res,
      nextPayday: payday,
      activeCount: active.filter((g) => g.currency === currency).length,
    };
  }, [goals, currency, today]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <View className="px-6 pb-4 pt-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">Metas</Text>
        <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">
          Ahorrá con fecha límite, quincena a quincena.
        </Text>

        {reservation.total > 0 && (
          <View className="mt-4 rounded-2xl bg-violet-50 dark:bg-violet-950 p-4">
            <Text className="text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              A reservar esta quincena ({formatPaydayLabel(nextPayday)})
            </Text>
            <Text className="mt-1 text-2xl font-bold text-violet-900 dark:text-violet-100">
              {formatCents(reservation.total, { currency })}
            </Text>
            <Text className="mt-0.5 text-sm text-violet-800 dark:text-violet-200">
              para {reservation.perGoal.length}{' '}
              {reservation.perGoal.length === 1 ? 'meta activa' : 'metas activas'}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 12 }}
        renderItem={({ item }) => {
          const plan = calculateGoalPlan({
            targetAmount: item.target_amount_cents,
            initialAmount: item.initial_amount_cents,
            contributedAmount: item.contributed_cents,
            dueDate: item.due_date,
            asOf: today,
          });
          return (
            <GoalCard
              goal={item}
              perPaycheck={plan.perPaycheck}
              isOverdue={plan.isOverdue}
              isUrgent={plan.isUrgent}
              onPress={() => router.push(`/goal/${item.id}`)}
            />
          );
        }}
        ListEmptyComponent={
          !loaded ? null : (
            <View className="mt-8 items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-12">
              <Target size={48} color="#cbd5e1" strokeWidth={1.5} />
              <Text className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                Sin metas todavía
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                Un viaje, un curso, una laptop — poné fecha y monto, y te decimos cuánto apartar
                cada quincena.
              </Text>
              <Pressable
                onPress={() => router.push('/goal/new')}
                accessibilityRole="button"
                className="mt-5 rounded-2xl bg-violet-600 px-5 py-3 active:bg-violet-700"
              >
                <Text className="text-sm font-bold text-white">Creá tu primera meta</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          goals.length > 0 && activeCount === 0 && reservation.total === 0 ? (
            <Text className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
              No hay metas activas en {currency}. Las metas en otra moneda se calculan al cambiar
              la moneda en Ajustes.
            </Text>
          ) : null
        }
      />

      {goals.length > 0 && (
        <Pressable
          onPress={() => router.push('/goal/new')}
          accessibilityLabel="Agregar nueva meta"
          accessibilityRole="button"
          className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-violet-600 active:bg-violet-700"
          style={{
            elevation: 6,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function formatPaydayLabel(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
}
