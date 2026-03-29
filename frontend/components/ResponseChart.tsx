"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Check = {
  id: number
  checked_at: string
  status: string
  response_time_ms: number | null
}

type Props = {
  checks: Check[]
}

export default function ResponseChart({ checks }: Props) {
  const data = [...checks]
    .filter((c) => c.response_time_ms != null)
    .sort(
      (a, b) =>
        new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
    )
    .map((c, index) => ({
      index,
      at: new Date(c.checked_at).toLocaleString(),
      shortTime: new Date(c.checked_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      ms: c.response_time_ms as number,
    }))

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No response time data in this window.
      </p>
    )
  }

  return (
    <div style={{ height: 256, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis
            dataKey="index"
            tickFormatter={(v: number) => data[v]?.shortTime ?? ""}
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fontSize: 11 }}
          />
          <YAxis width={56} tick={{ fontSize: 12 }} unit=" ms" domain={["auto", "auto"]} />
          <Tooltip
            formatter={(value) => [
              typeof value === "number" ? `${value} ms` : String(value ?? "—"),
              "Response time",
            ]}
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as { at?: string })?.at ?? ""
            }
          />
          <Line
            type="monotone"
            dataKey="ms"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
