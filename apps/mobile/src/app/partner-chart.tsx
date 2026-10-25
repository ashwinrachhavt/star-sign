import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getPartnerChartApi } from "../lib/api";
import { bodyGlyph } from "../../components/ui/glyphs";
import {
  Button,
  ScreenHeader,
} from "../../components/ui";
import {
  colors,
  microLabel,
  sansProse,
  space,
  type,
} from "../../theme/type";

const PLANET_LABELS: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune",
  pluto: "Pluto",
};

/**
 * Partner chart (ASH-259 consuming the 5.2 projection): renders exactly
 * what GET /api/connections/{id}/chart returns — placements only in the
 * accepted scope, the consent note always. The client adds nothing.
 */
export default function PartnerChart() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<string>("");
  const [placements, setPlacements] = useState<
    { planet: string; sign: string; house?: number }[]
  >([]);
  const [consentNote, setConsentNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (typeof id !== "string") {
          setError("No connection selected.");
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        try {
          const p = await getPartnerChartApi(id);
          setState(p.state);
          setPlacements(p.placements ?? []);
          setConsentNote(p.consentNote);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load the chart.");
        } finally {
          setLoading(false);
        }
      })();
    }, [id]),
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + space[8],
          paddingHorizontal: space[5],
        }}
      >
        <ScreenHeader title="Their sky" tabs={[]} />

        {loading ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: space[6] }} />
        ) : error ? (
          <Text style={[sansProse, type.s15, { color: colors.inkSecondary, marginTop: space[5] }]}>
            {error}
          </Text>
        ) : (
          <>
            {/* Consent note — copy.md rule 5, verbatim from the projection. */}
            <Text style={[sansProse, type.s15, { color: colors.inkSecondary, marginTop: space[3] }]}>
              {consentNote}
            </Text>

            {state === "accepted" && placements.length > 0 ? (
              <View style={styles.table}>
                {placements.map((pl) => (
                  <View key={pl.planet} style={styles.row}>
                    <Text style={[microLabel, { color: colors.ink, flex: 1 }]}>
                      {bodyGlyph(pl.planet)} {PLANET_LABELS[pl.planet] ?? pl.planet}
                    </Text>
                    <Text style={[microLabel, { color: colors.inkSecondary }]}>
                      {pl.sign}
                      {pl.house !== undefined ? ` · house ${pl.house}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[sansProse, type.s15, { color: colors.inkSecondary, marginTop: space[5] }]}>
                The chart appears here once you are connected. Until then
                there is nothing to show — that is by design.
              </Text>
            )}
          </>
        )}

        <View style={{ marginTop: space[6] }}>
<Button variant="link" label="Back" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  table: {
    marginTop: space[5],
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
});
