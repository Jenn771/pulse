export function statusToWord(status: string): string {
  const s = status.toUpperCase()
  switch (s) {
    case "UP":
      return "up"
    case "DOWN":
      return "down"
    case "SLOW":
      return "slow"
    case "PAUSED":
      return "paused"
    case "UNKNOWN":
    default:
      return "unknown"
  }
}

export function statusWordClass(status: string): string {
  const s = status.toUpperCase()
  switch (s) {
    case "UP":
      return "text-green-600"
    case "DOWN":
      return "text-red-600"
    case "SLOW":
      return "text-amber-600"
    case "PAUSED":
      return "text-gray-600"
    case "UNKNOWN":
    default:
      return "text-gray-500"
  }
}
