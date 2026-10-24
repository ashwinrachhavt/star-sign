import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, sansProse, serifDisplay, space, type } from "../../theme/type";

export function PlacementCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={[serifDisplay, type.s28, styles.title]}>{title}</Text>
      <Text style={[sansProse, type.s17, styles.prose]}>{children}</Text>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: "transparent",
    padding: space[5],
    gap: space[4],
  },
  title: {
    color: colors.ink,
  },
  prose: {
    color: colors.ink,
  },
});
