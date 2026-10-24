import { Pressable, StyleSheet, Text } from "react-native";
import { colors, microLabel, space } from "../../theme/type";

export function Button({
  variant = "link",
  label,
  onPress,
  disabled,
}: {
  variant?: "link" | "solid";
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        variant === "solid" ? styles.solid : styles.link,
        pressed && !disabled && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text style={[microLabel, { fontSize: 13 }, variant === "solid" ? styles.solidText : styles.linkText]}>
        {label}
        {variant === "link" ? " ›" : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  linkText: {
    color: colors.ink,
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
  },
  solid: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
    paddingHorizontal: space[5],
  },
  solidText: {
    color: colors.bg,
  },
  pressed: {
    opacity: 0.7,
  },
});
