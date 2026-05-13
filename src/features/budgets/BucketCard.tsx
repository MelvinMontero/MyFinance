import { Text, View } from 'react-native';
import type { ComponentType } from 'react';

import { formatCents } from '@/shared/utils/money';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export type BucketColor = 'emerald' | 'blue' | 'amber';

interface Props {
  Icon: ComponentType<IconProps>;
  title: string;
  /** Monto principal (centavos). */
  amount: number;
  currency: string;
  color: BucketColor;
  /** Subtítulo descriptivo. */
  subtitle?: string;
  /** Si se pasa, dibuja barra de progreso `value / max`. */
  progress?: {
    value: number;
    max: number;
    /** Texto a mostrar debajo de la barra (ej "4 de 8 pagados"). */
    label: string;
  };
}

// Mapas estáticos de clases para que Tailwind las detecte en build time.
const TONES: Record<BucketColor, {
  iconBg: string;
  iconColor: string;
  amountColor: string;
  barFill: string;
  cardBorder: string;
}> = {
  emerald: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900',
    iconColor: '#059669',
    amountColor: 'text-emerald-900 dark:text-emerald-100',
    barFill: 'bg-emerald-500',
    cardBorder: 'border-emerald-200 dark:border-emerald-800',
  },
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-900',
    iconColor: '#2563eb',
    amountColor: 'text-blue-900 dark:text-blue-100',
    barFill: 'bg-blue-500',
    cardBorder: 'border-blue-200 dark:border-blue-800',
  },
  amber: {
    iconBg: 'bg-amber-100 dark:bg-amber-900',
    iconColor: '#d97706',
    amountColor: 'text-amber-900 dark:text-amber-100',
    barFill: 'bg-amber-500',
    cardBorder: 'border-amber-200 dark:border-amber-800',
  },
};

export function BucketCard({ Icon, title, amount, currency, color, subtitle, progress }: Props) {
  const tone = TONES[color];
  const pct =
    progress && progress.max > 0
      ? Math.min(100, Math.max(0, (progress.value / progress.max) * 100))
      : 0;

  return (
    <View className={`rounded-2xl border bg-white dark:bg-gray-900 p-5 ${tone.cardBorder}`}>
      <View className="flex-row items-center">
        <View className={`mr-3 h-12 w-12 items-center justify-center rounded-2xl ${tone.iconBg}`}>
          <Icon size={24} color={tone.iconColor} strokeWidth={2} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {title}
          </Text>
          <Text className={`text-2xl font-bold ${tone.amountColor}`}>
            {formatCents(amount, { currency })}
          </Text>
        </View>
      </View>

      {subtitle && <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</Text>}

      {progress && (
        <View className="mt-4">
          <View className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <View
              className={`h-full rounded-full ${tone.barFill}`}
              style={{ width: `${pct}%` }}
            />
          </View>
          <Text className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">{progress.label}</Text>
        </View>
      )}
    </View>
  );
}
