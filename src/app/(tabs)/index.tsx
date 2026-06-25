import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, PiggyBank, Plus, Receipt, Target, Wallet } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreakdownModal } from '@/features/budgets/BreakdownModal';
import { BucketCard } from '@/features/budgets/BucketCard';
import { ProvisionRow } from '@/features/budgets/ProvisionRow';
import { getBudgetForPeriod, type BudgetForPeriod } from '@/features/budgets/repository';
import { getQuincenaBudget, type QuincenaBudget } from '@/features/budgets/quincena';
import { getQuincena } from '@/features/cycle/cycle';
import { currentPeriod, getPaymentSummary } from '@/features/fixed-expenses/repository';
import { rankGoalsByCutPriority } from '@/features/goals/calc';
import { listGoalsWithPlan, type GoalWithPlan } from '@/features/goals/repository';
import { IncomeConfirmCard } from '@/features/incomes/IncomeConfirmCard';
import {
  listOccurrencesInRange,
  setOccurrenceConfirmed,
  type OccurrenceWithSource,
} from '@/features/incomes/repository';
import { useSettings } from '@/features/settings/store';
import { initDb } from '@/shared/db';
import type { GoalPriority } from '@/shared/db/types';
import { convertCents } from '@/shared/utils/exchange';
import { formatCents } from '@/shared/utils/money';

type Status = 'loading' | 'ready' | 'error';
type ViewMode = 'monthly' | 'biweekly';

interface HomeData {
  monthly: BudgetForPeriod;
  quincena: QuincenaBudget;
  goals: GoalWithPlan[];
  paymentSummary: { paid: number; total: number };
  occurrences: OccurrenceWithSource[];
}

export default function HomeScreen() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<HomeData | null>(null);
  const [breakdownVisible, setBreakdownVisible] = useState(false);

  const liveCurrency = useSettings((s) => s.currency);
  const liveSavingsPercent = useSettings((s) => s.savings_percent);
  const liveRate = useSettings((s) => s.usd_to_crc_rate);

  const loadData = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setStatus('loading');
      try {
        await initDb();
        await useSettings.getState().load();
        const period = currentPeriod();
        const today = new Date();
        const quincena = getQuincena(today);

        // Mostramos TODAS las metas en el Inicio. Las que están en otra moneda
        // se convierten a la moneda activa con la tasa aproximada (₡/$), para
        // que entren en la reserva y en el desglose.
        const goals = await listGoalsWithPlan(today);
        const goalsReserve = goals.reduce(
          (sum, g) => sum + convertCents(g.plan.perQuincenaCents, g.currency, liveCurrency, liveRate),
          0,
        );
        // Reserva mensual ≈ las cuotas de las quincenas del mes (hasta 2).
        const monthlyGoalsReserve = goals.reduce(
          (sum, g) =>
            sum +
            convertCents(
              g.plan.perQuincenaCents * monthlyQuotaFactor(g),
              g.currency,
              liveCurrency,
              liveRate,
            ),
          0,
        );

        const [monthly, qb, summary, occurrences] = await Promise.all([
          getBudgetForPeriod(period, liveCurrency, liveSavingsPercent, monthlyGoalsReserve),
          getQuincenaBudget(quincena, liveCurrency, liveSavingsPercent, goalsReserve),
          getPaymentSummary(period, liveCurrency),
          listOccurrencesInRange(quincena.startDate, quincena.endDate, liveCurrency),
        ]);
        setData({ monthly, quincena: qb, goals, paymentSummary: summary, occurrences });
        setStatus('ready');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    },
    [liveCurrency, liveSavingsPercent, liveRate],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData(true);
    }, [loadData]),
  );

  const handleConfirmOccurrence = useCallback(
    async (id: string, confirmed: boolean) => {
      try {
        await setOccurrenceConfirmed(id, confirmed);
        await loadData(false); // refresca sin spinner: el dinero entra/sale de los sobres
        // Al CONFIRMAR (marcar como recibido) mostramos el desglose de cuánto reservar.
        if (confirmed) setBreakdownVisible(true);
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : String(err));
      }
    },
    [loadData],
  );

  const periodLabel = formatPeriodLabel(currentPeriod());

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-base text-gray-700 dark:text-gray-300">Calculando tus sobres…</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Text className="text-lg font-semibold text-red-600 dark:text-red-400">Error al cargar</Text>
        <Text className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">{errorMsg}</Text>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const { monthly } = data;
  const hasIncome =
    monthly.income > 0 ||
    monthly.pendingIncome > 0 ||
    data.quincena.income > 0 ||
    data.quincena.pendingIncome > 0 ||
    data.occurrences.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
        {/* HEADER */}
        <View className="pt-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {periodLabel}
          </Text>
          <Text className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">MyFinance</Text>
        </View>

        {hasIncome ? (
          <BucketsBlock
            monthly={monthly}
            quincena={data.quincena}
            goals={data.goals}
            occurrences={data.occurrences}
            currency={liveCurrency}
            savingsPercent={liveSavingsPercent}
            rate={liveRate}
            paymentSummary={data.paymentSummary}
            onConfirm={handleConfirmOccurrence}
          />
        ) : (
          <EmptyState onAddIncome={() => router.push('/income/new')} />
        )}

        {/* OTRAS MONEDAS */}
        {monthly.otherCurrenciesPresent.length > 0 && (
          <View className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              No incluidos en este cálculo
            </Text>
            <Text className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Tenés registros también en {monthly.otherCurrenciesPresent.join(', ')}. Cambiá la
              moneda por defecto en Ajustes para ver sus sobres.
            </Text>
          </View>
        )}

        {/* FOOTER */}
        <View className="mt-6 rounded-2xl bg-white dark:bg-gray-900 p-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Configuración actual
          </Text>
          <Text className="mt-1 text-sm text-gray-700 dark:text-gray-300">
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

      <BreakdownModal
        visible={breakdownVisible}
        onClose={() => setBreakdownVisible(false)}
        quincena={data.quincena}
        goals={data.goals}
        currency={liveCurrency}
        rate={liveRate}
      />
    </SafeAreaView>
  );
}

