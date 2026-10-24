import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { saveBirthProfile } from "../lib/readings";
import { Input } from "../../components/ui";
import {
  colors,
  microLabel,
  sansProse,
  serifDisplay,
  space,
  type,
} from "../../theme/type";

const COMMON_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function Onboarding() {
  const [birthDate, setBirthDate] = useState("");
  const [timeKnown, setTimeKnown] = useState<"yes" | "approx" | "no">("yes");
  const [birthTime, setBirthTime] = useState("");
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/login");
      return;
    }
    const precision =
      timeKnown === "yes" ? "exact" : timeKnown === "approx" ? "approximate" : "unknown";
    const { error: err } = await saveBirthProfile({
      userId: data.user.id,
      birthDate,
      birthTime: precision === "unknown" ? null : birthTime || null,
      precision,
      timeZone,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace("/day");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[serifDisplay, type.s28, styles.title]}>Your birth details</Text>
        <Text style={[sansProse, type.s15, styles.subtitle]}>
          We store exactly how precise your birth time is — and never pretend otherwise.
        </Text>

        <Input
          label="Birth date (YYYY-MM-DD)"
          placeholder="1990-06-15"
          autoCapitalize="none"
          value={birthDate}
          onChangeText={setBirthDate}
        />

        <Text style={[microLabel, styles.label]}>Birth time</Text>
        <View style={styles.row}>
          {(["yes", "approx", "no"] as const).map((opt) => (
            <Pressable
              key={opt}
              style={[styles.chip, timeKnown === opt && styles.chipActive]}
              onPress={() => setTimeKnown(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected: timeKnown === opt }}
            >
              <Text
                style={[
                  microLabel,
                  { color: timeKnown === opt ? colors.bg : colors.inkSecondary },
                ]}
              >
                {opt === "yes" ? "Exact" : opt === "approx" ? "Approx" : "Unknown"}
              </Text>
            </Pressable>
          ))}
        </View>
        {timeKnown !== "no" && (
          <Input
            label="Birth time (HH:MM)"
            placeholder="14:30"
            autoCapitalize="none"
            value={birthTime}
            onChangeText={setBirthTime}
          />
        )}

        <Input
          label="Time zone at birth"
          value={timeZone}
          onChangeText={setTimeZone}
          autoCapitalize="none"
        />
        <View style={styles.row}>
          {COMMON_ZONES.slice(0, 4).map((z) => (
            <Pressable
              key={z}
              style={[styles.chip, timeZone === z && styles.chipActive]}
              onPress={() => setTimeZone(z)}
              accessibilityRole="button"
              accessibilityState={{ selected: timeZone === z }}
            >
              <Text
                style={[
                  microLabel,
                  { color: timeZone === z ? colors.bg : colors.inkSecondary },
                ]}
              >
                {z.split("/")[1]?.replace("_", " ")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          label="Latitude"
          placeholder="40.7128"
          keyboardType="decimal-pad"
          value={lat}
          onChangeText={setLat}
        />

        <Input
          label="Longitude"
          placeholder="-74.0060"
          keyboardType="decimal-pad"
          value={lon}
          onChangeText={setLon}
        />

        {error && (
          <Text style={[sansProse, type.s13, styles.error]}>{error}</Text>
        )}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={styles.button}
          accessibilityRole="button"
        >
          <Text style={[microLabel, { fontSize: 13, color: colors.bg }]}>
            {busy ? "Saving…" : "Continue"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: space[5],
    paddingBottom: space[8],
    gap: space[4],
  },
  title: {
    color: colors.ink,
  },
  subtitle: {
    color: colors.inkSecondary,
  },
  label: {
    color: colors.inkSecondary,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space[3],
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  error: {
    color: colors.danger,
  },
  button: {
    backgroundColor: colors.ink,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[5],
    marginTop: space[2],
  },
});
