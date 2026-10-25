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
import { supabase } from "../lib/supabase";
import {
  fetchMyBirthProfileApi,
  getOrCreateDailyReadingApi,
} from "../lib/api";
import type { DailyReading } from "@star-sign/core";
import { Glance, LifeAreaRow, ProvenanceBlock } from "../../components/ui";
import { bodyGlyph } from "../../components/ui/glyphs";
import {
  colors,
  microLabel,
  sansProse,
  serifDisplay,
  space,
  type,
} from "../../theme/type";

const AREA_LABELS: Record<string, string> = {
  love: "Love",
  work: "Work",
  money: "Money",
  home: "Home & family",
  family: "Family",
  friends: "Friends",
  self: "Self",
};

const TEMPERATURE_LABEL: Record<string, string> = {
  hot: "Hot",
  warm: "Warm",
  quiet: "Quiet",
  // Pre-2026-10.3 rows never stored a temperature — the honest dash.
  legacy: "—",
};

export default function Day() {
  const insets = useSafeAreaInsets();
  const [reading, setReading] = useState<DailyReading | null>(null);
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
          const r = await getOrCreateDailyReadingApi();
          setReading(r);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load today's reading.");
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

  if (error || !reading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Text style={[sansProse, type.s15, styles.muted]}>{error ?? "Something went wrong."}</Text>
        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={[microLabel, { color: colors.ink }]}>Sign out ›</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + space[7],
        paddingHorizontal: space[5],
      }}
    >
      <View style={styles.topBar}>
        <Text style={[serifDisplay, type.s22, { color: colors.ink }]}>Star Sign</Text>
        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={[microLabel, { color: colors.inkSecondary }]}>Sign out ›</Text>
        </Pressable>
      </View>

      <Text style={[microLabel, styles.dateLabel, { color: colors.inkTertiary }]}>
        {new Date(reading.forDate + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </Text>
      <Glance headline={reading.headline}>{reading.explanation}</Glance>

      <View style={styles.dosDonts}>
        <View style={styles.column}>
          <Text style={[microLabel, { color: colors.inkTertiary, marginBottom: space[2] }]}>
            Do
          </Text>
          {reading.dos.map((d, i) => (
            <Text key={i} style={[sansProse, type.s15, styles.listItem]}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.column}>
          <Text style={[microLabel, { color: colors.inkTertiary, marginBottom: space[2] }]}>
            Don&apos;t
          </Text>
          {reading.donts.map((d, i) => (
            <Text key={i} style={[sansProse, type.s15, styles.listItem]}>
              {d}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.lifeAreas}>
        {reading.lifeAreas.map(({ area, temperature }) => (
          <LifeAreaRow
            key={area}
            area={AREA_LABELS[area] ?? area}
            state={TEMPERATURE_LABEL[temperature] ?? "—"}
          />
        ))}
      </View>

      {/* Dive deeper v1 (ASH-249): present only when the provenance carries
          the events that produced the reading — never rendered without it. */}
      {reading.diveDeeper && (
        <View style={[styles.diveDeeper, { marginTop: space[5] }]}>
          <Text style={[microLabel, { color: colors.ink, marginBottom: space[3] }]}>
            Dive deeper
          </Text>
          <Text style={[sansProse, type.s15, { color: colors.ink, lineHeight: 26, marginBottom: space[4] }]}>
            {reading.diveDeeper.lessons}
          </Text>
          <Text style={[microLabel, { color: colors.inkTertiary, marginBottom: space[2] }]}>
            Decode the day
          </Text>
          {reading.diveDeeper.decoded.map((d, i) => (
            <View key={i} style={styles.decodedRow}>
              <Text style={[sansProse, type.s15, { color: colors.ink }]}>
                {d.explanation}
              </Text>
              <Text style={[microLabel, { color: colors.inkTertiary, marginTop: space[1] }]}>
                {d.geometry}
              </Text>
            </View>
          ))}
          <Text style={[sansProse, type.s13, { color: colors.inkTertiary, marginTop: space[3] }]}>
            Deeper layers are coming with Star Sign Pro. Everything here stays
            free.
          </Text>
        </View>
      )}

      <ProvenanceBlock>
        {reading.provenance.selectedEvents.filter((e) => e.kind === "transit").length > 0 && (
          <View>
            {reading.provenance.selectedEvents
              .filter((e) => e.kind === "transit")
              .map((e, i) => {
                const ev = e as {
                  planet: string;
                  natal: string;
                  aspect: string;
                  orb?: number;
                };
                return (
                  <Text key={i} style={[microLabel, { color: colors.inkSecondary }]}>
                    {bodyGlyph(ev.planet)} {cap(ev.planet)} {ev.aspect} natal{" "}
                    {cap(ev.natal)}
                    {typeof ev.orb === "number" ? ` — orb ${ev.orb.toFixed(2)}` : ""}
                  </Text>
                );
              })}
          </View>
        )}
        <Text style={[microLabel, { color: colors.inkTertiary }]}>
          Ruleset {reading.provenance.rulesetVersion} · copy {reading.provenance.copyVersion} ·{" "}
          {reading.provenance.inputs.length} astronomical inputs
        </Text>
        <Text style={[microLabel, { color: colors.inkTertiary }]}>
          {reading.uncertaintyNote}
        </Text>
      </ProvenanceBlock>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space[4],
  },
  signOut: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  dateLabel: {
    marginBottom: space[2],
  },
  dosDonts: {
    flexDirection: "row",
    gap: space[5],
    marginTop: space[5],
  },
  column: { flex: 1 },
  listItem: {
    color: colors.ink,
    marginBottom: space[2],
  },
  lifeAreas: {
    marginTop: space[5],
  },
  diveDeeper: {
    borderWidth: 1,
    borderColor: colors.ink,
    padding: space[5],
  },
  decodedRow: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingVertical: space[3],
  },
  muted: {
    color: colors.inkSecondary,
    textAlign: "center",
  },
});

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
