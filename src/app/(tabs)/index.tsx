import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCategoryCount, getSettings, initDb } from '@/shared/db';
import type { Settings } from '@/shared/db/types';

type Status = 'loading' | 'ready' | 'error';

export default function HomeScreen() {
  const [status, setStatus] = useState<Status>('loading');
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDb();
        const [count, settingsRow] = await Promise.all([getCategoryCount(), getSettings()]);
        if (cancelled) return;
        setCategoryCount(count);
        setSettings(settingsRow);
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
  }, []);

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-base text-gray-700">Iniciando base de datos…</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg font-semibold text-red-600">Error al iniciar la base de datos</Text>
        <Text className="mt-2 text-center text-sm text-gray-600">{errorMsg}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 py-10">
        <Text className="text-3xl font-bold text-gray-900">MyFinance</Text>
        <Text className="mt-2 text-base text-gray-500">Fase 1 — Setup + DB</Text>

        <View className="mt-8 rounded-2xl bg-emerald-50 p-5">
          <Text className="text-sm uppercase tracking-wide text-emerald-700">Estado</Text>
          <Text className="mt-1 text-xl font-semibold text-emerald-900">
            DB inicializada — {categoryCount} categorías cargadas
          </Text>
        </View>

        {settings && (
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <Text className="text-sm uppercase tracking-wide text-gray-600">Configuración inicial</Text>
            <Text className="mt-1 text-base text-gray-900">
              Ahorro objetivo: {settings.savings_percent}%
            </Text>
            <Text className="text-base text-gray-900">Moneda: {settings.currency}</Text>
            <Text className="text-base text-gray-900">Tema: {settings.theme}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
