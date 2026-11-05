import { fontMono } from "@/app/fonts";

/**
 * Do/Don't lists. `proofs` (W2b) carries the named-transit grounding line
 * for each pair — proofs[i] grounds dos[i] AND donts[i] (both derive from
 * the same event). Absent proofs render nothing: no fabricated proof.
 */
export function DosDonts({
  dos,
  donts,
  proofs,
  doLabel = "Do",
  dontLabel = "Don't",
}: {
  dos: string[];
  donts: string[];
  proofs?: string[];
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
            {section.items.map((item, i) => (
              <li className="type-prose t-15" key={item}>
                {item}
                {proofs?.[i] && (
                  <span
                    className={`type-micro-label t-11 ${fontMono.className}`}
                    style={{ display: "block", color: "var(--ink-tertiary)", marginTop: "var(--space-1)" }}
                  >
                    {proofs[i]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
