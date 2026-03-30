"use client"

import { useMemo } from "react"
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

const MAX_CHART_POINTS = 400

function downsampleEvenly<T>(arr: T[], max: number): T[] {
  if (arr.length === 0) return []
  if (arr.length <= max) return arr
  const out: T[] = []
  const last = arr.length - 1
  for (let i = 0; i < max; i++) {
    out.push(arr[Math.round((i / (max - 1)) * last)])
  }
  return out
}

export default function ResponseChart({ checks }: Props) {
  const data = useMemo(() => {
    const sorted = [...checks]
      .filter((c) => c.response_time_ms != null)
      .sort(
        (a, b) =>
          new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
      )
    const sampled = downsampleEvenly(sorted, MAX_CHART_POINTS)
    return sampled.map((c, index) => ({
      index,
      at: new Date(c.checked_at).toLocaleString(),
      shortTime: new Date(c.checked_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      ms: c.response_time_ms as number,
      status: String(c.status),
    }))
  }, [checks])

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No response time data in this window.
      </p>
    )
  }

  return (
    <div style={{ height: 256, width: "100%", minHeight: 256 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis
            dataKey="index"
            tickFormatter={(v: number) =>
              data[Math.min(v, data.length - 1)]?.shortTime ?? ""
            }
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fontSize: 11 }}
          />
          <YAxis width={56} tick={{ fontSize: 12 }} unit=" ms" domain={["auto", "auto"]} />
          <Tooltip
            formatter={(value, _name, item) => {
              const payload = item?.payload as
                | { status?: string }
                | undefined
              const status = payload?.status
              const ms =
                typeof value === "number" ? `${Math.round(value)} ms` : "—"
              return [
                status ? `${ms} (${status})` : ms,
                "Response time",
              ]
            }}
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as { at?: string })?.at ?? ""
            }
          />
          <Line
            type="monotone"
            dataKey="ms"
            stroke="#0891b2"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
