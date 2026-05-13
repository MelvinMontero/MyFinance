import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Receipt } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCategories } from '@/features/categories/repository';
import { FixedExpenseCard } from '@/features/fixed-expenses/FixedExpenseCard';
import {
  currentPeriod,
  listFixedExpensesWithPayment,
  markAsPaid,
  unmarkAsPaid,
  type FixedExpenseWithPayment,
} from '@/features/fixed-expenses/repository';
import type { Category } from '@/shared/db/types';

export default function FixedExpensesScreen() {
  const router = useRouter();
  const [period] = useState(currentPeriod);
  const [items, setItems] = useState<FixedExpenseWithPayment[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [exps, cats] = await Promise.all([
        listFixedExpensesWithPayment(period),
        listCategories({ type: 'fixed_expense', includeArchived: true }),
      ]);
      const catMap: Record<string, Category> = {};
      for (const c of cats) catMap[c.id] = c;
      setItems(exps);
      setCategories(catMap);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function handleTogglePaid(id: string, paid: boolean) {
    try {
      if (paid) {
        await markAsPaid(id, period);
      } else {
        await unmarkAsPaid(id, period);
      }
      await reload();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  }

  const paidCount = items.filter((e) => e.payment_id !== null).length;
  const totalCount = items.length;
  const periodLabel = formatPeriodLabel(period);
  const allPaid = totalCount > 0 && paidCount === totalCount;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <View className="px-6 pb-4 pt-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gastos fijos</Text>
        <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">{periodLabel}</Text>

        {totalCount > 0 && (
          <View
            className={
              allPaid
                ? 'mt-4 rounded-2xl bg-emerald-100 dark:bg-emerald-900 p-4'
                : 'mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950 p-4'
            }
          >
            <Text
              className={
                allPaid
                  ? 'text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
                  : 'text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300'
              }
            >
              {allPaid ? '¡Mes al día!' : 'Progreso del mes'}
            </Text>
            <Text
              className={
                allPaid
                  ? 'mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100'
                  : 'mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100'
              }
            >
              {paidCount} de {totalCount} pagados
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 12 }}
        renderItem={({ item }) => (
          <FixedExpenseCard
            expense={item}
            category={categories[item.category_id]}
            onPress={() => router.push(`/fixed-expense/${item.id}`)}
            onTogglePaid={(paid) => handleTogglePaid(item.id, paid)}
          />
        )}
        ListEmptyComponent={
          loading ? null : (
            <View className="mt-8 items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-12">
              <Receipt size={48} color="#cbd5e1" strokeWidth={1.5} />
              <Text className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                Sin gastos fijos
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                Agregá renta, internet, suscripciones — todo lo que se paga mes a mes.
              </Text>
              <Pressable
                onPress={() => router.push('/fixed-expense/new')}
                accessibilityRole="button"
                className="mt-5 rounded-2xl bg-emerald-600 px-5 py-3 active:bg-emerald-700"
              >
                <Text className="text-sm font-bold text-white">Agregar gasto fijo</Text>
              </Pressable>
            </View>
          )
        }
      />

      {totalCount > 0 && (
        <Pressable
          onPress={() => router.push('/fixed-expense/new')}
          accessibilityLabel="Agregar nuevo gasto fijo"
          accessibilityRole="button"
          className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-emerald-600 active:bg-emerald-700"
          style={{
            elevation: 6,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function formatPeriodLabel(period: string): string {
  // period = "yyyy-MM"
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = format(date, "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
