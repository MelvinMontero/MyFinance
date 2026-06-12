import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { GoalForm } from '@/features/goals/GoalForm';
import type { GoalFormValues } from '@/features/goals/schemas';
import { useGoals } from '@/features/goals/store';
import { useReminders } from '@/features/notifications/useReminders';
import { useSettings } from '@/features/settings/store';
import { isSupportedCurrency } from '@/shared/utils/currency';

export default function NewGoalScreen() {
  const router = useRouter();
  const { reschedule } = useReminders();
  const defaultCurrency = useSettings((s) => s.currency);
  const safeDefaultCurrency = isSupportedCurrency(defaultCurrency) ? defaultCurrency : 'CRC';

  async function handleSubmit(values: GoalFormValues) {
    try {
      await useGoals.getState().add({
        name: values.name,
        target_amount_cents: values.target_amount_cents,
        initial_amount_cents: values.initial_amount_cents,
        currency: values.currency,
        due_date: values.due_date,
        funding_source: values.funding_source,
        category_id: values.category_id ?? null,
        note: values.note ?? null,
      });
      // Reprogramar avisos de metas si están activos (no bloquea el cierre).
      void reschedule().catch(() => {});
      router.back();
    } catch (err) {
      Alert.alert('Error al guardar', err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-2">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            Definí cuánto necesitás y para cuándo. Calculamos cuánto apartar en cada quincena (15 y
            fin de mes).
          </Text>
        </View>
        <View className="mt-4">
          <GoalForm
            onSubmit={handleSubmit}
            submitLabel="Crear meta"
            defaultValues={{ currency: safeDefaultCurrency }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
