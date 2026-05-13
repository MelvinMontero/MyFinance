import { Redirect, Tabs } from 'expo-router';
import {
  BarChart3,
  Home,
  Receipt,
  Settings as SettingsIcon,
  ShoppingBag,
  Wallet,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

import { useAppSession } from '@/features/auth/session';
import { useSettings } from '@/features/settings/store';

export default function TabsLayout() {
  const onboardingDone = useSettings((s) => s.onboarding_completed);
  const biometricEnabled = useSettings((s) => s.biometric_enabled);
  const unlocked = useAppSession((s) => s.unlocked);
  const { colorScheme: cs } = useColorScheme();
  const isDark = cs === 'dark';

  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }
  if (biometricEnabled && !unlocked) {
    return <Redirect href="/lock" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderTopColor: isDark ? '#1e293b' : '#e5e7eb',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="incomes"
        options={{
          title: 'Ingresos',
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="fixed-expenses"
        options={{
          title: 'Fijos',
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="extras"
        options={{
          title: 'Extras',
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
