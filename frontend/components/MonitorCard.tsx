"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { hostnameFromUrl } from "@/lib/urlUtils"
import { statusToWord, statusWordClass } from "@/lib/statusDisplay"

export type Monitor = {
  id: number
  name?: string | null
  url: string
  interval_minutes: number
  is_active: boolean
  created_at: string
}

export type CheckRow = {
  id: number
  checked_at: string
  status: string
  response_time_ms: number | null
}

type Props = {
  monitor: Monitor
  status?: string
  responseMs?: number | null
  uptimePercent?: number | null
  checks?: CheckRow[]
  onDelete: (id: number) => void
  onPause: (id: number) => void
}

function barClass(status: string): string {
  switch (status.toUpperCase()) {
    case "UP":
      return "bg-green-500"
    case "DOWN":
      return "bg-red-500"
    case "SLOW":
      return "bg-amber-400"
    default:
      return "bg-gray-300"
  }
}

function SparklineBars({ checks }: { checks: CheckRow[] }) {
  const sorted = [...checks].sort(
    (a, b) =>
      new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
  )
  const slice = sorted.slice(-40)

  if (slice.length === 0) {
    return (
      <div className="flex h-6 min-w-[7rem] items-center justify-start">
        <span className="text-xs text-gray-400">—</span>
      </div>
    )
  }

  return (
    <div className="flex h-6 min-w-[7rem] max-w-[10rem] items-end gap-0.5">
      {slice.map((c) => (
        <div
          key={c.id}
          className={`h-6 w-1 shrink-0 rounded-sm ${barClass(c.status)}`}
          title={c.status}
        />
      ))}
    </div>
  )
}

function formatResponse(ms: number | null | undefined): string {
  if (ms == null) return "—"
  return `${Math.round(ms)} ms`
}

function formatUptime(pct: number | null | undefined): string {
  if (pct == null) return "—"
  return `${pct}%`
}

export default function MonitorCard({
  monitor,
  status = "UNKNOWN",
  responseMs,
  uptimePercent,
  checks = [],
  onDelete,
  onPause,
}: Props) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuCoords, setMenuCoords] = useState<{
    top: number
    left: number
  } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!menuOpen || !menuButtonRef.current) {
      setMenuCoords(null)
      return
    }
    const rect = menuButtonRef.current.getBoundingClientRect()
    const w = 128
    setMenuCoords({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - w),
    })
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function updatePosition() {
      if (!menuButtonRef.current) return
      const rect = menuButtonRef.current.getBoundingClientRect()
      const w = 128
      setMenuCoords({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - w),
      })
    }
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(e: MouseEvent) {
      const t = e.target as Node
      if (menuRef.current?.contains(t)) return
      if (menuButtonRef.current?.contains(t)) return
      setMenuOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [menuOpen])

  const host = hostnameFromUrl(monitor.url)
  const displayName = monitor.name?.trim() || host

  return (
    <tr
      className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50/90"
      onClick={() => router.push(`/monitors/${monitor.id}`)}
    >
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        <span
          className={`text-sm font-semibold capitalize ${statusWordClass(status)}`}
        >
          {statusToWord(status)}
        </span>
      </td>
      <td className="max-w-[14rem] px-4 py-3 align-middle">
        <div className="font-medium text-gray-900 truncate" title={displayName}>
          {displayName}
        </div>
      </td>
      <td className="px-4 py-3 align-middle text-gray-800">
        <span className="text-sm">{host}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <SparklineBars checks={checks} />
      </td>
      <td className="px-4 py-3 align-middle whitespace-nowrap text-sm font-medium tabular-nums text-gray-900">
        {formatResponse(responseMs ?? null)}
      </td>
      <td className="px-4 py-3 align-middle whitespace-nowrap text-sm font-medium tabular-nums text-gray-900">
        {formatUptime(uptimePercent ?? null)}
      </td>
      <td
        className="px-2 py-3 align-middle text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={menuButtonRef}
          type="button"
          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Monitor actions"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((o) => !o)
          }}
        >
          <span className="text-lg font-bold leading-none">⋮</span>
        </button>
        {menuOpen &&
          menuCoords &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[100] w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              style={{ top: menuCoords.top, left: menuCoords.left }}
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setMenuOpen(false)
                  onPause(monitor.id)
                }}
              >
                {monitor.is_active ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(monitor.id)
                }}
              >
                Delete
              </button>
            </div>,
            document.body
          )}
      </td>
    </tr>
  )
}
