import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { GoalForm } from '@/features/goals/GoalForm';
import { createGoal } from '@/features/goals/repository';
import type { GoalFormValues } from '@/features/goals/schemas';
import { useSettings } from '@/features/settings/store';
import { isSupportedCurrency } from '@/shared/utils/currency';
import { toCents } from '@/shared/utils/money';

export default function NewGoalScreen() {
  const router = useRouter();
  const defaultCurrency = useSettings((s) => s.currency);
  const safeDefaultCurrency = isSupportedCurrency(defaultCurrency) ? defaultCurrency : 'CRC';

  async function handleSubmit(values: GoalFormValues) {
    try {
      await createGoal({
        name: values.name.trim(),
        target_cents: toCents(values.amount),
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-2">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            Definí cuánto querés juntar y para cuándo. La app calcula la cuota por quincena.
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
