import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { Input } from "../../components/ui";
import {
  colors,
  microLabel,
  sansProse,
  serifDisplay,
  space,
  type,
} from "../../theme/type";

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
      <Text style={[serifDisplay, type.s36, styles.title]}>Star Sign</Text>
      <Text style={[sansProse, type.s15, styles.subtitle]}>
        A private sky shared with someone you care about.
      </Text>

      <Input
        label="Email"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Input
        label="Password"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && (
        <Text style={[sansProse, type.s13, styles.error]}>{error}</Text>
      )}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={({ pressed }) => [styles.button, pressed && busy === false && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={[microLabel, { fontSize: 13, color: colors.bg }]}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")} style={styles.switch}>
        <Text style={[microLabel, { color: colors.inkSecondary }]}>
          {mode === "signin"
            ? "New here? Create an account ›"
            : "Already have an account? Sign in ›"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: space[5],
    justifyContent: "center",
    gap: space[4],
  },
  title: {
    color: colors.ink,
    marginBottom: space[1],
  },
  subtitle: {
    color: colors.inkSecondary,
    marginBottom: space[5],
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
  switch: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
