import { fontMono, fontSans, fontSerif } from "@/app/fonts";
import "./ui.css";

export function ScreenHeader({
  title,
  tabs,
  activeTab,
}: {
  title: string;
  tabs: { id: string; label: string; href: string }[];
  activeTab?: string;
}) {
  return (
    <>
      <header className="ui-screen-header">
        <h1 className={`ui-screen-header-title type-display t-28 ${fontSerif.className}`}>
          {title}
        </h1>
        {tabs.length > 0 && (
          <nav className="ui-screen-header-tabs type-micro-label" aria-label={title}>
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
      {tabs.length > 0 && (
        // Mobile adaptation: the same destinations as the tab strip, as a
        // fixed bottom bar in thumb reach (≤40rem; the strip hides there —
        // ui.css). Rendered from the same tabs data so the two can never
        // drift; pages pass one set of destinations.
        <nav className="ui-app-bottom-nav type-micro-label" aria-label="Primary">
          {tabs.map((tab) => (
            <a
              key={tab.id}
              href={tab.href}
              className={`ui-app-bottom-nav-item ui-focusable ${fontMono.className}`}
              data-active={activeTab === tab.id}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
