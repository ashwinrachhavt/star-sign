import { StyleSheet, Text, View } from "react-native";
import { colors, microLabel, serifDisplay, space, type } from "../../theme/type";

export function ScreenHeader({
  title,
  tabs,
  activeTab,
}: {
  title: string;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
}) {
  return (
    <View>
      <Text style={[styles.title, serifDisplay, type.s28]}>{title}</Text>
      {tabs && tabs.length > 0 && (
        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <View key={tab.id} style={[styles.tab, tab.id === activeTab && styles.tabActive]}>
              <Text
                style={[
                  microLabel,
                  { color: tab.id === activeTab ? colors.ink : colors.inkSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    textAlign: "center",
    paddingVertical: space[4],
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.ink,
  },
});
