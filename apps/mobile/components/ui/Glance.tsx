import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, microLabel, sansProse, serifDisplay, space, type } from "../../theme/type";

export function Glance({
  label = "Today at a glance",
  headline,
  children,
}: {
  label?: string;
  headline: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={[microLabel, styles.label]}>{label}</Text>
      <Text style={[serifDisplay, type.s28, styles.headline]}>{headline}</Text>
      <Text style={[sansProse, type.s17, styles.prose]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: "transparent",
    padding: space[5],
    gap: space[3],
  },
  label: {
    color: colors.inkTertiary,
  },
  headline: {
    color: colors.ink,
  },
  prose: {
    color: colors.ink,
  },
});
