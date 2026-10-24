import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, microLabel, space } from "../../theme/type";

export function TabBar({
  items,
  activeItem,
  onSelect,
}: {
  items: { id: string; label: string }[];
  activeItem?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <View style={styles.bar}>
      {items.map((item) => {
        const active = item.id === activeItem;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect?.(item.id)}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[microLabel, { color: active ? colors.ink : colors.inkSecondary }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: space[1],
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
});
