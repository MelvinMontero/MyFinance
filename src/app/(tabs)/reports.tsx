import { addMonths, addYears, format, parse, subMonths, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';

import { CategoryIcon } from '@/features/categories/CategoryIcon';
import {
  getMonthlyVariableBreakdown,
  getYearlyBudget,
  getYearlyKpis,
  type CategoryBreakdown,
  type MonthlyBudgetEntry,
  type YearlyKpis,
} from '@/features/reports/repository';
import { useSettings } from '@/features/settings/store';
import { currentPeriod } from '@/features/fixed-expenses/repository';
import { formatCents, fromCents } from '@/shared/utils/money';

type ReportMode = 'monthly' | 'yearly';

export default function ReportsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <ReportsContent />
    </SafeAreaView>
  );
}

/**
 * Estado y data fetching aislados en hijo para evitar el bug de
 * printUpgradeWarning de expo-router (mismo patrón que en HomeScreen).
 */
function ReportsContent() {
  const currency = useSettings((s) => s.currency);
  const savingsPercent = useSettings((s) => s.savings_percent);

  const [mode, setMode] = useState<ReportMode>('monthly');
  const [monthPeriod, setMonthPeriod] = useState<string>(currentPeriod);
  const [yearPeriod, setYearPeriod] = useState<string>(() =>
    format(new Date(), 'yyyy'),
  );

  const [monthlyBreakdown, setMonthlyBreakdown] = useState<CategoryBreakdown[]>([]);
  const [yearlyBudget, setYearlyBudget] = useState<MonthlyBudgetEntry[]>([]);
  const [kpis, setKpis] = useState<YearlyKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          if (mode === 'monthly') {
            const breakdown = await getMonthlyVariableBreakdown(monthPeriod, currency);
            if (!cancelled) setMonthlyBreakdown(breakdown);
          } else {
            const [budget, k] = await Promise.all([
              getYearlyBudget(yearPeriod, currency, savingsPercent),
              getYearlyKpis(yearPeriod, currency, savingsPercent),
            ]);
            if (!cancelled) {
              setYearlyBudget(budget);
              setKpis(k);
            }
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [mode, monthPeriod, yearPeriod, currency, savingsPercent]),
  );

  function prev() {
    if (mode === 'monthly') {
      const date = parse(monthPeriod, 'yyyy-MM', new Date());
      setMonthPeriod(format(subMonths(date, 1), 'yyyy-MM'));
    } else {
      const date = parse(yearPeriod, 'yyyy', new Date());
      setYearPeriod(format(subYears(date, 1), 'yyyy'));
    }
  }

  function next() {
    if (mode === 'monthly') {
      const date = parse(monthPeriod, 'yyyy-MM', new Date());
      setMonthPeriod(format(addMonths(date, 1), 'yyyy-MM'));
    } else {
      const date = parse(yearPeriod, 'yyyy', new Date());
      setYearPeriod(format(addYears(date, 1), 'yyyy'));
    }
  }

  const periodLabel =
    mode === 'monthly' ? formatMonthLabel(monthPeriod) : yearPeriod;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
      {/* HEADER */}
      <View className="pt-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">Reportes</Text>
        <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">
          Cómo se mueve tu plata en {currency}
        </Text>
      </View>

      {/* TOGGLE */}
      <View className="mt-4 flex-row self-start rounded-2xl bg-gray-200 dark:bg-gray-700 p-1">
        <Pressable
          onPress={() => setMode('monthly')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'monthly' }}
          className={
            mode === 'monthly'
              ? 'rounded-xl bg-white dark:bg-gray-900 px-5 py-2'
              : 'rounded-xl px-5 py-2'
          }
        >
          <Text
            className={
              mode === 'monthly'
                ? 'text-sm font-bold text-gray-900 dark:text-gray-100'
                : 'text-sm font-medium text-gray-600 dark:text-gray-400'
            }
          >
            Mensual
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('yearly')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'yearly' }}
          className={
            mode === 'yearly'
              ? 'rounded-xl bg-white dark:bg-gray-900 px-5 py-2'
              : 'rounded-xl px-5 py-2'
          }
        >
          <Text
            className={
              mode === 'yearly'
                ? 'text-sm font-bold text-gray-900 dark:text-gray-100'
                : 'text-sm font-medium text-gray-600 dark:text-gray-400'
            }
          >
            Anual
          </Text>
        </Pressable>
      </View>

      {/* PERIOD NAV */}
      <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-white dark:bg-gray-900 px-4 py-3">
        <Pressable
          onPress={prev}
          accessibilityLabel="Período anterior"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
        >
          <ChevronLeft size={22} color="#475569" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">{periodLabel}</Text>
        <Pressable
          onPress={next}
          accessibilityLabel="Período siguiente"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
        >
          <ChevronRight size={22} color="#475569" />
        </Pressable>
      </View>

      {/* CONTENT */}
      {loading ? (
        <View className="mt-8 items-center py-8">
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : mode === 'monthly' ? (
        <MonthlyView breakdown={monthlyBreakdown} currency={currency} />
      ) : (
        <YearlyView budget={yearlyBudget} kpis={kpis} currency={currency} />
      )}
    </ScrollView>
  );
}

