"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  getMonitor, getChecks, getUptime,
  getAlerts, analyzeMonitor, getAnalyses, getMonitorStatus
} from "@/lib/api"
import StatusBadge from "@/components/StatusBadge"
import ResponseChart from "@/components/ResponseChart"
import AnalysisHistory from "@/components/AnalysisHistory"

type Monitor = {
  id: number
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
}

type Analysis = {
  id: number
  monitor_id: number
  created_at: string
  summary_text: string
}

function headerAccentClass(status: string): string {
  switch (status) {
    case "UP":
      return "border-t-green-500"
    case "DOWN":
      return "border-t-red-500"
    case "SLOW":
      return "border-t-amber-500"
    default:
      return "border-t-gray-300"
  }
}

export default function MonitorDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const monitorId = Number(id)

  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [checks, setChecks] = useState<Check[]>([])
  const [uptime, setUptime] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [currentStatus, setCurrentStatus] = useState<string>("UNKNOWN")
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState("")

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.push("/")
      return
    }
    loadAll()
  }, [monitorId])

  async function loadAll() {
    try {
      const [monitorData, checksData, uptimeData, alertsData, analysesData, statusData] =
        await Promise.all([
          getMonitor(monitorId),
          getChecks(monitorId, 24),
          getUptime(monitorId, 30),
          getAlerts(monitorId),
          getAnalyses(monitorId),
          getMonitorStatus(monitorId),
        ])
      setMonitor(monitorData)
      setChecks(checksData)
      setUptime(uptimeData.uptime_percent)
      setAlerts(alertsData)
      setAnalyses(analysesData)
      setCurrentStatus(statusData.status)
    } catch {
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!monitor) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to dashboard
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div
          className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-gray-900 break-all">
                {monitor.url}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Checked every {monitor.interval_minutes} min
              </p>
            </div>
            <div className="shrink-0">
              <StatusBadge status={currentStatus} />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500">30-day uptime</p>
            <p className="text-4xl font-semibold text-gray-900 mt-1 tabular-nums">
              {uptime !== null ? `${uptime}%` : "—"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-medium text-gray-900 mb-4">
            Response time — last 24h
          </h2>
          <ResponseChart checks={checks} />
        </div>

        {alerts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-medium text-gray-900 mb-4">
              Incident history
            </h2>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={alert.type} />
                    <span className="text-gray-600">
                      {new Date(alert.triggered_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-gray-400">
                    {alert.resolved_at
                      ? `Resolved ${new Date(alert.resolved_at).toLocaleString()}`
                      : "Ongoing"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-medium text-gray-900">
              AI reliability analysis
            </h2>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 shrink-0"
            >
              {analyzing ? "Analyzing..." : "Analyze"}
            </button>
          </div>
          {analyzeError && (
            <p className="text-red-600 text-sm mb-3">{analyzeError}</p>
          )}
          <AnalysisHistory analyses={analyses} />
        </div>
      </main>
    </div>
  )
}
