import { fontMono } from "@/app/fonts";

export function DosDonts({
  dos,
  donts,
  doLabel = "Do",
  dontLabel = "Don't",
}: {
  dos: string[];
  donts: string[];
  doLabel?: string;
  dontLabel?: string;
}) {
  return (
    <div className="ui-dos-donts">
      {[
        { label: doLabel, items: dos },
        { label: dontLabel, items: donts },
      ].map((section) => (
        <section className="ui-dos-donts-section" key={section.label}>
          <p className={`ui-dos-donts-label type-micro-label t-11 ${fontMono.className}`}>
            {section.label}
          </p>
          <ul className="ui-dos-donts-list">
            {section.items.map((item) => (
              <li className="type-prose t-15" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
