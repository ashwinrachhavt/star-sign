import { fontMono } from "@/app/fonts";

export function LifeAreaRow({
  area,
  state,
}: {
  area: string;
  state: string;
}) {
  return (
    <div className="ui-life-area-row">
      <span className={`type-micro-label t-11 ${fontMono.className}`}>{area}</span>
      <span className={`ui-life-area-row-state type-micro-label t-11 ${fontMono.className}`}>
        {state}
      </span>
    </div>
  );
}
