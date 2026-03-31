import type { ReactNode } from "react"
import Link from "next/link"
import { PulseLogo } from "@/components/Icons"

export function AppNavbarShell({ children }: { children: ReactNode }) {
  return (
    <nav className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-800 bg-gray-900 px-6">
      {children}
    </nav>
  )
}

export function PulseBrandLink({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-lg font-medium text-white transition-colors hover:text-gray-200"
    >
      <PulseLogo />
      Pulse
    </Link>
  )
}
