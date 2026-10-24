import { ReactNode } from "react";
import { fontMono } from "@/app/fonts";

export function FriendRow({
  name,
  signLine,
  href,
}: {
  name: string;
  signLine: ReactNode;
  href: string;
}) {
  return (
    <a href={href} className="ui-card ui-friend-row ui-focusable">
      <span>
        <span className="ui-friend-row-name type-prose t-15" style={{ display: "block" }}>
          {name}
        </span>
        <span className={`ui-friend-row-signs type-mono t-13 ${fontMono.className}`}>
          {signLine}
        </span>
      </span>
      <span className="ui-friend-row-arrow" aria-hidden="true">
        →
      </span>
    </a>
  );
}
