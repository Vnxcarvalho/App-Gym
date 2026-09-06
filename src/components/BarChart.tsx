// components/BarChart.tsx
//
// Gráfico de barras verticais, single-series (uma métrica ao longo do tempo).
// Sem legenda (spec: 1 série não precisa de legenda — o título do card já diz o que é).
// Barra = acento vermelho da marca (contrast validado: 4.28:1 no fundo, 3.91:1 no card).
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from "react-native";
import { COLORS } from "../constants/theme";

export type BarChartDatum = {
  id: string;
  label: string; // rótulo curto do eixo X, ex: "24/06"
  dateLabel?: string; // rótulo completo p/ tooltip, ex: "24 de junho"
  value: number;
};

type Props = {
  data: BarChartDatum[];
  unit?: string;
  color?: string;
  height?: number;
};

const MAX_BAR_WIDTH = 24; // spec: bar ≤ 24px, nunca preenche o slot inteiro
const BAR_GAP = 3; // spec: gap na cor da superfície separa barras vizinhas
const Y_AXIS_WIDTH = 30;
const GRID_STEPS = [0, 0.5, 1];

function niceMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  let step: number;
  if (residual > 5) step = 10;
  else if (residual > 2) step = 5;
  else if (residual > 1) step = 2;
  else step = 1;
  return step * magnitude;
}

export default function BarChart({ data, unit = "", color = COLORS.accent, height = 150 }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);

  if (data.length === 0) {
    return (
      <View style={[styles.emptyState, { height }]}>
        <Text style={styles.emptyText}>Sem registros ainda</Text>
      </View>
    );
  }

  const max = niceMax(Math.max(...data.map((d) => d.value)) * 1.1);
  const lastId = data[data.length - 1].id;
  const slotWidth = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.max(8, Math.min(MAX_BAR_WIDTH, slotWidth - BAR_GAP * 2));

  function handlePlotLayout(e: LayoutChangeEvent) {
    setPlotWidth(e.nativeEvent.layout.width);
  }

  return (
    <View>
      <View style={[styles.row, { height }]}>
        {/* Eixo Y — valores arredondados, único texto que carrega magnitude fora das barras */}
        <View style={styles.yAxis}>
          {GRID_STEPS.map((g) => (
            <Text key={g} style={[styles.yLabel, { bottom: g * height - 6 }]}>
              {Math.round(max * g)}
            </Text>
          ))}
        </View>

        {/* Área de plotagem */}
        <View style={styles.plot} onLayout={handlePlotLayout}>
          {GRID_STEPS.map((g) => (
            <View key={g} style={[styles.gridLine, { bottom: g * height }]} />
          ))}

          <View style={styles.barsRow}>
            {data.map((d) => {
              const barHeight = Math.max(2, (d.value / max) * height);
              const isSelected = selectedId === d.id;
              const isLast = d.id === lastId;

              return (
                <Pressable
                  key={d.id}
                  style={[styles.barSlot, { width: slotWidth }]}
                  onPress={() => setSelectedId((prev) => (prev === d.id ? null : d.id))}
                  hitSlop={4}
                >
                  {isSelected ? (
                    <View style={[styles.tooltip, { bottom: barHeight + 8 }]}>
                      <Text style={styles.tooltipValue}>
                        {d.value}
                        {unit}
                      </Text>
                      <Text style={styles.tooltipDate}>{d.dateLabel ?? d.label}</Text>
                    </View>
                  ) : isLast ? (
                    <Text style={[styles.endLabel, { bottom: barHeight + 6 }]}>
                      {d.value}
                      {unit}
                    </Text>
                  ) : null}

                  <View
                    style={[
                      styles.bar,
                      {
                        width: barWidth,
                        height: barHeight,
                        backgroundColor: isSelected ? COLORS.accentLight : color,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Eixo X */}
      <View style={styles.axisRow}>
        <View style={{ width: Y_AXIS_WIDTH }} />
        <View style={styles.plot}>
          {data.map((d) => (
            <Text key={d.id} style={[styles.axisLabel, { width: slotWidth }]} numberOfLines={1}>
              {d.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    position: "relative",
  },
  yLabel: {
    position: "absolute",
    left: 0,
    fontSize: 9,
    color: COLORS.textTertiary,
  },
  plot: {
    flex: 1,
    flexDirection: "row",
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.border, // hairline, um passo fora da superfície — recessivo
  },
  barsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  barSlot: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    // canto reto na base (nasce da baseline), spec de bar/column
  },
  endLabel: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textSecondary, // texto nunca usa a cor da série
  },
  tooltip: {
    position: "absolute",
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 68,
    zIndex: 10,
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  tooltipDate: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  axisRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  axisLabel: {
    fontSize: 9,
    color: COLORS.textTertiary,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});
