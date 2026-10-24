import { ReactNode } from "react";

export function PlacementCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article className="ui-card ui-placement-card">
      <h2 className="type-display t-28">{title}</h2>
      <div className="ui-placement-card-prose">
        {Array.isArray(children) ? (
          children
        ) : (
          <p className="type-prose t-17">{children}</p>
        )}
      </div>
      {footer}
    </article>
  );
}
