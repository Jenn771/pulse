"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
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
import { AppNavbarShell } from "@/components/AppNavbar"
import { PulseLogo } from "@/components/Icons"

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
  const [sortField, setSortField] = useState<"created_at" | "status" | "url">("created_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [searchQuery, setSearchQuery] = useState("")

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

  const filteredAndSortedMonitors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const statusOrder: Record<string, number> = {
      UP: 0, SLOW: 1, DOWN: 2, PAUSED: 3, UNKNOWN: 4,
    }
    const filtered = q
      ? monitors.filter((m) => {
          const urlMatch = m.url.toLowerCase().includes(q)
          const nameMatch = m.name?.toLowerCase().includes(q) ?? false
          return urlMatch || nameMatch
        })
      : monitors

    return [...filtered].sort((a, b) => {
      let comparison = 0
      if (sortField === "status") {
        const sa = statusOrder[statusById[a.id] ?? "UNKNOWN"] ?? 4
        const sb = statusOrder[statusById[b.id] ?? "UNKNOWN"] ?? 4
        comparison = sa - sb
      } else if (sortField === "url") {
        try {
          const nameA = (a.name?.trim() || new URL(a.url).hostname).toLowerCase()
          const nameB = (b.name?.trim() || new URL(b.url).hostname).toLowerCase()
          comparison = nameA.localeCompare(nameB)
        } catch {
          comparison = a.url.localeCompare(b.url)
        }
      } else {
        comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      return sortDir === "asc" ? comparison : -comparison
    })
  }, [monitors, searchQuery, statusById, sortField, sortDir])

  function toggleSort(field: "created_at" | "status" | "url") {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <AppNavbarShell>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-medium text-white transition-colors hover:text-gray-200"
        >
          <PulseLogo />
          Pulse
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-white ring-1 ring-gray-600 transition hover:bg-gray-600"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            {avatarLetter}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 z-20 w-56 overflow-hidden rounded border border-gray-200 bg-white py-1 shadow-lg">
              <div className="px-4 py-2 text-xs font-medium uppercase text-gray-400">
                Account
              </div>
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
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </AppNavbarShell>

      <main className="mx-auto max-w-6xl space-y-7 px-6 py-8">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl text-gray-900">
              Service Monitors
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search monitors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 md:w-64"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setAddError("")
                setModalOpen(true)
              }}
              className="flex items-center gap-2 rounded bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Monitor
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Total monitors
            </p>
            <p className="mt-1 text-xl tabular-nums text-gray-900">
              {totalMonitors}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Currently up
            </p>
            <p className="mt-1 text-xl tabular-nums text-gray-900">
              {currentlyUp}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Currently down
            </p>
            <p className="mt-1 text-xl tabular-nums text-gray-900">
              {currentlyDown}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Incidents today
            </p>
            <p className="mt-1 text-xl tabular-nums text-gray-900">
              {incidentsToday}
            </p>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="table-fixed min-w-[940px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="w-24 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none"
                    onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">
                    Status
                    <span className="inline-block w-3 text-center text-gray-400">
                      {sortField === "status" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </span>
                </th>
                <th className="w-40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none"
                    onClick={() => toggleSort("url")}>
                  <span className="flex items-center gap-1">
                    Name
                    <span className="inline-block w-3 text-center text-gray-400">
                      {sortField === "url" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </span>
                </th>
                <th className="w-48 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Domain
                </th>
                <th className="w-52 min-w-[12.5rem] shrink-0 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Checks
                </th>
                <th className="w-28 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Response
                </th>
                <th className="w-28 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
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
                filteredAndSortedMonitors.map((monitor) => (
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
            className="relative w-full max-w-md rounded bg-white p-8 shadow-xl"
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
            <h2 className="text-2xl font-medium text-gray-900">New Monitor</h2>
            <p className="mt-1 mb-6 text-gray-500">
              Configure a new website to track.
            </p>
            <form onSubmit={handleAddMonitor} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-gray-400">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Production API"
                  className="w-full rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-gray-400">
                  Target URL *
                </label>
                <input
                  required
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.myapp.com"
                  className="w-full rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-gray-400">
                  Check Frequency
                </label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className="w-full rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value={1}>Every 1 minute</option>
                  <option value={5}>Every 5 minutes</option>
                  <option value={10}>Every 10 minutes</option>
                </select>
              </div>
              {addError && (
                <p className="text-xs text-red-600">{addError}</p>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 rounded bg-cyan-600 px-4 py-3 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
                >
                  {adding ? "Creating..." : "Save Monitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
