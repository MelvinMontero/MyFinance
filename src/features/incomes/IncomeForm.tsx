import { zodResolver } from '@hookform/resolvers/zod';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { SUPPORTED_CURRENCIES, currencySymbol } from '@/shared/utils/currency';
import { fromCents, parseAmount, toCents } from '@/shared/utils/money';

import { incomeFormSchema, type IncomeFormValues } from './schemas';

interface Props {
  /** Defaults — al editar, pasar `amount` en CRC (no cents) ya. */
  defaultValues?: Partial<IncomeFormValues>;
  onSubmit: (values: IncomeFormValues) => Promise<void> | void;
  submitLabel: string;
}

type Frequency = IncomeFormValues['frequency'];

const FREQUENCY_OPTIONS: { value: Frequency; label: string; hint: string }[] = [
  { value: 'one_time', label: 'Una vez', hint: 'Solo este día' },
  { value: 'biweekly', label: 'Quincenal', hint: 'Cada 14 días' },
  { value: 'monthly', label: 'Mensual', hint: 'Mismo día cada mes' },
];

export function IncomeForm({ defaultValues, onSubmit, submitLabel }: Props) {
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: {
      amount: 0,
      currency: 'CRC',
      source: '',
      frequency: 'monthly',
      start_date: today,
      end_date: '',
      note: '',
      ...defaultValues,
    },
  });

  const startDateStr = watch('start_date');
  const endDateStr = watch('end_date');
  const currency = watch('currency');

  function openDatePicker(field: 'start_date' | 'end_date') {
    const currentStr = field === 'start_date' ? startDateStr : endDateStr;
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

  function clearEndDate() {
    setValue('end_date', '', { shouldValidate: true, shouldDirty: true });
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
                    accessibilityLabel={`Moneda ${opt}`}
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
        {errors.currency && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.currency.message}</Text>
        )}
      </View>

      {/* MONTO */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Monto en {currency}
        </Text>
        <Controller
          control={control}
          name="amount"
          render={({ field: { value, onChange, onBlur } }) => (
            <View className="flex-row items-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4">
              <Text className="mr-2 text-2xl font-semibold text-gray-400 dark:text-gray-500">{currencySymbol(currency)}</Text>
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
                    // Mantenemos el valor previo si la entrada no es parseable
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

      {/* SOURCE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Fuente <Text className="text-gray-400 dark:text-gray-500 normal-case">(opcional)</Text>
        </Text>
        <Controller
          control={control}
          name="source"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4 text-base text-gray-900 dark:text-gray-100"
              placeholder="Sueldo, freelance, bono…"
              placeholderTextColor="#cbd5e1"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              maxLength={100}
            />
          )}
        />
        {errors.source && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.source.message}</Text>
        )}
      </View>

      {/* FRECUENCIA */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Frecuencia
        </Text>
        <Controller
          control={control}
          name="frequency"
          render={({ field: { value, onChange } }) => (
            <View className="gap-2">
              {FREQUENCY_OPTIONS.map((opt) => {
                const selected = value === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => onChange(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className={
                      selected
                        ? 'flex-row items-center justify-between rounded-2xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-5 py-4'
                        : 'flex-row items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4'
                    }
                  >
                    <View>
                      <Text
                        className={
                          selected
                            ? 'text-base font-semibold text-emerald-800 dark:text-emerald-200'
                            : 'text-base font-semibold text-gray-900 dark:text-gray-100'
                        }
                      >
                        {opt.label}
                      </Text>
                      <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{opt.hint}</Text>
                    </View>
                    {selected && (
                      <View className="h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
                        <Text className="text-xs font-bold text-white">✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        />
        {errors.frequency && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.frequency.message}</Text>
        )}
      </View>

      {/* START DATE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Fecha de inicio
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

      {/* END DATE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Fecha de fin <Text className="text-gray-400 dark:text-gray-500 normal-case">(opcional)</Text>
        </Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => openDatePicker('end_date')}
            className="flex-1 flex-row items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4"
          >
            <Text className={endDateStr ? 'text-base text-gray-900 dark:text-gray-100' : 'text-base text-gray-400 dark:text-gray-500'}>
              {endDateStr ? formatDateEs(endDateStr) : 'Sin fecha de fin'}
            </Text>
            <Calendar size={20} color="#64748b" />
          </Pressable>
          {endDateStr ? (
            <Pressable
              onPress={clearEndDate}
              accessibilityLabel="Quitar fecha de fin"
              className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950"
            >
              <X size={20} color="#64748b" />
            </Pressable>
          ) : null}
        </View>
        {errors.end_date && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.end_date.message}</Text>
        )}
      </View>

      {/* NOTE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Nota <Text className="text-gray-400 dark:text-gray-500 normal-case">(opcional)</Text>
        </Text>
        <Controller
          control={control}
          name="note"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-5 py-4 text-base text-gray-900 dark:text-gray-100"
              placeholder="Detalles adicionales"
              placeholderTextColor="#cbd5e1"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              numberOfLines={3}
              maxLength={500}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          )}
        />
        {errors.note && (
          <Text className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.note.message}</Text>
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

/** Helper para mostrar fechas ISO en español: "15 de marzo 2026". */
function formatDateEs(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

/** Helpers de conversión que necesitan los screens. Re-exportados para conveniencia. */
export { fromCents, toCents };
