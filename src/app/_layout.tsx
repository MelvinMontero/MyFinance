import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="income/new"
            options={{
              presentation: 'modal',
              title: 'Nuevo ingreso',
              headerStyle: { backgroundColor: '#ffffff' },
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <Stack.Screen
            name="income/[id]"
            options={{
              presentation: 'modal',
              title: 'Editar ingreso',
              headerStyle: { backgroundColor: '#ffffff' },
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
