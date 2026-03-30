import type { ReactNode } from "react"
import Link from "next/link"

export function AppNavbarShell({ children }: { children: ReactNode }) {
  return (
    <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        {children}
      </div>
    </nav>
  )
}

export function PulseBrandLink({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-lg font-semibold text-gray-900 transition-colors hover:text-gray-700"
    >
      <span
        className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-600"
        aria-hidden
      />
      Pulse
    </Link>
  )
}
