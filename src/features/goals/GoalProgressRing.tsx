import { useColorScheme } from 'nativewind';
import { Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { formatCents } from '@/shared/utils/money';

interface GoalProgressRingProps {
  progressRatio: number; // 0..1
  saved: number; // centavos
  target: number; // centavos
  currency: string;
  size?: number; // default 120
}

/** Anillo de progreso de una meta (donut violeta + centro con % y ahorrado). */
export function GoalProgressRing({
  progressRatio,
  saved,
  target,
  currency,
  size = 120,
}: GoalProgressRingProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const clamped = Math.min(1, Math.max(0, progressRatio));
  const pct = Math.round(clamped * 100);
  const restColor = isDark ? '#334155' : '#e5e7eb';

  const data =
    clamped >= 1
      ? [{ value: 1, color: '#6366f1' }]
      : clamped <= 0
        ? [{ value: 1, color: restColor }]
        : [
            { value: clamped, color: '#6366f1' },
            { value: 1 - clamped, color: restColor },
          ];

  return (
    <View accessibilityLabel={`Progreso de la meta: ${pct}%`}>
      <PieChart
        data={data}
        donut
        radius={size / 2}
        innerRadius={Math.round((size / 2) * 0.72)}
        innerCircleColor={isDark ? '#111827' : '#ffffff'}
        centerLabelComponent={() => (
          <View className="items-center">
            <Text className="text-2xl font-bold text-violet-700 dark:text-violet-300">{pct}%</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {formatCents(saved, { currency })}
            </Text>
            <Text className="text-[10px] text-gray-400 dark:text-gray-500">
              de {formatCents(target, { currency })}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
