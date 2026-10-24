import { ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, microLabel, space } from "../../theme/type";

export function ProvenanceBlock({
  summary = "Provenance",
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.block}>
      <Pressable
        onPress={() => setOpen(!open)}
        style={styles.summary}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[microLabel, { color: colors.inkTertiary }]}>{summary}</Text>
        <Text style={[microLabel, { color: colors.inkTertiary }]}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: space[3],
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  body: {
    gap: space[2],
    paddingBottom: space[3],
  },
});
