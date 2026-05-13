import { create } from 'zustand';

interface SessionState {
  /** True una vez que el usuario pasó el bloqueo biométrico (si aplica). */
  unlocked: boolean;
  setUnlocked: (v: boolean) => void;
  reset: () => void;
}

/**
 * Estado in-memory (NO persiste). Se resetea al matar la app, así el
 * usuario tiene que volver a desbloquear con biometría en cada arranque.
 */
export const useAppSession = create<SessionState>((set) => ({
  unlocked: false,
  setUnlocked: (v) => set({ unlocked: v }),
  reset: () => set({ unlocked: false }),
}));
