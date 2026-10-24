import { fontMono } from "@/app/fonts";

export function TabBar({
  items,
  activeItem,
}: {
  items: { id: string; label: string; href: string }[];
  activeItem?: string;
}) {
  return (
    <nav className="ui-tab-bar" aria-label="Primary">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={`ui-tab-bar-item ui-focusable type-micro-label t-11 ${fontMono.className}`}
          data-active={activeItem === item.id}
          aria-current={activeItem === item.id ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
