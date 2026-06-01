export type Plan = 'free' | 'premium1' | 'premium2';

export interface PlanFeatures {
  label: string;
  canCreateRoom: boolean;
  canUseEditor: boolean;
  canUsePresenter: boolean;
  canSaveEvents: boolean;
  canUseGoogleSheets: boolean;
  canUseCustomColumns: boolean;
  roomCapacity: number;
}

export const PLANS: Record<Plan, PlanFeatures> = {
  free: {
    label: 'Free',
    canCreateRoom:       false,
    canUseEditor:        false,
    canUsePresenter:     false,
    canSaveEvents:       false,
    canUseGoogleSheets:  false,
    canUseCustomColumns: false,
    roomCapacity:        0,
  },
  premium1: {
    label: 'Pro',
    canCreateRoom:       true,
    canUseEditor:        true,
    canUsePresenter:     true,
    canSaveEvents:       true,
    canUseGoogleSheets:  true,
    canUseCustomColumns: false,
    roomCapacity:        5,
  },
  premium2: {
    label: 'Studio',
    canCreateRoom:       true,
    canUseEditor:        true,
    canUsePresenter:     true,
    canSaveEvents:       true,
    canUseGoogleSheets:  true,
    canUseCustomColumns: true,
    roomCapacity:        15,
  },
};

export function getPlanFeatures(plan: Plan): PlanFeatures {
  return PLANS[plan];
}

export const PLAN_BADGE_COLOR: Record<Plan, string> = {
  free:     'text-warm-600 bg-warm-800/50 border-warm-700/40',
  premium1: 'text-amber-300 bg-amber-900/30 border-amber-700/40',
  premium2: 'text-crimson-300 bg-crimson-900/30 border-crimson-700/40',
};
