import { zodResolver } from '@hookform/resolvers/zod';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { listCategories } from '@/features/categories/repository';
import type { Category } from '@/shared/db/types';
import { SUPPORTED_CURRENCIES, currencySymbol } from '@/shared/utils/currency';
import { parseAmount } from '@/shared/utils/money';

import { fixedExpenseFormSchema, type FixedExpenseFormValues } from './schemas';

interface Props {
  defaultValues?: Partial<FixedExpenseFormValues>;
  onSubmit: (values: FixedExpenseFormValues) => Promise<void> | void;
  submitLabel: string;
}

export function FixedExpenseForm({ defaultValues, onSubmit, submitLabel }: Props) {
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCategories({ type: 'fixed_expense' }).then((rows) => {
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
  } = useForm<FixedExpenseFormValues>({
    resolver: zodResolver(fixedExpenseFormSchema),
    defaultValues: {
      name: '',
      amount: 0,
      currency: 'CRC',
      category_id: '',
      due_day: 1,
      start_date: today,
      end_date: '',
      ...defaultValues,
    },
  });

  const currency = watch('currency');
  const startDateStr = watch('start_date');
  const endDateStr = watch('end_date');

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

  return (
    <View className="gap-6">
      {/* MONEDA */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
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
                        ? 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3'
                        : 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3'
                    }
                  >
                    <Text
                      className={
                        selected
                          ? 'text-xl font-bold text-emerald-800'
                          : 'text-xl font-bold text-gray-500'
                      }
                    >
                      {currencySymbol(opt)}
                    </Text>
                    <Text
                      className={
                        selected
                          ? 'text-sm font-semibold text-emerald-800'
                          : 'text-sm font-semibold text-gray-700'
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

      {/* MONTO */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Monto en {currency}
        </Text>
        <Controller
          control={control}
          name="amount"
          render={({ field: { value, onChange, onBlur } }) => (
            <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
              <Text className="mr-2 text-2xl font-semibold text-gray-400">
                {currencySymbol(currency)}
              </Text>
              <TextInput
                className="flex-1 text-2xl font-semibold text-gray-900"
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
          <Text className="mt-1 text-sm text-red-600">{errors.amount.message}</Text>
        )}
      </View>

      {/* NOMBRE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Nombre
        </Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-900"
              placeholder="Renta, Netflix, Internet…"
              placeholderTextColor="#cbd5e1"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              maxLength={100}
            />
          )}
        />
        {errors.name && (
          <Text className="mt-1 text-sm text-red-600">{errors.name.message}</Text>
        )}
      </View>

      {/* CATEGORÍA */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Categoría
        </Text>
        <Controller
          control={control}
          name="category_id"
          render={({ field: { value, onChange } }) => (
            <View className="gap-2">
              {categories === null ? (
                <View className="items-center py-4">
                  <ActivityIndicator color="#059669" />
                </View>
              ) : (
                categories.map((cat) => {
                  const selected = value === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => onChange(cat.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      className={
                        selected
                          ? 'flex-row items-center gap-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3'
                          : 'flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3'
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
                            ? 'flex-1 text-base font-semibold text-emerald-800'
                            : 'flex-1 text-base font-semibold text-gray-900'
                        }
                      >
                        {cat.name}
                      </Text>
                      {selected && (
                        <View className="h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
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
        {errors.category_id && (
          <Text className="mt-1 text-sm text-red-600">{errors.category_id.message}</Text>
        )}
      </View>

      {/* DÍA DE PAGO */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Día de pago del mes
        </Text>
        <Controller
          control={control}
          name="due_day"
          render={({ field: { value, onChange, onBlur } }) => (
            <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
              <Text className="mr-2 text-base text-gray-500">Día</Text>
              <TextInput
                className="flex-1 text-2xl font-semibold text-gray-900"
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor="#cbd5e1"
                value={value > 0 ? String(value) : ''}
                onChangeText={(text) => {
                  const n = parseInt(text.replace(/\D/g, ''), 10);
                  onChange(Number.isFinite(n) ? n : 0);
                }}
                onBlur={onBlur}
                maxLength={2}
              />
              <Text className="ml-2 text-sm text-gray-500">/ 31</Text>
            </View>
          )}
        />
        <Text className="mt-1 text-xs text-gray-500">
          Si elegís 31 y el mes tiene menos días, contamos el último día del mes.
        </Text>
        {errors.due_day && (
          <Text className="mt-1 text-sm text-red-600">{errors.due_day.message}</Text>
        )}
      </View>

      {/* START DATE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Vigente desde
        </Text>
        <Pressable
          onPress={() => openDatePicker('start_date')}
          className="flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4"
        >
          <Text className="text-base text-gray-900">
            {startDateStr ? formatDateEs(startDateStr) : 'Seleccionar fecha'}
          </Text>
          <Calendar size={20} color="#64748b" />
        </Pressable>
        {errors.start_date && (
          <Text className="mt-1 text-sm text-red-600">{errors.start_date.message}</Text>
        )}
      </View>

      {/* END DATE */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Hasta <Text className="text-gray-400 normal-case">(opcional)</Text>
        </Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => openDatePicker('end_date')}
            className="flex-1 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4"
          >
            <Text
              className={endDateStr ? 'text-base text-gray-900' : 'text-base text-gray-400'}
            >
              {endDateStr ? formatDateEs(endDateStr) : 'Sin fecha de fin'}
            </Text>
            <Calendar size={20} color="#64748b" />
          </Pressable>
          {endDateStr ? (
            <Pressable
              onPress={() =>
                setValue('end_date', '', { shouldValidate: true, shouldDirty: true })
              }
              accessibilityLabel="Quitar fecha de fin"
              className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50"
            >
              <X size={20} color="#64748b" />
            </Pressable>
          ) : null}
        </View>
        {errors.end_date && (
          <Text className="mt-1 text-sm text-red-600">{errors.end_date.message}</Text>
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
