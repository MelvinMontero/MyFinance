import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { PiggyBank, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { GoalForm } from '@/features/goals/GoalForm';
import {
  addContribution,
  deleteGoal,
  getGoalWithPlan,
  updateGoal,
  type GoalWithPlan,
} from '@/features/goals/repository';
import type { GoalFormValues } from '@/features/goals/schemas';
import { isSupportedCurrency } from '@/shared/utils/currency';
import { fromCents, formatCents } from '@/shared/utils/money';

type Status = 'loading' | 'ready' | 'error' | 'notfound';

export default function GoalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [goal, setGoal] = useState<GoalWithPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const g = await getGoalWithPlan(id, new Date());
    if (!g) {
      setStatus('notfound');
      return;
    }
    setGoal(g);
    setStatus('ready');
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setStatus('loading');
        try {
          await reload();
        } catch (err) {
          if (cancelled) return;
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setStatus('error');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [reload]),
  );

  async function handleSave(values: GoalFormValues) {
    if (!id) return;
    try {
      await updateGoal(id, {
        name: values.name.trim(),
        target_cents: Math.round(values.amount * 100),
        currency: values.currency,
        start_date: values.start_date,
        deadline: values.deadline,
        priority: values.priority,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error al guardar', err instanceof Error ? err.message : String(err));
    }
  }

  function confirmContribute() {
    if (!goal || goal.quincena_quota_cents <= 0) return;
    const amount = goal.quincena_quota_cents;
    Alert.alert(
      'Apartar cuota',
      `¿Registrar un aporte de ${formatCents(amount, { currency: goal.currency })} a "${goal.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apartar',
          onPress: async () => {
            try {
              await addContribution(id!, amount);
              await reload();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  }

  function confirmDelete() {
    if (!goal) return;
    Alert.alert('Eliminar meta', `¿Eliminar "${goal.name}" y sus aportes? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(id!);
            router.back();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  }

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }
  if (status === 'notfound') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Text className="text-base text-gray-700 dark:text-gray-300">Esta meta ya no existe.</Text>
      </View>
    );
  }
  if (status === 'error' || !goal) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Text className="text-lg font-semibold text-red-600 dark:text-red-400">Error al cargar</Text>
        <Text className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">{errorMsg}</Text>
      </View>
    );
  }

  const pct = Math.round(goal.plan.progress * 100);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* RESUMEN */}
        <View className="rounded-3xl bg-emerald-50 dark:bg-emerald-950 p-6">
          <Text className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Progreso
          </Text>
          <Text className="mt-1 text-3xl font-bold text-emerald-900 dark:text-emerald-100">
            {formatCents(goal.saved_cents, { currency: goal.currency })}
          </Text>
          <Text className="text-sm text-emerald-800 dark:text-emerald-200">
            de {formatCents(goal.target_cents, { currency: goal.currency })} ({pct}%)
          </Text>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
            <View
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </View>
          {!goal.plan.isComplete && (
            <Text className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Cuota sugerida: {formatCents(goal.quincena_quota_cents, { currency: goal.currency })} por quincena ·
              faltan {goal.plan.remainingQuincenas}
            </Text>
          )}
        </View>

        {/* APARTAR CUOTA */}
        {!goal.plan.isComplete && goal.quincena_quota_cents > 0 && (
          <Pressable
            onPress={confirmContribute}
            accessibilityRole="button"
            className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 active:bg-emerald-700"
          >
            <PiggyBank size={20} color="#fff" strokeWidth={2} />
            <Text className="text-base font-bold text-white">
              Apartar {formatCents(goal.quincena_quota_cents, { currency: goal.currency })} esta quincena
            </Text>
          </Pressable>
        )}

        {/* EDITAR */}
        <Text className="mt-8 mb-3 text-base font-bold text-gray-900 dark:text-gray-100">Editar meta</Text>
        <GoalForm
          submitLabel="Guardar cambios"
          onSubmit={handleSave}
          defaultValues={{
            name: goal.name,
            amount: fromCents(goal.target_cents),
            currency: isSupportedCurrency(goal.currency) ? goal.currency : 'CRC',
            start_date: goal.start_date,
            deadline: goal.deadline,
            priority: goal.priority,
          }}
        />

        {/* ELIMINAR */}
        <Pressable
          onPress={confirmDelete}
          accessibilityRole="button"
          className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-6 py-4 active:opacity-80"
        >
          <Trash2 size={20} color="#dc2626" strokeWidth={2} />
          <Text className="text-base font-bold text-red-700 dark:text-red-300">Eliminar meta</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
