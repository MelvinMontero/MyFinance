import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Target } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalCard } from '@/features/goals/GoalCard';
import { listGoalsWithPlan, type GoalWithPlan } from '@/features/goals/repository';
import { initDb } from '@/shared/db';

type Status = 'loading' | 'ready' | 'error';

export default function GoalsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [goals, setGoals] = useState<GoalWithPlan[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setStatus('loading');
        try {
          await initDb();
          const rows = await listGoalsWithPlan(new Date());
          if (cancelled) return;
          setGoals(rows);
          setStatus('ready');
        } catch (err) {
          if (cancelled) return;
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setStatus('error');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">Metas</Text>
        <Pressable
          onPress={() => router.push('/goal/new')}
          accessibilityLabel="Agregar meta"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full bg-emerald-600 active:bg-emerald-700"
        >
          <Plus size={24} color="#fff" strokeWidth={2.5} />
        </Pressable>
      </View>

      {status === 'loading' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : status === 'error' ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg font-semibold text-red-600 dark:text-red-400">Error al cargar</Text>
          <Text className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">{errorMsg}</Text>
        </View>
      ) : goals.length === 0 ? (
        <EmptyState onAdd={() => router.push('/goal/new')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 }}>
          <View className="gap-3">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} onPress={() => router.push(`/goal/${g.id}`)} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-8">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900">
          <Target size={32} color="#059669" strokeWidth={2} />
        </View>
        <Text className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">Aún no tenés metas</Text>
        <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
          Creá una meta de ahorro y la app calcula cuánto apartar en cada cobro para llegar a tiempo.
        </Text>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          className="mt-5 rounded-2xl bg-emerald-600 px-6 py-3 active:bg-emerald-700"
        >
          <Text className="text-sm font-bold text-white">Crear meta</Text>
        </Pressable>
      </View>
    </View>
  );
}
