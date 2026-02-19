import type { MetricDataPoint } from "@/types/k8s";

interface MetricsChartProps {
  timeseries: MetricDataPoint[];
  metric: "cpu" | "memory";
  width?: number;
  height?: number;
}

function formatValue(metric: "cpu" | "memory", value: number): string {
  if (metric === "cpu") {
    if (value < 0.001) return `${(value * 1_000_000).toFixed(0)}µ`;
    if (value < 1) return `${(value * 1000).toFixed(0)}m`;
    return `${value.toFixed(2)}`;
  }
  // memory
  if (value < 1024) return `${value.toFixed(0)}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)}Ki`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(0)}Mi`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)}Gi`;
}

export function MetricsChart({
  timeseries,
  metric,
  width = 280,
  height = 80,
}: MetricsChartProps) {
  if (timeseries.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const values = timeseries.map((p) =>
    metric === "cpu" ? p.cpu_cores : p.memory_bytes,
  );
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const currentValue = values[values.length - 1];

  const padding = { top: 4, right: 4, bottom: 4, left: 4 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const color = metric === "cpu" ? "#3b82f6" : "#8b5cf6";
  const fillColor = metric === "cpu" ? "#3b82f620" : "#8b5cf620";

  const points = timeseries.map((_, i) => {
    const x = padding.left + (i / (timeseries.length - 1)) * chartW;
    const y =
      padding.top + chartH - ((values[i] - minVal) / range) * chartH;
    return { x, y };
  });

  const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        <path d={areaPath} fill={fillColor} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
      <div
        className="absolute top-1 right-1 text-[10px] font-mono font-medium"
        style={{ color }}
      >
        {formatValue(metric, currentValue)}
      </div>
    </div>
  );
}

export function MetricsSparkline({
  timeseries,
  metric,
  width = 100,
  height = 24,
}: MetricsChartProps) {
  if (timeseries.length < 2) return null;

  const values = timeseries.map((p) =>
    metric === "cpu" ? p.cpu_cores : p.memory_bytes,
  );
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const color = metric === "cpu" ? "#3b82f6" : "#8b5cf6";

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - minVal) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1} />
    </svg>
  );
}
