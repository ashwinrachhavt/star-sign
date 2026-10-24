import { StyleSheet, Text, View } from "react-native";
import { colors, microLabel, space } from "../../theme/type";

export function LifeAreaRow({ area, state }: { area: string; state: string }) {
  return (
    <View style={styles.row}>
      <Text style={[microLabel, { color: colors.ink }]}>{area}</Text>
      <Text style={[microLabel, { color: colors.inkSecondary }]}>{state}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
});
