import { ReactNode } from "react";
import { fontMono } from "@/app/fonts";
import { aspectGlyph, bodyGlyph } from "./glyphs";

/**
 * TransitEventCard (design-system §5, ref 12.png): bordered card — mono
 * caps date range, serif transit title, sans prose, optional mono footer
 * row with body/aspect glyphs. Glyphs are content, not decoration: they
 * are derived from the event data the card renders (ASH-254 AC3).
 */
export function TransitEventCard({
  dateRange,
  transit,
  aspect,
  natal,
  title,
  children,
  footer,
}: {
  /** Mono caps date range — use dateRangeLabel() for the em-dash format. */
  dateRange: string;
  /** Transiting body key (renders its glyph before the title). */
  transit?: string;
  /** Aspect family key (renders its glyph before the natal body). */
  aspect?: string;
  /** Natal body key (renders its glyph in the footer). */
  natal?: string;
  /** Serif title, e.g. "Pluto trine natal Moon". */
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article className="ui-card ui-transit-event-card">
      <p className={`ui-transit-event-card-dates type-micro-label t-11 ${fontMono.className}`}>
        {dateRange}
      </p>
      <h2 className="type-display t-22">
        {transit && (
          <span className={fontMono.className} aria-hidden="true">
            {bodyGlyph(transit)}{" "}
          </span>
        )}
        {title}
      </h2>
      <p className="type-prose t-15">{children}</p>
      {(natal || footer) && (
        <footer className={`ui-transit-event-card-footer type-mono t-13 ${fontMono.className}`}>
          {natal && (
            <span aria-hidden="true">
              {aspect ? `${aspectGlyph(aspect)} ` : ""}
              {bodyGlyph(natal)}
            </span>
          )}
          {footer}
        </footer>
      )}
    </article>
  );
}
