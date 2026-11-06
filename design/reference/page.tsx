'use client';

import { BottomNav } from '@/components/our-sky/BottomNav';
import { PhoneFrame } from '@/components/our-sky/PhoneFrame';
import { Starfield } from '@/components/our-sky/Starfield';
import { Onboarding } from '@/components/our-sky/screens/Onboarding';
import { HomeScreen } from '@/components/our-sky/screens/HomeScreen';
import { FriendsScreen } from '@/components/our-sky/screens/FriendsScreen';
import { VoidScreen } from '@/components/our-sky/screens/VoidScreen';
import { ShopScreen } from '@/components/our-sky/screens/ShopScreen';
import { YouScreen } from '@/components/our-sky/screens/YouScreen';
import { useOurSky, type Tab } from '@/components/our-sky/store';

const SCREENS: { label: string; jump: () => void; active: (s: ReturnType<typeof useOurSky.getState>) => boolean }[] = [
  { label: 'Onboarding', jump: () => useOurSky.setState({ mode: 'onboarding' }), active: s => s.mode === 'onboarding' },
  { label: 'Home · today', jump: () => useOurSky.setState({ mode: 'app', tab: 'home' }), active: s => s.mode === 'app' && s.tab === 'home' },
  { label: 'Friends', jump: () => useOurSky.setState({ mode: 'app', tab: 'friends', friendDetail: null }), active: s => s.mode === 'app' && s.tab === 'friends' && !s.friendDetail },
  { label: 'Friend detail', jump: () => useOurSky.setState({ mode: 'app', tab: 'friends', friendDetail: 'mara' }), active: s => s.mode === 'app' && s.tab === 'friends' && s.friendDetail === 'mara' && !s.relationshipFriend },
  { label: 'Relationship', jump: () => useOurSky.setState({ mode: 'app', tab: 'friends', friendDetail: 'mara', relationshipFriend: 'mara' }), active: s => !!s.relationshipFriend },
  { label: 'The Void', jump: () => useOurSky.setState({ mode: 'app', tab: 'void' }), active: s => s.mode === 'app' && s.tab === 'void' },
  { label: 'Shop', jump: () => useOurSky.setState({ mode: 'app', tab: 'shop' }), active: s => s.mode === 'app' && s.tab === 'shop' },
  { label: 'You · chart', jump: () => useOurSky.setState({ mode: 'app', tab: 'you', youSub: 'chart' }), active: s => s.mode === 'app' && s.tab === 'you' && s.youSub === 'chart' },
  { label: 'You · saved', jump: () => useOurSky.setState({ mode: 'app', tab: 'you', youSub: 'saved' }), active: s => s.mode === 'app' && s.tab === 'you' && s.youSub === 'saved' },
  { label: 'You · settings', jump: () => useOurSky.setState({ mode: 'app', tab: 'you', youSub: 'settings' }), active: s => s.mode === 'app' && s.tab === 'you' && s.youSub === 'settings' },
];

function AppScreen() {
  const mode = useOurSky(s => s.mode);
  const tab = useOurSky(s => s.tab);
  if (mode === 'onboarding') return <Onboarding />;
  return (
    <>
      {tab === 'home' && <HomeScreen />}
      {tab === 'friends' && <FriendsScreen />}
      {tab === 'void' && <VoidScreen />}
      {tab === 'shop' && <ShopScreen />}
      {tab === 'you' && <YouScreen />}
    </>
  );
}

export default function Page() {
  // subscribe so the rail's active state re-renders on navigation
  useOurSky(s => s.mode);
  useOurSky(s => s.tab);
  useOurSky(s => s.friendDetail);
  useOurSky(s => s.relationshipFriend);
  useOurSky(s => s.youSub);
  return (
    <main className="min-h-dvh bg-[#050505] text-foreground">
      {/* ---------- desktop: review shell ---------- */}
      <div className="relative hidden min-h-dvh items-center justify-center gap-20 px-12 py-10 md:flex">
        <Starfield density={55} className="opacity-50" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(242,242,240,0.045)_0%,transparent_60%)]"
        />

        {/* index rail */}
        <aside className="relative z-10 w-[250px] shrink-0">
          <h1 className="title-serif text-[34px] leading-none">our-sky</h1>
          <p className="label-mono-sm mt-3 text-[#5f5f5f]">M0 MOCKUPS · DEMO DATA</p>

          <nav aria-label="Screens" className="mt-10 space-y-0.5">
            {SCREENS.map(s => {
              const isActive = s.active(useOurSky.getState());
              return (
                <button
                  key={s.label}
                  onClick={s.jump}
                  aria-current={isActive ? 'true' : undefined}
                  className={`label-mono block w-full px-2 py-2 text-left transition-colors ${
                    isActive
                      ? 'bg-[#141414] text-foreground'
                      : 'text-[#5f5f5f] hover:bg-[#0d0d0d] hover:text-[#b0b0ad]'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-12 border-t border-[#1c1c1c] pt-5">
            <p className="label-mono-sm text-[#5f5f5f]">DOCS</p>
            <div className="mt-2 flex flex-col items-start gap-1.5">
              <a href="/docs/product-spec.md" className="label-mono-sm text-[#8a8a8a] underline underline-offset-4 hover:text-foreground">
                Product spec
              </a>
              <a href="/docs/tech-spec.md" className="label-mono-sm text-[#8a8a8a] underline underline-offset-4 hover:text-foreground">
                Tech spec
              </a>
            </div>
            <p className="mt-6 max-w-[230px] text-[11.5px] leading-relaxed text-[#4a4a4a]">
              Everything in the phone is interactive: cast the chart, echo into the Void, fill the
              cart. The bottom nav works. Asterisk-free asterisk: all data is demo data.
            </p>
          </div>
        </aside>

        {/* device */}
        <div className="relative z-10">
          <PhoneFrame>
            <AppScreen />
          </PhoneFrame>
        </div>
      </div>

      {/* ---------- mobile: fullscreen app ---------- */}
      <div className="md:hidden">
        <div className="grain relative flex h-dvh flex-col overflow-hidden bg-[#050505]">
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
            <AppScreen />
          </div>
          <BottomNav />
        </div>
      </div>
    </main>
  );
}

/* keep Tab import referenced for future typed jumps */
export type { Tab };
