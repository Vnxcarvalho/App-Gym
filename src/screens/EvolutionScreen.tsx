// screens/EvolutionScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import { MUSCLE_GROUP_LABELS } from "../constants/muscleGroups";
import BarChart, { BarChartDatum } from "../components/BarChart";
import { useAdmin } from "../context/AdminContext";
import { useResponsive } from "../hooks/useResponsive";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullIndicator from "../components/PullIndicator";
import { fetchLoadProgression, ExerciseProgression } from "../lib/progressionApi";

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

// weekStart vem como "YYYY-MM-DD" (segunda-feira) — parseia como data local pra
// não deslizar um dia por causa de fuso (new Date("YYYY-MM-DD") lê como UTC).
function parseDateOnly(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatWeekShort(iso: string) {
  const d = parseDateOnly(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatWeekLong(iso: string) {
  const d = parseDateOnly(iso);
  const label = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(d);
  return `Semana de ${label}`;
}

function computeDelta(history: BarChartDatum[]) {
  if (history.length < 2) return null;
  const first = history[0].value;
  const last = history[history.length - 1].value;
  return Math.round((last - first) * 10) / 10;
}

function formatDelta(delta: number, unit: string) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}${unit}`;
}

// ---------------------------------------------------------
// Stat tile (label + valor + delta)
// ---------------------------------------------------------

function StatTile({
  label,
  value,
  delta,
  deltaGood,
}: {
  label: string;
  value: string;
  delta?: string | null;
  deltaGood?: boolean;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {delta != null && (
        <Text style={[styles.statDelta, deltaGood && { color: COLORS.success }]}>{delta}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------
// Tabela de histórico (fallback acessível, sem depender do gráfico)
// ---------------------------------------------------------

function HistoryTable({ data, unit }: { data: BarChartDatum[]; unit: string }) {
  return (
    <View style={styles.table}>
      {[...data].reverse().map((row) => (
        <View key={row.id} style={styles.tableRow}>
          <Text style={styles.tableDate}>{row.dateLabel ?? row.label}</Text>
          <Text style={styles.tableValue}>
            {row.value}
            {unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ExpandableSection({
  title,
  data,
  unit,
}: {
  title: string;
  data: BarChartDatum[];
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable style={styles.expandRow} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.expandText}>{title}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={COLORS.textSecondary}
        />
      </Pressable>
      {open && <HistoryTable data={data} unit={unit} />}
    </View>
  );
}

// ---------------------------------------------------------
// Componente principal
// ---------------------------------------------------------

export default function EvolutionScreen() {
  const { effectiveUserId } = useAdmin();
  const { isWide, contentMaxWidth } = useResponsive();

  const [progression, setProgression] = useState<ExerciseProgression[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!effectiveUserId) return;
    const data = await fetchLoadProgression(effectiveUserId);
    setProgression(data);
    setSelectedExerciseId((prev) =>
      prev && data.some((e) => e.exerciseId === prev) ? prev : data[0]?.exerciseId ?? null
    );
  }, [effectiveUserId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((err) => console.warn("Falha ao carregar progressão de carga:", err.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const { pullAnim, handlers: pullHandlers } = usePullToRefresh(load);

  const selected = progression.find((e) => e.exerciseId === selectedExerciseId) ?? null;

  const chartData: BarChartDatum[] = useMemo(
    () =>
      (selected?.weeks ?? []).map((w) => ({
        id: w.weekStart,
        label: formatWeekShort(w.weekStart),
        dateLabel: formatWeekLong(w.weekStart),
        value: w.topWeightKg,
      })),
    [selected]
  );

  const delta = useMemo(() => computeDelta(chartData), [chartData]);
  const currentLoad = chartData[chartData.length - 1]?.value ?? 0;
  const weeksTracked = selected?.weeks.length ?? 0;

  return (
    <View style={styles.container}>
      <PullIndicator pullAnim={pullAnim} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContentOuter}
        {...pullHandlers}
      >
        <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
          <Text style={styles.screenTitle}>Evolução</Text>

          <View style={isWide ? styles.cardsRow : styles.cardsColumn}>
            {/* ---------------- Progressão de carga ---------------- */}
            <View style={[styles.card, isWide && styles.cardFlex]}>
              <Text style={styles.cardTitle}>Progressão de carga</Text>
              <Text style={styles.cardSubtitle}>
                Cada barra é uma semana treinada — o valor é a maior carga levantada nesse
                exercício na semana.
              </Text>

              {loading ? (
                <View style={styles.chartLoading}>
                  <ActivityIndicator color={COLORS.accent} />
                </View>
              ) : progression.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="barbell-outline" size={28} color={COLORS.textTertiary} />
                  <Text style={styles.emptyTitle}>Nenhum treino finalizado ainda</Text>
                  <Text style={styles.emptyText}>
                    Inicie um treino, marque as séries e toque em "Finalizar". A cada semana
                    treinada, a carga de cada exercício vira um ponto no gráfico.
                  </Text>
                </View>
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsRow}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {progression.map((ex) => {
                      const active = ex.exerciseId === selectedExerciseId;
                      return (
                        <Pressable
                          key={ex.exerciseId}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setSelectedExerciseId(ex.exerciseId)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {ex.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {selected && (
                    <Text style={styles.selectedMeta}>
                      {MUSCLE_GROUP_LABELS[selected.muscleGroup] ?? selected.muscleGroup} ·{" "}
                      {weeksTracked} semana{weeksTracked !== 1 ? "s" : ""} registrada
                      {weeksTracked !== 1 ? "s" : ""}
                    </Text>
                  )}

                  <View style={styles.statsRow}>
                    <StatTile label="Carga atual" value={`${currentLoad}kg`} />
                    <StatTile
                      label="Desde o início"
                      value={delta != null ? formatDelta(delta, "kg") : "—"}
                      delta={delta != null && delta > 0 ? "progresso" : null}
                      deltaGood
                    />
                  </View>

                  <BarChart data={chartData} unit="kg" />

                  {chartData.length > 0 && (
                    <ExpandableSection
                      title="Ver histórico completo"
                      data={chartData}
                      unit="kg"
                    />
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContentOuter: {
    alignItems: "center",
  },
  content: {
    width: "100%",
    padding: 24,
    paddingBottom: 48,
    gap: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 20,
    alignItems: "flex-start",
  },
  cardsColumn: {
    gap: 20,
  },
  cardFlex: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 16,
  },
  chipsRow: {
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.accent,
  },
  selectedMeta: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statTile: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  statDelta: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chartLoading: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: "center",
    lineHeight: 17,
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  expandText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  table: {
    marginTop: 10,
    gap: 2,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  tableDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tableValue: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});
