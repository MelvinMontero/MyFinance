import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

/**
 * Reporta si el dispositivo tiene hardware biométrico Y el usuario tiene
 * algo enrolado (huella/cara). Sin esto, la biometría no puede activarse.
 */
export async function checkBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { hasHardware, isEnrolled, supportedTypes };
}

export async function authenticateBiometric(
  reason = 'Desbloqueá MyFinance',
): Promise<{ success: boolean; error?: string }> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar contraseña del dispositivo',
    disableDeviceFallback: false,
  });
  if (result.success) return { success: true };
  return {
    success: false,
    error: 'error' in result ? result.error : 'cancelled',
  };
}
