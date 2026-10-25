import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type { ConnectionView } from "@star-sign/core";
import {
  listConnectionsApi,
  requestConnectionApi,
  acceptConnectionApi,
  revokeConnectionApi,
  listPeopleApi,
  ApiPersonRow,
} from "../lib/api";
import { supabase } from "../lib/supabase";
import {
  Button,
  Input,
  ProvenanceBlock,
  ScreenHeader,
  TabBar,
} from "../../components/ui";
import {
  colors,
  microLabel,
  sansProse,
  space,
  type,
} from "../../theme/type";

/**
 * Connections (ASH-259 / 5.4): parity with the web connections flow
 * (api.md §7) — list both directions, request by user id, accept
 * (recipient-only, with the plain-language consent summary), revoke with
 * immediate effect. In-app pending badge only; push is 7.1.
 */
export default function Connections() {
  const insets = useSafeAreaInsets();
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [people, setPeople] = useState<ApiPersonRow[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [addresseeId, setAddresseeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setUserId(data.user.id);
        try {
          const [conns, ppl] = await Promise.all([
            listConnectionsApi(),
            listPeopleApi(),
          ]);
          setConnections(conns);
          setPeople(ppl);
        } catch (e) {
          setActionError(e instanceof Error ? e.message : "Could not load connections.");
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

  const nameOf = (id: string): string | null =>
    people.find((p) => p.id === id)?.display_name ?? null;

  const pending = connections.filter((c) => c.state === "requested");
  const incoming = pending.filter((c) => c.addresseeId === userId);
  const outgoing = pending.filter((c) => c.requesterId === userId);
  const active = connections.filter((c) => c.state === "accepted");

  async function request() {
    setBusy(true);
    setActionError(null);
    try {
      await requestConnectionApi(addresseeId.trim());
      setAddresseeId("");
      const conns = await listConnectionsApi();
      setConnections(conns);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not send request.");
    } finally {
      setBusy(false);
    }
  }

  async function accept(id: string) {
    setBusy(true);
    setActionError(null);
    try {
      await acceptConnectionApi(id);
      setConnections(await listConnectionsApi());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not accept.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setActionError(null);
    try {
      await revokeConnectionApi(id);
      setConnections(await listConnectionsApi());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not end connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + space[8],
          paddingHorizontal: space[5],
        }}
      >
        <ScreenHeader
          title="Connections"
          tabs={[
            { id: "day", label: "My Day" },
            { id: "week", label: "Week" },
            { id: "connections", label: "Connections" },
          ]}
          activeTab="connections"
        />

        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={[microLabel, { color: colors.inkSecondary }]}>Sign out ›</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: space[6] }} />
        ) : (
          <>
            {/* In-app pending badge (push deferred to 7.1) */}
            {incoming.length > 0 && (
              <Text style={[microLabel, styles.badge, { color: colors.bg }]}>
                {incoming.length} pending request{incoming.length === 1 ? "" : "s"}
              </Text>
            )}

            {/* Consent-before-accept (criterion: no buried scope) */}
            {incoming.length > 0 && (
              <View style={styles.section}>
                <Text style={[microLabel, { color: colors.inkTertiary, marginBottom: space[2] }]}>
                  Requests to you
                </Text>
                {incoming.map((c) => {
                  const name = nameOf(c.requesterId) ?? "Someone";
                  return (
                    <View key={c.id} style={styles.card}>
                      <Text style={[sansProse, type.s17, { color: colors.ink }]}>
                        {name} wants to connect.
                      </Text>
                      <Text style={[sansProse, type.s15, { color: colors.inkSecondary, marginTop: space[2] }]}>
                        If you accept, they see your natal chart placements —
                        signs and houses only. Not your birth date, time, or
                        place. Only {name} can see this, and they can turn it
                        off at any time.
                      </Text>
                      <View style={styles.row}>
                        <Button variant="solid" label="Accept" onPress={() => accept(c.id)} disabled={busy} />
                        <Button variant="link" label="Decline" onPress={() => revoke(c.id)} disabled={busy} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {active.length > 0 && (
              <View style={styles.section}>
                <Text style={[microLabel, { color: colors.inkTertiary, marginBottom: space[2] }]}>
                  Connected
                </Text>
                {active.map((c) => {
                  const other = c.requesterId === userId ? c.addresseeId : c.requesterId;
                  const name = nameOf(other) ?? "Your partner";
                  return (
                    <View key={c.id} style={styles.card}>
                      <Pressable
                        onPress={() => router.push({ pathname: "/partner-chart", params: { id: c.id } })}
                        style={styles.rowLink}
                      >
                        <View>
                          <Text style={[sansProse, type.s15, { color: colors.ink }]}>{name}</Text>
                          <Text style={[microLabel, { color: colors.inkSecondary, marginTop: space[1] }]}>
                            CONNECTED · VIEW CHART →
                          </Text>
                        </View>
                      </Pressable>
                      <Button variant="link" label="Disconnect" onPress={() => revoke(c.id)} disabled={busy} />
                    </View>
                  );
                })}
              </View>
            )}

            {outgoing.length > 0 && (
              <View style={styles.section}>
                <Text style={[microLabel, { color: colors.inkTertiary, marginBottom: space[2] }]}>
                  Requests you sent
                </Text>
                {outgoing.map((c) => {
                  const name = nameOf(c.addresseeId) ?? "Waiting for them";
                  return (
                    <View key={c.id} style={styles.card}>
                      <Text style={[sansProse, type.s15, { color: colors.ink }]}>
                        {name} — awaiting their yes.
                      </Text>
                      <Button variant="link" label="Withdraw" onPress={() => revoke(c.id)} disabled={busy} />
                    </View>
                  );
                })}
              </View>
            )}

            {connections.filter((c) => c.state === "requested" || c.state === "accepted").length === 0 && (
              <Text style={[sansProse, type.s15, { color: colors.inkSecondary, marginTop: space[6] }]}>
                No connections yet. When someone shares their user id, you can
                ask to connect here. Nothing is shared until you both agree.
              </Text>
            )}

            <View style={{ marginTop: space[6] }}>
              <Input
                label="Connect by user id"
                placeholder="Their user id"
                autoCapitalize="none"
                value={addresseeId}
                onChangeText={setAddresseeId}
              />
              <Button variant="solid" label="Send request" onPress={request} disabled={busy || addresseeId.trim().length === 0} />
            </View>

            {actionError ? (
              <Text style={[sansProse, type.s13, { color: colors.danger, marginTop: space[3] }]}>
                {actionError}
              </Text>
            ) : null}

            <View style={{ marginTop: space[5] }}>
              <ProvenanceBlock summary="How sharing works">
                <Text style={[microLabel, { color: colors.inkTertiary }]}>
                  A connection is a mutual yes. Accepting shares natal chart
                  placements only. Ending it takes effect immediately, for
                  both sides.
                </Text>
              </ProvenanceBlock>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
        <TabBar
          items={[
            { id: "day", label: "My Day" },
            { id: "week", label: "Week" },
            { id: "connections", label: "Connections" },
          ]}
          activeItem="connections"
          onSelect={(id) => {
            if (id === "day") router.replace("/day");
            if (id === "week") router.replace("/week");
          }}
        />
      </View>
    </View>
  );
}

async function signOut() {
  await supabase.auth.signOut();
  router.replace("/login");
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  signOut: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: space[2],
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.ink,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    marginTop: space[4],
    overflow: "hidden",
  },
  section: {
    marginTop: space[5],
    gap: space[3],
  },
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space[5],
    gap: space[3],
  },
  row: {
    flexDirection: "row",
    gap: space[5],
    alignItems: "center",
  },
  rowLink: {
    minHeight: 44,
    justifyContent: "center",
  },
  tabBar: {
    backgroundColor: colors.bg,
  },
});
