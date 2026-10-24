import { TextInput, StyleSheet, Text, View } from "react-native";
import { colors, microLabel, sansProse, space } from "../../theme/type";

export function Input({
  label,
  chip,
  ...props
}: {
  label: string;
  chip?: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={[microLabel, styles.label]}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={[sansProse, styles.input]}
          placeholderTextColor={colors.inkSecondary}
          {...props}
        />
        {chip && (
          <Text style={[microLabel, styles.chip]}>{chip}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space[2],
  },
  label: {
    color: colors.inkSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
  },
  input: {
    flex: 1,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    paddingVertical: space[3],
    fontSize: 17,
    minHeight: 44,
  },
  chip: {
    color: colors.inkSecondary,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: space[1],
    paddingHorizontal: space[2],
  },
});
