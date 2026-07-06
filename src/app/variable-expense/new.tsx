import { useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { getCurrentQuincenaOverspendCents } from '@/features/budgets/quincena';
import { notifyOverspendNow } from '@/features/notifications/scheduler';
import { useSettings } from '@/features/settings/store';
import { VariableExpenseForm } from '@/features/variable-expenses/VariableExpenseForm';
import { createVariableExpense } from '@/features/variable-expenses/repository';
import type { VariableExpenseFormValues } from '@/features/variable-expenses/schemas';
import { isSupportedCurrency } from '@/shared/utils/currency';
import { formatCents, toCents } from '@/shared/utils/money';

export default function NewVariableExpenseScreen() {
  const router = useRouter();
  const defaultCurrency = useSettings((s) => s.currency);
  const safeDefaultCurrency = isSupportedCurrency(defaultCurrency)
    ? defaultCurrency
    : 'CRC';

  async function handleSubmit(values: VariableExpenseFormValues) {
    try {
      await createVariableExpense({
        amount_cents: toCents(values.amount),
        currency: values.currency,
        category_id: values.category_id,
        occurred_at: values.occurred_at,
        note: values.note?.trim() ? values.note.trim() : null,
      });

      // Alerta de sobregasto: ¿este gasto te pasó del dinero libre de la quincena?
      const savingsPercent = useSettings.getState().savings_percent;
      const notificationsEnabled = useSettings.getState().notifications_enabled;
      const usdToCrcRate = useSettings.getState().usd_to_crc_rate;
      const overspent = await getCurrentQuincenaOverspendCents(
        values.currency,
        savingsPercent,
        usdToCrcRate,
      );
      if (overspent > 0) {
        if (notificationsEnabled) {
          await notifyOverspendNow(overspent, values.currency).catch(() => {
            /* la notificación es best-effort */
          });
        }
        Alert.alert(
          'Cuidado: sobregasto',
          `Vas ${formatCents(overspent, { currency: values.currency })} por encima de tu dinero libre de esta quincena.`,
          [{ text: 'Entendido', onPress: () => router.back() }],
        );
        return;
      }
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
            Café, comida fuera, salidas — todo lo que sale de tu dinero libre.
          </Text>
        </View>
        <View className="mt-4">
          <VariableExpenseForm
            onSubmit={handleSubmit}
            submitLabel="Guardar gasto"
            defaultValues={{ currency: safeDefaultCurrency }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
