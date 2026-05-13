import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Wallet } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IncomeCard } from '@/features/incomes/IncomeCard';
import { listIncomes } from '@/features/incomes/repository';
import type { Income } from '@/shared/db/types';

export default function IncomesScreen() {
  const router = useRouter();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const rows = await listIncomes();
          if (!cancelled) setIncomes(rows);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <View className="px-6 pb-4 pt-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">Ingresos</Text>
        <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">
          {loading
            ? 'Cargando…'
            : `${incomes.length} ${incomes.length === 1 ? 'ingreso registrado' : 'ingresos registrados'}`}
        </Text>
      </View>

      <FlatList
        data={incomes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 12 }}
        renderItem={({ item }) => (
          <IncomeCard income={item} onPress={() => router.push(`/income/${item.id}`)} />
        )}
        ListEmptyComponent={
          loading ? null : (
            <View className="mt-8 items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-12">
              <Wallet size={48} color="#cbd5e1" strokeWidth={1.5} />
              <Text className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                Aún no hay ingresos
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                Agregá tu primer ingreso para empezar a proyectar tus sobres.
              </Text>
              <Pressable
                onPress={() => router.push('/income/new')}
                accessibilityRole="button"
                className="mt-5 rounded-2xl bg-emerald-600 px-5 py-3 active:bg-emerald-700"
              >
                <Text className="text-sm font-bold text-white">Agregar ingreso</Text>
              </Pressable>
            </View>
          )
        }
      />

      {incomes.length > 0 && (
        <Pressable
          onPress={() => router.push('/income/new')}
          accessibilityLabel="Agregar nuevo ingreso"
          accessibilityRole="button"
          className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-emerald-600 shadow-lg active:bg-emerald-700"
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
