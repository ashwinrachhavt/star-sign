import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { computeWeekAhead } from "@star-sign/core";
import type { BirthProfile } from "@star-sign/core";
import { supabase } from "../lib/supabase";
import { fetchMyBirthProfileApi } from "../lib/api";
import { rowToBirthProfile } from "../lib/readings";
import {
  ScreenHeader,
  TabBar,
  TransitEventCard,
  dateRangeLabel,
} from "../../components/ui";
import {
  colors,
  microLabel,
  sansProse,
  space,
  type,
} from "../../theme/type";

const ASPECT_WORDS: Record<string, string> = {
  conjunction: "meets",
  opposition: "opposes",
  square: "squares",
  trine: "trines",
  sextile: "sextiles",
};

const AREA_LABELS: Record<string, string> = {
  love: "love", work: "work", money: "money", home: "home",
  family: "family", friends: "friends", self: "self",
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface WeekEvent {
  transit: string;
  natal: string;
  type: string;
  orb: number;
  retrograde: boolean;
  areas: readonly string[];
  score: number;
}

/** Prose strictly derived from event fields — no invented explanation. */
function eventProse(e: WeekEvent): string {
  const parts: string[] = [];
  if (e.retrograde) parts.push("Retrograde.");
  parts.push(`Orb ${e.orb.toFixed(1)}°.`);
  const areas = e.areas.map((a) => AREA_LABELS[a] ?? a);
  if (areas.length > 0) parts.push(`Touches ${areas.join(", ")}.`);
  return parts.join(" ");
}

export default function Week() {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<
    { date: string; events: WeekEvent[] }[]
  >([]);
  const [quiet, setQuiet] = useState(false);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        setError(null);
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login");
          return;
        }
        const profileRow = await fetchMyBirthProfileApi();
        if (!profileRow) {
          router.replace("/onboarding");
          return;
        }
        try {
          // computeWeekAhead is a pure core function over the birth
          // profile — same computation web's week page runs (day ↔ week
          // can never disagree). No mobile-only shape is created; the
          // WeekAhead contract comes from @star-sign/core.
          const week = computeWeekAhead(
            rowToBirthProfile(profileRow) as BirthProfile,
          );
          setDays(week.days as { date: string; events: WeekEvent[] }[]);
          setQuiet(week.quiet);
          setVersion(week.version);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load the week.");
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.ink} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Text style={[sansProse, type.s15, styles.muted]}>{error}</Text>
        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={[microLabel, { color: colors.ink }]}>Sign out ›</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + space[7],
          paddingHorizontal: space[5],
        }}
      >
        <ScreenHeader
          title="Your Week"
          tabs={[
            { id: "day", label: "My Day" },
            { id: "week", label: "Week" },
          ]}
          activeTab="week"
        />

        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={[microLabel, { color: colors.inkSecondary }]}>Sign out ›</Text>
        </Pressable>

        {quiet ? (
          <Text style={[sansProse, type.s17, { color: colors.inkSecondary, marginTop: space[6] }]}>
            A quiet week — the sky has nothing loud planned. Rest or start
            something of your own.
          </Text>
        ) : (
          <View style={styles.days}>
            {days.map((day, i) => {
              if (day.events.length === 0) return null;
              return (
                <View key={day.date}>
                  {i > 0 && <View style={styles.separator} />}
                  <View style={styles.dayGroup}>
                    {day.events.map((e) => (
                      <TransitEventCard
                        key={`${day.date}-${e.transit}-${e.type}-${e.natal}`}
                        dateRange={dateRangeLabel(day.date)}
                        transit={e.transit}
                        aspect={e.type}
                        natal={e.natal}
                        title={`${cap(e.transit)} ${ASPECT_WORDS[e.type] ?? e.type} natal ${cap(e.natal)}`}
                        footer={`${cap(e.transit)} · score ${e.score.toFixed(1)}`}
                      >
                        {eventProse(e)}
                      </TransitEventCard>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {version ? (
          <Text style={[microLabel, styles.rulesetFooter, { color: colors.inkTertiary }]}>
            WEEK-AHEAD RULESET {version} · EVENTS COMPUTED FROM YOUR CHART
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
        <TabBar
          items={[
            { id: "day", label: "My Day" },
            { id: "week", label: "Week" },
          ]}
          activeItem="week"
          onSelect={(id) => {
            if (id === "day") router.replace("/day");
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  signOut: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: space[2],
  },
  days: {
    marginTop: space[5],
    gap: space[5],
  },
  dayGroup: {
    gap: space[3],
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    marginBottom: space[5],
  },
  rulesetFooter: {
    marginTop: space[6],
  },
  tabBar: {
    backgroundColor: colors.bg,
  },
  muted: {
    color: colors.inkSecondary,
    textAlign: "center",
  },
});
