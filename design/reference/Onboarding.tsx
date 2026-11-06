'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOurSky } from '../store';
import { ChartWheel } from '../ChartWheel';
import { ArtFigure } from '../ArtFigure';
import { USER } from '@/lib/our-sky/data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const CITIES = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'London, UK',
  'Berlin, DE', 'Paris, FR', 'Tokyo, JP', 'Seoul, KR', 'São Paulo, BR', 'Mexico City, MX',
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function Onboarding() {
  const { obName, obDate, obTime, obPlace, setOb, finishOnboarding } = useOurSky();
  const [step, setStep] = useState(0);

  const [mm, dd, yy] = (obDate || '//').split('/');

  const next = () => setStep(s => Math.min(s + 1, 5));

  return (
    <div className="relative min-h-full bg-[#050505]">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.section
            key="w"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex min-h-full flex-col items-center justify-center px-8 text-center"
          >
            <ArtFigure src="moon" alt="" className="mx-auto w-36" />
            <h1 className="title-serif mt-8 text-[40px] leading-none">our-sky</h1>
            <p className="mt-4 max-w-[270px] text-[14px] leading-relaxed text-[#9a9a9a]">
              A complete picture of the sky when and where you were born — and who you share it with.
            </p>
            <Button
              onClick={next}
              className="label-mono mt-10 h-12 w-full max-w-[280px] rounded-none border border-foreground bg-foreground text-[13px] text-background hover:bg-[#d6d6d3]"
            >
              Cast your chart
            </Button>
            <p className="label-mono-sm mt-4 text-[#5a5a5a]">TAKES 90 SECONDS · NO EMAIL REQUIRED</p>
          </motion.section>
        )}

        {step === 1 && (
          <motion.section key="n" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="px-8 pt-10">
            <StepHeader n="01" title="What do we call you?" />
            <MonoLabel>NAME</MonoLabel>
            <Input
              value={obName}
              onChange={e => setOb({ obName: e.target.value })}
              placeholder="Nova"
              className="mt-2 h-12 rounded-none border-border bg-transparent font-mono text-[15px] placeholder:text-[#4a4a4a] focus-visible:ring-foreground"
            />
            <MonoLabel className="mt-6">HANDLE (AUTO-SUGGESTED)</MonoLabel>
            <div className="mt-2 border border-border px-4 py-3 font-mono text-[14px] text-[#d6d6d3]">
              @{(obName || 'iris').toLowerCase().replace(/[^a-z]/g, '')}33
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#6a6a6a]">
              Your handle is how friends find you. Readings are private by default — similarity is the only thing we share.
            </p>
            <StepNav onNext={next} nextLabel="Continue" disabled={!obName.trim()} />
          </motion.section>
        )}

        {step === 2 && (
          <motion.section key="d" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="px-8 pt-10">
            <StepHeader n="02" title="When did the sky make you?" />
            <MonoLabel>BIRTH DATE</MonoLabel>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <NumInput placeholder="MM" value={mm} maxLen={2} onChange={v => setOb({ obDate: `${v}/${dd ?? ''}/${yy ?? ''}` })} />
              <NumInput placeholder="DD" value={dd} maxLen={2} onChange={v => setOb({ obDate: `${mm ?? ''}/${v}/${yy ?? ''}` })} />
              <NumInput placeholder="YYYY" value={yy} maxLen={4} onChange={v => setOb({ obDate: `${mm ?? ''}/${dd ?? ''}/${v}` })} />
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#6a6a6a]">
              The sun was in Scorpio on the day we have in mind for you. Everything else follows from this.
            </p>
            <StepNav onNext={next} nextLabel="Continue" disabled={!(mm && dd && yy)} />
          </motion.section>
        )}

        {step === 3 && (
          <motion.section key="t" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="px-8 pt-10">
            <StepHeader n="03" title="What time did you arrive?" />
            <MonoLabel>BIRTH TIME (24H)</MonoLabel>
            <Input
              value={obTime}
              onChange={e => setOb({ obTime: e.target.value })}
              placeholder="06:12"
              inputMode="numeric"
              className="mt-2 h-12 rounded-none border-border bg-transparent font-mono text-[15px] placeholder:text-[#4a4a4a] focus-visible:ring-foreground"
            />
            <Dialog>
              <DialogTrigger asChild>
                <button className="label-mono mt-6 text-[#8a8a8a] underline underline-offset-4 hover:text-foreground">
                  I DON&apos;T KNOW MY BIRTH TIME
                </button>
              </DialogTrigger>
              <DialogContent className="border-border bg-[#0a0a0a] sm:max-w-[320px]">
                <DialogHeader>
                  <DialogTitle className="title-serif text-left text-[22px]">That&apos;s fine. Honestly.</DialogTitle>
                  <DialogDescription asChild>
                    <div className="space-y-3 pt-2 text-left text-[13.5px] leading-relaxed text-[#9a9a9a]">
                      <p>
                        We&apos;ll cast your chart for noon and mark houses and rising as approximate.
                        Your planets in signs stay exact — only the house math needs minutes.
                      </p>
                      <p>You can update it later in Settings when you interrogate your mother.</p>
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
            <StepNav onNext={next} nextLabel="Continue" />
          </motion.section>
        )}

        {step === 4 && (
          <motion.section key="p" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="px-8 pt-10">
            <StepHeader n="04" title="Where were you born?" />
            <MonoLabel>BIRTH PLACE</MonoLabel>
            <div className="mt-2 max-h-[240px] overflow-y-auto border border-border thin-scrollbar">
              {CITIES.map(c => (
                <button
                  key={c}
                  onClick={() => setOb({ obPlace: c })}
                  className={`block w-full px-4 py-3 text-left font-mono text-[13.5px] transition-colors ${
                    obPlace === c ? 'bg-[#161616] text-foreground' : 'text-[#9a9a9a] hover:bg-[#101010]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#6a6a6a]">
              We store the city and its coordinates. Nothing else, no trackers, no resale. Your birth data is not our business model.
            </p>
            <StepNav onNext={next} nextLabel="Cast my chart" disabled={!obPlace} />
          </motion.section>
        )}

        {step === 5 && (
          <motion.section
            key="r"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex min-h-full flex-col items-center justify-center px-8 text-center"
          >
            <ChartWheel size={252} animate showAspects />
            <motion.h2
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
              className="title-serif mt-6 text-[27px] leading-snug"
            >
              {obName || USER.name}, you are a
              <br />
              Scorpio sun, Aries moon,
              <br />
              Cancer rising.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
              className="mt-4 max-w-[280px] text-[13.5px] leading-relaxed text-[#9a9a9a]"
            >
              You have a fundamental urge to get to the bottom of things, you feel in bursts, and the
              armor is visible. Ten readings, three windows, one Void. Let&apos;s go.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="w-full max-w-[280px]">
              <Button
                onClick={finishOnboarding}
                className="label-mono mt-8 h-12 w-full rounded-none border border-foreground bg-foreground text-[13px] text-background hover:bg-[#d6d6d3]"
              >
                Read your chart
              </Button>
              <p className="label-mono-sm mt-4 text-[#5a5a5a]">PLACIDUS · {obPlace || 'PORTLAND'}</p>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* month reference strip (flavor) */}
      {step > 0 && step < 5 && (
        <div className="absolute inset-x-0 bottom-24 overflow-hidden opacity-40">
          <div className="label-mono-sm flex gap-6 px-8 text-[#3f3f3f]">
            {MONTHS.map(m => <span key={m}>{m}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

function StepHeader({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="label-mono text-[#5f5f5f]">{n} / 04</p>
      <h2 className="title-serif mt-3 text-[28px] leading-tight">{title}</h2>
    </div>
  );
}

function MonoLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`label-mono-sm text-[#8a8a8a] ${className}`}>{children}</p>;
}

function NumInput({
  value, onChange, placeholder, maxLen,
}: { value: string; onChange: (v: string) => void; placeholder: string; maxLen: number }) {
  return (
    <Input
      value={value ?? ''}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, maxLen))}
      placeholder={placeholder}
      inputMode="numeric"
      className="h-12 rounded-none border-border bg-transparent text-center font-mono text-[15px] placeholder:text-[#4a4a4a] focus-visible:ring-foreground"
    />
  );
}

function StepNav({ onNext, nextLabel, disabled }: { onNext: () => void; nextLabel: string; disabled?: boolean }) {
  return (
    <div className="mt-10">
      <Button
        onClick={onNext}
        disabled={disabled}
        className="label-mono h-12 w-full rounded-none border border-foreground bg-foreground text-[13px] text-background hover:bg-[#d6d6d3] disabled:border-[#2a2a2a] disabled:bg-transparent disabled:text-[#4a4a4a]"
      >
        {nextLabel}
      </Button>
    </div>
  );
}
