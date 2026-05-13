import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/features/settings/store';
import {
  SUPPORTED_CURRENCIES,
  currencyName,
  currencySymbol,
} from '@/shared/utils/currency';

export default function SettingsScreen() {
  const savingsPercent = useSettings((s) => s.savings_percent);
  const currency = useSettings((s) => s.currency);
  const setSavingsPercent = useSettings((s) => s.setSavingsPercent);
  const setCurrency = useSettings((s) => s.setCurrency);

  // Valor en vivo del slider (mientras arrastrás), para feedback inmediato.
  const [draftPct, setDraftPct] = useState(savingsPercent);

  // Si la fuente cambia (ej. otra pantalla actualizó), sincronizamos el draft.
  useEffect(() => {
    setDraftPct(savingsPercent);
  }, [savingsPercent]);

  async function handlePctRelease(value: number) {
    const rounded = Math.round(value);
    setDraftPct(rounded);
    try {
      await setSavingsPercent(rounded);
    } catch (e) {
      Alert.alert(
        'Error al guardar',
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  async function handleCurrencyChange(c: string) {
    if (c === currency) return;
    try {
      await setCurrency(c);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 pb-24 pt-4">
        <Text className="text-3xl font-bold text-gray-900">Ajustes</Text>
        <Text className="mt-1 text-base text-gray-500">
          Personalizá MyFinance a tus números.
        </Text>

        {/* META DE AHORRO */}
        <View className="mt-8 rounded-2xl bg-white p-5">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Meta de ahorro mensual
          </Text>
          <View className="mt-2 flex-row items-baseline">
            <Text className="text-5xl font-bold text-emerald-700">{draftPct}</Text>
            <Text className="ml-1 text-2xl font-semibold text-emerald-700">%</Text>
          </View>
          <Text className="mt-2 text-sm text-gray-500">
            Del total de ingresos del mes, este porcentaje se reserva automáticamente
            para tu sobre de ahorro.
          </Text>
          <Slider
            style={{ width: '100%', height: 44, marginTop: 16 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={savingsPercent}
            onValueChange={(v) => setDraftPct(Math.round(v))}
            onSlidingComplete={handlePctRelease}
            minimumTrackTintColor="#059669"
            maximumTrackTintColor="#d1d5db"
            thumbTintColor="#059669"
          />
          <View className="-mt-1 flex-row justify-between">
            <Text className="text-xs text-gray-400">0%</Text>
            <Text className="text-xs text-gray-400">50%</Text>
            <Text className="text-xs text-gray-400">100%</Text>
          </View>
        </View>

        {/* MONEDA POR DEFECTO */}
        <View className="mt-4 rounded-2xl bg-white p-5">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Moneda por defecto
          </Text>
          <Text className="mt-1 text-sm text-gray-500">
            Es la moneda preseleccionada al crear un nuevo ingreso o gasto. Podés
            elegir otra para cada registro individual.
          </Text>

          <View className="mt-4 gap-2">
            {SUPPORTED_CURRENCIES.map((c) => {
              const selected = currency === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => handleCurrencyChange(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Cambiar moneda a ${currencyName(c)}`}
                  className={
                    selected
                      ? 'flex-row items-center justify-between rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4'
                      : 'flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4'
                  }
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={
                        selected
                          ? 'h-11 w-11 items-center justify-center rounded-xl bg-emerald-600'
                          : 'h-11 w-11 items-center justify-center rounded-xl bg-gray-100'
                      }
                    >
                      <Text
                        className={
                          selected
                            ? 'text-xl font-bold text-white'
                            : 'text-xl font-bold text-gray-700'
                        }
                      >
                        {currencySymbol(c)}
                      </Text>
                    </View>
                    <Text
                      className={
                        selected
                          ? 'text-base font-semibold text-emerald-800'
                          : 'text-base font-semibold text-gray-900'
                      }
                    >
                      {currencyName(c)}
                    </Text>
                  </View>
                  {selected && (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                      <Text className="text-xs font-bold text-white">✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* NOTA */}
        <View className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <Text className="text-sm font-semibold text-emerald-900">Moneda por registro</Text>
          <Text className="mt-1 text-sm text-emerald-800">
            Cada ingreso, gasto fijo y gasto variable guarda su propia moneda. Cambiar
            la default acá no toca los registros ya creados — solo afecta el valor
            preseleccionado en los formularios nuevos.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
