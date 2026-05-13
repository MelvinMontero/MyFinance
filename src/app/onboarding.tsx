import { useRouter } from 'expo-router';
import {
  ArrowRight,
  PiggyBank,
  Receipt,
  Sparkles,
  Wallet,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/features/settings/store';

interface Slide {
  Icon: typeof PiggyBank;
  iconTint: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    Icon: Sparkles,
    iconTint: '#059669',
    title: 'Bienvenido a MyFinance',
    body: 'Una app simple, sin nube y sin cuentas. Tus datos viven solo en tu teléfono.',
  },
  {
    Icon: Wallet,
    iconTint: '#d97706',
    title: 'Tu plata, en 3 sobres',
    body: 'Cada mes tu ingreso se reparte en Ahorro (%), Gastos fijos y Dinero libre. El resto es para gustos y extras.',
  },
  {
    Icon: Receipt,
    iconTint: '#2563eb',
    title: 'Disciplina sin esfuerzo',
    body: 'Registrá ingresos y gastos. La app calcula los sobres en vivo y te avisa cuando te pasás.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const setOnboardingCompleted = useSettings((s) => s.setOnboardingCompleted);
  const [index, setIndex] = useState(0);

  async function finish() {
    await setOnboardingCompleted(true);
    router.replace('/');
  }

  async function next() {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      await finish();
    }
  }

  const slide = SLIDES[index];
  if (!slide) return null;
  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8">
        <View
          className="h-28 w-28 items-center justify-center rounded-3xl"
          style={{ backgroundColor: slide.iconTint + '22' }}
        >
          <slide.Icon size={56} color={slide.iconTint} strokeWidth={1.8} />
        </View>
        <Text className="mt-8 text-center text-3xl font-bold text-gray-900">
          {slide.title}
        </Text>
        <Text className="mt-4 text-center text-base leading-6 text-gray-600">
          {slide.body}
        </Text>
      </View>

      {/* Dots */}
      <View className="mb-4 flex-row items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <View
            key={i}
            className={
              i === index ? 'h-2 w-6 rounded-full bg-emerald-600' : 'h-2 w-2 rounded-full bg-gray-300'
            }
          />
        ))}
      </View>

      {/* Buttons */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={next}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 active:bg-emerald-700"
        >
          <Text className="text-base font-bold text-white">
            {isLast ? 'Comenzar' : 'Siguiente'}
          </Text>
          <ArrowRight size={18} color="#fff" strokeWidth={2.5} />
        </Pressable>
        {!isLast && (
          <Pressable
            onPress={finish}
            accessibilityRole="button"
            className="mt-2 items-center py-3 active:opacity-60"
          >
            <Text className="text-sm font-semibold text-gray-500">Saltar</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
