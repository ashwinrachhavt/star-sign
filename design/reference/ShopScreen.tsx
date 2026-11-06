'use client';

import { useState } from 'react';
import { PRODUCTS, type Product } from '@/lib/our-sky/data';
import { useOurSky, cartCount } from '../store';
import { ArtFigure } from '../ArtFigure';
import { toast } from 'sonner';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const FILTERS = ['all', 'prints', 'rituals', 'objects', 'books'] as const;
const money = (c: number) => `$${(c / 100).toFixed(0)}`;

export function ShopScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const items = filter === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.kind === filter);

  return (
    <div className="relative pb-16">
      <header className="flex items-center justify-between px-6 pb-5 pt-7">
        <div>
          <h1 className="title-serif text-[30px]">Objects for the sky</h1>
          <p className="label-mono-sm mt-1.5 text-[#5f5f5f]">SHIPS WORLDWIDE · SMALL EDITIONS</p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          aria-label="Open cart"
          className="relative flex h-10 w-10 items-center justify-center border border-border text-[#b0b0ad] transition-colors hover:border-[#4a4a4a] hover:text-foreground"
        >
          <ShoppingBag className="h-4 w-4" />
          <CartBadge />
        </button>
      </header>

      {/* filters */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-5">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`label-mono-sm shrink-0 border px-3.5 py-2 transition-colors ${
              filter === f
                ? 'border-foreground bg-foreground text-background'
                : 'border-[#2a2a2a] text-[#8a8a8a] hover:border-[#4a4a4a] hover:text-foreground'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* grid */}
      <section className="grid grid-cols-2 gap-3 px-5">
        {items.map(p => (
          <ProductDialog key={p.id} product={p}>
            <button className="group text-left">
              <div className="relative aspect-square overflow-hidden border border-[#1c1c1c]">
                <ArtFigure
                  src={p.artKey}
                  alt={p.name}
                  drift={false}
                  className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
                />
                {p.personalizable && (
                  <Badge className="label-mono-sm absolute left-2 top-2 rounded-none border border-[#3a3a3a] bg-[#050505]/90 text-[10px] text-[#b0b0ad] hover:bg-[#050505]">
                    USES YOUR CHART
                  </Badge>
                )}
              </div>
              <h3 className="title-serif mt-3 text-[16px] leading-snug">{p.name}</h3>
              <p className="label-mono-sm mt-1 text-[#8a8a8a]">{money(p.priceCents)}</p>
            </button>
          </ProductDialog>
        ))}
      </section>

      <p className="label-mono-sm mt-10 px-6 text-center text-[#3f3f3f]">
        EVERY OBJECT PACKED BY HAND · NO PLASTIC, EVER
      </p>

      <CartSheet open={cartOpen} setOpen={setCartOpen} />
    </div>
  );
}

function CartBadge() {
  const count = useOurSky(cartCount);
  if (count === 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#e23636] font-mono text-[9px] text-white">
      {count}
    </span>
  );
}

/* ---------------- product dialog ---------------- */

function ProductDialog({ product, children }: { product: Product; children: React.ReactNode }) {
  const addToCart = useOurSky(s => s.addToCart);
  const [variant, setVariant] = useState<string>(product.variant?.[0] ?? '');

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="grain max-h-[85vh] overflow-y-auto border-border bg-[#050505] p-0 thin-scrollbar sm:max-w-[360px]">
        <div className="relative aspect-[4/3] w-full">
          <ArtFigure src={product.artKey} alt={product.name} drift={false} className="h-full w-full" />
        </div>
        <div className="px-6 pb-8">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="title-serif text-[25px] leading-tight">{product.name}</DialogTitle>
          </DialogHeader>
          <p className="label-mono mt-1 text-[#8a8a8a]">{product.kind.toUpperCase()} · {money(product.priceCents)}</p>
          <p className="mt-4 text-[14px] leading-[1.7] text-[#d6d6d3]">{product.blurb}</p>

          {product.variant && (
            <div className="mt-5">
              <p className="label-mono-sm text-[#8a8a8a]">SIZE</p>
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger className="mt-2 w-full rounded-none border-border bg-transparent font-mono text-[13px] focus:ring-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-border bg-[#0a0a0a]">
                  {product.variant.map(v => (
                    <SelectItem key={v} value={v} className="rounded-none font-mono text-[13px]">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ul className="mt-5 space-y-1.5 border-t border-border pt-4">
            {product.specs.map(s => (
              <li key={s} className="label-mono-sm text-[#6a6a6a]">◈ {s}</li>
            ))}
          </ul>

          <button
            onClick={() => { addToCart(product.id, variant || undefined); toast(`${product.name} — in the cart.`); }}
            className="label-mono mt-6 w-full border border-foreground bg-foreground py-3.5 text-[12px] text-background transition-colors hover:bg-[#d6d6d3]"
          >
            ADD TO CART — {money(product.priceCents)}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- cart sheet ---------------- */

function CartSheet({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const cart = useOurSky(s => s.cart);
  const addToCart = useOurSky(s => s.addToCart);
  const removeFromCart = useOurSky(s => s.removeFromCart);
  const count = useOurSky(cartCount);
  const subtotal = cart.reduce((n, l) => {
    const p = PRODUCTS.find(p => p.id === l.productId);
    return n + (p ? p.priceCents * l.qty : 0);
  }, 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="grain h-[80vh] rounded-t-none border-border bg-[#050505] p-0">
        <div className="mx-auto max-w-[420px] px-6 pb-10">
          <SheetHeader className="p-0 pb-4 pt-6 text-left">
            <SheetTitle className="title-serif text-[26px]">Cart</SheetTitle>
            <p className="label-mono-sm mt-1 text-[#5f5f5f]">{count} ITEM{count === 1 ? '' : 'S'}</p>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="title-serif text-[20px] text-[#8a8a8a]">Nothing yet.</p>
              <p className="label-mono-sm mt-2 text-[#5f5f5f]">THE SKY IS PATIENT. SO IS SHIPPING.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border border-y border-border">
                {cart.map(l => {
                  const p = PRODUCTS.find(p => p.id === l.productId)!;
                  return (
                    <li key={`${l.productId}-${l.variant}`} className="flex items-center gap-4 py-4">
                      <div className="h-14 w-14 shrink-0">
                        <ArtFigure src={p.artKey} alt="" drift={false} className="h-full w-full" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px]">{p.name}</p>
                        {l.variant && <p className="label-mono-sm mt-0.5 text-[#5f5f5f]">{l.variant.toUpperCase()}</p>}
                        <p className="label-mono-sm mt-0.5 text-[#8a8a8a]">{money(p.priceCents)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeFromCart(l.productId, l.variant)}
                          aria-label="Decrease quantity"
                          className="flex h-7 w-7 items-center justify-center border border-border text-[#8a8a8a] hover:text-foreground"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-mono text-[13px]">{l.qty}</span>
                        <button
                          onClick={() => addToCart(l.productId, l.variant)}
                          aria-label="Increase quantity"
                          className="flex h-7 w-7 items-center justify-center border border-border text-[#8a8a8a] hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 space-y-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#8a8a8a]">Subtotal</span>
                  <span className="font-mono">{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#8a8a8a]">Shipping</span>
                  <span className="font-mono">FREE</span>
                </div>
              </div>
              <Separator className="my-4 bg-border" />
              <button
                onClick={() => toast('Checkout is a prototype. The sky thanks you.')}
                className="label-mono w-full border border-foreground bg-foreground py-3.5 text-[12px] text-background transition-colors hover:bg-[#d6d6d3]"
              >
                CHECKOUT — {money(subtotal)}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
