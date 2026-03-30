export function hostnameFromUrl(urlStr: string): string {
  try {
    const u = urlStr.startsWith("http") ? urlStr : `https://${urlStr}`
    return new URL(u).hostname
  } catch {
    return urlStr
  }
}

export function fullUrlFromMonitor(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`
}
