import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { safeLocalSet } from "@/lib/local-cache";

export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  value: number;
  gain: number;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  date?: string;
  goal?: number;
  raised: number;
  active: boolean;
  template?: string;
}

export interface Contributor {
  id: string;
  name: string;
  amount: number;
  eventId: string;
  eventTitle: string;
  note?: string;
  date: string;
  thanked: boolean;
}

export interface Activity {
  id: string;
  from: string;
  amount: number;
  event: string;
  eventId: string;
  note?: string;
  time: string;
  status: 'pending' | 'invested';
}

export interface Fund {
  id: string;
  name: string;
  slug: string;
  type: 'child' | 'personal';
  status: 'draft' | 'pending' | 'active';
  balance: number;
  totalReceived: number;
  pendingAmount: number;
  cashAmount: number;
  investedAmount: number;
  growth: number;
  projection: number;
  contributors: number;
  events: Event[];
  holdings: Holding[];
  activity: Activity[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'family';
  kycCompleted: boolean;
}

interface KoraState {
  user: User | null;
  funds: Fund[];
  selectedFundId: string | null;
  isLoading: boolean;
  onboardingStep: 'signup' | 'fund_created' | 'activated' | 'event_created' | 'shared' | 'complete';
}

interface KoraContextType extends KoraState {
  setUser: (user: User | null) => void;
  addFund: (fund: Omit<Fund, 'id' | 'createdAt'>) => Fund;
  updateFund: (fundId: string, updates: Partial<Fund>) => void;
  selectFund: (fundId: string) => void;
  addEvent: (fundId: string, event: Omit<Event, 'id'>) => Event;
  updateEvent: (fundId: string, eventId: string, updates: Partial<Event>) => void;
  addActivity: (fundId: string, activity: Omit<Activity, 'id'>) => void;
  markThanked: (fundId: string, activityId: string) => void;
  setOnboardingStep: (step: KoraState['onboardingStep']) => void;
  selectedFund: Fund | null;
  pendingThankYous: number;
  resetToEmpty: () => void;
  loadDemoData: () => void;
}

const KoraContext = createContext<KoraContextType | null>(null);

const STORAGE_KEY = 'kora_state';

const generateId = () => Math.random().toString(36).substring(2, 9);

const createEmptyState = (): KoraState => ({
  user: null,
  funds: [],
  selectedFundId: null,
  isLoading: false,
  onboardingStep: 'signup',
});

const createDemoFund = (name: string, type: 'child' | 'personal', status: Fund['status']): Fund => {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const isActive = status === 'active';
  
  return {
    id: generateId(),
    name,
    slug,
    type,
    status,
    balance: isActive ? 4250 : 0,
    totalReceived: isActive ? 3850 : 0,
    pendingAmount: isActive ? 150 : 0,
    cashAmount: isActive ? 85 : 0,
    investedAmount: isActive ? 4015 : 0,
    growth: isActive ? 248 : 0,
    projection: isActive ? 28400 : 15000,
    contributors: isActive ? 18 : 0,
    events: isActive ? [
      { id: generateId(), title: 'Open anytime', slug: 'anytime', raised: 2180, active: true },
      { id: generateId(), title: '5th Birthday', slug: '5th-birthday', date: '2024-06-15', goal: 2500, raised: 1420, active: true },
      { id: generateId(), title: 'Kindergarten', slug: 'kindergarten-graduation', date: '2024-05-20', goal: 1000, raised: 650, active: true },
    ] : [],
    holdings: isActive ? [
      { ticker: 'VTI', name: 'Total Stock Market', shares: 8.234, value: 2150, gain: 124 },
      { ticker: 'VXUS', name: 'International Stocks', shares: 12.5, value: 825, gain: 45 },
      { ticker: 'BND', name: 'Total Bond Market', shares: 8.1, value: 680, gain: 12 },
      { ticker: 'VTIP', name: 'Inflation-Protected', shares: 5.2, value: 360, gain: 8 },
    ] : [],
    activity: isActive ? [
      { id: generateId(), from: 'Grandma Rose', amount: 100, event: '5th Birthday', eventId: 'evt1', note: 'Happy birthday sweetheart!', time: '2 hours ago', status: 'pending' },
      { id: generateId(), from: 'Uncle Mike', amount: 50, event: '5th Birthday', eventId: 'evt1', note: 'For your future!', time: 'Yesterday', status: 'invested' },
      { id: generateId(), from: 'Sarah Chen', amount: 25, event: 'Open anytime', eventId: 'evt2', time: '3 days ago', status: 'invested' },
    ] : [],
    createdAt: new Date().toISOString(),
  };
};

export function KoraProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KoraState>(() => {
    if (typeof window === 'undefined') return createEmptyState();
    // The localStorage READ must be inside the try too. When the browser blocks
    // storage (private/incognito mode, or "block all cookies"), `getItem` itself
    // throws a SecurityError ("the operation is insecure") — and because this
    // runs in the top-level provider's initial render, an uncaught throw here
    // white-screens the ENTIRE app. Guarding only the JSON.parse left that hole.
    // Degrade to an empty state instead so the app always renders.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      /* storage blocked or corrupt — start fresh */
    }
    return createEmptyState();
  });

  useEffect(() => {
    safeLocalSet(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setUser = (user: User | null) => {
    setState(prev => ({ ...prev, user }));
  };

  const addFund = (fundData: Omit<Fund, 'id' | 'createdAt'>): Fund => {
    const fund: Fund = {
      ...fundData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      funds: [...prev.funds, fund],
      selectedFundId: fund.id,
      onboardingStep: 'fund_created',
    }));
    return fund;
  };

  const updateFund = (fundId: string, updates: Partial<Fund>) => {
    setState(prev => ({
      ...prev,
      funds: prev.funds.map(f => f.id === fundId ? { ...f, ...updates } : f),
    }));
  };

  const selectFund = (fundId: string) => {
    setState(prev => ({ ...prev, selectedFundId: fundId }));
  };

  const addEvent = (fundId: string, eventData: Omit<Event, 'id'>): Event => {
    const event: Event = { ...eventData, id: generateId() };
    setState(prev => ({
      ...prev,
      funds: prev.funds.map(f => 
        f.id === fundId ? { ...f, events: [...f.events, event] } : f
      ),
      onboardingStep: prev.onboardingStep === 'activated' ? 'event_created' : prev.onboardingStep,
    }));
    return event;
  };

  const updateEvent = (fundId: string, eventId: string, updates: Partial<Event>) => {
    setState(prev => ({
      ...prev,
      funds: prev.funds.map(f => 
        f.id === fundId 
          ? { ...f, events: f.events.map(e => e.id === eventId ? { ...e, ...updates } : e) }
          : f
      ),
    }));
  };

  const addActivity = (fundId: string, activityData: Omit<Activity, 'id'>) => {
    const activity: Activity = { ...activityData, id: generateId() };
    setState(prev => ({
      ...prev,
      funds: prev.funds.map(f => 
        f.id === fundId 
          ? { 
              ...f, 
              activity: [activity, ...f.activity],
              totalReceived: f.totalReceived + activity.amount,
              pendingAmount: activity.status === 'pending' ? f.pendingAmount + activity.amount : f.pendingAmount,
              contributors: f.contributors + 1,
            } 
          : f
      ),
    }));
  };

  const markThanked = (fundId: string, activityId: string) => {
    setState(prev => ({
      ...prev,
      funds: prev.funds.map(f => 
        f.id === fundId 
          ? { ...f, activity: f.activity.map(a => a.id === activityId ? { ...a, thanked: true } : a) }
          : f
      ),
    }));
  };

  const setOnboardingStep = (step: KoraState['onboardingStep']) => {
    setState(prev => ({ ...prev, onboardingStep: step }));
  };

  const resetToEmpty = () => {
    setState(createEmptyState());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage blocked — state reset is what matters */
    }
  };

  const loadDemoData = () => {
    const demoFund = createDemoFund('Mila', 'child', 'active');
    setState({
      user: { id: generateId(), name: 'Sarah', email: 'sarah@example.com', plan: 'free', kycCompleted: true },
      funds: [demoFund],
      selectedFundId: demoFund.id,
      isLoading: false,
      onboardingStep: 'complete',
    });
  };

  const selectedFund = state.funds.find(f => f.id === state.selectedFundId) || state.funds[0] || null;
  
  const pendingThankYous = selectedFund 
    ? selectedFund.activity.filter(a => !(a as any).thanked).length 
    : 0;

  const value: KoraContextType = {
    ...state,
    setUser,
    addFund,
    updateFund,
    selectFund,
    addEvent,
    updateEvent,
    addActivity,
    markThanked,
    setOnboardingStep,
    selectedFund,
    pendingThankYous,
    resetToEmpty,
    loadDemoData,
  };

  return (
    <KoraContext.Provider value={value}>
      {children}
    </KoraContext.Provider>
  );
}

export function useKora() {
  const context = useContext(KoraContext);
  if (!context) {
    throw new Error('useKora must be used within a KoraProvider');
  }
  return context;
}
