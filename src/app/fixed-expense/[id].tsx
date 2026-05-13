import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
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

import { FixedExpenseForm } from '@/features/fixed-expenses/FixedExpenseForm';
import {
  deleteFixedExpense,
  getFixedExpense,
  listPaymentsForExpense,
  updateFixedExpense,
} from '@/features/fixed-expenses/repository';
import type { FixedExpenseFormValues } from '@/features/fixed-expenses/schemas';
import type { FixedExpense, FixedExpensePayment } from '@/shared/db/types';
import { isSupportedCurrency } from '@/shared/utils/currency';
import { formatCents, fromCents, toCents } from '@/shared/utils/money';

export default function EditFixedExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [expense, setExpense] = useState<FixedExpense | null>(null);
  const [payments, setPayments] = useState<FixedExpensePayment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [exp, pays] = await Promise.all([
        getFixedExpense(id),
        listPaymentsForExpense(id),
      ]);
      setExpense(exp);
      setPayments(pays);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleUpdate(values: FixedExpenseFormValues) {
    if (!expense) return;
    try {
      await updateFixedExpense(expense.id, {
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
      Alert.alert('Error al actualizar', err instanceof Error ? err.message : String(err));
    }
  }

  function confirmDelete() {
    if (!expense) return;
    Alert.alert(
      'Eliminar gasto fijo',
      `¿Seguro que querés eliminar "${expense.name}"?${
        payments.length > 0
          ? ` Se borrará también el historial de ${payments.length} ${payments.length === 1 ? 'pago' : 'pagos'}.`
          : ''
      }`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFixedExpense(expense.id);
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
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <FixedExpenseForm
          submitLabel="Guardar cambios"
          onSubmit={handleUpdate}
          defaultValues={{
            name: expense.name,
            amount: fromCents(expense.amount_cents),
            currency: isSupportedCurrency(expense.currency) ? expense.currency : 'CRC',
            category_id: expense.category_id,
            due_day: expense.due_day,
            start_date: expense.start_date,
            end_date: expense.end_date ?? '',
          }}
        />

        {/* Historial de pagos */}
        {payments.length > 0 && (
          <View className="mt-8">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
              Historial de pagos
            </Text>
            <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {payments.map((p, idx) => (
                <View
                  key={p.id}
                  className={
                    idx > 0
                      ? 'flex-row items-center justify-between border-t border-gray-100 px-4 py-3'
                      : 'flex-row items-center justify-between px-4 py-3'
                  }
                >
                  <View>
                    <Text className="text-base text-gray-900">
                      {formatPeriodLabelLong(p.period)}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Pagado el {formatDateShort(p.paid_at)}
                    </Text>
                  </View>
                  <Text className="text-base font-semibold text-gray-900">
                    {formatCents(p.amount_cents, { currency: expense.currency })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* DELETE */}
        <View className="mt-10">
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 active:bg-red-100"
          >
            <Trash2 size={18} color="#dc2626" />
            <Text className="text-base font-semibold text-red-700">Eliminar gasto fijo</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatPeriodLabelLong(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = format(date, "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateShort(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}
