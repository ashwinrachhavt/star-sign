import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { saveBirthProfile } from "../lib/readings";

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
      style={{ flex: 1, backgroundColor: "#0b0e1a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Your birth details</Text>
        <Text style={styles.subtitle}>
          We store exactly how precise your birth time is — and never pretend otherwise.
        </Text>

        <Text style={styles.label}>Birth date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="1990-06-15"
          placeholderTextColor="#9aa3c7"
          autoCapitalize="none"
          value={birthDate}
          onChangeText={setBirthDate}
        />

        <Text style={styles.label}>Birth time</Text>
        <View style={styles.row}>
          {(["yes", "approx", "no"] as const).map((opt) => (
            <Pressable
              key={opt}
              style={[styles.chip, timeKnown === opt && styles.chipActive]}
              onPress={() => setTimeKnown(opt)}
            >
              <Text style={[styles.chipText, timeKnown === opt && styles.chipTextActive]}>
                {opt === "yes" ? "Exact" : opt === "approx" ? "Approx" : "Unknown"}
              </Text>
            </Pressable>
          ))}
        </View>
        {timeKnown !== "no" && (
          <TextInput
            style={styles.input}
            placeholder="14:30"
            placeholderTextColor="#9aa3c7"
            autoCapitalize="none"
            value={birthTime}
            onChangeText={setBirthTime}
          />
        )}

        <Text style={styles.label}>Time zone at birth</Text>
        <TextInput
          style={styles.input}
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
            >
              <Text style={[styles.chipText, timeZone === z && styles.chipTextActive]}>
                {z.split("/")[1]?.replace("_", " ")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Latitude</Text>
        <TextInput
          style={styles.input}
          placeholder="40.7128"
          placeholderTextColor="#9aa3c7"
          keyboardType="decimal-pad"
          value={lat}
          onChangeText={setLat}
        />

        <Text style={styles.label}>Longitude</Text>
        <TextInput
          style={styles.input}
          placeholder="-74.0060"
          placeholderTextColor="#9aa3c7"
          keyboardType="decimal-pad"
          value={lon}
          onChangeText={setLon}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={submit} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? "Saving…" : "Continue"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 64 },
  title: { color: "#e8eaf6", fontSize: 26, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#9aa3c7", fontSize: 14, marginBottom: 20, lineHeight: 20 },
  label: { color: "#9aa3c7", fontSize: 13, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: "#141830",
    borderColor: "#2a3158",
    borderWidth: 1,
    borderRadius: 12,
    color: "#e8eaf6",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    borderColor: "#2a3158",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#8b9cf9", borderColor: "#8b9cf9" },
  chipText: { color: "#9aa3c7", fontSize: 14 },
  chipTextActive: { color: "#0b0e1a", fontWeight: "600" },
  button: {
    backgroundColor: "#8b9cf9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: "#0b0e1a", fontSize: 16, fontWeight: "600" },
  error: { color: "#f28b82", fontSize: 13, marginTop: 8 },
});
