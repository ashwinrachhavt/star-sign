import { ReactNode } from "react";
import { fontMono } from "@/app/fonts";

export function TransitEventCard({
  dateRange,
  title,
  children,
}: {
  dateRange: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="ui-card ui-transit-event-card">
      <p className={`ui-transit-event-card-dates type-micro-label t-11 ${fontMono.className}`}>
        {dateRange}
      </p>
      <h2 className="type-display t-22">{title}</h2>
      <p className="type-prose t-15">{children}</p>
    </article>
  );
}
