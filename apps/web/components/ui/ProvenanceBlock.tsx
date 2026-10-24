import { ReactNode } from "react";
import { fontMono } from "@/app/fonts";

export function ProvenanceBlock({
  summary = "Provenance",
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className={`ui-provenance-block type-mono t-11 ${fontMono.className}`}>
      <summary className="ui-focusable type-micro-label t-11">{summary}</summary>
      <div className="ui-provenance-block-body">{children}</div>
    </details>
  );
}
