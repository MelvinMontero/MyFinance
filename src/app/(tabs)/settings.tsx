import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Download,
  Fingerprint,
  Moon,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react-native';

import { checkBiometricCapability } from '@/features/auth/biometric';
import { exportBackup, importBackup } from '@/features/backup/repository';
import {
  cancelAllScheduled,
  requestNotificationPermission,
  rescheduleFixedExpenseNotifications,
} from '@/features/notifications/scheduler';
import { useSettings } from '@/features/settings/store';
import type { ThemePreference } from '@/shared/db/types';
import {
  SUPPORTED_CURRENCIES,
  currencyName,
  currencySymbol,
} from '@/shared/utils/currency';

export default function SettingsScreen() {
  const savingsPercent = useSettings((s) => s.savings_percent);
  const currency = useSettings((s) => s.currency);
  const theme = useSettings((s) => s.theme);
  const biometricEnabled = useSettings((s) => s.biometric_enabled);
  const notificationsEnabled = useSettings((s) => s.notifications_enabled);

  const setSavingsPercent = useSettings((s) => s.setSavingsPercent);
  const setCurrency = useSettings((s) => s.setCurrency);
  const setTheme = useSettings((s) => s.setTheme);
  const setBiometricEnabled = useSettings((s) => s.setBiometricEnabled);
  const setNotificationsEnabled = useSettings((s) => s.setNotificationsEnabled);
  const loadSettings = useSettings((s) => s.load);

  const [draftPct, setDraftPct] = useState(savingsPercent);
  const [busy, setBusy] = useState<null | 'export' | 'import' | 'notif' | 'bio'>(null);

  useEffect(() => {
    setDraftPct(savingsPercent);
  }, [savingsPercent]);

  async function handlePctRelease(value: number) {
    const rounded = Math.round(value);
    setDraftPct(rounded);
    try {
      await setSavingsPercent(rounded);
    } catch (e) {
      Alert.alert('Error al guardar', e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCurrencyChange(c: string) {
    if (c === currency) return;
    try {
      await setCurrency(c);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  async function handleThemeChange(t: ThemePreference) {
    if (t === theme) return;
    try {
      await setTheme(t);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  async function handleBiometricToggle(enabled: boolean) {
    if (busy) return;
    setBusy('bio');
    try {
      if (enabled) {
        const cap = await checkBiometricCapability();
        if (!cap.hasHardware) {
          Alert.alert(
            'Sin hardware biométrico',
            'Este dispositivo no soporta huella ni reconocimiento facial.',
          );
          return;
        }
        if (!cap.isEnrolled) {
          Alert.alert(
            'Sin biometría configurada',
            'Configurá una huella o cara en los ajustes del sistema y volvé a intentarlo.',
          );
          return;
        }
      }
      await setBiometricEnabled(enabled);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleNotificationsToggle(enabled: boolean) {
    if (busy) return;
    setBusy('notif');
    try {
      if (enabled) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            'Permiso denegado',
            'Otorgá permiso de notificaciones en los ajustes del sistema y volvé a intentarlo.',
          );
          return;
        }
        const count = await rescheduleFixedExpenseNotifications(currency);
        await setNotificationsEnabled(true);
        Alert.alert(
          'Notificaciones activadas',
          count === 0
            ? 'Por ahora no hay gastos fijos próximos. Cuando agregués alguno, te recordaré 3 días antes y el día mismo.'
            : `Programé ${count} ${count === 1 ? 'recordatorio' : 'recordatorios'}.`,
        );
      } else {
        await cancelAllScheduled();
        await setNotificationsEnabled(false);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleExport() {
    if (busy) return;
    setBusy('export');
    try {
      const result = await exportBackup();
      Alert.alert(
        'Respaldo exportado',
        `${formatBytes(result.size)} guardados. Eligí dónde compartirlo (Drive, email, descargas, etc.).\n\n⚠️ El archivo está sin cifrar — guardalo en un lugar seguro.`,
      );
    } catch (e) {
      Alert.alert('Error al exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function handleImport() {
    if (busy) return;
    Alert.alert(
      'Importar respaldo',
      'Esto SOBRESCRIBE todos los datos actuales (ingresos, gastos, settings). ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          style: 'destructive',
          onPress: async () => {
            setBusy('import');
            try {
              const result = await importBackup();
              if (!result.ok) {
                if (result.reason !== 'cancelled') {
                  Alert.alert('No se pudo importar', result.reason);
                }
                return;
              }
              await loadSettings(); // refrescar store desde DB recién importada
              Alert.alert(
                'Respaldo restaurado',
                `${result.rowsRestored} filas en ${result.tablesRestored} tablas. Navegá a las pestañas para ver tus datos.`,
              );
            } catch (e) {
              Alert.alert(
                'Error al importar',
                e instanceof Error ? e.message : String(e),
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 pb-24 pt-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">Ajustes</Text>
        <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">
          Personalizá MyFinance a tus números.
        </Text>

        {/* APARIENCIA */}
        <Section title="Apariencia">
          <View className="flex-row gap-2">
            <ThemeOption
              icon={Smartphone}
              label="Sistema"
              selected={theme === 'system'}
              onPress={() => handleThemeChange('system')}
            />
            <ThemeOption
              icon={Sun}
              label="Claro"
              selected={theme === 'light'}
              onPress={() => handleThemeChange('light')}
            />
            <ThemeOption
              icon={Moon}
              label="Oscuro"
              selected={theme === 'dark'}
              onPress={() => handleThemeChange('dark')}
            />
          </View>
          <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            El modo oscuro está aplicado en esta pantalla. Otras pantallas se irán
            sumando en próximas actualizaciones.
          </Text>
        </Section>

        {/* META DE AHORRO */}
        <Section title="Meta de ahorro mensual">
          <View className="flex-row items-baseline">
            <Text className="text-5xl font-bold text-emerald-700 dark:text-emerald-400">
              {draftPct}
            </Text>
            <Text className="ml-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              %
            </Text>
          </View>
          <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Del total de ingresos del mes, este porcentaje se reserva
            automáticamente para tu sobre de ahorro.
          </Text>
          <Slider
            style={{ width: '100%', height: 44, marginTop: 16 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={savingsPercent}
            onValueChange={(v) => setDraftPct(Math.round(v))}
            onSlidingComplete={handlePctRelease}
            minimumTrackTintColor="#059669"
            maximumTrackTintColor="#d1d5db"
            thumbTintColor="#059669"
          />
          <View className="-mt-1 flex-row justify-between">
            <Text className="text-xs text-gray-400">0%</Text>
            <Text className="text-xs text-gray-400">50%</Text>
            <Text className="text-xs text-gray-400">100%</Text>
          </View>
        </Section>

        {/* MONEDA POR DEFECTO */}
        <Section title="Moneda por defecto">
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            Preseleccionada al crear ingresos y gastos. Podés elegir otra en
            cada registro.
          </Text>
          <View className="gap-2">
            {SUPPORTED_CURRENCIES.map((c) => {
              const selected = currency === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => handleCurrencyChange(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={
                    selected
                      ? 'flex-row items-center justify-between rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4 dark:bg-emerald-950'
                      : 'flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800'
                  }
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={
                        selected
                          ? 'h-11 w-11 items-center justify-center rounded-xl bg-emerald-600'
                          : 'h-11 w-11 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700'
                      }
                    >
                      <Text
                        className={
                          selected
                            ? 'text-xl font-bold text-white'
                            : 'text-xl font-bold text-gray-700 dark:text-gray-200'
                        }
                      >
                        {currencySymbol(c)}
                      </Text>
                    </View>
                    <Text
                      className={
                        selected
                          ? 'text-base font-semibold text-emerald-800 dark:text-emerald-200'
                          : 'text-base font-semibold text-gray-900 dark:text-gray-100'
                      }
                    >
                      {currencyName(c)}
                    </Text>
                  </View>
                  {selected && (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                      <Text className="text-xs font-bold text-white">✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* SEGURIDAD */}
        <Section title="Seguridad">
          <ToggleRow
            icon={Fingerprint}
            iconColor="#059669"
            label="Bloqueo biométrico"
            description="Pide huella o cara al abrir la app."
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            disabled={busy !== null}
          />
        </Section>

        {/* NOTIFICACIONES */}
        <Section title="Notificaciones">
          <ToggleRow
            icon={Bell}
            iconColor="#2563eb"
            label="Recordatorios de gastos fijos"
            description="Aviso 3 días antes y el día del vencimiento."
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            disabled={busy !== null}
          />
        </Section>

        {/* RESPALDO */}
        <Section title="Respaldo de datos">
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            Exportá un archivo .json con todos tus datos para guardarlo en
            Drive, email o donde quieras. Sin cifrar — guardalo en un lugar
            seguro.
          </Text>
          <Pressable
            onPress={handleExport}
            disabled={busy !== null}
            accessibilityRole="button"
            className={
              busy === 'export'
                ? 'mb-2 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 py-3'
                : 'mb-2 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 active:bg-emerald-700'
            }
          >
            <Download size={18} color="#fff" strokeWidth={2.5} />
            <Text className="text-base font-bold text-white">
              {busy === 'export' ? 'Exportando…' : 'Exportar respaldo'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleImport}
            disabled={busy !== null}
            accessibilityRole="button"
            className={
              busy === 'import'
                ? 'flex-row items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-gray-100 px-4 py-3 dark:border-gray-700 dark:bg-gray-800'
                : 'flex-row items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-3 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
            }
          >
            <Upload size={18} color="#475569" strokeWidth={2.5} />
            <Text className="text-base font-bold text-gray-700 dark:text-gray-200">
              {busy === 'import' ? 'Importando…' : 'Importar respaldo'}
            </Text>
          </Pressable>
          <Text className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Importar SOBRESCRIBE todos tus datos actuales.
          </Text>
        </Section>

        {/* NOTA */}
        <View className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950">
          <Text className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Moneda por registro
          </Text>
          <Text className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
            Cada ingreso, gasto fijo y gasto variable guarda su propia moneda.
            Cambiar la default acá no toca los registros ya creados.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6 rounded-2xl bg-white p-5 dark:bg-gray-800">
      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
        {title}
      </Text>
      {children}
    </View>
  );
}

interface IconCompProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function ThemeOption({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: React.ComponentType<IconCompProps>;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={
        selected
          ? 'flex-1 items-center rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-3 py-4 dark:bg-emerald-950'
          : 'flex-1 items-center rounded-2xl border border-gray-200 bg-white px-3 py-4 dark:border-gray-700 dark:bg-gray-700'
      }
    >
      <Icon size={22} color={selected ? '#059669' : '#64748b'} strokeWidth={2} />
      <Text
        className={
          selected
            ? 'mt-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200'
            : 'mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  icon: Icon,
  iconColor,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon: React.ComponentType<IconCompProps>;
  iconColor: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className="h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconColor + '22' }}
      >
        <Icon size={22} color={iconColor} strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#cbd5e1', true: '#10b981' }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
