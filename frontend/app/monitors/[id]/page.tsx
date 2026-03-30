"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  getMonitor,
  getChecks,
  getUptime,
  getAlerts,
  analyzeMonitor,
  getAnalyses,
  getMonitorStatus,
} from "@/lib/api"
import { hostnameFromUrl, fullUrlFromMonitor } from "@/lib/urlUtils"
import { statusToWord, statusWordClass } from "@/lib/statusDisplay"
import ResponseChart from "@/components/ResponseChart"
import AnalysisHistory from "@/components/AnalysisHistory"
import { AppNavbarShell, PulseBrandLink } from "@/components/AppNavbar"

type Monitor = {
  id: number
  name?: string | null
  url: string
  interval_minutes: number
  is_active: boolean
}

type Check = {
  id: number
  checked_at: string
  status: string
  response_time_ms: number | null
}

type Alert = {
  id: number
  triggered_at: string
  resolved_at: string | null
  type: string
  response_time_ms?: number | null
}

type Analysis = {
  id: number
  monitor_id: number
  created_at: string
  summary_text: string
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const sec = Math.floor(diff / 1000)
  if (sec < 0) return "just now"
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

export default function MonitorDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const monitorId = Number(id)

  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [checks, setChecks] = useState<Check[]>([])
  const [uptime, setUptime] = useState<number | null>(null)
  const [totalChecks30d, setTotalChecks30d] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [currentStatus, setCurrentStatus] = useState<string>("UNKNOWN")
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState("")
  const [hours, setHours] = useState(24)
  const [checksByRange, setChecksByRange] = useState<
    Record<number, Check[]>
  >({})

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.push("/")
      return
    }
    loadAll()
  }, [monitorId])

  async function loadAll() {
    setLoading(true)
    try {
      const [
        monitorData,
        uptimeData,
        alertsData,
        analysesData,
        statusData,
        checks24,
        checks168,
        checks720,
      ] = await Promise.all([
        getMonitor(monitorId),
        getUptime(monitorId, 30),
        getAlerts(monitorId),
        getAnalyses(monitorId),
        getMonitorStatus(monitorId),
        getChecks(monitorId, 24),
        getChecks(monitorId, 168),
        getChecks(monitorId, 720),
      ])
      setMonitor(monitorData)
      setUptime(uptimeData.uptime_percent)
      setTotalChecks30d(uptimeData.total_checks ?? null)
      setAlerts(alertsData)
      setAnalyses(analysesData)
      setCurrentStatus(statusData.status)
      setChecksByRange({ 24: checks24, 168: checks168, 720: checks720 })
      setChecks(checks24)
    } catch {
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (checksByRange[hours] !== undefined) {
      setChecks(checksByRange[hours])
    }
  }, [hours, checksByRange])

  async function handleAnalyze() {
    setAnalyzeError("")
    setAnalyzing(true)
    try {
      await analyzeMonitor(monitorId)
      const fresh = await getAnalyses(monitorId)
      setAnalyses(fresh)
    } catch (err: unknown) {
      if (err instanceof Error) setAnalyzeError(err.message)
      else setAnalyzeError("Analysis failed")
    } finally {
      setAnalyzing(false)
    }
  }

  const lastCheckAt = useMemo(() => {
    if (!checks.length) return null
    const sorted = [...checks].sort(
      (a, b) =>
        new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
    )
    return sorted[0]?.checked_at ?? null
  }, [checks])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!monitor) return null

  const periodLabel =
    hours === 24 ? "24h" : hours === 168 ? "7 days" : "30 days"

  const displayTitle = monitor.name?.trim() || hostnameFromUrl(monitor.url)
  const fullUrl = fullUrlFromMonitor(monitor.url)

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavbarShell>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-cyan-600 hover:text-cyan-700"
        >
          ← Back to dashboard
        </Link>
        <PulseBrandLink />
      </AppNavbarShell>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {displayTitle}
          </h1>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-cyan-600 hover:underline break-all"
          >
            {fullUrl}
          </a>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex min-h-[7.5rem] flex-col rounded-lg border border-gray-200 bg-stone-100 p-5">
            <p className="text-[11px] font-medium leading-snug text-gray-500">
              Current status
            </p>
            <p
              className={`mt-2 text-xl font-bold capitalize leading-tight ${statusWordClass(currentStatus)}`}
            >
              {statusToWord(currentStatus)}
            </p>
          </div>
          <div className="flex min-h-[7.5rem] flex-col rounded-lg border border-gray-200 bg-stone-100 p-5">
            <p className="text-[11px] font-medium leading-snug text-gray-500">
              Uptime (30d)
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums leading-tight text-gray-900">
              {uptime !== null ? `${uptime}%` : "—"}
            </p>
            {totalChecks30d !== null && (
              <p className="mt-auto pt-2 text-[11px] leading-snug text-gray-500">
                {totalChecks30d} checks
              </p>
            )}
          </div>
          <div className="flex min-h-[7.5rem] flex-col rounded-lg border border-gray-200 bg-stone-100 p-5">
            <p className="text-[11px] font-medium leading-snug text-gray-500">
              Last check
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums leading-tight text-gray-900">
              {lastCheckAt ? formatRelativeTime(lastCheckAt) : "—"}
            </p>
            <p className="mt-auto pt-2 text-[11px] leading-snug text-gray-500">
              Checked every {monitor.interval_minutes} min
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-medium text-gray-900">
              Response time — {periodLabel}
            </h2>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 divide-x divide-gray-200">
              <button
                type="button"
                onClick={() => setHours(24)}
                className={`px-3 py-1.5 text-sm font-medium capitalize ${
                  hours === 24
                    ? "bg-cyan-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                day
              </button>
              <button
                type="button"
                onClick={() => setHours(168)}
                className={`px-3 py-1.5 text-sm font-medium capitalize ${
                  hours === 168
                    ? "bg-cyan-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                week
              </button>
              <button
                type="button"
                onClick={() => setHours(720)}
                className={`px-3 py-1.5 text-sm font-medium capitalize ${
                  hours === 720
                    ? "bg-cyan-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                month
              </button>
            </div>
          </div>
          <div
            className="relative min-h-[256px]"
            style={{ height: 256, width: "100%" }}
          >
            <ResponseChart checks={checks} />
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-base font-medium text-gray-900">
              Incident history
            </h2>
            <div className="space-y-2">
              {alerts.map((alert) => {
                const duration = alert.resolved_at
                  ? Math.round(
                      (new Date(alert.resolved_at).getTime() -
                        new Date(alert.triggered_at).getTime()) /
                        1000
                    )
                  : null
                const durationText =
                  duration !== null
                    ? duration < 60
                      ? `${duration}s`
                      : `${Math.round(duration / 60)}m`
                    : "Ongoing"

                return (
                  <div
                    key={alert.id}
                    className="flex flex-col gap-1 border-b border-gray-100 py-2 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium text-gray-800">
                        {alert.type}
                      </span>
                      <span className="text-gray-600">
                        {new Date(alert.triggered_at).toLocaleString()}
                      </span>
                      {alert.response_time_ms != null && (
                        <span className="text-xs text-gray-500 tabular-nums">
                          {Math.round(alert.response_time_ms)} ms
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      Duration: {durationText}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-base font-medium text-gray-900">
              AI reliability analysis
            </h2>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="inline-flex min-w-[96px] shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {analyzing ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Analyze"
              )}
            </button>
          </div>
          {analyzeError && (
            <p className="mb-3 text-sm text-red-600">{analyzeError}</p>
          )}
          <AnalysisHistory analyses={analyses} />
        </div>
      </main>
    </div>
  )
}
