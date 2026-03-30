"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { login, signup } from "@/lib/api"

export default function HomePage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (isLogin) {
        await login(email, password)
      } else {
        await signup(email, password)
        await login(email, password)
      }
      router.push("/dashboard")
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-600 shrink-0" aria-hidden />
            Pulse
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError("") }}
            className="text-cyan-600 hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  )
}
