import { useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { FixedExpenseForm } from '@/features/fixed-expenses/FixedExpenseForm';
import { createFixedExpense } from '@/features/fixed-expenses/repository';
import type { FixedExpenseFormValues } from '@/features/fixed-expenses/schemas';
import { useSettings } from '@/features/settings/store';
import { isSupportedCurrency } from '@/shared/utils/currency';
import { toCents } from '@/shared/utils/money';

export default function NewFixedExpenseScreen() {
  const router = useRouter();
  const defaultCurrency = useSettings((s) => s.currency);
  const safeDefaultCurrency = isSupportedCurrency(defaultCurrency)
    ? defaultCurrency
    : 'CRC';

  async function handleSubmit(values: FixedExpenseFormValues) {
    try {
      await createFixedExpense({
        name: values.name.trim(),
        amount_cents: toCents(values.amount),
        currency: values.currency,
        category_id: values.category_id,
        due_day: values.due_day,
        start_date: values.start_date,
        end_date:
          values.end_date && values.end_date.trim() !== '' ? values.end_date : null,
      });
      router.back();
    } catch (err) {
      Alert.alert(
        'Error al guardar',
        err instanceof Error ? err.message : String(err),
      );
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
            Renta, servicios, suscripciones — lo que se paga mes a mes.
          </Text>
        </View>
        <View className="mt-4">
          <FixedExpenseForm
            onSubmit={handleSubmit}
            submitLabel="Guardar gasto fijo"
            defaultValues={{ currency: safeDefaultCurrency }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
