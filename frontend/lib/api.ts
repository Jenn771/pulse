const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Reads the access token from localStorage
function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("access_token")
}

// Helper that makes authenticated requests and automatically adds the Authorization header
async function authFetch(path: string, options: RequestInit = {}) {
    const token = getToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  
    // Refreshing the token once before redirecting to login
    if (res.status === 401) {
      const refreshed = await refreshToken()
      if (refreshed) {
        // Retry the original request with the new token
        const newToken = getToken()
        return fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
            ...options.headers,
          },
        })
      }
      // Refresh failed so we clear tokens and redirect to login
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      window.location.href = "/"
      throw new Error("Unauthorized")
    }
  
    return res
  }

// --- Auth ---

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 429) throw new Error("Too many login attempts. Try again in a minute.")
  if (!res.ok) throw new Error("Invalid email or password")
  const data = await res.json()

  // Store both tokens in localStorage
  localStorage.setItem("access_token", data.access_token)
  localStorage.setItem("refresh_token", data.refresh_token)
  return data
}

export async function signup(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json()
    const message = Array.isArray(err.detail)
      ? err.detail[0]?.msg || "Signup failed"
      : err.detail || "Signup failed"
    throw new Error(message)
  }
  return res.json()
}

export function logout() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
  window.location.href = "/"
}

// Silently refreshes the access token using the stored refresh token
export async function refreshToken(): Promise<boolean> {
    if (typeof window === "undefined") return false

    const storedRefreshToken = localStorage.getItem("refresh_token")
    if (!storedRefreshToken) return false
  
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: storedRefreshToken }),
      })
      if (!res.ok) return false
      const data = await res.json()
      localStorage.setItem("access_token", data.access_token)
      localStorage.setItem("refresh_token", data.refresh_token)
      return true
    } catch {
      return false
    }
  }
  
  // Returns the currently logged in user's profile
  export async function getMe() {
    const res = await authFetch("/auth/me")
    if (!res.ok) return null
    return res.json()
  }


// --- Monitors ---

export async function getMonitors() {
  const res = await authFetch("/monitors/")
  if (!res.ok) throw new Error("Failed to fetch monitors")
  return res.json()
}

// Fetches a single monitor by ID
export async function getMonitor(id: number) {
    const res = await authFetch(`/monitors/${id}`)
    if (!res.ok) throw new Error("Monitor not found")
    return res.json()
  }

export async function createMonitor(url: string, interval_minutes: number) {
  const res = await authFetch("/monitors/", {
    method: "POST",
    body: JSON.stringify({ url, interval_minutes }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to create monitor")
  }
  return res.json()
}

export async function deleteMonitor(id: number) {
  const res = await authFetch(`/monitors/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete monitor")
}

export async function pauseMonitor(id: number) {
  const res = await authFetch(`/monitors/${id}/pause`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to pause monitor")
  return res.json()
}

export async function getMonitorStatus(monitorId: number) {
  const res = await authFetch(`/monitors/${monitorId}/status`)
  if (!res.ok) throw new Error("Failed to fetch monitor status")
  return res.json()
}

// --- Checks ---

export async function getChecks(monitorId: number, hours = 24) {
  const res = await authFetch(`/monitors/${monitorId}/checks?hours=${hours}`)
  if (!res.ok) throw new Error("Failed to fetch checks")
  return res.json()
}

export async function getUptime(monitorId: number, days = 30) {
  const res = await authFetch(`/monitors/${monitorId}/uptime?days=${days}`)
  if (!res.ok) throw new Error("Failed to fetch uptime")
  return res.json()
}

export async function getAlerts(monitorId: number) {
  const res = await authFetch(`/monitors/${monitorId}/alerts`)
  if (!res.ok) throw new Error("Failed to fetch alerts")
  return res.json()
}

// --- AI Analysis ---

export async function analyzeMonitor(monitorId: number) {
  const res = await authFetch(`/ai/${monitorId}/analyze`)
  if (res.status === 429) throw new Error("Rate limit: once per hour per monitor")
  if (!res.ok) throw new Error("Analysis failed")
  return res.json()
}

export async function getAnalyses(monitorId: number) {
  const res = await authFetch(`/ai/${monitorId}/analyses`)
  if (!res.ok) throw new Error("Failed to fetch analyses")
  return res.json()
}