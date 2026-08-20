import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";

import { useTheme } from "@/lib/theme";

interface ScoreRingProps {
  score: number;
  size?: number;
  label?: string;
}

function ringColors(score: number): readonly [string, string] {
  if (score >= 80) {
    return ["#16A34A", "#4ADE80"];
  }
  if (score >= 60) {
    return ["#38BDF8", "#5B5BF0"];
  }
  if (score >= 40) {
    return ["#F59E0B", "#FB923C"];
  }
  return ["#EF4444", "#FB7185"];
}

export default function ScoreRing({ score, size = 110, label }: ScoreRingProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const [start, end] = ringColors(score);
  const strokeWidth = size * 0.085;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={start} />
            <Stop offset="1" stopColor={end} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={[styles.score, { color: colors.textPrimary }]}>{score}</Text>
        {label !== undefined && (
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
