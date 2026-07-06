import { X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { GoalWithPlan } from '@/features/goals/repository';
import { convertCents } from '@/shared/utils/exchange';
import { formatCents } from '@/shared/utils/money';

import type { QuincenaBudget } from './quincena';

interface Props {
  visible: boolean;
  onClose: () => void;
  quincena: QuincenaBudget;
  goals: GoalWithPlan[];
  /** Moneda del presupuesto (la de los sobres). */
  currency: string;
  /** Tasa ₡ por $1 para convertir metas en otra moneda. */
  rate: number;
}

/**
 * Ventana emergente que aparece al confirmar el salario: desglosa cuánto reservar
 * para ahorro, cada gasto fijo y cada meta (convirtiendo a la moneda activa).
 */
export function BreakdownModal({ visible, onClose, quincena, goals, currency, rate }: Props) {
  const totalReserve = quincena.savings + quincena.goalsReserve + quincena.fixedExpenses;
  const available = quincena.freeMoney; // ingreso − ahorro − metas − fijos

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View className="rounded-t-3xl bg-white dark:bg-gray-900 p-6" style={{ maxHeight: '88%' }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">¿Cuánto reservar?</Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Cerrar"
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
            >
              <X size={20} color="#64748b" />
            </Pressable>
          </View>
          <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            De tu salario confirmado ({formatCents(quincena.income, { currency })}) apartá:
          </Text>

          <ScrollView className="mt-4" style={{ maxHeight: 360 }}>
            <Row label="Ahorro" amount={formatCents(quincena.savings, { currency })} />

            {quincena.expenseProvisions.length > 0 && <SectionLabel text="Gastos fijos" />}
            {quincena.expenseProvisions.map((e) => (
              <Row
                key={e.id}
                label={e.name}
                amount={e.paid ? '✓ pagado' : formatCents(e.amountCents, { currency })}
                muted={e.paid}
              />
            ))}

            {goals.length > 0 && <SectionLabel text="Metas" />}
            {goals.map((g) => {
              // Lo PENDIENTE de esta quincena: si el check o un abono ya
              // cubrió la cuota, acá aparece "✓ aportado" (igual que fijos pagados).
              const covered = g.quincena_ask_cents === 0 && g.contributed_this_quincena > 0;
              const converted = convertCents(g.quincena_ask_cents, g.currency, currency, rate);
              const isOther = g.currency !== currency;
              return (
                <Row
                  key={g.id}
                  label={g.name}
                  amount={covered ? '✓ aportado' : formatCents(converted, { currency })}
                  muted={covered}
                  hint={
                    !covered && isOther
                      ? `≈ de ${formatCents(g.quincena_ask_cents, { currency: g.currency })} (cambio ₡${rate}/$)`
                      : undefined
                  }
                />
              );
            })}
          </ScrollView>

          <View className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Total a reservar</Text>
              <Text className="text-base font-bold text-gray-900 dark:text-gray-100">
                {formatCents(totalReserve, { currency })}
              </Text>
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-sm text-gray-700 dark:text-gray-300">Te queda libre</Text>
              <Text
                className={
                  available < 0
                    ? 'text-sm font-semibold text-red-600 dark:text-red-400'
                    : 'text-sm font-semibold text-emerald-600 dark:text-emerald-400'
                }
              >
                {formatCents(available, { currency })}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            className="mt-5 items-center rounded-2xl bg-emerald-600 px-6 py-3 active:bg-emerald-700"
          >
            <Text className="text-base font-bold text-white">Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  amount,
  hint,
  muted,
}: {
  label: string;
  amount: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800 py-3">
      <View className="flex-1 pr-3">
        <Text
          className={
            muted
              ? 'text-base text-gray-400 dark:text-gray-500'
              : 'text-base font-medium text-gray-900 dark:text-gray-100'
          }
        >
          {label}
        </Text>
        {hint ? <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</Text> : null}
      </View>
      <Text
        className={
          muted
            ? 'text-base text-gray-400 dark:text-gray-500'
            : 'text-base font-semibold text-gray-900 dark:text-gray-100'
        }
      >
        {amount}
      </Text>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {text}
    </Text>
  );
}
