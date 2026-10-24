import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: err } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace(mode === "signup" ? "/onboarding" : "/day");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Our Sky</Text>
      <Text style={styles.subtitle}>A private sky shared with someone you care about.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#9aa3c7"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#9aa3c7"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#0b0e1a" />
        ) : (
          <Text style={styles.buttonText}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        <Text style={styles.switchText}>
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0e1a", padding: 24, justifyContent: "center" },
  title: { color: "#e8eaf6", fontSize: 32, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#9aa3c7", fontSize: 15, marginBottom: 32 },
  input: {
    backgroundColor: "#141830",
    borderColor: "#2a3158",
    borderWidth: 1,
    borderRadius: 12,
    color: "#e8eaf6",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#8b9cf9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#0b0e1a", fontSize: 16, fontWeight: "600" },
  error: { color: "#f28b82", fontSize: 13, marginTop: 4 },
  switchText: { color: "#8b9cf9", textAlign: "center", marginTop: 20 },
});
