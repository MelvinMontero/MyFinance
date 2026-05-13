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

import { IncomeForm } from '@/features/incomes/IncomeForm';
import { OccurrencesList } from '@/features/incomes/OccurrencesList';
import { OverrideAmountModal } from '@/features/incomes/OverrideAmountModal';
import {
  deleteIncome,
  getIncome,
  listOccurrences,
  overrideOccurrenceAmount,
  setOccurrenceConfirmed,
  updateIncome,
} from '@/features/incomes/repository';
import type { IncomeFormValues } from '@/features/incomes/schemas';
import type { Income, IncomeOccurrence } from '@/shared/db/types';
import { isSupportedCurrency } from '@/shared/utils/currency';
import { fromCents, toCents } from '@/shared/utils/money';

export default function EditIncomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [income, setIncome] = useState<Income | null>(null);
  const [occurrences, setOccurrences] = useState<IncomeOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOcc, setEditingOcc] = useState<IncomeOccurrence | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [inc, occs] = await Promise.all([getIncome(id), listOccurrences({ incomeId: id })]);
      setIncome(inc);
      setOccurrences(occs);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleUpdate(values: IncomeFormValues) {
    if (!income) return;
    try {
      await updateIncome(income.id, {
        amount_cents: toCents(values.amount),
        currency: values.currency,
        source: values.source?.trim() ? values.source.trim() : null,
        start_date: values.start_date,
        end_date: values.end_date && values.end_date.trim() !== '' ? values.end_date : null,
        note: values.note?.trim() ? values.note.trim() : null,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error al actualizar', err instanceof Error ? err.message : String(err));
    }
  }

  function confirmDelete() {
    if (!income) return;
    Alert.alert(
      'Eliminar ingreso',
      `¿Seguro que querés eliminar "${income.source ?? 'este ingreso'}"? Se borrarán también sus ${occurrences.length} ocurrencias.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteIncome(income.id);
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

  async function handleToggleConfirm(occId: string, newValue: boolean) {
    try {
      await setOccurrenceConfirmed(occId, newValue);
      setOccurrences((prev) =>
        prev.map((o) => (o.id === occId ? { ...o, is_confirmed: newValue ? 1 : 0 } : o)),
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOverrideSave(newAmountCents: number) {
    if (!editingOcc) return;
    try {
      await overrideOccurrenceAmount(editingOcc.id, newAmountCents);
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === editingOcc.id ? { ...o, amount_cents: newAmountCents } : o,
        ),
      );
      setEditingOcc(null);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  }

  if (loading || !income) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <IncomeForm
          submitLabel="Guardar cambios"
          onSubmit={handleUpdate}
          defaultValues={{
            amount: fromCents(income.amount_cents),
            currency: isSupportedCurrency(income.currency) ? income.currency : 'CRC',
            source: income.source ?? '',
            frequency: income.frequency,
            start_date: income.start_date,
            end_date: income.end_date ?? '',
            note: income.note ?? '',
          }}
        />

        {/* OCURRENCIAS */}
        <View className="mt-8">
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            Ocurrencias proyectadas
          </Text>
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            Tocá el círculo para confirmar que llegó. Tocá el monto para ajustar solo esa ocurrencia.
          </Text>
          <OccurrencesList
            occurrences={occurrences}
            currency={income.currency}
            onToggleConfirm={handleToggleConfirm}
            onPressAmount={setEditingOcc}
          />
        </View>

        {/* DELETE */}
        <View className="mt-10">
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 active:bg-red-100"
          >
            <Trash2 size={18} color="#dc2626" />
            <Text className="text-base font-semibold text-red-700 dark:text-red-300">Eliminar ingreso</Text>
          </Pressable>
        </View>
      </ScrollView>

      <OverrideAmountModal
        visible={editingOcc !== null}
        initialAmountCents={editingOcc?.amount_cents ?? 0}
        baselineAmountCents={income.amount_cents}
        currency={income.currency}
        onCancel={() => setEditingOcc(null)}
        onSave={handleOverrideSave}
      />
    </KeyboardAvoidingView>
  );
}
