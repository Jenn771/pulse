"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getMonitors,
  createMonitor,
  deleteMonitor,
  pauseMonitor,
  logout,
  getMe,
  getMonitorStatus,
  getChecks,
  getUptime,
} from "@/lib/api"
import MonitorCard, { type CheckRow } from "@/components/MonitorCard"
import { AppNavbarShell, PulseBrandLink } from "@/components/AppNavbar"

type Monitor = {
  id: number
  name?: string | null
  url: string
  interval_minutes: number
  is_active: boolean
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const [statusById, setStatusById] = useState<Record<number, string>>({})
  const [checksById, setChecksById] = useState<Record<number, CheckRow[]>>({})
  const [cardStats, setCardStats] = useState<
    Record<number, { responseMs: number | null; uptime: number | null }>
  >({})

  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [interval, setInterval] = useState(5)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState("")

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.push("/")
      return
    }
    loadMonitors()
    getMe().then((u) => {
      if (u?.email) setUserEmail(u.email as string)
    })
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

  useEffect(() => {
    if (!modalOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [modalOpen])

  async function loadMonitors() {
    try {
      const data = await getMonitors()
      if (data.length === 0) {
        setStatusById({})
        setMonitors(data)
      } else {
        const statusResults = await Promise.all(
          data.map((m: Monitor) =>
            getMonitorStatus(m.id).catch(() => ({ status: "UNKNOWN" }))
          )
        )
        const statusMap: Record<number, string> = {}
        data.forEach((m: Monitor, i: number) => {
          const res = statusResults[i] as { status: string }
          statusMap[m.id] = String(res.status)
        })
        setStatusById(statusMap)
        setMonitors(data)
      }
    } catch {
      setError("Failed to load monitors")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (monitors.length === 0) {
      setStatusById({})
      setCardStats({})
      setChecksById({})
      return
    }
    let cancelled = false
    ;(async () => {
      const results = await Promise.all(
        monitors.map(async (m) => {
          try {
            const [checksRes, uptimeRes] = await Promise.all([
              getChecks(m.id, 24),
              getUptime(m.id, 30),
            ])
            const latest = checksRes[0]
            return {
              id: m.id,
              checks: checksRes as CheckRow[],
              stats: {
                responseMs: latest?.response_time_ms ?? null,
                uptime: uptimeRes.uptime_percent,
              },
            }
          } catch {
            return {
              id: m.id,
              checks: [] as CheckRow[],
              stats: { responseMs: null, uptime: null },
            }
          }
        })
      )
      if (cancelled) return
      const stats: Record<number, { responseMs: number | null; uptime: number | null }> =
        {}
      const checks: Record<number, CheckRow[]> = {}
      for (const r of results) {
        stats[r.id] = r.stats
        checks[r.id] = r.checks
      }
      setCardStats(stats)
      setChecksById(checks)
    })()
    return () => {
      cancelled = true
    }
  }, [monitors])

  async function handleAddMonitor(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddError("")
    setAdding(true)
    try {
      const newMonitor = await createMonitor(url, interval, name)
      try {
        const s = await getMonitorStatus(newMonitor.id)
        setStatusById((prev) => ({
          ...prev,
          [newMonitor.id]: String(s.status),
        }))
      } catch {
        setStatusById((prev) => ({
          ...prev,
          [newMonitor.id]: "UNKNOWN",
        }))
      }
      setMonitors((prev) => [newMonitor, ...prev])
      setName("")
      setUrl("")
      setInterval(5)
      setModalOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) setAddError(err.message)
      else setAddError("Failed to add monitor")
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteMonitor(id)
      setMonitors((prev) => prev.filter((m) => m.id !== id))
      setStatusById((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setCardStats((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setChecksById((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
    } catch {
      setError("Failed to delete monitor")
    }
  }

  async function handlePause(id: number) {
    try {
      const updated = await pauseMonitor(id)
      setMonitors((prev) => prev.map((m) => (m.id === id ? updated : m)))
      try {
        const [statusRes, checksRes, uptimeRes] = await Promise.all([
          getMonitorStatus(id),
          getChecks(id, 24),
          getUptime(id, 30),
        ])
        const latest = checksRes[0]
        setStatusById((prev) => ({ ...prev, [id]: String(statusRes.status) }))
        setChecksById((prev) => ({ ...prev, [id]: checksRes as CheckRow[] }))
        setCardStats((prev) => ({
          ...prev,
          [id]: {
            responseMs: latest?.response_time_ms ?? null,
            uptime: uptimeRes.uptime_percent,
          },
        }))
      } catch {
        /* ignore */
      }
    } catch {
      setError("Failed to update monitor")
    }
  }

  const totalMonitors = monitors.length
  const currentlyUp = monitors.filter((m) => m.is_active).length
  const currentlyDown = monitors.filter((m) => !m.is_active).length
  const incidentsToday = 0

  const avatarLetter =
    userEmail && userEmail.length > 0 ? userEmail[0].toUpperCase() : "U"

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavbarShell>
        <PulseBrandLink href="/dashboard" />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-200"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            {avatarLetter}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 z-20 overflow-hidden shadow-lg">
              <p className="px-4 py-2 text-sm text-gray-700 truncate" title={userEmail ?? ""}>
                {userEmail ?? "—"}
              </p>
              <hr className="border-gray-100" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </AppNavbarShell>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold text-gray-900">All monitors</h1>
          <button
            type="button"
            onClick={() => {
              setAddError("")
              setModalOpen(true)
            }}
            className="shrink-0 self-start bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            + Add monitor
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-stone-100 rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Total monitors</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">
              {totalMonitors}
            </p>
          </div>
          <div className="bg-stone-100 rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Currently up</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">
              {currentlyUp}
            </p>
          </div>
          <div className="bg-stone-100 rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Currently down</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">
              {currentlyDown}
            </p>
          </div>
          <div className="bg-stone-100 rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-600">Incidents today</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">
              {incidentsToday}
            </p>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-[880px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/90 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Domain
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Checks
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Response
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Uptime 30d
                </th>
                <th className="w-12 px-2 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {monitors.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-14 text-center text-gray-500"
                  >
                    <p className="text-base text-gray-600">No monitors yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Use &quot;+ Add monitor&quot; to get started
                    </p>
                  </td>
                </tr>
              ) : (
                monitors.map((monitor) => (
                  <MonitorCard
                    key={monitor.id}
                    monitor={monitor}
                    status={statusById[monitor.id] ?? "UNKNOWN"}
                    responseMs={cardStats[monitor.id]?.responseMs}
                    uptimePercent={cardStats[monitor.id]?.uptime}
                    checks={checksById[monitor.id] ?? []}
                    onDelete={handleDelete}
                    onPause={handlePause}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-lg bg-white p-6 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 text-gray-500 hover:text-gray-800"
              aria-label="Close"
              onClick={() => setModalOpen(false)}
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold text-gray-900 pr-8">Add a monitor</h2>
            <form onSubmit={handleAddMonitor} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production API"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder="https://example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interval
                </label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value={1}>1 min</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                </select>
              </div>
              {addError && (
                <p className="text-red-600 text-sm">{addError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
                >
                  {adding ? "Adding..." : "Add monitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
