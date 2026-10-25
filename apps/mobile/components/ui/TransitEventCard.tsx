import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  aspectGlyph,
  bodyGlyph,
} from "./glyphs";
import { colors, microLabel, sansProse, serifDisplay, space, type } from "../../theme/type";

/**
 * TransitEventCard, RN mirror of apps/web/components/ui/TransitEventCard.tsx
 * (design-system §5, ref 12.png): hairline card — mono caps date range,
 * serif title, sans prose, mono glyph footer. Glyphs derive from the event
 * data the card renders (ASH-254 AC3).
 */
export function TransitEventCard({
  dateRange,
  transit,
  aspect,
  natal,
  title,
  children,
  footer,
}: {
  dateRange: string;
  transit?: string;
  aspect?: string;
  natal?: string;
  title: string;
  children: ReactNode;
  footer?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={[microLabel, styles.dates]}>{dateRange}</Text>
      <Text style={[serifDisplay, type.s22, styles.title]}>
        {transit ? `${bodyGlyph(transit)} ` : ""}
        {title}
      </Text>
      <Text style={[sansProse, type.s15, styles.prose]}>{children}</Text>
      {(natal || footer) && (
        <View style={styles.footer}>
          {natal ? (
            <Text style={[microLabel, { color: colors.inkSecondary }]}>
              {aspect ? `${aspectGlyph(aspect)} ` : ""}
              {bodyGlyph(natal)}
            </Text>
          ) : null}
          {footer ? (
            <Text style={[microLabel, { color: colors.inkSecondary }]}>{footer}</Text>
          ) : null}
        </View>
      )}
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
    alignItems: "center",
  },
  dates: {
    color: colors.inkSecondary,
  },
  title: {
    color: colors.ink,
    textAlign: "center",
  },
  prose: {
    color: colors.ink,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
});
