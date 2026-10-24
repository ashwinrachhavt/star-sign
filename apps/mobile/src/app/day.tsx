import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import {
  fetchMyBirthProfile,
  getOrCreateDailyReading,
  rowToBirthProfile,
} from "../lib/readings";
import type { DailyReading } from "@our-sky/core";

const AREA_LABELS: Record<string, string> = {
  love: "Love",
  work: "Work",
  money: "Money",
  home: "Home & family",
  family: "Family",
  friends: "Friends",
  self: "Self",
};

export default function Day() {
  const [reading, setReading] = useState<DailyReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProvance, setShowProvance] = useState(false);

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
        const profileRow = await fetchMyBirthProfile();
        if (!profileRow) {
          router.replace("/onboarding");
          return;
        }
        const forDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: profileRow.birth_time_zone,
        }).format(new Date());
        const { reading: r, error: err } = await getOrCreateDailyReading(
          data.user.id,
          forDate,
          rowToBirthProfile(profileRow),
        );
        if (err || !r) setError(err ?? "Could not load today's reading.");
        else setReading(r);
        setLoading(false);
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
        <ActivityIndicator color="#8b9cf9" size="large" />
      </View>
    );
  }

  if (error || !reading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Text style={styles.muted}>{error ?? "Something went wrong."}</Text>
        <Pressable onPress={signOut} style={{ marginTop: 16 }}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Our Sky</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={styles.dateLabel}>
        {new Date(reading.forDate + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </Text>
      <Text style={styles.headline}>{reading.headline}</Text>
      <Text style={styles.body}>{reading.explanation}</Text>

      <View style={styles.card}>
        <View style={styles.column}>
          <Text style={styles.sectionLabel}>Dos</Text>
          {reading.dos.map((d, i) => (
            <Text key={i} style={styles.listItem}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.column}>
          <Text style={styles.sectionLabel}>Don&apos;ts</Text>
          {reading.donts.map((d, i) => (
            <Text key={i} style={styles.listItem}>
              {d}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.badgeRow}>
        {reading.lifeAreas.map((area) => (
          <View key={area} style={styles.badge}>
            <Text style={styles.badgeText}>{AREA_LABELS[area] ?? area}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={() => setShowProvance(!showProvance)}>
        <Text style={styles.link}>
          {showProvance ? "Hide" : "Why this reading?"}
        </Text>
      </Pressable>
      {showProvance && (
        <View style={styles.card}>
          <Text style={styles.body}>
            Ruleset {reading.provenance.rulesetVersion} · copy{" "}
            {reading.provenance.copyVersion} ·{" "}
            {reading.provenance.inputs.length} astronomical inputs
          </Text>
          <Text style={[styles.body, { color: "#f5c98a", marginTop: 8 }]}>
            {reading.uncertaintyNote}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0e1a", padding: 20 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 48, marginBottom: 16 },
  brand: { color: "#e8eaf6", fontSize: 20, fontWeight: "700" },
  dateLabel: { color: "#9aa3c7", fontSize: 13, marginBottom: 8 },
  headline: { color: "#e8eaf6", fontSize: 26, lineHeight: 34, fontWeight: "700", marginBottom: 12 },
  body: { color: "#e8eaf6", fontSize: 15, lineHeight: 23 },
  card: {
    backgroundColor: "#141830",
    borderColor: "#2a3158",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  column: { flex: 1 },
  sectionLabel: { color: "#9aa3c7", fontSize: 12, marginBottom: 8, textTransform: "uppercase" },
  listItem: { color: "#e8eaf6", fontSize: 14, lineHeight: 21, marginBottom: 6 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  badge: {
    backgroundColor: "#2a3158",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: "#8b9cf9", fontSize: 12 },
  muted: { color: "#9aa3c7", fontSize: 15, textAlign: "center" },
  link: { color: "#8b9cf9", fontSize: 14 },
});
