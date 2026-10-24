import { fontMono } from "@/app/fonts";

export function CardFooterLink({
  glyph,
  href,
  label,
}: {
  glyph: string;
  href: string;
  label: string;
}) {
  return (
    <footer className={`ui-card-footer-link type-micro-label t-11 ${fontMono.className}`}>
      <span aria-hidden="true">{glyph}</span>
      <a href={href} className="ui-focusable">
        {label}
        <span aria-hidden="true">→</span>
      </a>
    </footer>
  );
}
