import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import fs from "fs"
import path from "path"

export async function GET() {
  const info: any = {
    time: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      WHATSAPP_DATA_PATH: process.env.WHATSAPP_DATA_PATH || null,
      NEXT_PUBLIC_VERCEL_ANALYTICS: process.env.NEXT_PUBLIC_VERCEL_ANALYTICS || null,
      VERCEL: process.env.VERCEL || null,
    },
  }

  // Check filesystem for configured path
  const configured = process.env.WHATSAPP_DATA_PATH || ".wwebjs_auth"
  const resolved = path.resolve(configured)
  info.configuredDataPath = resolved

  try {
    const stat = await fs.promises.stat(resolved).catch(() => null)
    info.pathExists = !!stat
    if (stat) {
      info.pathIsDirectory = stat.isDirectory()
      try {
        const testFile = path.join(resolved, `.debug_write_test_${Date.now()}`)
        await fs.promises.writeFile(testFile, "ok")
        await fs.promises.unlink(testFile)
        info.writable = true
      } catch (e: any) {
        info.writable = false
        info.writeError = e.message
      }
    }
  } catch (e: any) {
    info.fsError = e.message
  }

  // Try to import the whatsapp-service and return its status if possible
  try {
    const whatsapp = await import("@/lib/whatsapp-service")
    try {
      const status = whatsapp.getWhatsAppStatus()
      info.whatsappStatus = status
    } catch (e: any) {
      info.whatsappStatusError = e.message
    }
  } catch (e: any) {
    info.importError = (e && e.stack) || String(e)
  }

  return NextResponse.json({ ok: true, info })
}
