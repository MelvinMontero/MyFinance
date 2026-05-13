import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, ShoppingBag } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCategories } from '@/features/categories/repository';
import { useSettings } from '@/features/settings/store';
import { VariableExpenseCard } from '@/features/variable-expenses/VariableExpenseCard';
import {
  currentPeriod,
  getVariableExpenseTotal,
  listVariableExpenses,
} from '@/features/variable-expenses/repository';
import type { Category, VariableExpense } from '@/shared/db/types';
import { formatCents } from '@/shared/utils/money';

export default function ExtrasScreen() {
  const router = useRouter();
  const [period] = useState(currentPeriod);
  const [items, setItems] = useState<VariableExpense[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const liveCurrency = useSettings((s) => s.currency);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [exps, cats, tot] = await Promise.all([
        listVariableExpenses({ period, currency: liveCurrency }),
        listCategories({ type: 'variable_expense', includeArchived: true }),
        getVariableExpenseTotal(period, liveCurrency),
      ]);
      const catMap: Record<string, Category> = {};
      for (const c of cats) catMap[c.id] = c;
      setItems(exps);
      setCategories(catMap);
      setTotal(tot);
    } finally {
      setLoading(false);
    }
  }, [period, liveCurrency]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const periodLabel = formatPeriodLabel(period);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <View className="px-6 pb-4 pt-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">Extras</Text>
        <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">{periodLabel}</Text>

        <View className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950 p-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Gastado este mes
          </Text>
          <Text className="mt-1 text-3xl font-bold text-amber-900 dark:text-amber-100">
            {formatCents(total, { currency: liveCurrency })}
          </Text>
          <Text className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {items.length === 0
              ? 'Aún no hay gastos extras registrados'
              : items.length === 1
                ? '1 gasto registrado'
                : `${items.length} gastos registrados`}
          </Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 12 }}
        renderItem={({ item }) => (
          <VariableExpenseCard
            expense={item}
            category={categories[item.category_id]}
            onPress={() => router.push(`/variable-expense/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          loading ? null : (
            <View className="mt-4 items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-12">
              <ShoppingBag size={48} color="#cbd5e1" strokeWidth={1.5} />
              <Text className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                Sin gastos extras
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                Cafés, comidas fuera, salidas — todo lo que sale del dinero libre.
              </Text>
              <Pressable
                onPress={() => router.push('/variable-expense/new')}
                accessibilityRole="button"
                className="mt-5 rounded-2xl bg-amber-600 px-5 py-3 active:bg-amber-700"
              >
                <Text className="text-sm font-bold text-white">Agregar gasto</Text>
              </Pressable>
            </View>
          )
        }
      />

      <Pressable
        onPress={() => router.push('/variable-expense/new')}
        accessibilityLabel="Agregar nuevo gasto extra"
        accessibilityRole="button"
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-amber-500 active:bg-amber-600"
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
    </SafeAreaView>
  );
}

function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = format(date, 'MMMM yyyy', { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
