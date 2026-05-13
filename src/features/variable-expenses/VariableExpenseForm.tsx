import { zodResolver } from '@hookform/resolvers/zod';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from 'lucide-react-native';
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

import {
  variableExpenseFormSchema,
  type VariableExpenseFormValues,
} from './schemas';

interface Props {
  defaultValues?: Partial<VariableExpenseFormValues>;
  onSubmit: (values: VariableExpenseFormValues) => Promise<void> | void;
  submitLabel: string;
}

export function VariableExpenseForm({ defaultValues, onSubmit, submitLabel }: Props) {
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
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
  } = useForm<VariableExpenseFormValues>({
    resolver: zodResolver(variableExpenseFormSchema),
    defaultValues: {
      amount: 0,
      currency: 'CRC',
      category_id: '',
      occurred_at: today,
      note: '',
      ...defaultValues,
    },
  });

  const currency = watch('currency');
  const dateStr = watch('occurred_at');

  function openDatePicker() {
    const initial = dateStr ? parseISO(dateStr) : new Date();
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      maximumDate: new Date(), // no permitimos fechas futuras para gastos variables
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
                        ? 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-amber-600 bg-amber-50 px-4 py-3'
                        : 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3'
                    }
                  >
                    <Text
                      className={
                        selected
                          ? 'text-xl font-bold text-amber-800'
                          : 'text-xl font-bold text-gray-500'
                      }
                    >
                      {currencySymbol(opt)}
                    </Text>
                    <Text
                      className={
                        selected
                          ? 'text-sm font-semibold text-amber-800'
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
                    /* mantener valor previo si no parsea */
                  }
                }}
                onBlur={onBlur}
                autoFocus
              />
            </View>
          )}
        />
        {errors.amount && (
          <Text className="mt-1 text-sm text-red-600">{errors.amount.message}</Text>
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
                  <ActivityIndicator color="#d97706" />
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
                          ? 'flex-row items-center gap-3 rounded-2xl border-2 border-amber-600 bg-amber-50 px-4 py-3'
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
                            ? 'flex-1 text-base font-semibold text-amber-800'
                            : 'flex-1 text-base font-semibold text-gray-900'
                        }
                      >
                        {cat.name}
                      </Text>
                      {selected && (
                        <View className="h-5 w-5 items-center justify-center rounded-full bg-amber-600">
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

      {/* FECHA */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Fecha
        </Text>
        <Pressable
          onPress={openDatePicker}
          className="flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4"
        >
          <Text className="text-base text-gray-900">
            {dateStr ? formatDateEs(dateStr) : 'Seleccionar fecha'}
          </Text>
          <Calendar size={20} color="#64748b" />
        </Pressable>
        {errors.occurred_at && (
          <Text className="mt-1 text-sm text-red-600">{errors.occurred_at.message}</Text>
        )}
      </View>

      {/* NOTA */}
      <View>
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Nota <Text className="text-gray-400 normal-case">(opcional)</Text>
        </Text>
        <Controller
          control={control}
          name="note"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-900"
              placeholder="Starbucks, almuerzo en…"
              placeholderTextColor="#cbd5e1"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              maxLength={500}
            />
          )}
        />
        {errors.note && (
          <Text className="mt-1 text-sm text-red-600">{errors.note.message}</Text>
        )}
      </View>

      {/* SUBMIT */}
      <Pressable
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityRole="button"
        className={
          isSubmitting
            ? 'mt-2 items-center rounded-2xl bg-amber-300 px-6 py-4'
            : 'mt-2 items-center rounded-2xl bg-amber-600 px-6 py-4 active:bg-amber-700'
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
