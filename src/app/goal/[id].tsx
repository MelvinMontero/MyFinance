import { zodResolver } from '@hookform/resolvers/zod';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { calculateGoalPlan } from '@/features/goals/calculate';
import { ContributionRow } from '@/features/goals/ContributionRow';
import { GoalForm } from '@/features/goals/GoalForm';
import { GoalProgressRing } from '@/features/goals/GoalProgressRing';
import {
  addContribution,
  deleteContribution,
  getGoal,
  listContributions,
  type GoalWithProgress,
} from '@/features/goals/repository';
import {
  manualContributionSchema,
  type GoalFormValues,
  type ManualContributionValues,
} from '@/features/goals/schemas';
import { useGoals } from '@/features/goals/store';
import { useReminders } from '@/features/notifications/useReminders';
import type { GoalContribution } from '@/shared/db/types';
import { currencySymbol, isSupportedCurrency } from '@/shared/utils/currency';
import { formatCents, fromCents, parseAmount, toCents } from '@/shared/utils/money';

export default function GoalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reschedule } = useReminders();

  const [goal, setGoal] = useState<GoalWithProgress | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [addingContribution, setAddingContribution] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [g, contribs] = await Promise.all([getGoal(id), listContributions(id)]);
      setGoal(g);
      setContributions(contribs);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const today = format(new Date(), 'yyyy-MM-dd');
  const plan = useMemo(
    () =>
      goal
        ? calculateGoalPlan({
            targetAmount: goal.target_amount_cents,
            initialAmount: goal.initial_amount_cents,
            contributedAmount: goal.contributed_cents,
            dueDate: goal.due_date,
            asOf: today,
          })
        : null,
    [goal, today],
  );

  async function handleEdit(values: GoalFormValues) {
    if (!goal) return;
    try {
      await useGoals.getState().edit(goal.id, {
        name: values.name,
        target_amount_cents: values.target_amount_cents,
        initial_amount_cents: values.initial_amount_cents,
        currency: values.currency,
        due_date: values.due_date,
        funding_source: values.funding_source,
        category_id: values.category_id ?? null,
        note: values.note ?? null,
      });
      void reschedule().catch(() => {});
      setEditing(false);
      await reload();
    } catch (err) {
      Alert.alert('Error al guardar', err instanceof Error ? err.message : String(err));
    }
  }

  function handleDelete() {
    if (!goal) return;
    Alert.alert(
      'Eliminar meta',
      `¿Borrar "${goal.name}"? Se borra también todo su historial de aportes. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await useGoals.getState().remove(goal.id);
              void reschedule().catch(() => {});
              router.back();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  }

  async function handleAddContribution(values: ManualContributionValues) {
    if (!goal) return;
    try {
      await addContribution({
        goal_id: goal.id,
        amount_cents: values.amount_cents,
        occurred_at: values.occurred_at,
        source: 'manual',
        note: values.note ?? null,
      });
      setAddingContribution(false);
      await reload();
      await useGoals.getState().load();
    } catch (err) {
      Alert.alert('Error al registrar', err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteContribution(contributionId: string) {
    try {
      await deleteContribution(contributionId);
      await reload();
      await useGoals.getState().load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  }

  if (loading && !goal) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  if (!goal || !plan) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Text className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Meta no encontrada
        </Text>
      </View>
    );
  }

  const currency = goal.currency;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-900"
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <>
            <Text className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
              Editar meta
            </Text>
            <GoalForm
              defaultValues={{
                name: goal.name,
                target_amount_cents: goal.target_amount_cents,
                initial_amount_cents: goal.initial_amount_cents,
                currency: isSupportedCurrency(goal.currency) ? goal.currency : 'CRC',
                due_date: goal.due_date,
                funding_source: goal.funding_source,
                category_id: goal.category_id,
                note: goal.note,
              }}
              submitLabel="Guardar cambios"
              onSubmit={handleEdit}
            />
            <Pressable
              onPress={() => setEditing(false)}
              accessibilityRole="button"
              className="mt-3 items-center rounded-2xl border border-gray-300 dark:border-gray-700 px-6 py-4 active:bg-gray-50 dark:active:bg-gray-800"
            >
              <Text className="text-base font-bold text-gray-700 dark:text-gray-200">Cancelar</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* HEADER: anillo + datos */}
            <View className="items-center">
              <GoalProgressRing
                progressRatio={plan.progressRatio}
                saved={plan.saved}
                target={plan.target}
                currency={currency}
                size={150}
              />
              <Text className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {goal.name}
              </Text>
              {goal.status === 'completed' && (
                <View className="mt-2 rounded-md bg-emerald-100 dark:bg-emerald-900 px-3 py-1">
                  <Text className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    🎉 Meta completada
                  </Text>
                </View>
              )}
            </View>

            {/* DATOS CLAVE */}
            <View className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-5">
              <DataRow label="Objetivo" value={formatCents(plan.target, { currency })} />
              <DataRow label="Ahorrado" value={formatCents(plan.saved, { currency })} />
              <DataRow label="Faltante" value={formatCents(plan.remaining, { currency })} />
              {!plan.isFunded && (
                <DataRow
                  label="Por quincena"
                  value={formatCents(plan.perPaycheck, { currency })}
                  highlight
                />
              )}
              <DataRow label="Fecha límite" value={formatDateEs(goal.due_date)} />
              <DataRow
                label="Fuente"
                value={goal.funding_source === 'off_top' ? 'Aparte del salario' : 'Del ahorro'}
              />
              {plan.isOverdue && (
                <Text className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">
                  La fecha límite ya pasó y la meta no está completa.
                </Text>
              )}
              {plan.isUrgent && !plan.isOverdue && (
                <Text className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  No quedan quincenas antes de la fecha — hay que reservar todo ya.
                </Text>
              )}
              {goal.note ? (
                <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">{goal.note}</Text>
              ) : null}
            </View>

            {/* APORTE MANUAL */}
            {addingContribution ? (
              <ManualContributionForm
                currency={currency}
                onSubmit={handleAddContribution}
                onCancel={() => setAddingContribution(false)}
              />
            ) : (
              <Pressable
                onPress={() => setAddingContribution(true)}
                accessibilityRole="button"
                className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-4 active:bg-violet-700"
              >
                <Plus size={18} color="#fff" strokeWidth={2.5} />
                <Text className="text-base font-bold text-white">Registrar aporte manual</Text>
              </Pressable>
            )}

            {/* HISTORIAL */}
            <Text className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
              Historial de aportes
            </Text>
            <View className="mt-3 gap-2">
              {contributions.length === 0 ? (
                <Text className="text-sm text-gray-400 dark:text-gray-500">Aún no hay aportes.</Text>
              ) : (
                contributions.map((c) => (
                  <ContributionRow
                    key={c.id}
                    contribution={c}
                    currency={currency}
                    onDelete={handleDeleteContribution}
                  />
                ))
              )}
            </View>

            {/* ACCIONES */}
            <View className="mt-8 gap-3">
              <Pressable
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 active:bg-gray-50"
              >
                <Pencil size={18} color="#475569" strokeWidth={2} />
                <Text className="text-base font-bold text-gray-700 dark:text-gray-200">Editar</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-6 py-4 active:bg-red-100"
              >
                <Trash2 size={18} color="#dc2626" strokeWidth={2} />
                <Text className="text-base font-bold text-red-600 dark:text-red-400">
                  Eliminar meta
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DataRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View className="flex-row items-baseline justify-between py-1.5">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text
        className={
          highlight
            ? 'text-lg font-bold text-violet-700 dark:text-violet-300'
            : 'text-base font-semibold text-gray-900 dark:text-gray-100'
        }
      >
        {value}
      </Text>
    </View>
  );
}

function ManualContributionForm({
  currency,
  onSubmit,
  onCancel,
}: {
  currency: string;
  onSubmit: (values: ManualContributionValues) => Promise<void>;
  onCancel: () => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<ManualContributionValues>({
    resolver: zodResolver(manualContributionSchema),
    defaultValues: { amount_cents: 0, occurred_at: today, note: null },
  });

  const occurredAt = watch('occurred_at');

  function openDatePicker() {
    DateTimePickerAndroid.open({
      value: occurredAt ? parseISO(occurredAt) : new Date(),
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) {
          setValue('occurred_at', format(selected, 'yyyy-MM-dd'), {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      },
    });
  }

  return (
    <View className="mt-4 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 p-5">
      <Text className="text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        Aporte manual
      </Text>

      <Controller
        control={control}
        name="amount_cents"
        render={({ field: { value, onChange, onBlur } }) => (
          <View className="mt-3 flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4">
            <Text className="mr-2 text-2xl font-semibold text-gray-400 dark:text-gray-500">
              {currencySymbol(currency)}
            </Text>
            <TextInput
              className="flex-1 text-2xl font-semibold text-gray-900 dark:text-gray-100"
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#cbd5e1"
              value={value > 0 ? String(fromCents(value)) : ''}
              onChangeText={(text) => {
                if (text.trim() === '') {
                  onChange(0);
                  return;
                }
                try {
                  onChange(toCents(parseAmount(text)));
                } catch {
                  /* mantener valor previo si la entrada no parsea */
                }
              }}
              onBlur={onBlur}
            />
          </View>
        )}
      />
      {errors.amount_cents && (
        <Text className="mt-1 text-sm text-red-600 dark:text-red-400">
          {errors.amount_cents.message}
        </Text>
      )}

      <Pressable
        onPress={openDatePicker}
        accessibilityRole="button"
        accessibilityLabel="Elegir fecha del aporte"
        className="mt-3 flex-row items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4"
      >
        <Text className="text-base text-gray-900 dark:text-gray-100">
          {occurredAt ? formatDateEs(occurredAt) : 'Seleccionar fecha'}
        </Text>
        <Calendar size={20} color="#64748b" />
      </Pressable>

      <Controller
        control={control}
        name="note"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            className="mt-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4 text-base text-gray-900 dark:text-gray-100"
            placeholder="Nota (opcional)"
            placeholderTextColor="#cbd5e1"
            value={value ?? ''}
            onChangeText={(t) => onChange(t.length > 0 ? t : null)}
            onBlur={onBlur}
            maxLength={200}
          />
        )}
      />

      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={onCancel}
          disabled={isSubmitting}
          accessibilityRole="button"
          className="flex-1 items-center rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 active:bg-gray-50"
        >
          <Text className="text-sm font-bold text-gray-700 dark:text-gray-200">Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          accessibilityRole="button"
          className={
            isSubmitting
              ? 'flex-1 items-center rounded-2xl bg-violet-300 px-4 py-3'
              : 'flex-1 items-center rounded-2xl bg-violet-600 px-4 py-3 active:bg-violet-700'
          }
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-sm font-bold text-white">Guardar aporte</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function formatDateEs(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}
