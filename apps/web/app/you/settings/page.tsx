import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ui";
import { SettingsSection } from "./settings-section";
import { fontMono } from "@/app/fonts";

export const dynamic = "force-dynamic";

/**
 * You → Settings (ASH-267): account and data controls. Everything here
 * is a link or a live toggle backed by an existing API route — no new
 * endpoints, no duplicated policy.
 */
export default async function YouSettingsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const userId = userData.user.id;

  const [{ data: profileRow }, { data: prefs }, { data: profileMeta }] = await Promise.all([
    supabase
      .from("birth_profiles")
      .select("birth_date, birth_time, birth_time_precision, birth_place_label")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("notification_preferences")
      .select("opt_full_moon, opt_retrograde, opt_weekly_digest, quiet_start_hour, quiet_end_hour")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
  ]);

  return (
    <main className="container">
      <ScreenHeader
        title="You"
        tabs={[
          { id: "chart", label: "Chart", href: "/you" },
          { id: "saved", label: "Saved", href: "/you/saved" },
          { id: "settings", label: "Settings", href: "/you/settings" },
        ]}
        activeTab="settings"
      />

      <section style={{ marginTop: "var(--space-6)" }}>
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}
        >
          BIRTH DATA
        </p>
        <div className="card">
          {profileRow ? (
            <>
              <p className="type-prose t-15">
                {profileRow.birth_date}
                {profileRow.birth_time ? ` at ${profileRow.birth_time.slice(0, 5)}` : ""}
                {profileRow.birth_time_precision !== "exact" && ` (${profileRow.birth_time_precision} time)`}
              </p>
              {profileRow.birth_place_label && (
                <p
                  className={`type-micro-label t-11 ${fontMono.className}`}
                  style={{ color: "var(--ink-secondary)", marginTop: "var(--space-2)" }}
                >
                  {profileRow.birth_place_label.toUpperCase()}
                </p>
              )}
            </>
          ) : (
            <p className="type-prose t-15" style={{ color: "var(--ink-secondary)" }}>
              No birth data yet.
            </p>
          )}
          <p style={{ marginTop: "var(--space-3)" }}>
            <a
              href="/onboarding?edit=1"
              className="ui-focusable type-micro-label t-11"
              style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Edit birth details
            </a>
          </p>
          <p
            className={`type-micro-label t-11 ${fontMono.className}`}
            style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-2)" }}
          >
            EDITING RECALCULATES YOUR CHART. PAST READINGS KEEP THEIR ORIGINAL BASIS.
          </p>
        </div>
      </section>

      <SettingsSection
        displayName={profileMeta?.display_name ?? "You"}
        prefs={
          prefs
            ? {
                optFullMoon: prefs.opt_full_moon,
                optRetrograde: prefs.opt_retrograde,
                optWeeklyDigest: prefs.opt_weekly_digest,
                quietStartHour: prefs.quiet_start_hour,
                quietEndHour: prefs.quiet_end_hour,
              }
            : null
        }
      />
    </main>
  );
}
