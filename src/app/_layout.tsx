import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme, useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setupNotificationHandler } from '@/features/notifications/scheduler';
import { useSettings } from '@/features/settings/store';
import { initDb } from '@/shared/db';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <RootContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootContent() {
  const loaded = useSettings((s) => s.loaded);
  const theme = useSettings((s) => s.theme);
  const { colorScheme: cs } = useColorScheme();
  const isDark = cs === 'dark';
  const [error, setError] = useState<string | null>(null);

  // Boot: initDb + load settings + setup notifs.
  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await useSettings.getState().load();
        setupNotificationHandler();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  // Aplica el theme al colorScheme de NativeWind cada vez que cambia en el store.
  useEffect(() => {
    colorScheme.set(theme);
  }, [theme]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: isDark ? '#0f172a' : '#fff' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#dc2626' }}>Error al iniciar</Text>
        <Text style={{ marginTop: 8, color: isDark ? '#cbd5e1' : '#475569', textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0f172a' : '#fff' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const headerBg = isDark ? '#0f172a' : '#ffffff';
  const headerText = isDark ? '#f1f5f9' : '#0f172a';

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: isDark ? '#030712' : '#f9fafb' },
        headerStyle: { backgroundColor: headerBg },
        headerTitleStyle: { fontWeight: '700', color: headerText },
        headerTintColor: headerText,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="onboarding"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="lock"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="income/new"
        options={{
          presentation: 'modal',
          title: 'Nuevo ingreso',
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { fontWeight: '700', color: headerText },
          headerTintColor: headerText,
        }}
      />
      <Stack.Screen
        name="income/[id]"
        options={{
          presentation: 'modal',
          title: 'Editar ingreso',
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { fontWeight: '700', color: headerText },
          headerTintColor: headerText,
        }}
      />
      <Stack.Screen
        name="fixed-expense/new"
        options={{
          presentation: 'modal',
          title: 'Nuevo gasto fijo',
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { fontWeight: '700', color: headerText },
          headerTintColor: headerText,
        }}
      />
      <Stack.Screen
        name="fixed-expense/[id]"
        options={{
          presentation: 'modal',
          title: 'Editar gasto fijo',
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { fontWeight: '700', color: headerText },
          headerTintColor: headerText,
        }}
      />
      <Stack.Screen
        name="variable-expense/new"
        options={{
          presentation: 'modal',
          title: 'Nuevo gasto extra',
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { fontWeight: '700', color: headerText },
          headerTintColor: headerText,
        }}
      />
      <Stack.Screen
        name="variable-expense/[id]"
        options={{
          presentation: 'modal',
          title: 'Editar gasto extra',
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { fontWeight: '700', color: headerText },
          headerTintColor: headerText,
        }}
      />
    </Stack>
  );
}