/**
 * Toggle + contenido. El viewMode vive aislado acá para que su cambio NO
 * re-renderice HomeScreen (evita el choque con el wrapper de expo-router).
 */
function BucketsBlock({
  monthly,
  quincena,
  goals,
  occurrences,
  currency,
  savingsPercent,
  rate,
  paymentSummary,
  onConfirm,
}: {
  monthly: BudgetForPeriod;
  quincena: QuincenaBudget;
  goals: GoalWithPlan[];
  occurrences: OccurrenceWithSource[];
  currency: string;
  savingsPercent: number;
  rate: number;
  paymentSummary: { paid: number; total: number };
  onConfirm: (id: string, confirmed: boolean) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('biweekly');

  return (
    <>
      {/* TOGGLE Mensual / Quincenal */}
      <View className="mt-4 flex-row self-start rounded-2xl bg-gray-200 dark:bg-gray-700 p-1">
        {(['monthly', 'biweekly'] as ViewMode[]).map((mode) => {
          const selected = viewMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={selected ? 'rounded-xl bg-white dark:bg-gray-900 px-5 py-2' : 'rounded-xl px-5 py-2'}
            >
              <Text
                className={
                  selected
                    ? 'text-sm font-bold text-gray-900 dark:text-gray-100'
                    : 'text-sm font-medium text-gray-600 dark:text-gray-400'
                }
              >
                {mode === 'monthly' ? 'Mensual' : 'Quincenal'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {viewMode === 'monthly' ? (
        <MonthlyView
          budget={monthly}
          goals={goals}
          currency={currency}
          savingsPercent={savingsPercent}
          rate={rate}
          paymentSummary={paymentSummary}
        />
      ) : (
        <QuincenaView
          quincena={quincena}
          goals={goals}
          occurrences={occurrences}
          currency={currency}
          savingsPercent={savingsPercent}
          rate={rate}
          onConfirm={onConfirm}
        />
      )}
    </>
  );
}

/** Vista mensual de resumen (sobres del mes, con Metas). */
function MonthlyView({
  budget,
  goals,
  currency,
  savingsPercent,
  rate,
  paymentSummary,
}: {
  budget: BudgetForPeriod;
  goals: GoalWithPlan[];
  currency: string;
  savingsPercent: number;
  rate: number;
  paymentSummary: { paid: number; total: number };
}) {
  const subtitleFreeMoney = budget.isOverspent
    ? `Gastaste ${formatCents(budget.variableExpensesSpent, { currency })} de tu dinero libre`
    : budget.variableExpensesSpent > 0
      ? `Gastaste ${formatCents(budget.variableExpensesSpent, { currency })} este mes`
      : 'Lo que podés gastar en gustos y extras';

  return (
    <>
      {budget.isOverBudget ? (
        <View className="mt-6 rounded-3xl bg-red-50 dark:bg-red-950 p-6">
          <Text className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
            Sobre presupuesto
          </Text>
          <Text className="mt-2 text-5xl font-bold text-red-700 dark:text-red-300">
            −{formatCents(Math.abs(budget.freeMoney), { currency })}
          </Text>
          <Text className="mt-1 text-sm text-red-800 dark:text-red-200">
            Te faltan {formatCents(Math.abs(budget.freeMoney), { currency })} para cubrir ahorro + fijos.
          </Text>
        </View>
      ) : (
        <View className="mt-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950 p-6">
          <Text className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Te quedan
          </Text>
          <Text className="mt-2 text-5xl font-bold text-emerald-900 dark:text-emerald-100">
            {formatCents(budget.freeMoneyRemaining, { currency })}
          </Text>
          <Text className="mt-1 text-base text-emerald-800 dark:text-emerald-200">
            de {formatCents(budget.freeMoney, { currency })} de dinero libre este mes
          </Text>
        </View>
      )}

      {budget.pendingIncome > 0 && (
        <View className="mt-4 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
          <Text className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Tenés {formatCents(budget.pendingIncome, { currency })} de ingresos por confirmar este mes.
            Marcálos en la vista Quincenal cuando te paguen para que cuenten.
          </Text>
        </View>
      )}

      <View className="mt-6 gap-3">
        <BucketCard
          Icon={PiggyBank}
          title="Ahorro"
          amount={budget.savings}
          currency={currency}
          color="emerald"
          subtitle={`Meta — ${savingsPercent}% del ingreso este mes`}
        />
        <BucketCard
          Icon={Target}
          title="Metas"
          amount={budget.goalsReserve}
          currency={currency}
          color="emerald"
          subtitle={goals.length === 0 ? 'Sin metas activas' : 'Aporte a tus metas este mes'}
        />
        <BucketCard
          Icon={Receipt}
          title="Gastos fijos"
          amount={budget.fixedExpenses}
          currency={currency}
          color="blue"
          subtitle="Renta, servicios, suscripciones"
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
          amount={budget.freeMoney}
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
                      ? `Quedan ${formatCents(budget.freeMoneyRemaining, { currency })}`
                      : `Quedan ${formatCents(budget.freeMoneyRemaining, { currency })} de ${formatCents(budget.freeMoney, { currency })}`,
                }
              : undefined
          }
        />
      </View>

      {goals.length > 0 && (
        <View className="mt-6 rounded-2xl bg-white dark:bg-gray-900 p-4">
          <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Metas este mes</Text>
          {goals.map((g) => (
            <ProvisionRow
              key={g.id}
              label={g.name}
              amountCents={convertCents(
                g.plan.perQuincenaCents * monthlyQuotaFactor(g),
                g.currency,
                currency,
                rate,
              )}
              currency={currency}
              subtitle={goalSubtitle(g, currency)}
            />
          ))}
        </View>
      )}
    </>
  );
}

/** Vista quincenal REAL: cuánto apartar este cobro, con desglose por ítem. */
function QuincenaView({
  quincena,
  goals,
  occurrences,
  currency,
  savingsPercent,
  rate,
  onConfirm,
}: {
  quincena: QuincenaBudget;
  goals: GoalWithPlan[];
  occurrences: OccurrenceWithSource[];
  currency: string;
  savingsPercent: number;
  rate: number;
  onConfirm: (id: string, confirmed: boolean) => void;
}) {
  const { startDate, endDate } = quincena.quincena;
  const rangeLabel = `${format(parseISO(startDate), "d 'de' MMM", { locale: es })} – ${format(parseISO(endDate), "d 'de' MMM", { locale: es })}`;
  const totalToProvision = quincena.savings + quincena.goalsReserve + quincena.fixedExpenses;
  const cutOrder = rankGoalsByCutPriority(goals.filter((g) => g.plan.perQuincenaCents > 0));
  const cutNames = cutOrder
    .map((id) => goals.find((g) => g.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <>
      {/* HERO ingreso CONFIRMADO de la quincena */}
      <View className="mt-6 rounded-3xl bg-blue-50 dark:bg-blue-950 p-6">
        <Text className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Ingreso confirmado de esta quincena
        </Text>
        <Text className="mt-2 text-5xl font-bold text-blue-900 dark:text-blue-100">
          {formatCents(quincena.income, { currency })}
        </Text>
        <Text className="mt-1 text-sm text-blue-800 dark:text-blue-200">{rangeLabel}</Text>
        {quincena.pendingIncome > 0 && (
          <Text className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300">
            + {formatCents(quincena.pendingIncome, { currency })} por confirmar (no cuenta aún)
          </Text>
        )}
      </View>

      {/* CHECK de ingresos: marcá lo que ya te pagaron */}
      <IncomeConfirmCard occurrences={occurrences} currency={currency} onToggle={onConfirm} />

      {/* DÉFICIT */}
      {quincena.isOverBudget && (
        <View className="mt-4 flex-row items-start gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4">
          <AlertTriangle size={20} color="#dc2626" strokeWidth={2} />
          <View className="flex-1">
            <Text className="text-sm font-bold text-red-900 dark:text-red-100">
              Te faltan {formatCents(Math.abs(quincena.freeMoney), { currency })} este cobro
            </Text>
            <Text className="mt-1 text-sm text-red-800 dark:text-red-200">
              {cutNames.length > 0
                ? `Considerá reducir primero las metas de menor prioridad: ${cutNames.join(', ')}.`
                : 'Revisá tus gastos fijos o el % de ahorro.'}
            </Text>
          </View>
        </View>
      )}

      {/* SOBREGASTO: extras superan el dinero libre */}
      {quincena.isOverspent && !quincena.isOverBudget && (
        <View className="mt-4 flex-row items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4">
          <AlertTriangle size={20} color="#d97706" strokeWidth={2} />
          <View className="flex-1">
            <Text className="text-sm font-bold text-amber-900 dark:text-amber-100">
              Te pasaste del dinero libre
            </Text>
            <Text className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              Gastaste {formatCents(Math.abs(quincena.freeMoneyRemaining), { currency })} de más esta quincena.
            </Text>
          </View>
        </View>
      )}

      {/* SOBRES de la quincena */}
      <View className="mt-6 gap-3">
        <BucketCard
          Icon={PiggyBank}
          title="Ahorro"
          amount={quincena.savings}
          currency={currency}
          color="emerald"
          subtitle={`${savingsPercent}% del ingreso de la quincena`}
        />
        <BucketCard
          Icon={Target}
          title="Metas"
          amount={quincena.goalsReserve}
          currency={currency}
          color="emerald"
          subtitle={
            goals.length === 0 ? 'Sin metas activas — creá una en la pestaña Metas' : 'Cuota de tus metas este cobro'
          }
        />
        <BucketCard
          Icon={Receipt}
          title="Gastos fijos"
          amount={quincena.fixedExpenses}
          currency={currency}
          color="blue"
          subtitle="Repartido por quincena hasta cada cobro"
        />
        <BucketCard
          Icon={Wallet}
          title="Dinero libre"
          amount={quincena.freeMoney}
          currency={currency}
          color="amber"
          subtitle={
            quincena.variableExpensesSpent > 0
              ? `Gastaste ${formatCents(quincena.variableExpensesSpent, { currency })} en extras esta quincena`
              : 'Lo que te queda para gustos esta quincena'
          }
          progress={
            quincena.freeMoney > 0
              ? {
                  value: quincena.variableExpensesSpent,
                  max: quincena.freeMoney,
                  label:
                    quincena.variableExpensesSpent === 0
                      ? `Quedan ${formatCents(quincena.freeMoneyRemaining, { currency })}`
                      : `Quedan ${formatCents(quincena.freeMoneyRemaining, { currency })} de ${formatCents(quincena.freeMoney, { currency })}`,
                }
              : undefined
          }
        />
      </View>

      {/* DESGLOSE: cuánto aparto este cobro */}
      <View className="mt-6 rounded-2xl bg-white dark:bg-gray-900 p-4">
        <Text className="text-base font-bold text-gray-900 dark:text-gray-100">¿Cuánto aparto este cobro?</Text>

        {quincena.expenseProvisions.length > 0 && (
          <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Gastos fijos
          </Text>
        )}
        {quincena.expenseProvisions.map((e) => (
          <ProvisionRow
            key={`e-${e.id}`}
            label={e.name}
            amountCents={e.amountCents}
            currency={currency}
            subtitle={
              e.paid
                ? '✓ pagado este mes — nada que apartar'
                : e.quincenasSpan > 1
                  ? `repartido en ${e.quincenasSpan} quincenas · cobro ${e.due}`
                  : `cobro ${e.due}`
            }
          />
        ))}

        {goals.length > 0 && (
          <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Metas
          </Text>
        )}
        {goals.map((g) => (
          <ProvisionRow
            key={`g-${g.id}`}
            label={g.name}
            amountCents={convertCents(g.plan.perQuincenaCents, g.currency, currency, rate)}
            currency={currency}
            subtitle={goalSubtitle(g, currency)}
          />
        ))}

        {/* TOTALES */}
        <View className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Total a apartar</Text>
            <Text className="text-base font-bold text-gray-900 dark:text-gray-100">
              {formatCents(totalToProvision, { currency })}
            </Text>
          </View>
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-sm text-gray-700 dark:text-gray-300">Disponible para gastar</Text>
            <Text
              className={
                quincena.freeMoneyRemaining < 0
                  ? 'text-sm font-semibold text-red-600 dark:text-red-400'
                  : 'text-sm font-semibold text-emerald-600 dark:text-emerald-400'
              }
            >
              {formatCents(quincena.freeMoneyRemaining, { currency })}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}

const PRIORITY_LABEL: Record<GoalPriority, string> = {
  high: 'Prioridad alta',
  medium: 'Prioridad media',
  low: 'Prioridad baja',
};

function goalSubtitle(g: GoalWithPlan, viewCurrency: string): string {
  const base = g.plan.isComplete
    ? `${PRIORITY_LABEL[g.priority]} · completada`
    : g.plan.isOverdue
      ? `${PRIORITY_LABEL[g.priority]} · fecha vencida`
      : `${PRIORITY_LABEL[g.priority]} · faltan ${g.plan.remainingQuincenas} quincenas`;
  return g.currency !== viewCurrency
    ? `${base} · ≈ de ${formatCents(g.plan.perQuincenaCents, { currency: g.currency })}`
    : base;
}

/** Cuántas cuotas de quincena de una meta aplican en un mes (1 o 2). */
function monthlyQuotaFactor(g: GoalWithPlan): number {
  return Math.min(2, Math.max(1, g.plan.remainingQuincenas));
}

function EmptyState({ onAddIncome }: { onAddIncome: () => void }) {
  return (
    <View className="mt-6 items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-8">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900">
        <Wallet size={32} color="#059669" strokeWidth={2} />
      </View>
      <Text className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">Aún no hay ingresos este mes</Text>
      <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
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
