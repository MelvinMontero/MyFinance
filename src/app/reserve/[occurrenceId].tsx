import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { getBudgetForPeriod } from '@/features/budgets/repository';
import { ReservationBreakdown } from '@/features/goals/ReservationBreakdown';
import {
  addContribution,
  getGoal,
  listContributionsByOccurrence,
  listGoals,
} from '@/features/goals/repository';
import { computeReservations, type ReservationLine } from '@/features/goals/reservations';
import { useGoals } from '@/features/goals/store';
import { getIncome, getOccurrence } from '@/features/incomes/repository';
import { notifyGoalAchieved } from '@/features/notifications/scheduler';
import { useSettings } from '@/features/settings/store';
import type { GoalContribution, IncomeOccurrence } from '@/shared/db/types';
import { formatCents } from '@/shared/utils/money';

type Status = 'loading' | 'ready' | 'already-reserved' | 'error';

export default function ReserveScreen() {
  const router = useRouter();
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId: string }>();
  const savingsPercent = useSettings((s) => s.savings_percent);

  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [occurrence, setOccurrence] = useState<IncomeOccurrence | null>(null);
  const [currency, setCurrency] = useState('CRC');
  const [lines, setLines] = useState<ReservationLine[]>([]);
  const [existing, setExisting] = useState<GoalContribution[]>([]);
  const [freeAfter, setFreeAfter] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!occurrenceId) return;
    setStatus('loading');
    try {
      const occ = await getOccurrence(occurrenceId);
      if (!occ) {
        setErrorMsg('No se encontró la ocurrencia del ingreso.');
        setStatus('error');
        return;
      }
      setOccurrence(occ);

      const income = await getIncome(occ.income_id);
      const cur = income?.currency ?? 'CRC';
      setCurrency(cur);

      // Idempotencia: si ya hay aportes ligados a esta ocurrencia, no duplicar.
      const prior = await listContributionsByOccurrence(occurrenceId);
      if (prior.length > 0) {
        setExisting(prior);
        setStatus('already-reserved');
        return;
      }

      const active = await listGoals({ status: 'active' });
      const res = computeReservations({
        asOf: occ.occurred_at,
        currency: cur,
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
      setLines(res.perGoal);

      const budget = await getBudgetForPeriod(occ.occurred_at.slice(0, 7), cur, savingsPercent);
      setFreeAfter(budget.freeMoney);

      setStatus('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [occurrenceId, savingsPercent]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConfirm() {
    if (!occurrence || confirming) return;
    setConfirming(true);
    try {
      const affectedGoalIds: string[] = [];
      for (const line of lines) {
        await addContribution({
          goal_id: line.goalId,
          amount_cents: line.amount,
          occurred_at: occurrence.occurred_at,
          income_occurrence_id: occurrence.id,
          source: 'auto',
        });
        affectedGoalIds.push(line.goalId);
      }
      await useGoals.getState().load();

      // Si algún aporte completó su meta, avisar.
      for (const goalId of affectedGoalIds) {
        const g = await getGoal(goalId);
        if (g?.status === 'completed') {
          void notifyGoalAchieved(g.name).catch(() => {});
        }
      }
      router.back();
    } catch (err) {
      Alert.alert('Error al reservar', err instanceof Error ? err.message : String(err));
    } finally {
      setConfirming(false);
    }
  }

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text className="mt-4 text-base text-gray-700 dark:text-gray-300">
          Calculando tus reservas…
        </Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Text className="text-lg font-semibold text-red-600 dark:text-red-400">Error</Text>
        <Text className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">{errorMsg}</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="mt-5 rounded-2xl border border-gray-300 dark:border-gray-700 px-6 py-3"
        >
          <Text className="text-sm font-bold text-gray-700 dark:text-gray-200">Cerrar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-900"
      contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
    >
      {status === 'already-reserved' ? (
        <>
          <View className="items-center">
            <CheckCircle2 size={48} color="#059669" strokeWidth={1.5} />
            <Text className="mt-4 text-xl font-bold text-gray-900 dark:text-gray-100">
              Ya reservaste para esta quincena
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              Estos aportes ya quedaron en el historial:
            </Text>
          </View>
          <View className="mt-6 gap-2">
            {existing.map((c) => (
              <ExistingLine key={c.id} contribution={c} currency={currency} />
            ))}
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="mt-6 items-center rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 active:bg-gray-50"
          >
            <Text className="text-base font-bold text-gray-700 dark:text-gray-200">Cerrar</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View className="mb-6">
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ¡Ingreso registrado! 💰
            </Text>
            {occurrence && (
              <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">
                {formatCents(occurrence.amount_cents, { currency })} ·{' '}
                {formatOccurrenceDate(occurrence.occurred_at)}. Esto es lo que conviene apartar
                para tus metas:
              </Text>
            )}
          </View>
          <ReservationBreakdown
            lines={lines}
            currency={currency}
            freeAfter={freeAfter}
            onConfirm={handleConfirm}
            onSkip={() => router.back()}
            confirming={confirming}
          />
        </>
      )}
    </ScrollView>
  );
}

function ExistingLine({
  contribution,
  currency,
}: {
  contribution: GoalContribution;
  currency: string;
}) {
  const [goalName, setGoalName] = useState<string>('…');
  useEffect(() => {
    let cancelled = false;
    getGoal(contribution.goal_id).then((g) => {
      if (!cancelled && g) setGoalName(g.name);
    });
    return () => {
      cancelled = true;
    };
  }, [contribution.goal_id]);

  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-4 py-3">
      <Text className="flex-1 text-base text-gray-900 dark:text-gray-100" numberOfLines={1}>
        {goalName}
      </Text>
      <Text className="ml-2 text-base font-bold text-violet-700 dark:text-violet-300">
        {formatCents(contribution.amount_cents, { currency })}
      </Text>
    </View>
  );
}

function formatOccurrenceDate(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
}
