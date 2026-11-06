'use client';

import { useOurSky, type Tab, cartCount } from './store';

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'friends', label: 'Friends' },
  { key: 'void', label: 'Void' },
  { key: 'shop', label: 'Shop' },
  { key: 'you', label: 'You' },
];

export function BottomNav() {
  const tab = useOurSky(s => s.tab);
  const goTab = useOurSky(s => s.goTab);
  const count = useOurSky(cartCount);

  return (
    <nav
      aria-label="Primary"
      className="absolute bottom-0 left-0 right-0 z-20 flex h-[58px] items-stretch border-t border-[#1c1c1c] bg-[#050505]"
    >
      {TABS.map(t => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => goTab(t.key)}
            aria-current={active ? 'page' : undefined}
            className={`label-mono relative flex-1 pb-2 pt-1 transition-colors ${
              active ? 'text-foreground' : 'text-[#5f5f5f] hover:text-[#9a9a9a]'
            }`}
          >
            <span className="relative">
              {t.label}
              {t.key === 'shop' && count > 0 && (
                <span className="absolute -right-2.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#e23636]" />
              )}
            </span>
            {active && <span className="absolute inset-x-4 bottom-3 h-px bg-foreground" />}
          </button>
        );
      })}
    </nav>
  );
}
