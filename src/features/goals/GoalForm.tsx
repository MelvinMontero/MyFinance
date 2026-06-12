import { zodResolver } from '@hookform/resolvers/zod';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { listCategories } from '@/features/categories/repository';
import type { Category, GoalFundingSource } from '@/shared/db/types';
import { SUPPORTED_CURRENCIES, currencySymbol } from '@/shared/utils/currency';
import { fromCents, parseAmount, toCents } from '@/shared/utils/money';

import { goalFormSchema, type GoalFormValues } from './schemas';

interface GoalFormProps {
  defaultValues?: Partial<GoalFormValues>;
  submitLabel: string;
  onSubmit: (values: GoalFormValues) => Promise<void> | void;
}

const FUNDING_OPTIONS: { value: GoalFundingSource; label: string; help: string }[] = [
  {
    value: 'off_top',
    label: 'Aparte del salario',
    help: 'Se reserva antes de repartir. Reduce tu dinero libre.',
  },
  {
    value: 'from_savings',
    label: 'Sale de mi ahorro',
    help: 'Sale de tu sobre de Ahorro (no es plata extra).',
  },
];

export function GoalForm({ defaultValues, submitLabel, onSubmit }: GoalFormProps) {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCategories({ type: 'variable_expense' }).then((rows) => {
      if (!cancelled) setCategories(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: '',
      target_amount_cents: 0,
      initial_amount_cents: 0,
      currency: 'CRC',
      due_date: '',
      funding_source: 'off_top',
      category_id: null,
      note: null,
      ...defaultValues,
    },
  });

  const currency = watch('currency');
  const dueDateStr = watch('due_date');
  const fundingSource = watch('funding_source');

  function openDatePicker() {
    const initial = dueDateStr ? parseISO(dueDateStr) : new Date();
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) {
          setValue('due_date', format(selected, 'yyyy-MM-dd'), {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      },
    });
  }

  return (
    <View className="gap-6">
      {/* NOMBRE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Nombre de la meta
        </Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4 text-base text-gray-900 dark:text-gray-100"
              placeholder="Programa de intercambio, viaje, laptop…"
              placeholderTextColor="#cbd5e1"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              maxLength={100}
            />
          )}
        />
        {errors.name && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</Text>
        )}
      </View>

      {/* MONEDA */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Moneda
        </Text>
        <Controller
          control={control}
          name="currency"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row gap-2">
              {SUPPORTED_CURRENCIES.map((opt) => {
                const selected = value === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => onChange(opt)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className={
                      selected
                        ? 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-violet-600 bg-violet-50 dark:bg-violet-950 px-4 py-3'
                        : 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3'
                    }
                  >
                    <Text
                      className={
                        selected
                          ? 'text-xl font-bold text-violet-800 dark:text-violet-200'
                          : 'text-xl font-bold text-gray-500 dark:text-gray-400'
                      }
                    >
                      {currencySymbol(opt)}
                    </Text>
                    <Text
                      className={
                        selected
                          ? 'text-sm font-semibold text-violet-800 dark:text-violet-200'
                          : 'text-sm font-semibold text-gray-700 dark:text-gray-300'
                      }
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </View>

      {/* MONTO OBJETIVO */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Monto objetivo en {currency}
        </Text>
        <Controller
          control={control}
          name="target_amount_cents"
          render={({ field: { value, onChange, onBlur } }) => (
            <AmountInput
              currency={currency}
              valueCents={value}
              onChangeCents={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.target_amount_cents && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.target_amount_cents.message}
          </Text>
        )}
      </View>

      {/* PRIMA INICIAL */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Prima inicial <Text className="normal-case text-gray-400 dark:text-gray-500">(ya tengo)</Text>
        </Text>
        <Controller
          control={control}
          name="initial_amount_cents"
          render={({ field: { value, onChange, onBlur } }) => (
            <AmountInput
              currency={currency}
              valueCents={value}
              onChangeCents={onChange}
              onBlur={onBlur}
            />
          )}
        />
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          ¿Cuánto tenés ya guardado para esto?
        </Text>
        {errors.initial_amount_cents && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.initial_amount_cents.message}
          </Text>
        )}
      </View>

      {/* FECHA LÍMITE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Fecha límite
        </Text>
        <Pressable
          onPress={openDatePicker}
          accessibilityRole="button"
          accessibilityLabel="Elegir fecha límite"
          className="flex-row items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4"
        >
          <Text
            className={
              dueDateStr
                ? 'text-base text-gray-900 dark:text-gray-100'
                : 'text-base text-gray-400 dark:text-gray-500'
            }
          >
            {dueDateStr ? formatDateEs(dueDateStr) : 'Seleccionar fecha'}
          </Text>
          <Calendar size={20} color="#64748b" />
        </Pressable>
        {errors.due_date && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.due_date.message}</Text>
        )}
      </View>

      {/* FUENTE DEL DINERO */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          ¿De dónde sale la plata?
        </Text>
        <Controller
          control={control}
          name="funding_source"
          render={({ field: { value, onChange } }) => (
            <View className="gap-2">
              {FUNDING_OPTIONS.map((opt) => {
                const selected = value === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => onChange(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className={
                      selected
                        ? 'rounded-2xl border-2 border-violet-600 bg-violet-50 dark:bg-violet-950 px-4 py-3'
                        : 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3'
                    }
                  >
                    <Text
                      className={
                        selected
                          ? 'text-base font-semibold text-violet-800 dark:text-violet-200'
                          : 'text-base font-semibold text-gray-900 dark:text-gray-100'
                      }
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
        <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {FUNDING_OPTIONS.find((o) => o.value === fundingSource)?.help}
        </Text>
      </View>

      {/* CATEGORÍA (opcional) */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Categoría <Text className="normal-case text-gray-400 dark:text-gray-500">(opcional)</Text>
        </Text>
        <Controller
          control={control}
          name="category_id"
          render={({ field: { value, onChange } }) => (
            <View className="gap-2">
              {categories === null ? (
                <View className="items-center py-4">
                  <ActivityIndicator color="#7c3aed" />
                </View>
              ) : (
                categories.map((cat) => {
                  const selected = value === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => onChange(selected ? null : cat.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      className={
                        selected
                          ? 'flex-row items-center gap-3 rounded-2xl border-2 border-violet-600 bg-violet-50 dark:bg-violet-950 px-4 py-3'
                          : 'flex-row items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3'
                      }
                    >
                      <View
                        className="h-10 w-10 items-center justify-center rounded-xl"
                        style={{ backgroundColor: cat.color + '22' }}
                      >
                        <CategoryIcon name={cat.icon} size={20} color={cat.color} />
                      </View>
                      <Text
                        className={
                          selected
                            ? 'flex-1 text-base font-semibold text-violet-800 dark:text-violet-200'
                            : 'flex-1 text-base font-semibold text-gray-900 dark:text-gray-100'
                        }
                      >
                        {cat.name}
                      </Text>
                      {selected && (
                        <View className="h-5 w-5 items-center justify-center rounded-full bg-violet-600">
                          <Text className="text-xs font-bold text-white">✓</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        />
      </View>

      {/* NOTA */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Nota <Text className="normal-case text-gray-400 dark:text-gray-500">(opcional)</Text>
        </Text>
        <Controller
          control={control}
          name="note"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4 text-base text-gray-900 dark:text-gray-100"
              placeholder="Detalles, links, lo que querás recordar…"
              placeholderTextColor="#cbd5e1"
              value={value ?? ''}
              onChangeText={(t) => onChange(t.length > 0 ? t : null)}
              onBlur={onBlur}
              maxLength={300}
              multiline
            />
          )}
        />
      </View>

      {/* SUBMIT */}
      <Pressable
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityRole="button"
        className={
          isSubmitting
            ? 'mt-2 items-center rounded-2xl bg-violet-300 px-6 py-4'
            : 'mt-2 items-center rounded-2xl bg-violet-600 px-6 py-4 active:bg-violet-700'
        }
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-bold text-white">{submitLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

/** Input de monto que edita centavos enteros mostrando unidades (patrón FixedExpenseForm). */
function AmountInput({
  currency,
  valueCents,
  onChangeCents,
  onBlur,
}: {
  currency: string;
  valueCents: number;
  onChangeCents: (cents: number) => void;
  onBlur: () => void;
}) {
  return (
    <View className="flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4">
      <Text className="mr-2 text-2xl font-semibold text-gray-400 dark:text-gray-500">
        {currencySymbol(currency)}
      </Text>
      <TextInput
        className="flex-1 text-2xl font-semibold text-gray-900 dark:text-gray-100"
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#cbd5e1"
        value={valueCents > 0 ? String(fromCents(valueCents)) : ''}
        onChangeText={(text) => {
          if (text.trim() === '') {
            onChangeCents(0);
            return;
          }
          try {
            onChangeCents(toCents(parseAmount(text)));
          } catch {
            /* mantener valor previo si la entrada no parsea */
          }
        }}
        onBlur={onBlur}
      />
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
