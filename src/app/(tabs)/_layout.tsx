import { Tabs } from 'expo-router';
import {
  BarChart3,
  Home,
  Receipt,
  Settings as SettingsIcon,
  ShoppingBag,
  Wallet,
} from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11 },
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
