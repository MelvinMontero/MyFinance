import { zodResolver } from '@hookform/resolvers/zod';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import type { GoalPriority } from '@/shared/db/types';
import { SUPPORTED_CURRENCIES, currencySymbol } from '@/shared/utils/currency';
import { parseAmount } from '@/shared/utils/money';

import { goalFormSchema, type GoalFormValues } from './schemas';

interface Props {
  defaultValues?: Partial<GoalFormValues>;
  onSubmit: (values: GoalFormValues) => Promise<void> | void;
  submitLabel: string;
}

const PRIORITIES: { value: GoalPriority; label: string }[] = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

export function GoalForm({ defaultValues, onSubmit, submitLabel }: Props) {
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

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
      amount: 0,
      currency: 'CRC',
      start_date: today,
      deadline: '',
      priority: 'medium',
      ...defaultValues,
    },
  });

  const currency = watch('currency');
  const startDateStr = watch('start_date');
  const deadlineStr = watch('deadline');

  function openDatePicker(field: 'start_date' | 'deadline') {
    const currentStr = field === 'start_date' ? startDateStr : deadlineStr;
    const initial = currentStr ? parseISO(currentStr) : new Date();
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) {
          setValue(field, format(selected, 'yyyy-MM-dd'), {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      },
    });
  }

  return (
    <View className="gap-6">
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
                        ? 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-4 py-3'
                        : 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3'
                    }
                  >
                    <Text
                      className={
                        selected
                          ? 'text-xl font-bold text-emerald-800 dark:text-emerald-200'
                          : 'text-xl font-bold text-gray-500 dark:text-gray-400'
                      }
                    >
                      {currencySymbol(opt)}
                    </Text>
                    <Text
                      className={
                        selected
                          ? 'text-sm font-semibold text-emerald-800 dark:text-emerald-200'
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
          Meta en {currency}
        </Text>
        <Controller
          control={control}
          name="amount"
          render={({ field: { value, onChange, onBlur } }) => (
            <View className="flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4">
              <Text className="mr-2 text-2xl font-semibold text-gray-400 dark:text-gray-500">
                {currencySymbol(currency)}
              </Text>
              <TextInput
                className="flex-1 text-2xl font-semibold text-gray-900 dark:text-gray-100"
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#cbd5e1"
                value={value > 0 ? String(value) : ''}
                onChangeText={(text) => {
                  if (text.trim() === '') {
                    onChange(0);
                    return;
                  }
                  try {
                    onChange(parseAmount(text));
                  } catch {
                    /* mantener valor previo si la entrada no parsea */
                  }
                }}
                onBlur={onBlur}
              />
            </View>
          )}
        />
        {errors.amount && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount.message}</Text>
        )}
      </View>

      {/* NOMBRE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Nombre
        </Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4 text-base text-gray-900 dark:text-gray-100"
              placeholder="Intercambio, carro, fondo de viaje…"
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

      {/* PRIORIDAD */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Prioridad
        </Text>
        <Controller
          control={control}
          name="priority"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row gap-2">
              {PRIORITIES.map((opt) => {
                const selected = value === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => onChange(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className={
                      selected
                        ? 'flex-1 items-center rounded-2xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-4 py-3'
                        : 'flex-1 items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3'
                    }
                  >
                    <Text
                      className={
                        selected
                          ? 'text-sm font-semibold text-emerald-800 dark:text-emerald-200'
                          : 'text-sm font-semibold text-gray-700 dark:text-gray-300'
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
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Si el dinero no alcanza en una quincena, se sugiere recortar primero las de menor prioridad.
        </Text>
      </View>

      {/* START DATE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Empezás a ahorrar
        </Text>
        <Pressable
          onPress={() => openDatePicker('start_date')}
          className="flex-row items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4"
        >
          <Text className="text-base text-gray-900 dark:text-gray-100">
            {startDateStr ? formatDateEs(startDateStr) : 'Seleccionar fecha'}
          </Text>
          <Calendar size={20} color="#64748b" />
        </Pressable>
        {errors.start_date && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.start_date.message}</Text>
        )}
      </View>

      {/* DEADLINE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Fecha límite
        </Text>
        <Pressable
          onPress={() => openDatePicker('deadline')}
          className="flex-row items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4"
        >
          <Text
            className={deadlineStr ? 'text-base text-gray-900 dark:text-gray-100' : 'text-base text-gray-400 dark:text-gray-500'}
          >
            {deadlineStr ? formatDateEs(deadlineStr) : 'Seleccionar fecha'}
          </Text>
          <Calendar size={20} color="#64748b" />
        </Pressable>
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Obligatoria — define la cuota por quincena para llegar a tiempo.
        </Text>
        {errors.deadline && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.deadline.message}</Text>
        )}
      </View>

      {/* SUBMIT */}
      <Pressable
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityRole="button"
        className={
          isSubmitting
            ? 'mt-2 items-center rounded-2xl bg-emerald-300 px-6 py-4'
            : 'mt-2 items-center rounded-2xl bg-emerald-600 px-6 py-4 active:bg-emerald-700'
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

function formatDateEs(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}
