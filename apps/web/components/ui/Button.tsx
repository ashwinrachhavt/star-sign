import { ReactNode } from "react";
import { fontMono } from "@/app/fonts";

export function Button({
  variant = "link",
  href,
  onClick,
  type,
  disabled,
  children,
}: {
  variant?: "link" | "solid";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  children: ReactNode;
}) {
  const className =
    variant === "solid"
      ? `ui-button-solid ui-focusable type-micro-label t-13 ${fontMono.className}`
      : `ui-button-link ui-focusable type-micro-label t-13 ${fontMono.className}`;

  if (href) {
    return (
      <a href={href} className={className}>
        {children}
        {variant === "link" && <span aria-hidden="true">›</span>}
      </a>
    );
  }
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
