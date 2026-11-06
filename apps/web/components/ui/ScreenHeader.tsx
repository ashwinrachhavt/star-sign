"use client";

import { usePathname } from "next/navigation";
import { fontMono, fontSans, fontSerif } from "@/app/fonts";
import "./ui.css";

interface Tab {
  id: string;
  label: string;
  href: string;
}

/**
 * The app's stable top-level IA. Every screen renders this as the bottom
 * bar (the persistent native tab-bar pattern) so primary navigation is
 * always in thumb reach — including on section pages like /you whose own
 * tab strip is a subsection, not the primary nav.
 */
export const PRIMARY_TABS: Tab[] = [
  { id: "day", label: "My Day", href: "/day" },
  { id: "week", label: "Week", href: "/week" },
  { id: "people", label: "People", href: "/people" },
  { id: "you", label: "You", href: "/you" },
];

/** True when a page's tab strip is the primary nav itself (day/week/people). */
function isPrimaryTabSet(tabs: Tab[]): boolean {
  return (
    tabs.length === PRIMARY_TABS.length &&
    tabs.every((tab, i) => tab.href === PRIMARY_TABS[i].href)
  );
}

export function ScreenHeader({
  title,
  tabs,
  activeTab,
}: {
  title: string;
  tabs: { id: string; label: string; href: string }[];
  activeTab?: string;
}) {
  const pathname = usePathname();
  const primarySet = isPrimaryTabSet(tabs);

  return (
    <>
      <header className="ui-screen-header">
        <h1 className={`ui-screen-header-title type-display t-28 ${fontSerif.className}`}>
          {title}
        </h1>
        {tabs.length > 0 && (
          // data-primary marks strips that ARE the primary nav: those hide
          // on phones (the bottom bar owns primary navigation there).
          // Section strips (e.g. Chart/Saved/Settings on /you) stay visible
          // on every viewport — they would be unreachable otherwise.
          <nav
            className="ui-screen-header-tabs type-micro-label"
            aria-label={title}
            data-primary={primarySet ? "true" : undefined}
          >
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={tab.href}
                className={`ui-screen-header-tab ui-focusable ${fontMono.className}`}
                data-active={activeTab === tab.id}
              >
                {tab.label}
              </a>
            ))}
          </nav>
        )}
      </header>
      <nav className="ui-app-bottom-nav type-micro-label" aria-label="Primary">
        {PRIMARY_TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <a
              key={tab.id}
              href={tab.href}
              className={`ui-app-bottom-nav-item ui-focusable ${fontMono.className}`}
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
