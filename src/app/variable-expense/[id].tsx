import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
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

import { VariableExpenseForm } from '@/features/variable-expenses/VariableExpenseForm';
import {
  deleteVariableExpense,
  getVariableExpense,
  updateVariableExpense,
} from '@/features/variable-expenses/repository';
import type { VariableExpenseFormValues } from '@/features/variable-expenses/schemas';
import type { VariableExpense } from '@/shared/db/types';
import { isSupportedCurrency } from '@/shared/utils/currency';
import { fromCents, toCents } from '@/shared/utils/money';

export default function EditVariableExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [expense, setExpense] = useState<VariableExpense | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const exp = await getVariableExpense(id);
      setExpense(exp);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleUpdate(values: VariableExpenseFormValues) {
    if (!expense) return;
    try {
      await updateVariableExpense(expense.id, {
        amount_cents: toCents(values.amount),
        currency: values.currency,
        category_id: values.category_id,
        occurred_at: values.occurred_at,
        note: values.note?.trim() ? values.note.trim() : null,
      });
      router.back();
    } catch (err) {
      Alert.alert(
        'Error al actualizar',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  function confirmDelete() {
    if (!expense) return;
    Alert.alert(
      'Eliminar gasto',
      '¿Seguro que querés eliminar este gasto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVariableExpense(expense.id);
              router.back();
            } catch (err) {
              Alert.alert(
                'Error al eliminar',
                err instanceof Error ? err.message : String(err),
              );
            }
          },
        },
      ],
    );
  }

  if (loading || !expense) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <VariableExpenseForm
          submitLabel="Guardar cambios"
          onSubmit={handleUpdate}
          defaultValues={{
            amount: fromCents(expense.amount_cents),
            currency: isSupportedCurrency(expense.currency) ? expense.currency : 'CRC',
            category_id: expense.category_id,
            occurred_at: expense.occurred_at,
            note: expense.note ?? '',
          }}
        />

        <View className="mt-10">
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 active:bg-red-100"
          >
            <Trash2 size={18} color="#dc2626" />
            <Text className="text-base font-semibold text-red-700">Eliminar gasto</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
