'use client';

import { create } from 'zustand';
import { VOID_POSTS, type VoidPost } from '@/lib/our-sky/data';

export type Tab = 'home' | 'friends' | 'void' | 'shop' | 'you';
export type YouSub = 'chart' | 'saved' | 'settings';

export interface CartLine {
  productId: string;
  variant?: string;
  qty: number;
}

interface OurSkyState {
  // navigation
  mode: 'onboarding' | 'app';
  tab: Tab;
  youSub: YouSub;
  friendDetail: string | null;
  relationshipFriend: string | null;
  // onboarding
  obName: string;
  obDate: string;
  obTime: string;
  obPlace: string;
  // void
  voidRulesSeen: boolean;
  voidPosts: VoidPost[];
  // shop
  cart: CartLine[];
  // saved
  savedIds: string[];

  // actions
  finishOnboarding: () => void;
  replayOnboarding: () => void;
  setOb: (patch: Partial<Pick<OurSkyState, 'obName' | 'obDate' | 'obTime' | 'obPlace'>>) => void;
  goTab: (t: Tab) => void;
  setYouSub: (s: YouSub) => void;
  openFriend: (id: string | null) => void;
  setRelationship: (id: string | null) => void;
  dismissRules: () => void;
  releasePost: (body: string, tag?: string) => void;
  echoPost: (id: string) => void;
  takeBack: (id: string) => void;
  dimPost: (id: string) => void;
  addToCart: (productId: string, variant?: string) => void;
  removeFromCart: (productId: string, variant?: string) => void;
  toggleSave: (id: string) => void;
}

export const useOurSky = create<OurSkyState>((set, get) => ({
  mode: 'onboarding',
  tab: 'home',
  youSub: 'chart',
  friendDetail: null,
  relationshipFriend: null,
  obName: '',
  obDate: '',
  obTime: '',
  obPlace: '',
  voidRulesSeen: false,
  voidPosts: VOID_POSTS,
  cart: [],
  savedIds: ['s1', 's2'],

  finishOnboarding: () => set({ mode: 'app', tab: 'you' }),
  replayOnboarding: () => set({ mode: 'onboarding' }),
  setOb: patch => set(patch),
  goTab: t => set({ tab: t, friendDetail: null }),
  setYouSub: s => set({ youSub: s }),
  openFriend: id => set({ friendDetail: id }),
  setRelationship: id => set({ relationshipFriend: id }),
  dismissRules: () => set({ voidRulesSeen: true }),

  releasePost: (body, tag) =>
    set(s => ({
      voidPosts: [{ id: `mine-${Date.now()}`, body, astroTag: tag, echoed: false, mine: true, ageH: 0 }, ...s.voidPosts],
    })),
  echoPost: id =>
    set(s => ({
      voidPosts: s.voidPosts.map(p => (p.id === id ? { ...p, echoed: !p.echoed } : p)),
    })),
  takeBack: id =>
    set(s => ({
      voidPosts: s.voidPosts.filter(p => p.id !== id),
    })),
  dimPost: id =>
    set(s => ({
      voidPosts: s.voidPosts.map(p => (p.id === id ? { ...p, body: '…' } : p)),
    })),

  addToCart: (productId, variant) =>
    set(s => {
      const i = s.cart.findIndex(l => l.productId === productId && l.variant === variant);
      if (i >= 0) {
        const cart = [...s.cart];
        cart[i] = { ...cart[i], qty: cart[i].qty + 1 };
        return { cart };
      }
      return { cart: [...s.cart, { productId, variant, qty: 1 }] };
    }),
  removeFromCart: (productId, variant) =>
    set(s => {
      const cart = s.cart
        .map(l => (l.productId === productId && l.variant === variant ? { ...l, qty: l.qty - 1 } : l))
        .filter(l => l.qty > 0);
      return { cart };
    }),
  toggleSave: id =>
    set(s => ({
      savedIds: s.savedIds.includes(id) ? s.savedIds.filter(x => x !== id) : [...s.savedIds, id],
    })),
}));

export const cartCount = (s: OurSkyState) => s.cart.reduce((n, l) => n + l.qty, 0);
