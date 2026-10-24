import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { fetchMyBirthProfile } from "../lib/readings";
import { colors } from "../../theme/type";

export default function Index() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const profile = await fetchMyBirthProfile();
      if (!profile) {
        router.replace("/onboarding");
      } else {
        router.replace("/day");
      }
    })().finally(() => setChecking(false));
  }, []);

  return (
    <View style={styles.container}>
      {checking && <ActivityIndicator color={colors.ink} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
