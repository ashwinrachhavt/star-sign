import { ReactNode } from "react";
import { fontMono } from "@/app/fonts";

export function ProfileHeader({
  name,
  handle,
  signLine,
  avatar,
}: {
  name: string;
  handle: string;
  signLine: ReactNode;
  avatar?: { src: string; alt: string };
}) {
  return (
    <header className="ui-profile-header">
      {avatar && (
        <span className="ui-profile-header-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar.src} alt={avatar.alt} className="ui-grain-image" width={88} height={88} />
        </span>
      )}
      <h1 className="type-display t-28">{name}</h1>
      <p className={`ui-profile-header-handle type-mono t-13 ${fontMono.className}`}>{handle}</p>
      <p className={`ui-profile-header-signs type-mono t-13 ${fontMono.className}`}>{signLine}</p>
    </header>
  );
}
