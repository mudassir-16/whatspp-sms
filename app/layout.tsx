import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

export const metadata: Metadata = {
  title: "NSS BloodConnect - Blood Donor Platform",
  description: "Connect voluntary blood donors across campus for emergencies",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Only render Vercel Analytics when explicitly enabled via env var.
  // On non-Vercel platforms (Render, Docker), this avoids loading
  // /_vercel/insights/script.js which returns 404 and pollutes logs.
  const showVercelAnalytics = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "1" || process.env.VERCEL === "1"

  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        {showVercelAnalytics && <Analytics />}
      </body>
    </html>
  )
}
