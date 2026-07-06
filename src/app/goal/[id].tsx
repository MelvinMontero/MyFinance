import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
import { currencySymbol, isSupportedCurrency } from '@/shared/utils/currency';
import { fromCents, formatCents, parseAmount, toCents } from '@/shared/utils/money';

type Status = 'loading' | 'ready' | 'error' | 'notfound';

export default function GoalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [goal, setGoal] = useState<GoalWithPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [abonoText, setAbonoText] = useState('');
  const [abonando, setAbonando] = useState(false);

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

  async function handleAbono() {
    if (!goal || !id) return;
    if (abonando) return; // guard: un doble-tap no registra el abono dos veces
    let cents: number;
    try {
      cents = toCents(parseAmount(abonoText));
    } catch {
      Alert.alert('Monto inválido', 'Ingresá un monto válido para el abono.');
      return;
    }
    if (cents <= 0) {
      Alert.alert('Monto inválido', 'El abono debe ser mayor que cero.');
      return;
    }
    setAbonando(true);
    try {
      await addContribution(id, cents);
      setAbonoText('');
      await reload();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    } finally {
      setAbonando(false);
    }
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
          <Text className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Te faltan {formatCents(goal.plan.remainingCents, { currency: goal.currency })}
          </Text>
          {!goal.plan.isComplete && (
            <Text className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              Cuota sugerida: {formatCents(goal.quincena_quota_cents, { currency: goal.currency })} por quincena ·
              faltan {goal.plan.remainingQuincenas}
            </Text>
          )}
          {goal.contributed_this_quincena > 0 && (
            <Text className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Aportado esta quincena: {formatCents(goal.contributed_this_quincena, { currency: goal.currency })}
            </Text>
          )}
        </View>

        {/* REGISTRAR ABONO */}
        {!goal.plan.isComplete && (
          <View className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-4">
            <Text className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
              Registrar abono
            </Text>
            <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Apartá la cuota sugerida o el monto que quieras. Se rebaja del total de la meta.
            </Text>
            <View className="mt-3 flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
              <Text className="mr-2 text-2xl font-semibold text-gray-400 dark:text-gray-500">
                {currencySymbol(goal.currency)}
              </Text>
              <TextInput
                className="flex-1 text-2xl font-semibold text-gray-900 dark:text-gray-100"
                keyboardType="decimal-pad"
                value={abonoText}
                onChangeText={setAbonoText}
                placeholder={goal.quincena_quota_cents > 0 ? String(fromCents(goal.quincena_quota_cents)) : '0'}
                placeholderTextColor="#cbd5e1"
              />
            </View>
            <View className="mt-3 flex-row gap-2">
              {goal.quincena_quota_cents > 0 && (
                <Pressable
                  onPress={() => setAbonoText(String(fromCents(goal.quincena_quota_cents)))}
                  accessibilityRole="button"
                  className="items-center justify-center rounded-xl border border-gray-300 px-3 py-3 active:opacity-70 dark:border-gray-700"
                >
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cuota {formatCents(goal.quincena_quota_cents, { currency: goal.currency })}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleAbono}
                disabled={abonando}
                accessibilityRole="button"
                accessibilityState={{ disabled: abonando }}
                className={
                  abonando
                    ? 'flex-1 items-center justify-center rounded-xl bg-emerald-300 px-4 py-3'
                    : 'flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 active:bg-emerald-700'
                }
              >
                <Text className="text-base font-bold text-white">
                  {abonando ? 'Guardando…' : 'Abonar'}
                </Text>
              </Pressable>
            </View>
          </View>
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
