'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOurSky } from '../store';
import { Starfield } from '../Starfield';
import { VOID_RULES } from '@/lib/our-sky/data';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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

const TAG_SUGGESTIONS = ['mercury', 'venus', 'mars', 'saturn', 'none'];

export function VoidScreen() {
  const posts = useOurSky(s => s.voidPosts);
  const rulesSeen = useOurSky(s => s.voidRulesSeen);
  const dismissRules = useOurSky(s => s.dismissRules);
  const echoPost = useOurSky(s => s.echoPost);
  const takeBack = useOurSky(s => s.takeBack);
  const dimPost = useOurSky(s => s.dimPost);
  const releasePost = useOurSky(s => s.releasePost);
  const [draft, setDraft] = useState('');
  const [tag, setTag] = useState<string>('none');
  const [composerOpen, setComposerOpen] = useState(false);

  const decay = (ageH: number) => (ageH < 8 ? 1 : ageH < 24 ? 0.66 : ageH < 40 ? 0.42 : 0.28);

  const release = () => {
    const body = draft.trim();
    if (!body) return;
    releasePost(body, tag === 'none' ? undefined : tag);
    setDraft('');
    setTag('none');
    setComposerOpen(false);
    toast('Released into the void.');
  };

  return (
    <div className="relative min-h-full bg-[#050505]">
      <Starfield density={80} />

      <div className="relative z-10 pb-24">
        <header className="px-6 pb-2 pt-7">
          <h1 className="title-serif text-[30px]">The Void</h1>
          <p className="mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-[#8a8a8a]">
            No names. No likes. Nothing lasts. Say it anyway.
          </p>
        </header>

        {/* rules */}
        <AnimatePresence>
          {!rulesSeen && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-5 mt-5 border border-[#3a3a3a] bg-[#0a0a0a]/90 px-5 py-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="label-mono text-[#8a8a8a]">The rules</h2>
                <button
                  onClick={dismissRules}
                  className="label-mono-sm text-[#5f5f5f] hover:text-foreground"
                  aria-label="Dismiss rules"
                >
                  ✕
                </button>
              </div>
              <ul className="mt-4 space-y-2.5">
                {VOID_RULES.map(r => (
                  <li key={r} className="label-mono-sm text-[#b0b0ad]">{r}</li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] leading-relaxed text-[#5f5f5f]">
                Echoes are anonymous resonance. You will never see who. You will never see how many.
              </p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* feed */}
        <section className="mt-7 space-y-8 px-6">
          {posts.map(p => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: decay(p.ageH) }}
              transition={{ duration: 0.5 }}
              className={`group relative ${p.mine ? 'border border-[#242424] px-4 py-3' : ''}`}
            >
              <p className="text-[15px] leading-[1.7] text-[#e6e6e3]">{p.body}</p>
              <div className="mt-2.5 flex items-center gap-4">
                {p.ageH >= 36 && (
                  <span className="label-mono-sm text-[#4a4a4a]">FADING</span>
                )}
                {p.astroTag && (
                  <span className="label-mono-sm text-[#4a4a4a]">◈ {p.astroTag.toUpperCase()}</span>
                )}
                <span className="flex-1" />
                <button
                  onClick={() => {
                    echoPost(p.id);
                    if (!p.echoed) toast('It echoed with someone.');
                  }}
                  className={`label-mono-sm transition-opacity ${
                    p.echoed ? 'text-foreground opacity-100' : 'text-[#5f5f5f] opacity-0 group-hover:opacity-100 hover:!opacity-100'
                  }`}
                  aria-label={p.echoed ? 'Echoed' : 'Echo this post'}
                >
                  {p.echoed ? 'ECHOED ◉' : 'ECHO ○'}
                </button>
                {p.mine ? (
                  <button
                    onClick={() => { takeBack(p.id); toast('Taken back into you.'); }}
                    className="label-mono-sm text-[#5f5f5f] opacity-0 transition-opacity group-hover:opacity-100 hover:!opacity-100"
                  >
                    TAKE IT BACK
                  </button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="label-mono-sm text-[#5f5f5f] opacity-0 transition-opacity group-hover:opacity-100 hover:!opacity-100"
                        aria-label="Report post"
                      >
                        ⋯
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-border bg-[#0a0a0a] sm:max-w-[320px]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="title-serif text-left text-[21px]">
                          Report to the void?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left text-[13px] leading-relaxed text-[#9a9a9a]">
                          It will dim for you immediately and for everyone if the void agrees. No one
                          will know it was you. No one ever knows it was you.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-none border-border bg-transparent font-mono text-[12px] uppercase tracking-widest hover:bg-[#141414] hover:text-foreground">
                          Never mind
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => { dimPost(p.id); toast('Reported. The void will look at it.'); }}
                          className="rounded-none bg-foreground font-mono text-[12px] uppercase tracking-widest text-background hover:bg-[#d6d6d3]"
                        >
                          Report
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </motion.article>
          ))}
        </section>

        <p className="label-mono-sm mt-12 px-6 text-center text-[#3f3f3f]">
          OLDER POSTS HAVE BECOME PART OF THE SKY ↑
        </p>
      </div>

      {/* composer dock */}
      <div className="absolute inset-x-0 bottom-16 z-20 px-5 pb-3">
        <Drawer open={composerOpen} onOpenChange={setComposerOpen}>
          <DrawerTrigger asChild>
            <button className="label-mono flex w-full items-center justify-center gap-2 border border-[#3a3a3a] bg-[#0a0a0a]/95 py-3.5 text-[#b0b0ad] backdrop-blur transition-colors hover:border-[#5a5a5a] hover:text-foreground">
              SPEAK INTO THE VOID
            </button>
          </DrawerTrigger>
          <DrawerContent className="border-border bg-[#0a0a0a]">
            <div className="mx-auto w-full max-w-[400px] px-5 pb-8">
              <DrawerHeader className="p-0 pb-3 text-left">
                <DrawerTitle className="title-serif text-[24px]">What&apos;s in your orbit tonight?</DrawerTitle>
              </DrawerHeader>
              <Textarea
                value={draft}
                onChange={e => setDraft(e.target.value.slice(0, 500))}
                placeholder="Nobody will know it was you. Not even us."
                className="min-h-[110px] resize-none rounded-none border-border bg-transparent text-[15px] leading-relaxed placeholder:text-[#4a4a4a] focus-visible:ring-foreground"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="label-mono-sm text-[#5f5f5f]">{draft.length}/500</span>
                <span className="label-mono-sm text-[#5f5f5f]">FADES IN 48H</span>
              </div>
              <p className="label-mono-sm mt-4 text-[#8a8a8a]">TAG IT (OPTIONAL · SUGGESTED BY THE SKY)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TAG_SUGGESTIONS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTag(t)}
                    className={`label-mono-sm border px-3 py-1.5 transition-colors ${
                      tag === t
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-[#2a2a2a] text-[#8a8a8a] hover:border-[#4a4a4a] hover:text-foreground'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button
                onClick={release}
                disabled={!draft.trim()}
                className="label-mono mt-5 h-12 w-full rounded-none bg-foreground text-[12px] text-background hover:bg-[#d6d6d3] disabled:bg-transparent disabled:text-[#4a4a4a]"
              >
                Release
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
