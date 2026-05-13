import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  PiggyBank,
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
          // Idempotentes — la primera ejecución hace el trabajo, las siguientes son no-op.
          await initDb();
          await useSettings.getState().load();

          // La primera vez que se monta, los valores de React state pueden ser los
          // defaults del store (CRC, 20). Cuando load() complete, el store dispara
          // un re-render → este callback se recrea con los valores reales → este
          // useFocusEffect se vuelve a disparar (los deps cambiaron). El cleanup
          // cancela la fetch vieja, así que no hay flash.
          const period = currentPeriod();
          const [b, summary] = await Promise.all([
            getBudgetForPeriod(period, liveCurrency, liveSavingsPercent),
            getPaymentSummary(period),
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

  const period = currentPeriod();
  const periodLabel = formatPeriodLabel(period);

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
  const subtitleFreeMoney = budget.isOverspent
    ? `Gastaste ${formatCents(budget.variableExpensesSpent, { currency: liveCurrency })} de tu dinero libre`
    : budget.variableExpensesSpent > 0
      ? `Gastaste ${formatCents(budget.variableExpensesSpent, { currency: liveCurrency })} este mes`
      : 'Lo que podés gastar en gustos y extras';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        {/* HEADER */}
        <View className="pt-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {periodLabel}
          </Text>
          <Text className="mt-1 text-3xl font-bold text-gray-900">MyFinance</Text>
        </View>

        {/* HERO */}
        {hasIncome ? (
          <HeroBlock budget={budget} currency={liveCurrency} />
        ) : (
          <EmptyState onAddIncome={() => router.push('/income/new')} />
        )}

        {/* SOBRES */}
        {hasIncome && (
          <View className="mt-6 gap-3">
            <BucketCard
              Icon={PiggyBank}
              title="Ahorro"
              amount={budget.savings}
              currency={liveCurrency}
              color="emerald"
              subtitle={`Meta del mes — ${liveSavingsPercent}% del ingreso`}
            />
            <BucketCard
              Icon={Receipt}
              title="Gastos fijos"
              amount={budget.fixedExpenses}
              currency={liveCurrency}
              color="blue"
              subtitle="Renta, servicios, suscripciones"
              progress={{
                value: paymentSummary.paid,
                max: paymentSummary.total,
                label:
                  paymentSummary.total === 0
                    ? 'Aún no hay gastos fijos'
                    : paymentSummary.paid === paymentSummary.total
                      ? `¡${paymentSummary.total} de ${paymentSummary.total} pagados este mes!`
                      : `${paymentSummary.paid} de ${paymentSummary.total} pagados este mes`,
              }}
            />
            <BucketCard
              Icon={Wallet}
              title="Dinero libre"
              amount={budget.freeMoney}
              currency={liveCurrency}
              color="amber"
              subtitle={subtitleFreeMoney}
              progress={
                budget.freeMoney > 0
                  ? {
                      value: budget.variableExpensesSpent,
                      max: budget.freeMoney,
                      label:
                        budget.variableExpensesSpent === 0
                          ? `Quedan ${formatCents(budget.freeMoneyRemaining, { currency: liveCurrency })}`
                          : `Quedan ${formatCents(budget.freeMoneyRemaining, { currency: liveCurrency })} de ${formatCents(budget.freeMoney, { currency: liveCurrency })}`,
                    }
                  : undefined
              }
            />
          </View>
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
    </SafeAreaView>
  );
}

function HeroBlock({
  budget,
  currency,
}: {
  budget: BudgetForPeriod;
  currency: string;
}) {
  if (budget.isOverBudget) {
    return (
      <View className="mt-6 rounded-3xl bg-red-50 p-6">
        <Text className="text-sm font-semibold uppercase tracking-wide text-red-700">
          Sobre presupuesto
        </Text>
        <Text className="mt-2 text-5xl font-bold text-red-700">
          −{formatCents(Math.abs(budget.freeMoney), { currency })}
        </Text>
        <Text className="mt-1 text-sm text-red-800">
          Te faltan {formatCents(Math.abs(budget.freeMoney), { currency })} para cubrir ahorro + fijos.
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-6 rounded-3xl bg-emerald-50 p-6">
      <Text className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
        Te quedan
      </Text>
      <Text className="mt-2 text-5xl font-bold text-emerald-900">
        {formatCents(budget.freeMoneyRemaining, { currency })}
      </Text>
      <Text className="mt-1 text-base text-emerald-800">
        de {formatCents(budget.freeMoney, { currency })} de dinero libre este mes
      </Text>
    </View>
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
