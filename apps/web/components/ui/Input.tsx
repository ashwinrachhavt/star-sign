import { fontMono } from "@/app/fonts";

export function Input({
  id,
  label,
  chip,
  ...props
}: {
  id: string;
  label: string;
  chip?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="ui-input-field">
      <label
        htmlFor={id}
        className={`ui-input-label type-micro-label t-11 ${fontMono.className}`}
      >
        {label}
      </label>
      <div className="ui-input-row">
        <input
          id={id}
          className={`ui-input ui-focusable type-prose ${fontMono.className}`}
          {...props}
        />
        {chip && (
          <span className={`ui-input-chip type-micro-label t-11 ${fontMono.className}`}>
            {chip}
          </span>
        )}
      </div>
    </div>
  );
}
