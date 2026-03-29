"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getMonitors, createMonitor, deleteMonitor, pauseMonitor, logout } from "@/lib/api"
import MonitorCard from "@/components/MonitorCard"

type Monitor = {
  id: number
  url: string
  interval_minutes: number
  is_active: boolean
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Add monitor form state
  const [url, setUrl] = useState("")
  const [interval, setInterval] = useState(5)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState("")

  useEffect(() => {
    // Check if logged in
    if (!localStorage.getItem("access_token")) {
      router.push("/")
      return
    }
    loadMonitors()
  }, [])

  async function loadMonitors() {
    try {
      const data = await getMonitors()
      setMonitors(data)
    } catch {
      setError("Failed to load monitors")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddMonitor(e: React.FormEvent) {
    e.preventDefault()
    setAddError("")
    setAdding(true)
    try {
      const newMonitor = await createMonitor(url, interval)
      setMonitors((prev) => [newMonitor, ...prev])
      setUrl("")
      setInterval(5)
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
    } catch {
      setError("Failed to delete monitor")
    }
  }

  async function handlePause(id: number) {
    try {
      const updated = await pauseMonitor(id)
      setMonitors((prev) => prev.map((m) => m.id === id ? updated : m))
    } catch {
      setError("Failed to update monitor")
    }
  }

  const totalMonitors = monitors.length
  const currentlyUp = monitors.filter((m) => m.is_active).length
  const currentlyDown = monitors.filter((m) => !m.is_active).length
  const incidentsToday = 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0" aria-hidden />
          Pulse
        </h1>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm text-gray-500">Total monitors</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">
              {totalMonitors}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm text-gray-500">Currently up</p>
            <p className="text-2xl font-semibold text-green-600 mt-1 tabular-nums">
              {currentlyUp}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm text-gray-500">Currently down</p>
            <p className="text-2xl font-semibold text-red-600 mt-1 tabular-nums">
              {currentlyDown}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm text-gray-500">Incidents today</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1 tabular-nums">
              {incidentsToday}
            </p>
          </div>
        </div>

        <details className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 group">
          <summary className="text-base font-medium text-gray-900 cursor-pointer list-none flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <span>Add a monitor</span>
            <span className="text-sm text-gray-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <form onSubmit={handleAddMonitor} className="mt-6 flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm text-gray-500 mb-1">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-sm text-gray-500 mb-1">
                Interval
              </label>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 min</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 shrink-0"
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </form>
          {addError && (
            <p className="text-red-600 text-sm mt-3">{addError}</p>
          )}
        </details>

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        {monitors.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-lg text-gray-600">No monitors yet</p>
            <p className="text-sm text-gray-500 mt-1">Add a URL above to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {monitors.map((monitor) => (
              <MonitorCard
                key={monitor.id}
                monitor={monitor}
                onDelete={handleDelete}
                onPause={handlePause}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
