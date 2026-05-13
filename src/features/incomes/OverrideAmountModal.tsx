import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { currencySymbol } from '@/shared/utils/currency';
import { formatCents, fromCents, parseAmount, toCents } from '@/shared/utils/money';

interface Props {
  visible: boolean;
  /** Monto base de la ocurrencia (centavos). */
  initialAmountCents: number;
  /** Monto del ingreso recurrente (para mostrar como referencia). */
  baselineAmountCents: number;
  /** Moneda del ingreso padre (CRC, USD, …). */
  currency: string;
  onCancel: () => void;
  onSave: (newAmountCents: number) => void;
}

/**
 * Modal para sobre-escribir el monto de una ocurrencia individual.
 * No toca la serie — solo esta ocurrencia.
 */
export function OverrideAmountModal({
  visible,
  initialAmountCents,
  baselineAmountCents,
  currency,
  onCancel,
  onSave,
}: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText(String(fromCents(initialAmountCents)));
      setError(null);
    }
  }, [visible, initialAmountCents]);

  function handleSave() {
    try {
      const parsed = parseAmount(text);
      if (parsed <= 0) {
        setError('El monto debe ser mayor que cero');
        return;
      }
      onSave(toCents(parsed));
    } catch {
      setError('Monto inválido');
    }
  }

  function handleReset() {
    setText(String(fromCents(baselineAmountCents)));
    setError(null);
  }

  const isOverridden = initialAmountCents !== baselineAmountCents;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        className="flex-1 items-center justify-center bg-black/40 px-6"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full rounded-3xl bg-white dark:bg-gray-900 p-6"
          style={{ maxWidth: 420 }}
        >
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">Ajustar monto</Text>
          <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Cambia solo esta ocurrencia. La serie no se altera.
          </Text>

          <Text className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            Monto en {currency}
          </Text>
          <View className="flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-4 py-3">
            <Text className="mr-2 text-xl font-semibold text-gray-400 dark:text-gray-500">{currencySymbol(currency)}</Text>
            <TextInput
              className="flex-1 text-xl font-semibold text-gray-900 dark:text-gray-100"
              keyboardType="decimal-pad"
              value={text}
              onChangeText={(t) => {
                setText(t);
                setError(null);
              }}
              autoFocus
              selectTextOnFocus
            />
          </View>
          {error && <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</Text>}

          <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Monto base del ingreso: {formatCents(baselineAmountCents, { currency })}
          </Text>

          {isOverridden && (
            <Pressable
              onPress={handleReset}
              accessibilityRole="button"
              className="mt-3 self-start rounded-lg px-2 py-1 active:bg-gray-100"
            >
              <Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                ↺ Volver al monto base
              </Text>
            </Pressable>
          )}

          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              className="flex-1 items-center rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 active:bg-gray-50"
            >
              <Text className="text-base font-semibold text-gray-700 dark:text-gray-300">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              accessibilityRole="button"
              className="flex-1 items-center rounded-2xl bg-emerald-600 px-4 py-3 active:bg-emerald-700"
            >
              <Text className="text-base font-bold text-white">Guardar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
