type Analysis = {
  id: number
  monitor_id: number
  created_at: string
  summary_text: string
}

type Props = {
  analyses: Analysis[]
}

function stripSimpleMarkdown(text: string): string {
  let s = text
  while (s.includes("**")) {
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1")
  }
  s = s.replace(/^#{1,6}\s+/gm, "")
  return s.trim()
}

export default function AnalysisHistory({ analyses }: Props) {
  if (analyses.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No analyses yet. Click Analyze to generate one.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {analyses.map((a) => (
        <div
          key={a.id}
          className="border border-gray-200 rounded p-4"
        >
          <p className="text-xs text-gray-400 mb-2">
            {new Date(a.created_at).toLocaleString()}
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {stripSimpleMarkdown(a.summary_text)}
          </p>
        </div>
      ))}
    </div>
  )
}
