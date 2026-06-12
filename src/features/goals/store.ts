// src/features/goals/store.ts
import { create } from 'zustand';

import {
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
  type GoalWithProgress,
  type NewGoalInput,
  type UpdateGoalInput,
} from './repository';

export interface GoalsState {
  goals: GoalWithProgress[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (input: NewGoalInput) => Promise<void>;
  edit: (id: string, patch: UpdateGoalInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useGoals = create<GoalsState>((set, get) => ({
  goals: [],
  loaded: false,
  load: async () => {
    const goals = await listGoals();
    set({ goals, loaded: true });
  },
  add: async (input) => {
    await createGoal(input);
    await get().load();
  },
  edit: async (id, patch) => {
    await updateGoal(id, patch);
    await get().load();
  },
  remove: async (id) => {
    await deleteGoal(id);
    await get().load();
  },
}));
