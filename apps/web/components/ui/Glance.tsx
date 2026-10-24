import { ReactNode } from "react";
import { fontMono } from "@/app/fonts";

export function Glance({
  label = "Today at a glance",
  headline,
  children,
}: {
  label?: string;
  headline: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-card ui-glance">
      <p className={`ui-glance-label type-micro-label t-11 ${fontMono.className}`}>{label}</p>
      <h2 className="type-display t-28">{headline}</h2>
      <p className="type-prose t-17">{children}</p>
    </section>
  );
}
