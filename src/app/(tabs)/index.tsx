import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  PiggyBank,
  Plus,
  Receipt,
  Wallet,
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

import { BucketCard } from '@/features/budgets/BucketCard';
import {
  getBudgetForPeriod,
  type BudgetForPeriod,
} from '@/features/budgets/repository';
import {
  currentPeriod,
  getPaymentSummary,
} from '@/features/fixed-expenses/repository';
import { useSettings } from '@/features/settings/store';
import { initDb } from '@/shared/db';
import { formatCents } from '@/shared/utils/money';

type Status = 'loading' | 'ready' | 'error';
type ViewMode = 'monthly' | 'biweekly';

export default function HomeScreen() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetForPeriod | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<{ paid: number; total: number }>({
    paid: 0,
    total: 0,
  });

  const liveCurrency = useSettings((s) => s.currency);
  const liveSavingsPercent = useSettings((s) => s.savings_percent);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setStatus('loading');
        try {
          await initDb();
          await useSettings.getState().load();
          const period = currentPeriod();
          const [b, summary] = await Promise.all([
            getBudgetForPeriod(period, liveCurrency, liveSavingsPercent),
            getPaymentSummary(period, liveCurrency),
          ]);
          if (cancelled) return;
          setBudget(b);
          setPaymentSummary(summary);
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
    }, [liveCurrency, liveSavingsPercent]),
  );

  const periodLabel = formatPeriodLabel(currentPeriod());

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-base text-gray-700">Calculando tus sobres…</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg font-semibold text-red-600">Error al cargar</Text>
        <Text className="mt-2 text-center text-sm text-gray-600">{errorMsg}</Text>
      </SafeAreaView>
    );
  }

  if (!budget) return null;

  const hasIncome = budget.income > 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
        {/* HEADER */}
        <View className="pt-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {periodLabel}
          </Text>
          <Text className="mt-1 text-3xl font-bold text-gray-900">MyFinance</Text>
        </View>

        {/* TOGGLE + SOBRES — se aísla en su propio componente para que el
            cambio de viewMode no haga re-render del HomeScreen y evite
            chocar con el wrapper de expo-router (printUpgradeWarning). */}
        {hasIncome ? (
          <BucketsBlock
            budget={budget}
            currency={liveCurrency}
            savingsPercent={liveSavingsPercent}
            paymentSummary={paymentSummary}
          />
        ) : (
          <EmptyState onAddIncome={() => router.push('/income/new')} />
        )}

        {/* WARNING over-budget */}
        {budget.isOverBudget && (
          <View className="mt-4 flex-row items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle size={20} color="#dc2626" strokeWidth={2} />
            <View className="flex-1">
              <Text className="text-sm font-bold text-red-900">Sobre presupuesto</Text>
              <Text className="mt-1 text-sm text-red-800">
                Tu ahorro objetivo + gastos fijos superan tu ingreso del mes en{' '}
                {formatCents(Math.abs(budget.freeMoney), { currency: liveCurrency })}. Revisá
                el % de ahorro o tus gastos fijos.
              </Text>
            </View>
          </View>
        )}

        {/* WARNING overspent */}
        {budget.isOverspent && !budget.isOverBudget && (
          <View className="mt-4 flex-row items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={20} color="#d97706" strokeWidth={2} />
            <View className="flex-1">
              <Text className="text-sm font-bold text-amber-900">Te pasaste del dinero libre</Text>
              <Text className="mt-1 text-sm text-amber-800">
                Excedés en {formatCents(Math.abs(budget.freeMoneyRemaining), { currency: liveCurrency })}.
                Considerá frenar gastos extras hasta el próximo mes.
              </Text>
            </View>
          </View>
        )}

        {/* OTRAS MONEDAS */}
        {budget.otherCurrenciesPresent.length > 0 && (
          <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              No incluidos en este cálculo
            </Text>
            <Text className="mt-1 text-sm text-gray-700">
              Tenés registros también en {budget.otherCurrenciesPresent.join(', ')}. Cambiá la
              moneda por defecto en Ajustes para ver sus sobres.
            </Text>
          </View>
        )}

        {/* FOOTER */}
        <View className="mt-6 rounded-2xl bg-white p-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Configuración actual
          </Text>
          <Text className="mt-1 text-sm text-gray-700">
            Moneda: {liveCurrency} · Ahorro objetivo: {liveSavingsPercent}%
          </Text>
        </View>
      </ScrollView>

      {/* FAB — gasto rápido (variable expense) */}
      {hasIncome && (
        <Pressable
          onPress={() => router.push('/variable-expense/new')}
          accessibilityLabel="Agregar gasto rápido"
          accessibilityRole="button"
          className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-amber-500 active:bg-amber-600"
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

/**
 * Componente aislado para el toggle y los 3 sobres.
 * Su propio useState(viewMode) NO escala el re-render a HomeScreen,
 * lo cual previene un choque con el wrapper de expo-router que en re-render
 * intenta llamar `printUpgradeWarning` sobre el contexto de navegación.
 */
function BucketsBlock({
  budget,
  currency,
  savingsPercent,
  paymentSummary,
}: {
  budget: BudgetForPeriod;
  currency: string;
  savingsPercent: number;
  paymentSummary: { paid: number; total: number };
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');

  const halve = (cents: number): number =>
    viewMode === 'biweekly' ? Math.round(cents / 2) : cents;
  const periodSuffix = viewMode === 'biweekly' ? 'por quincena' : 'este mes';

  const subtitleFreeMoney = budget.isOverspent
    ? `Gastaste ${formatCents(halve(budget.variableExpensesSpent), { currency })} de tu dinero libre`
    : budget.variableExpensesSpent > 0
      ? `Gastaste ${formatCents(halve(budget.variableExpensesSpent), { currency })} ${periodSuffix}`
      : 'Lo que podés gastar en gustos y extras';

  return (
    <>
      {/* TOGGLE Mensual / Quincenal */}
      <View className="mt-4 flex-row self-start rounded-2xl bg-gray-200 p-1">
        <Pressable
          onPress={() => setViewMode('monthly')}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'monthly' }}
          className={
            viewMode === 'monthly'
              ? 'rounded-xl bg-white px-5 py-2'
              : 'rounded-xl px-5 py-2'
          }
        >
          <Text
            className={
              viewMode === 'monthly'
                ? 'text-sm font-bold text-gray-900'
                : 'text-sm font-medium text-gray-600'
            }
          >
            Mensual
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('biweekly')}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'biweekly' }}
          className={
            viewMode === 'biweekly'
              ? 'rounded-xl bg-white px-5 py-2'
              : 'rounded-xl px-5 py-2'
          }
        >
          <Text
            className={
              viewMode === 'biweekly'
                ? 'text-sm font-bold text-gray-900'
                : 'text-sm font-medium text-gray-600'
            }
          >
            Quincenal
          </Text>
        </Pressable>
      </View>

      {/* HERO */}
      {budget.isOverBudget ? (
        <View className="mt-6 rounded-3xl bg-red-50 p-6">
          <Text className="text-sm font-semibold uppercase tracking-wide text-red-700">
            Sobre presupuesto
          </Text>
          <Text className="mt-2 text-5xl font-bold text-red-700">
            −{formatCents(halve(Math.abs(budget.freeMoney)), { currency })}
          </Text>
          <Text className="mt-1 text-sm text-red-800">
            Te faltan {formatCents(halve(Math.abs(budget.freeMoney)), { currency })} para cubrir ahorro + fijos.
          </Text>
        </View>
      ) : (
        <View className="mt-6 rounded-3xl bg-emerald-50 p-6">
          <Text className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Te quedan
          </Text>
          <Text className="mt-2 text-5xl font-bold text-emerald-900">
            {formatCents(halve(budget.freeMoneyRemaining), { currency })}
          </Text>
          <Text className="mt-1 text-base text-emerald-800">
            de {formatCents(halve(budget.freeMoney), { currency })} de dinero libre {periodSuffix}
          </Text>
        </View>
      )}

      {/* SOBRES */}
      <View className="mt-6 gap-3">
        <BucketCard
          Icon={PiggyBank}
          title="Ahorro"
          amount={halve(budget.savings)}
          currency={currency}
          color="emerald"
          subtitle={`Meta — ${savingsPercent}% del ingreso ${periodSuffix}`}
        />
        <BucketCard
          Icon={Receipt}
          title="Gastos fijos"
          amount={halve(budget.fixedExpenses)}
          currency={currency}
          color="blue"
          subtitle={
            viewMode === 'biweekly'
              ? 'Renta, servicios, suscripciones · promedio'
              : 'Renta, servicios, suscripciones'
          }
          progress={{
            value: paymentSummary.paid,
            max: paymentSummary.total,
            label:
              paymentSummary.total === 0
                ? 'Sin gastos fijos vigentes este mes'
                : paymentSummary.paid === paymentSummary.total
                  ? `¡${paymentSummary.total} de ${paymentSummary.total} pagados este mes!`
                  : `${paymentSummary.paid} de ${paymentSummary.total} pagados este mes`,
          }}
        />
        <BucketCard
          Icon={Wallet}
          title="Dinero libre"
          amount={halve(budget.freeMoney)}
          currency={currency}
          color="amber"
          subtitle={subtitleFreeMoney}
          progress={
            budget.freeMoney > 0
              ? {
                  value: budget.variableExpensesSpent,
                  max: budget.freeMoney,
                  label:
                    budget.variableExpensesSpent === 0
                      ? `Quedan ${formatCents(halve(budget.freeMoneyRemaining), { currency })}`
                      : `Quedan ${formatCents(halve(budget.freeMoneyRemaining), { currency })} de ${formatCents(halve(budget.freeMoney), { currency })}`,
                }
              : undefined
          }
        />
      </View>
    </>
  );
}

function EmptyState({ onAddIncome }: { onAddIncome: () => void }) {
  return (
    <View className="mt-6 items-center rounded-3xl border border-dashed border-gray-300 bg-white p-8">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
        <Wallet size={32} color="#059669" strokeWidth={2} />
      </View>
      <Text className="mt-4 text-lg font-bold text-gray-900">Aún no hay ingresos este mes</Text>
      <Text className="mt-1 text-center text-sm text-gray-500">
        Agregá tu primer ingreso para ver cómo se reparten tus sobres.
      </Text>
      <Pressable
        onPress={onAddIncome}
        accessibilityRole="button"
        className="mt-5 rounded-2xl bg-emerald-600 px-6 py-3 active:bg-emerald-700"
      >
        <Text className="text-sm font-bold text-white">Agregar ingreso</Text>
      </Pressable>
    </View>
  );
}

function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = format(date, "MMMM 'de' yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
