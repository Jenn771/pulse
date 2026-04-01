"use client"

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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
      return "bg-green-500 hover:bg-green-600"
    case "DOWN":
      return "bg-red-500 hover:bg-red-600"
    case "SLOW":
      return "bg-amber-400 hover:bg-amber-500"
    default:
      return "bg-gray-300 hover:bg-gray-400"
  }
}

function statusDotClass(status: string): string {
  switch (status.toUpperCase()) {
    case "UP":
      return "bg-green-400"
    case "DOWN":
      return "bg-red-400"
    case "SLOW":
      return "bg-amber-400"
    default:
      return "bg-gray-400"
  }
}

const SPARK_BAR_PX = 4
const SPARK_GAP_PX = 1
const SPARK_MAX_POINTS = 40

function SparklineBars({ checks }: { checks: CheckRow[] }) {
  const [tip, setTip] = useState<{
    check: CheckRow
    left: number
    top: number
  } | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [capacity, setCapacity] = useState(SPARK_MAX_POINTS)

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setTip(null), 120)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    function update() {
      const node = containerRef.current
      if (!node) return
      const w = node.getBoundingClientRect().width
      if (w < 1) return
      const step = SPARK_BAR_PX + SPARK_GAP_PX
      const n = Math.max(
        1,
        Math.min(SPARK_MAX_POINTS, Math.floor((w + SPARK_GAP_PX) / step))
      )
      setCapacity(n)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const slice = useMemo(() => {
    const sorted = [...checks].sort(
      (a, b) =>
        new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
    )
    const take = Math.min(SPARK_MAX_POINTS, capacity, sorted.length)
    return sorted.slice(-take)
  }, [checks, capacity])

  if (slice.length === 0) {
    return (
      <div className="flex h-6 min-w-[7rem] items-center justify-start">
        <span className="text-xs text-gray-400">—</span>
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className="h-6 w-full min-w-0 overflow-hidden"
      >
        <div className="flex h-6 items-end justify-start gap-px">
          {slice.map((bar) => (
            <div
              key={bar.id}
              className="relative w-1 shrink-0"
              onMouseEnter={(e) => {
                cancelClose()
                const r = e.currentTarget.getBoundingClientRect()
                setTip({
                  check: bar,
                  left: r.left + r.width / 2,
                  top: r.top,
                })
              }}
              onMouseLeave={scheduleClose}
            >
              <div
                className={`h-6 w-1 cursor-default transition-colors ${barClass(bar.status)}`}
              />
            </div>
          ))}
        </div>
      </div>
      {tip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[200]"
            style={{
              left: tip.left,
              top: tip.top,
              transform: "translate(-50%, calc(-100% - 0.35rem))",
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="min-w-[9rem] rounded-md border border-gray-200 bg-stone-100 px-3 py-2.5 text-left shadow-lg ring-1 ring-cyan-600/15">
              <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-700">
                {new Date(tip.check.checked_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>

              <p className="mt-1 text-lg font-medium tabular-nums tracking-tight text-gray-900">
                {tip.check.response_time_ms != null
                  ? `${Math.round(tip.check.response_time_ms)}`
                  : "—"}
                <span className="ml-1 text-sm font-medium text-gray-500">ms</span>
              </p>

              <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(
                    tip.check.status
                  )}`}
                  aria-hidden
                />
                <span className="text-xs font-medium capitalize text-gray-700">
                  {tip.check.status.toLowerCase()}
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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
      className="cursor-pointer border-b border-gray-100 last:border-0 transition-colors hover:bg-slate-50"
      onClick={() => router.push(`/monitors/${monitor.id}`)}
    >
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        <span
          className={`text-sm font-medium capitalize ${statusWordClass(status)}`}
        >
          {statusToWord(status)}
        </span>
      </td>
      <td className="max-w-[10rem] min-w-0 px-4 py-3 align-middle">
        <div
          className="truncate font-medium text-gray-900"
          title={displayName}
        >
          {displayName}
        </div>
      </td>
      <td className="max-w-[12rem] min-w-0 px-4 py-3 align-middle text-gray-700">
        <span className="block truncate text-sm" title={host}>
          {host}
        </span>
      </td>
      <td className="min-w-0 max-w-[min(100%,11rem)] px-4 py-3 align-middle">
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
          className="rounded p-2 text-gray-700 hover:bg-gray-100"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Monitor actions"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((o) => !o)
          }}
        >
          <span className="text-lg font-medium leading-none">⋮</span>
        </button>
        {menuOpen &&
          menuCoords &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[100] w-32 rounded border border-gray-200 bg-white py-1 shadow-lg"
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
                  setConfirmingDelete(true)
                }}
              >
                Delete
              </button>
            </div>,
            document.body
          )}
        {confirmingDelete &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setConfirmingDelete(false)}
            >
              <div
                className="w-full max-w-sm rounded border border-gray-200 bg-white p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-medium text-gray-900">
                  Delete monitor
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-gray-700">
                    {monitor.name?.trim() || new URL(monitor.url).hostname}
                  </span>
                  ? This will remove all checks, alerts, and analyses. This
                  cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false)
                      onDelete(monitor.id)
                    }}
                    className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </td>
    </tr>
  )
}
