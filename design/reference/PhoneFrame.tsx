'use client';

import { BottomNav } from './BottomNav';

/**
 * PhoneFrame — device chrome for desktop review. On mobile viewports the
 * frame disappears and the app fills the screen (see Showcase in page.tsx).
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[780px] w-[390px]">
      {/* titanium edge */}
      <div className="absolute inset-0 rounded-[54px] border border-[#3a3a3a] bg-[#0c0c0c] shadow-[0_0_0_2px_#1a1a1a,0_40px_120px_-20px_rgba(0,0,0,0.9)]" />
      {/* screen */}
      <div className="grain absolute inset-[10px] overflow-hidden rounded-[44px] bg-[#050505]">
        {/* status bar */}
        <div className="relative z-30 flex h-[52px] items-end justify-between px-8 pb-1.5 text-foreground">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[15px] font-medium tracking-tight">11:51</span>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M21.7 13.6a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0 10 10 0 0 0-14.2 0 1 1 0 0 1-1.4 0l-1.4-1.4a1 1 0 0 1 0-1.4 14 14 0 0 1 19.8 0ZM18.5 16.8a1 1 0 0 1 0 1.4L17 19.7a1 1 0 0 1-1.4 0 6 6 0 0 0-8.5 0 1 1 0 0 1-1.4 0l-1.5-1.5a1 1 0 0 1 0-1.4 10 10 0 0 1 14.3 0Z" />
              <circle cx="12" cy="21" r="1.6" />
            </svg>
          </div>
          {/* dynamic island */}
          <div className="absolute left-1/2 top-2.5 h-[26px] w-[112px] -translate-x-1/2 rounded-full bg-black" />
          <div className="flex items-center gap-1.5">
            {/* cellular */}
            <svg viewBox="0 0 18 12" className="h-3 w-4" fill="currentColor" aria-hidden>
              <rect x="0" y="8" width="3" height="4" rx="0.5" />
              <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.5" />
              <rect x="9" y="3" width="3" height="9" rx="0.5" />
              <rect x="13.5" y="0.5" width="3" height="11.5" rx="0.5" opacity="0.35" />
            </svg>
            {/* wifi */}
            <svg viewBox="0 0 16 12" className="h-3 w-3.5" fill="currentColor" aria-hidden>
              <path d="M8 9.6a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Zm-3.2-2.9a4.9 4.9 0 0 1 6.4 0l-1.3 1.4a3 3 0 0 0-3.8 0L4.8 6.7ZM2 4a9 9 0 0 1 12 0l-1.3 1.3a7.2 7.2 0 0 0-9.4 0L2 4Z" />
            </svg>
            {/* battery */}
            <svg viewBox="0 0 27 13" className="h-3.5 w-6" aria-hidden>
              <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4" />
              <rect x="2" y="2" width="12" height="9" rx="2" fill="currentColor" />
              <path d="M24.5 4.5v4a2.2 2.2 0 0 0 0-4Z" fill="currentColor" opacity="0.4" />
            </svg>
          </div>
        </div>

        {/* app viewport */}
        <div className="relative h-[calc(100%-52px-58px)] overflow-y-auto overflow-x-hidden no-scrollbar">
          {children}
        </div>

        {/* bottom nav */}
        <BottomNav />

        {/* home indicator */}
        <div className="absolute bottom-1.5 left-1/2 z-30 h-[4px] w-[120px] -translate-x-1/2 rounded-full bg-[#3a3a3a]" />
      </div>
    </div>
  );
}
