import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getFixedExpenseCount,
  getPaymentSummary,
} from '@/features/fixed-expenses/repository';
import {
  getIncomeCount,
  getOccurrenceCount,
} from '@/features/incomes/repository';
import { useSettings } from '@/features/settings/store';
import { getCategoryCount, getSettings, initDb } from '@/shared/db';
import type { Settings } from '@/shared/db/types';

type Status = 'loading' | 'ready' | 'error';

export default function HomeScreen() {
  const [status, setStatus] = useState<Status>('loading');
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [incomeCount, setIncomeCount] = useState<number>(0);
  const [occCount, setOccCount] = useState<number>(0);
  const [fixedCount, setFixedCount] = useState<number>(0);
  const [paidThisMonth, setPaidThisMonth] = useState<number>(0);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Estos vienen del store reactivo — se actualizan cuando cambiás en Ajustes.
  const liveSavingsPercent = useSettings((s) => s.savings_percent);
  const liveCurrency = useSettings((s) => s.currency);

  // Init de DB + settings store una sola vez
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDb();
        const [count, settingsRow] = await Promise.all([
          getCategoryCount(),
          getSettings(),
          useSettings.getState().load(),
        ]);
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

  // Refrescar conteos cada vez que la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [incCount, oCount, fxCount, summary] = await Promise.all([
            getIncomeCount(),
            getOccurrenceCount(),
            getFixedExpenseCount(),
            getPaymentSummary(),
          ]);
          if (!cancelled) {
            setIncomeCount(incCount);
            setOccCount(oCount);
            setFixedCount(fxCount);
            setPaidThisMonth(summary.paid);
          }
        } catch {
          /* silent — el dashboard sigue mostrando los demás datos */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
        <Text className="mt-2 text-base text-gray-500">Fase 3 — Gastos fijos</Text>

        <View className="mt-8 rounded-2xl bg-emerald-50 p-5">
          <Text className="text-sm uppercase tracking-wide text-emerald-700">Ingresos</Text>
          <Text className="mt-1 text-xl font-semibold text-emerald-900">
            {incomeCount} {incomeCount === 1 ? 'activo' : 'activos'}
          </Text>
          <Text className="mt-1 text-sm text-emerald-800">
            {occCount} {occCount === 1 ? 'ocurrencia proyectada' : 'ocurrencias proyectadas'}
          </Text>
        </View>

        <View className="mt-4 rounded-2xl bg-blue-50 p-5">
          <Text className="text-sm uppercase tracking-wide text-blue-700">Gastos fijos</Text>
          <Text className="mt-1 text-xl font-semibold text-blue-900">
            {paidThisMonth} de {fixedCount} pagados este mes
          </Text>
          <Text className="mt-1 text-sm text-blue-800">
            {fixedCount === 0
              ? 'Sin gastos fijos aún'
              : fixedCount - paidThisMonth === 0
                ? '¡Todo al día!'
                : `${fixedCount - paidThisMonth} ${fixedCount - paidThisMonth === 1 ? 'pendiente' : 'pendientes'} en lo que va del mes`}
          </Text>
        </View>

        <View className="mt-4 rounded-2xl bg-gray-100 p-5">
          <Text className="text-sm uppercase tracking-wide text-gray-700">Catálogo</Text>
          <Text className="mt-1 text-sm text-gray-700">
            {categoryCount} categorías cargadas
          </Text>
        </View>

        {settings && (
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <Text className="text-sm uppercase tracking-wide text-gray-600">Configuración</Text>
            <Text className="mt-1 text-base text-gray-900">
              Ahorro objetivo: {liveSavingsPercent}%
            </Text>
            <Text className="text-base text-gray-900">
              Moneda por defecto: {liveCurrency}
            </Text>
            <Text className="text-base text-gray-900">Tema: {settings.theme}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
