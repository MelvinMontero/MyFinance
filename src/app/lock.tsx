import { useRouter } from 'expo-router';
import { Fingerprint, Lock as LockIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticateBiometric } from '@/features/auth/biometric';
import { useAppSession } from '@/features/auth/session';

export default function LockScreen() {
  const router = useRouter();
  const setUnlocked = useAppSession((s) => s.setUnlocked);
  const [state, setState] = useState<'idle' | 'authenticating' | 'denied'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function tryUnlock() {
    setState('authenticating');
    setErrorMsg(null);
    const result = await authenticateBiometric('Desbloqueá MyFinance');
    if (result.success) {
      setUnlocked(true);
      router.replace('/');
    } else {
      setState('denied');
      setErrorMsg(result.error === 'cancelled' ? null : (result.error ?? null));
    }
  }

  // Disparamos auto-prompt al montar.
  useEffect(() => {
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-900" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="h-24 w-24 items-center justify-center rounded-3xl bg-emerald-600/20">
          <LockIcon size={48} color="#10b981" strokeWidth={1.8} />
        </View>
        <Text className="mt-6 text-2xl font-bold text-white">MyFinance</Text>
        <Text className="mt-2 text-center text-base text-gray-400">
          {state === 'authenticating'
            ? 'Autenticando…'
            : state === 'denied'
              ? 'No se pudo desbloquear'
              : 'Bloqueado'}
        </Text>
        {errorMsg && (
          <Text className="mt-2 text-center text-sm text-red-300">{errorMsg}</Text>
        )}
      </View>

      <View className="px-6 pb-8">
        <Pressable
          onPress={tryUnlock}
          disabled={state === 'authenticating'}
          accessibilityRole="button"
          className={
            state === 'authenticating'
              ? 'flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4'
              : 'flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 active:bg-emerald-700'
          }
        >
          {state === 'authenticating' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Fingerprint size={20} color="#fff" strokeWidth={2.5} />
              <Text className="text-base font-bold text-white">
                Desbloquear
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
