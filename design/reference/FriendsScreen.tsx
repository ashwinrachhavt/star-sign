'use client';

import { useState } from 'react';
import { FRIENDS, SIGN_GLYPH, type Friend } from '@/lib/our-sky/data';
import { useOurSky } from '../store';
import { ChartWheel } from '../ChartWheel';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function FriendsScreen() {
  const friendDetail = useOurSky(s => s.friendDetail);
  const friend = FRIENDS.find(f => f.id === friendDetail) ?? null;
  return friend ? <FriendDetail friend={friend} /> : <FriendsList />;
}

/* ---------------- list ---------------- */

function FriendsList() {
  const openFriend = useOurSky(s => s.openFriend);
  return (
    <div className="relative pb-16">
      <header className="px-6 pb-5 pt-7">
        <h1 className="title-serif text-[30px]">Better together</h1>
        <p className="mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-[#9a9a9a]">
          Keep track of your friends, see what the sky is doing to them, and whether you&apos;re fated to fall in love.
        </p>
      </header>

      <section className="px-5">
        <div className="card-hairline divide-y divide-border">
          {FRIENDS.map(f => (
            <button
              key={f.id}
              onClick={() => openFriend(f.id)}
              className="group flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#0c0c0c]"
            >
              <div>
                <p className="text-[15px] text-foreground">{f.name}</p>
                <p className="label-mono-sm mt-1.5 text-[#8a8a8a]">
                  <span className="mr-1.5">☉</span>{f.bigThree.sun}
                  <span className="mx-1.5 text-[#5f5f5f]">↑</span>{f.bigThree.rising}
                  <span className="mx-1.5 text-[#5f5f5f]">↙</span>{f.bigThree.moon}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="label-mono-sm text-[#5f5f5f]">{f.similarity}%</span>
                <ArrowRight className="h-4 w-4 text-[#5f5f5f] transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </button>
          ))}

          {/* add friend */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="label-mono flex w-full items-center justify-between px-5 py-4 text-[#8a8a8a] transition-colors hover:bg-[#0c0c0c] hover:text-foreground">
                ADD A FRIEND <span className="font-sans text-[16px] leading-none">+</span>
              </button>
            </DialogTrigger>
            <DialogContent className="border-border bg-[#0a0a0a] sm:max-w-[320px]">
              <DialogHeader>
                <DialogTitle className="title-serif text-left text-[22px]">The sky is better shared</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-3">
                <Input placeholder="@handle" className="h-11 rounded-none border-border bg-transparent font-mono text-[14px] focus-visible:ring-foreground" />
                <Button
                  onClick={() => toast('Invite sent. The sky will notify you.')}
                  className="label-mono h-11 w-full rounded-none bg-foreground text-[12px] text-background hover:bg-[#d6d6d3]"
                >
                  Send invite
                </Button>
                <button
                  onClick={() => toast('Link copied. Doom-scroll it to someone.')}
                  className="label-mono-sm block w-full pt-1 text-center text-[#8a8a8a] underline underline-offset-4 hover:text-foreground"
                >
                  OR COPY AN INVITE LINK
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <ArtFragment />
    </div>
  );
}

function ArtFragment() {
  return (
    <div className="mt-10 flex justify-center opacity-80">
      <div className="w-40 -rotate-6">
        <div className="relative aspect-square">
          <img
            src="/art/hand.png"
            alt=""
            aria-hidden
            className="art-drift h-full w-full object-contain mix-blend-lighten opacity-90"
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- friend detail ---------------- */

function FriendDetail({ friend }: { friend: Friend }) {
  const openFriend = useOurSky(s => s.openFriend);
  const setRelationship = useOurSky(s => s.setRelationship);
  const [overlay, setOverlay] = useState<'them' | 'together'>('them');

  return (
    <div className="relative pb-16">
      <header className="flex items-center gap-3 px-5 pb-4 pt-5">
        <button
          onClick={() => openFriend(null)}
          aria-label="Back to friends"
          className="flex h-8 w-8 items-center justify-center border border-border text-[#8a8a8a] hover:border-[#4a4a4a] hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="title-serif text-[24px] leading-none">{friend.name}</h1>
          <p className="label-mono-sm mt-1 text-[#5f5f5f]">{friend.handle}</p>
        </div>
      </header>

      {/* wheel toggle */}
      <section className="px-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex border border-border">
            {(['them', 'together'] as const).map(m => (
              <button
                key={m}
                onClick={() => setOverlay(m)}
                className={`label-mono-sm px-3.5 py-2 transition-colors ${
                  overlay === m ? 'bg-foreground text-background' : 'text-[#8a8a8a] hover:text-foreground'
                }`}
              >
                {m === 'them' ? 'THEIR SKY' : 'TOGETHER'}
              </button>
            ))}
          </div>
          <span className="label-mono-sm text-[#5f5f5f]">PLACIDUS</span>
        </div>
        <div className="relative flex justify-center py-2">
          <ChartWheel size={272} showAspects={overlay === 'them'} dim={overlay === 'together'} />
          {overlay === 'together' && (
            <div className="spin-slow absolute inset-0 flex items-center justify-center">
              <div className="relative h-[272px] w-[272px]">
                <svg viewBox="-105 -105 210 210" className="absolute inset-0 h-full w-full" aria-hidden>
                  {/* synastry chords between the two charts */}
                  <line x1={-58} y1={-40} x2={62} y2={30} stroke="#e23636" strokeOpacity={0.55} strokeWidth={0.8} />
                  <line x1={-30} y1={64} x2={40} y2={-62} stroke="#5a5a5a" strokeWidth={0.7} strokeDasharray="2 2.4" />
                </svg>
              </div>
            </div>
          )}
        </div>
        <p className="label-mono-sm text-center text-[#5f5f5f]">
          {overlay === 'them'
            ? `☉ ${friend.bigThree.sun.toUpperCase()} · ☾ ${friend.bigThree.moon.toUpperCase()} · ↑ ${friend.bigThree.rising.toUpperCase()}`
            : 'YOUR WHEELS OVERLAID · RED = TIGHTEST ASPECT'}
        </p>
      </section>

      {/* similarity panel */}
      <section className="mt-7 px-5">
        <div className="card-hairline px-5 py-6">
          <div className="flex items-baseline justify-between">
            <h3 className="label-mono text-[#8a8a8a]">Sky shared</h3>
            <span className="title-serif text-[26px]">{friend.similarity}%</span>
          </div>
          <div className="mt-3 h-px w-full bg-[#1c1c1c]">
            <div className="h-px bg-foreground" style={{ width: `${friend.similarity}%` }} />
          </div>
          <ul className="mt-5 space-y-2.5">
            {friend.shared.map(s => (
              <li key={s} className="flex items-center justify-between text-[14px] text-[#d6d6d3]">
                <span>{s}</span>
                <span className="font-mono text-[13px] text-[#5f5f5f]">shared</span>
              </li>
            ))}
          </ul>
          <p className="label-mono-sm mt-5 border-t border-border pt-4 text-[#8a8a8a]">
            TIGHTEST ASPECT · {friend.topAspect}
          </p>
        </div>
      </section>

      {/* today line */}
      <section className="mt-4 px-5">
        <div className="card-hairline px-5 py-4">
          <p className="label-mono-sm text-[#5f5f5f]">THEIR TODAY</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#d6d6d3]">{friend.line}</p>
        </div>
      </section>

      {/* relationship analysis */}
      <section className="mt-4 px-5">
        <button
          onClick={() => setRelationship(friend.id)}
          className="card-hairline flex w-full items-center justify-between px-5 py-5 text-left transition-colors hover:border-[#4a4a4a]"
        >
          <span className="label-mono flex items-center gap-2">
            <span className="text-[#e23636]">❤</span> YOUR RELATIONSHIP ANALYSIS
          </span>
          <ArrowRight className="h-4 w-4 text-[#8a8a8a]" />
        </button>
      </section>

      <RelationshipSheet friend={friend} />
    </div>
  );
}

/* ---------------- relationship analysis sheet ---------------- */

function RelationshipSheet({ friend }: { friend: Friend }) {
  const relationshipFriend = useOurSky(s => s.relationshipFriend);
  const setRelationship = useOurSky(s => s.setRelationship);
  const [unlocked, setUnlocked] = useState(false);

  return (
    <Sheet open={relationshipFriend === friend.id} onOpenChange={o => !o && setRelationship(null)}>
      <SheetContent
        side="bottom"
        className="grain h-[88vh] overflow-y-auto rounded-t-none border-border bg-[#050505] p-0 thin-scrollbar"
      >
        <div className="mx-auto max-w-[420px] px-6 pb-10">
          <SheetHeader className="p-0 pb-4 pt-6 text-left">
            <SheetTitle className="title-serif text-[28px] leading-tight">
              You & {friend.name.split(' ')[0]}
            </SheetTitle>
            <p className="label-mono-sm mt-1 text-[#5f5f5f]">SYNASTRY · PLACIDUS · TROPICAL</p>
          </SheetHeader>

          <div className="space-y-6">
            {friend.analysis.map((section, i) => {
              const locked = i > 0 && !unlocked;
              return (
                <section key={section.heading} className="relative">
                  <h3 className="title-serif text-[23px]">{section.heading}</h3>
                  <div className={`mt-3 space-y-4 ${locked ? 'select-none' : ''}`}>
                    {section.paras.map((p, j) => (
                      <p key={j} className={`text-[14.5px] leading-[1.7] text-[#d6d6d3] ${locked ? 'blur-[5px]' : ''}`}>
                        {p}
                      </p>
                    ))}
                  </div>
                  {section.receipts && !locked && (
                    <p className="label-mono-sm mt-3 text-[#5f5f5f]">◈ {section.receipts}</p>
                  )}
                  {locked && (
                    <div className="absolute inset-x-0 bottom-0 flex justify-center pt-6">
                      <button
                        onClick={() => { setUnlocked(true); toast('our-sky+ · the rest is yours.'); }}
                        className="label-mono flex items-center gap-2 border border-foreground bg-foreground px-4 py-2.5 text-[11px] text-background hover:bg-[#d6d6d3]"
                      >
                        <Lock className="h-3 w-3" /> UNLOCK WITH OUR-SKY+
                      </button>
                    </div>
                  )}
                  {locked && <div className="h-10" />}
                </section>
              );
            })}
          </div>

          <div className="mt-8 border-t border-border pt-5">
            <Badge variant="outline" className="label-mono-sm rounded-none border-border text-[#8a8a8a]">
              SECTION 1 IS ALWAYS FREE
            </Badge>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#6a6a6a]">
              Synastry is computed between both charts, not averaged. Nobody is compatible; some
              configurations are simply more interesting than others.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
