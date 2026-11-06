'use client';

import { useState } from 'react';
import { READINGS, USER, SAVED_ITEMS, ASC, MC, SIGN_GLYPH, SIGN_ORDER } from '@/lib/our-sky/data';
import { useOurSky, type YouSub } from '../store';
import { ArtFigure } from '../ArtFigure';
import { ReadingCard } from '../ReadingCard';
import { ChartWheel } from '../ChartWheel';
import { toast } from 'sonner';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const SUBTABS: { key: YouSub; label: string }[] = [
  { key: 'chart', label: 'Chart' },
  { key: 'saved', label: 'Saved' },
  { key: 'settings', label: 'Settings' },
];

export function YouScreen() {
  const youSub = useOurSky(s => s.youSub);
  return (
    <div className="relative pb-16">
      <header className="pt-6">
        <h1 className="title-serif text-center text-[26px]">You</h1>
        <div className="mt-4 grid grid-cols-3 border-b border-[#161616]">
          {SUBTABS.map(t => {
            const active = youSub === t.key;
            return (
              <button
                key={t.key}
                onClick={() => useOurSky.getState().setYouSub(t.key)}
                aria-current={active ? 'true' : undefined}
                className={`relative pb-3 text-[15px] transition-colors ${
                  active ? 'text-foreground' : 'text-[#5f5f5f] hover:text-[#9a9a9a]'
                }`}
              >
                {t.label}
                {active && <span className="absolute inset-x-8 bottom-0 h-[2px] bg-foreground" />}
              </button>
            );
          })}
        </div>
      </header>
      <div className="pt-2">
        {youSub === 'chart' && <ChartTab />}
        {youSub === 'saved' && <SavedTab />}
        {youSub === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

/* ---------------- chart ---------------- */

function ChartTab() {
  const friendHook = (handle: string) => toast(`Opening ${handle}'s sky — in the full build.`);

  return (
    <div>
      {/* big three */}
      <section className="px-5 pt-4">
        <div className="card-hairline grid grid-cols-3 divide-x divide-border">
          {(
            [
              ['☉', 'SUN', USER.bigThree.sun],
              ['☾', 'MOON', USER.bigThree.moon],
              ['↑', 'RISING', USER.bigThree.rising],
            ] as const
          ).map(([glyph, label, sign]) => (
            <div key={label} className="px-3 py-4 text-center">
              <p className="font-mono text-[16px]">{glyph}</p>
              <p className="title-serif mt-1 text-[17px]">{sign}</p>
              <p className="label-mono-sm mt-0.5 text-[#5f5f5f]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* wheel */}
      <section className="mt-6 flex flex-col items-center">
        <ChartWheel size={268} showAspects />
        <p className="label-mono-sm mt-3 text-[#5f5f5f]">
          PLACIDUS · TROPICAL · PORTLAND, OR
        </p>
      </section>

      {/* readings with interleaved art */}
      <section className="mt-8 space-y-6 px-5">
        {READINGS.map((r, i) => (
          <div key={r.key} className="space-y-6">
            <ReadingCard reading={r} savedKey={r.key} />
            {r.art && (r.key === 'venus:cancer:house1' || r.key === 'saturn:taurus:house11') && (
              <ArtFigure
                src={r.art}
                alt=""
                className={r.key === 'venus:cancer:house1' ? 'mx-auto -ml-2 w-44' : 'ml-6 w-48'}
              />
            )}
          </div>
        ))}
      </section>

      {/* footer meta */}
      <section className="mt-10 px-6">
        <div className="card-hairline px-5 py-5">
          <p className="label-mono text-[#8a8a8a]">Born</p>
          <p className="mt-1.5 text-[14px] text-[#d6d6d3]">{USER.born}</p>
          <p className="label-mono-sm mt-4 text-[#5f5f5f]">
            ASC {ASC.sign.toUpperCase()} {degMin(ASC.deg)} · MC {MC.sign.toUpperCase()} {degMin(MC.deg)} · 10 PLANETS CAST
          </p>
        </div>
        <p className="label-mono-sm mt-6 text-center text-[#3f3f3f]">
          SIMILARITY LINKS OPEN FRIEND SKIES IN THE FULL BUILD
        </p>
      </section>
    </div>
  );
}

const degMin = (d: number) => `${Math.floor(d)}°${String(Math.round((d % 1) * 60)).padStart(2, '0')}'`;

/* ---------------- saved ---------------- */

function SavedTab() {
  const savedIds = useOurSky(s => s.savedIds);
  const toggleSave = useOurSky(s => s.toggleSave);
  const items = SAVED_ITEMS.filter(i => savedIds.includes(i.id));

  return (
    <div className="px-5 pt-5">
      {items.length === 0 ? (
        <div className="flex flex-col items-center pt-24 text-center">
          <p className="title-serif text-[22px] text-[#8a8a8a]">Nothing kept yet.</p>
          <p className="label-mono-sm mt-3 text-[#5f5f5f]">THE SKY IS PATIENT.</p>
        </div>
      ) : (
        <ul className="card-hairline divide-y divide-border">
          {items.map(i => (
            <li key={i.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[15px] text-foreground">{i.title}</p>
                <p className="label-mono-sm mt-1 text-[#5f5f5f]">{i.meta}</p>
              </div>
              <button
                onClick={() => { toggleSave(i.id); toast('Returned to the sky.'); }}
                className="label-mono-sm text-[#5f5f5f] hover:text-foreground"
                aria-label={`Remove ${i.title} from saved`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="label-mono-sm mt-6 text-center text-[#3f3f3f]">
        KEPT FROM HOME, FRIENDS & SHOP LAND HERE
      </p>
    </div>
  );
}

/* ---------------- settings ---------------- */

function SettingsTab() {
  const replayOnboarding = useOurSky(s => s.replayOnboarding);
  const [prefs, setPrefs] = useState({ daily: true, windows: true, friends: false, echoes: true });

  return (
    <div className="space-y-7 px-5 pt-6">
      {/* birth data */}
      <section>
        <SectionLabel>BIRTH DATA</SectionLabel>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="card-hairline mt-2 flex w-full items-center justify-between px-5 py-4 text-left hover:border-[#4a4a4a]">
              <div>
                <p className="text-[14.5px] text-foreground">{USER.name} · {USER.handle}</p>
                <p className="label-mono-sm mt-1 text-[#5f5f5f]">{USER.born}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#5f5f5f]" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-border bg-[#0a0a0a] sm:max-w-[330px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="title-serif text-left text-[21px]">Recast your chart?</AlertDialogTitle>
              <AlertDialogDescription className="text-left text-[13px] leading-relaxed text-[#9a9a9a]">
                Every reading, similarity, and window re-computes from the new data. This is the
                astrology equivalent of moving countries. Bring snacks.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-none border-border bg-transparent font-mono text-[12px] uppercase tracking-widest hover:bg-[#141414] hover:text-foreground">
                Keep my sky
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => toast('Recasting is an alpha feature.')}
                className="rounded-none bg-foreground font-mono text-[12px] uppercase tracking-widest text-background hover:bg-[#d6d6d3]"
              >
                Recast
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      {/* notifications */}
      <section>
        <SectionLabel>NOTIFICATIONS</SectionLabel>
        <div className="card-hairline mt-2 divide-y divide-border">
          {(
            [
              ['daily', 'The daily sky', 'One push, 07:00, your time zone'],
              ['windows', 'Transit windows', 'When a window opens or closes'],
              ['friends', 'Friend sky', 'When the sky does something to a friend'],
              ['echoes', 'Void echoes', 'When something you released echoes'],
            ] as const
          ).map(([key, label, sub]) => (
            <div key={key} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <p className="text-[14px] text-foreground">{label}</p>
                <p className="mt-0.5 text-[12px] text-[#6a6a6a]">{sub}</p>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))}
                className="data-[state=checked]:bg-foreground data-[state=unchecked]:bg-[#2a2a2a]"
              />
            </div>
          ))}
        </div>
      </section>

      {/* account */}
      <section>
        <SectionLabel>ACCOUNT</SectionLabel>
        <div className="card-hairline mt-2 divide-y divide-border">
          <SettingRow label="Email" value="demo@oursky.app" />
          <SettingRow label="Privacy manifesto" value="No resale. No trackers." />
          <div className="px-5 py-3.5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-[14px] text-[#e23636] hover:underline">Delete account</button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-border bg-[#0a0a0a] sm:max-w-[330px]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="title-serif text-left text-[21px]">
                    Delete your sky?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-left text-[13px] leading-relaxed text-[#9a9a9a]">
                    Your chart, readings, and void posts will be destroyed within 30 days. The void
                    will keep a dot with no memory. We think that&apos;s beautiful, but we&apos;d
                    rather you stayed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-none border-border bg-transparent font-mono text-[12px] uppercase tracking-widest hover:bg-[#141414] hover:text-foreground">
                    Stay
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => toast('Deletion is disabled in the prototype. The sky exhales.')}
                    className="rounded-none bg-[#e23636] font-mono text-[12px] uppercase tracking-widest text-white hover:bg-[#c22c2c]"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>

      {/* appearance */}
      <section>
        <SectionLabel>APPEARANCE</SectionLabel>
        <div className="card-hairline mt-2 divide-y divide-border">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="label-mono-sm text-foreground">VOID BLACK</span>
              <span className="h-3 w-3 border border-[#3a3a3a] bg-[#050505]" />
            </div>
            <Badge variant="outline" className="label-mono-sm rounded-none border-border text-[#8a8a8a]">
              DEFAULT
            </Badge>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="label-mono-sm text-[#5f5f5f]">PAPER</span>
              <span className="h-3 w-3 border border-[#3a3a3a] bg-[#e8e8e5]" />
            </div>
            <span className="label-mono-sm text-[#3f3f3f]">SOON</span>
          </div>
        </div>
      </section>

      {/* about */}
      <section>
        <SectionLabel>ABOUT</SectionLabel>
        <div className="card-hairline mt-2 px-5 py-5">
          <p className="text-[13.5px] leading-[1.7] text-[#9a9a9a]">
            our-sky v0.3 · M0 mockups. Built from the sky when and where you were born — and from
            questionable decisions at 2am. No outcome claims, ever. The stars incline; they do not
            bind.
          </p>
          <button
            onClick={replayOnboarding}
            className="label-mono mt-4 flex items-center gap-2 text-[#8a8a8a] hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> REPLAY ONBOARDING
          </button>
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-mono text-[#8a8a8a]">{children}</p>;
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-[14px] text-foreground">{label}</span>
      <span className="font-mono text-[12.5px] text-[#8a8a8a]">{value}</span>
    </div>
  );
}
