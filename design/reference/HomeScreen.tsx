'use client';

import { motion } from 'framer-motion';
import { DAY, TRANSITS, FRIENDS } from '@/lib/our-sky/data';
import { ArtFigure } from '../ArtFigure';
import { OrbitMini } from '../OrbitMini';
import { useOurSky } from '../store';
import { toast } from 'sonner';
import { Bookmark } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function HomeScreen() {
  const goTab = useOurSky(s => s.goTab);
  const openFriend = useOurSky(s => s.openFriend);
  const savedIds = useOurSky(s => s.savedIds);
  const toggleSave = useOurSky(s => s.toggleSave);

  return (
    <div className="relative pb-16">
      {/* day header */}
      <header className="px-6 pb-5 pt-7">
        <h1 className="label-mono text-[#8a8a8a]">{DAY.dateLabel}</h1>
        <p className="mt-2 flex items-center gap-2 text-[13px] text-[#b0b0ad]">
          <span className="font-mono">☾</span> {DAY.moonLine}
        </p>
      </header>

      {/* day sketch */}
      <section className="px-5">
        <article className="card-hairline px-5 py-6">
          <h2 className="title-serif text-[25px] leading-tight">{DAY.sketchTitle}</h2>
          <div className="mt-3 space-y-4">
            {DAY.sketchParas.map((p, i) => (
              <p key={i} className="text-[15px] leading-[1.65] text-[#d6d6d3]">{p}</p>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="label-mono-sm text-[#5a5a5a]">YOUR DAY · COMPUTED 07:00</span>
            <button
              aria-label="Save day sketch"
              onClick={() => {
                toggleSave('day-sketch');
                toast(savedIds.includes('day-sketch') ? 'Returned to the sky.' : 'Kept. The sky is patient.');
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Bookmark className={`h-3.5 w-3.5 ${savedIds.includes('day-sketch') ? 'fill-foreground text-foreground' : ''}`} />
            </button>
          </div>
        </article>
      </section>

      {/* retrograde */}
      <section className="mt-6 px-5">
        <Accordion type="single" collapsible className="card-hairline border-border">
          <AccordionItem value="retro" className="border-border">
            <AccordionTrigger className="label-mono px-5 py-4 text-[#b0b0ad] hover:no-underline [&[data-state=open]>svg]:text-foreground">
              <span>
                {DAY.retrograde.label} <span className="text-[#5f5f5f]">· {DAY.retrograde.until}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <p className="text-[14px] leading-[1.65] text-[#d6d6d3]">{DAY.retrograde.body}</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* earth fragment */}
      <ArtFigure src="earth" alt="" className="mx-auto mt-8 w-44 opacity-80" />

      {/* transit windows */}
      <section className="mt-8 px-5">
        <h3 className="label-mono px-1 text-[#8a8a8a]">Transit windows</h3>
        <div className="mt-3 space-y-4">
          {TRANSITS.map((t, idx) => (
            <motion.article
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: idx * 0.05 }}
              className="card-hairline flex gap-4 px-5 py-5"
            >
              <div className="min-w-0 flex-1">
                <p className="label-mono-sm text-[#8a8a8a]">{t.range}</p>
                <h4 className="title-serif mt-1.5 text-[22px] leading-tight">{t.title}</h4>
                <p className="mt-2.5 text-[14px] leading-[1.65] text-[#b8b8b5]">{t.paras[0]}</p>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => {
                      toggleSave(t.id);
                      toast(savedIds.includes(t.id) ? 'Returned to the sky.' : 'Kept. The sky is patient.');
                    }}
                    className={`label-mono-sm underline-offset-4 hover:underline ${savedIds.includes(t.id) ? 'text-foreground' : 'text-[#8a8a8a]'}`}
                  >
                    {savedIds.includes(t.id) ? 'SAVED ✓' : 'KEEP THIS'}
                  </button>
                </div>
              </div>
              <OrbitMini transiting={t.orbit.transiting} natal={t.orbit.natal} type={t.orbit.type} size={86} />
            </motion.article>
          ))}
        </div>
      </section>

      {/* friend sky strip */}
      <section className="mt-9 pb-2">
        <div className="flex items-baseline justify-between px-6">
          <h3 className="label-mono text-[#8a8a8a]">Friend sky</h3>
          <button onClick={() => goTab('friends')} className="label-mono-sm text-[#5f5f5f] hover:text-foreground">
            ALL →
          </button>
        </div>
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-2">
          {FRIENDS.slice(0, 4).map(f => (
            <button
              key={f.id}
              onClick={() => { openFriend(f.id); goTab('friends'); }}
              className="card-hairline w-[228px] shrink-0 px-4 py-4 text-left transition-colors hover:border-[#4a4a4a]"
            >
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 rounded-full border border-border bg-[#111]">
                  <AvatarFallback className="rounded-full font-mono text-[11px] text-[#b0b0ad]">
                    {f.name.split(' ').map(w => w[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] text-foreground">{f.name}</p>
                  <p className="label-mono-sm text-[#5f5f5f]">{f.similarity}% SHARED</p>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#9a9a9a]">{f.line}</p>
            </button>
          ))}
        </div>
      </section>

      <p className="label-mono-sm px-6 pb-6 pt-2 text-center text-[#3f3f3f]">
        THE SKY RESUMES TOMORROW AT 07:00
      </p>
    </div>
  );
}
