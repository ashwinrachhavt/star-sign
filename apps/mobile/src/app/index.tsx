import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { fetchMyBirthProfile } from "../lib/readings";

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
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0e1a" }}>
      {checking && <ActivityIndicator color="#8b9cf9" />}
    </View>
  );
}
