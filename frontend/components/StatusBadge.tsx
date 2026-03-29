type Props = {
  status: string
}

export default function StatusBadge({ status }: Props) {
  const styles: Record<string, string> = {
    UP: "bg-green-100 text-green-800",
    DOWN: "bg-red-100 text-red-800",
    SLOW: "bg-amber-100 text-amber-800",
    UNKNOWN: "bg-gray-100 text-gray-600",
    PAUSED: "bg-gray-100 text-gray-600",
  }

  const style = styles[status] ?? styles.UNKNOWN

  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${style}`}>
      {status}
    </span>
  )
}
