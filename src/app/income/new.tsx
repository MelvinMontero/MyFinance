import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { IncomeForm } from '@/features/incomes/IncomeForm';
import { createIncome } from '@/features/incomes/repository';
import type { IncomeFormValues } from '@/features/incomes/schemas';
import { useSettings } from '@/features/settings/store';
import { isSupportedCurrency } from '@/shared/utils/currency';
import { toCents } from '@/shared/utils/money';

export default function NewIncomeScreen() {
  const router = useRouter();
  const defaultCurrency = useSettings((s) => s.currency);
  const safeDefaultCurrency = isSupportedCurrency(defaultCurrency) ? defaultCurrency : 'CRC';

  async function handleSubmit(values: IncomeFormValues) {
    try {
      const { occurrences } = await createIncome({
        amount_cents: toCents(values.amount),
        currency: values.currency,
        source: values.source?.trim() ? values.source.trim() : null,
        frequency: values.frequency,
        start_date: values.start_date,
        end_date: values.end_date && values.end_date.trim() !== '' ? values.end_date : null,
        note: values.note?.trim() ? values.note.trim() : null,
      });
      router.back();
      // Aviso al usuario de cuántas ocurrencias se proyectaron
      const count = occurrences.length;
      setTimeout(() => {
        Alert.alert(
          'Ingreso guardado',
          count === 1
            ? 'Se registró 1 ocurrencia.'
            : `Se proyectaron ${count} ocurrencias para los próximos 12 meses.`,
        );
      }, 300);
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
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-2">
          <Text className="text-sm text-gray-500">
            Cuando guardés, se proyectarán automáticamente las ocurrencias para los próximos 12 meses.
          </Text>
        </View>
        <View className="mt-4">
          <IncomeForm
            onSubmit={handleSubmit}
            submitLabel="Guardar ingreso"
            defaultValues={{ currency: safeDefaultCurrency }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
