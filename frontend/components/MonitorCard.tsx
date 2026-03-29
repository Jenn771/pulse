import Link from "next/link"

type Monitor = {
  id: number
  url: string
  interval_minutes: number
  is_active: boolean
  created_at: string
}

type Props = {
  monitor: Monitor
  onDelete: (id: number) => void
  onPause: (id: number) => void
}

function statusDotClass(monitor: Monitor): string {
  if (!monitor.is_active) return "bg-gray-400"
  return "bg-green-500"
}

export default function MonitorCard({ monitor, onDelete, onPause }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
      <Link
        href={`/monitors/${monitor.id}`}
        className="flex flex-1 min-w-0 items-start gap-3 rounded-lg -m-2 p-2 hover:bg-gray-50 transition-colors"
      >
        <span
          className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${statusDotClass(monitor)}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 break-all">
            {monitor.url}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Every {monitor.interval_minutes} min
          </p>
        </div>
      </Link>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onPause(monitor.id)}
          className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
        >
          {monitor.is_active ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(monitor.id)}
          className="text-xs text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
