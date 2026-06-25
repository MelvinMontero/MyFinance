import { Text, View } from 'react-native';

import { formatCents } from '@/shared/utils/money';

interface Props {
  label: string;
  amountCents: number;
  currency: string;
  subtitle?: string;
}

/** Fila del desglose "¿cuánto aparto este cobro?": etiqueta + monto + contexto. */
export function ProvisionRow({ label, amountCents, currency, subtitle }: Props) {
  return (
    <View className="flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800 py-3">
      <View className="flex-1 pr-3">
        <Text className="text-base font-medium text-gray-900 dark:text-gray-100">{label}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</Text>
        ) : null}
      </View>
      <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {formatCents(amountCents, { currency })}
      </Text>
    </View>
  );
}