/* ===== MENSUAL ===== */

function MonthlyView({
  breakdown,
  currency,
}: {
  breakdown: CategoryBreakdown[];
  currency: string;
}) {
  const total = breakdown.reduce((acc, c) => acc + c.amount_cents, 0);

  if (breakdown.length === 0) {
    return (
      <View className="mt-6 items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-12">
        <PieIcon size={48} color="#cbd5e1" strokeWidth={1.5} />
        <Text className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
          Sin gastos extras
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
          No hay gastos variables registrados en este mes. Agregalos desde la tab
          Extras o el botón rápido del Inicio.
        </Text>
      </View>
    );
  }

  // Para el donut, gifted-charts toma `value` como número arbitrario.
  // Le pasamos colones (cents/100) para que las proporciones se mantengan
  // y los números sean razonables.
  const pieData = breakdown.map((c) => ({
    value: fromCents(c.amount_cents),
    color: c.color,
    text: '',
  }));

  return (
    <>
      {/* DONUT */}
      <View className="mt-6 items-center rounded-2xl bg-white dark:bg-gray-900 p-5">
        <Text className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Distribución por categoría
        </Text>
        <View className="my-4">
          <PieChart
            data={pieData}
            donut
            radius={110}
            innerRadius={70}
            centerLabelComponent={() => (
              <View className="items-center">
                <Text className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Total
                </Text>
                <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatCents(total, { currency })}
                </Text>
              </View>
            )}
          />
        </View>
      </View>

      {/* TOP CATEGORIES */}
      <View className="mt-4 rounded-2xl bg-white dark:bg-gray-900 p-5">
        <Text className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Top {Math.min(5, breakdown.length)} categorías
        </Text>
        <View className="mt-3 gap-3">
          {breakdown.slice(0, 5).map((cat) => {
            const pct = total > 0 ? (cat.amount_cents / total) * 100 : 0;
            return (
              <View key={cat.category_id} className="flex-row items-center">
                <View
                  className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: cat.color + '22' }}
                >
                  <CategoryIcon name={cat.icon} size={20} color={cat.color} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-baseline justify-between">
                    <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {cat.name}
                    </Text>
                    <Text className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {formatCents(cat.amount_cents, { currency })}
                    </Text>
                  </View>
                  <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </View>
                  <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {pct.toFixed(0)}% · {cat.count}{' '}
                    {cat.count === 1 ? 'gasto' : 'gastos'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}

/* ===== ANUAL ===== */

function YearlyView({
  budget,
  kpis,
  currency,
}: {
  budget: MonthlyBudgetEntry[];
  kpis: YearlyKpis | null;
  currency: string;
}) {
  const hasData = budget.some(
    (m) => m.income > 0 || m.fixedExpenses > 0 || m.variableExpensesSpent > 0,
  );

  if (!hasData || !kpis) {
    return (
      <View className="mt-6 items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-12">
        <BarChart3 size={48} color="#cbd5e1" strokeWidth={1.5} />
        <Text className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
          Sin datos para este año
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
          Cargá ingresos y gastos para ver el resumen anual.
        </Text>
      </View>
    );
  }

  // Stacked bars: cada mes muestra [ahorro, fijos, variables]. Convertimos a
  // colones para que el eje y se vea con números razonables.
  const stackData = budget.map((m) => ({
    stacks: [
      { value: fromCents(m.savings), color: '#10b981' },
      { value: fromCents(m.fixedExpenses), color: '#3b82f6' },
      { value: fromCents(m.variableExpensesSpent), color: '#f59e0b' },
    ],
    label: monthShortLabel(m.period),
  }));

  return (
    <>
      {/* STACKED BARS */}
      <View className="mt-6 rounded-2xl bg-white dark:bg-gray-900 p-5">
        <Text className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Distribución mensual del año
        </Text>
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">Ahorro · Fijos · Variables</Text>
        <View className="mt-4 -mx-2">
          <BarChart
            stackData={stackData}
            barWidth={18}
            spacing={6}
            initialSpacing={8}
            yAxisLabelWidth={48}
            xAxisLabelTextStyle={{ color: '#64748b', fontSize: 10 }}
            yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
            noOfSections={4}
            yAxisThickness={0}
            xAxisThickness={0}
            disableScroll
          />
        </View>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <LegendItem color="#10b981" label="Ahorro" />
          <LegendItem color="#3b82f6" label="Fijos" />
          <LegendItem color="#f59e0b" label="Variables" />
        </View>
      </View>

      {/* KPIs */}
      <View className="mt-4 gap-3">
        <KpiCard
          Icon={TrendingUp}
          label="Ahorro objetivo del año"
          value={formatCents(kpis.totalSavingsTarget, { currency })}
          tint="emerald"
        />
        <KpiCard
          Icon={TrendingDown}
          label="Total gastado"
          value={formatCents(kpis.totalFixedSpent + kpis.totalVariableSpent, {
            currency,
          })}
          subtitle={`${formatCents(kpis.totalFixedSpent, { currency })} fijos · ${formatCents(kpis.totalVariableSpent, { currency })} variables`}
          tint="amber"
        />
        <KpiCard
          Icon={BarChart3}
          label="Mes con más gasto"
          value={
            kpis.highestSpendMonth
              ? formatMonthLabel(kpis.highestSpendMonth.period)
              : '—'
          }
          subtitle={
            kpis.highestSpendMonth
              ? formatCents(kpis.highestSpendMonth.amount, { currency })
              : 'Sin datos'
          }
          tint="blue"
        />
        <KpiCard
          Icon={BarChart3}
          label="Promedio mensual de extras"
          value={formatCents(kpis.averageMonthlyVariableSpend, { currency })}
          subtitle="Solo meses con registros"
          tint="amber"
        />
      </View>
    </>
  );
}

/* ===== HELPERS ===== */

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Text>
    </View>
  );
}

type KpiTint = 'emerald' | 'blue' | 'amber';

const TINTS: Record<KpiTint, { bg: string; iconColor: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900', iconColor: '#059669', text: 'text-emerald-900 dark:text-emerald-100' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900', iconColor: '#2563eb', text: 'text-blue-900 dark:text-blue-100' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900', iconColor: '#d97706', text: 'text-amber-900 dark:text-amber-100' },
};

interface IconComponentProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function KpiCard({
  Icon,
  label,
  value,
  subtitle,
  tint,
}: {
  Icon: React.ComponentType<IconComponentProps>;
  label: string;
  value: string;
  subtitle?: string;
  tint: KpiTint;
}) {
  const t = TINTS[tint];
  return (
    <View className="flex-row items-center rounded-2xl bg-white dark:bg-gray-900 p-4">
      <View className={`mr-3 h-12 w-12 items-center justify-center rounded-2xl ${t.bg}`}>
        <Icon size={22} color={t.iconColor} strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </Text>
        <Text className={`text-lg font-bold ${t.text}`}>{value}</Text>
        {subtitle && <Text className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</Text>}
      </View>
    </View>
  );
}

function formatMonthLabel(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = format(date, 'MMMM yyyy', { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthShortLabel(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = format(date, 'MMM', { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
