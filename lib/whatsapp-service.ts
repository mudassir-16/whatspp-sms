// Server-side only - prevent client-side bundling
if (typeof window !== "undefined") {
  throw new Error("whatsapp-service can only be used server-side")
}

// Use type imports to avoid bundling issues
import type { Client as WhatsAppClient, LocalAuth as WhatsAppLocalAuth, Message } from "whatsapp-web.js"

// Dynamic imports to prevent Next.js from bundling these packages at build time
let Client: typeof WhatsAppClient | null = null
let LocalAuth: typeof WhatsAppLocalAuth | null = null
let qrcode: any = null

async function loadWhatsAppDependencies() {
  if (!Client || !LocalAuth) {
    const whatsappModule = await import("whatsapp-web.js")
    Client = whatsappModule.Client
    LocalAuth = whatsappModule.LocalAuth
  }
  if (!qrcode) {
    const qrcodeModule = await import("qrcode-terminal")
    qrcode = qrcodeModule.default || qrcodeModule
  }
}

// Use globalThis to persist state across module reloads in development/Next.js
const globalAny: any = globalThis
if (!globalAny.whatsappState) {
  globalAny.whatsappState = {
    client: null,
    isInitialized: false,
    isReady: false,
    isAuthenticated: false,
    currentQRCode: null,
    initializationPromise: null,
    initializationError: null,
    lastQRTimestamp: null,
    loadingPercent: 0,
    loadingMessage: ""
  }
}

const state = globalAny.whatsappState

export interface WhatsAppMessage {
  to: string // Phone number with country code (e.g., "919876543210")
  message: string
}

/**
 * Initialize WhatsApp client
 */
export async function initializeWhatsApp(waitForReady: boolean = true): Promise<boolean> {
  if (state.isReady) return true
  if (state.initializationPromise) return state.initializationPromise

  state.initializationPromise = (async (): Promise<boolean> => {
    if (state.isInitialized && state.client) return state.isReady
    try {
      // Load dependencies dynamically
      await loadWhatsAppDependencies()

      if (!Client || !LocalAuth) {
        throw new Error("Failed to load WhatsApp dependencies")
      }

      state.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: process.env.WHATSAPP_DATA_PATH || ".wwebjs_auth" // persistent disk or fallback to local
        }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--single-process"
          ]
        }
      })

      state.client.on("qr", async (qr: string) => {
        console.log("📱 WhatsApp QR Code generated")
        // Generate QR code as data URL for web display
        try {
          const QRCode = await import("qrcode")
          const qrDataUrl = await (QRCode as any).toDataURL(qr, {
            width: 300,
            margin: 2,
          })
          state.currentQRCode = qrDataUrl
          state.lastQRTimestamp = Date.now()
          console.log("✅ QR code ready for display on website (Timestamp:", state.lastQRTimestamp, ")")
        } catch (error) {
          console.error("Error generating QR code image:", error)
          // Fallback to terminal display
          if (qrcode && qrcode.generate) {
            qrcode.generate(qr, { small: true })
          }
        }
      })

      state.client.on("ready", () => {
        console.log("✅ WhatsApp client is ready!")
        state.isReady = true
        state.currentQRCode = null // Clear QR code once connected
      })

      state.client.on("authenticated", () => {
        console.log("✅ WhatsApp authenticated successfully")
        state.isAuthenticated = true
      })

      state.client.on("loading_screen", (percent: string, message: string) => {
        console.log(`📱 WhatsApp Loading: ${percent}% - ${message}`)
        state.loadingPercent = parseInt(percent)
        state.loadingMessage = message
      })

      state.client.on("auth_failure", (msg: string) => {
        console.error("❌ WhatsApp authentication failed:", msg)
        state.isAuthenticated = false
        state.isReady = false
      })

      state.client.on("disconnected", (reason: string) => {
        console.log("⚠️  WhatsApp client disconnected:", reason)
        state.isAuthenticated = false
        state.isReady = false
        state.isInitialized = false
        state.client = null
      })

      state.initializationError = null
      await state.client.initialize()
      console.log("✅ state.client.initialize completed")
      state.isInitialized = true

      // If we don't want to wait for ready (e.g. for QR code generation), return true immediately
      if (!waitForReady) {
        return true
      }

      // Wait for client to be ready (max 60 seconds)
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("⚠️ Timeout waiting for WhatsApp ready state")
          resolve(false)
        }, 60000)

        const checkReady = setInterval(() => {
          if (state.isReady) {
            clearInterval(checkReady)
            clearTimeout(timeout)
            resolve(true)
          }
        }, 1000)
      })
    } catch (error: any) {
      console.error("❌ Error initializing WhatsApp:", error)
      state.initializationError = error.message || "Unknown error during initialization"
      state.isInitialized = false
      state.initializationPromise = null
      state.client = null
      return false
    }
  })()

  return state.initializationPromise!
}

/**
 * Send a WhatsApp message
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure client is initialized and ready
    if (!state.isInitialized || !state.isReady) {
      if (state.isAuthenticated) {
        return {
          success: false,
          error: "WhatsApp is still synchronizing your messages. Please wait a moment and try again.",
        }
      }

      const initialized = await initializeWhatsApp()
      if (!initialized) {
        return {
          success: false,
          error: "WhatsApp client is not ready. Please scan the QR code in the Admin panel first.",
        }
      }
    }

    if (!state.client) {
      return {
        success: false,
        error: "WhatsApp client not initialized",
      }
    }

    // Format phone number (remove + and spaces, ensure country code)
    const formattedNumber = phoneNumber.replace(/[+\s-]/g, "")
    const numberWithCountryCode =
      formattedNumber.startsWith("91") || formattedNumber.startsWith("1")
        ? formattedNumber
        : `91${formattedNumber}` // Default to India country code

    const chatId = `${numberWithCountryCode}@c.us`

    await state.client.sendMessage(chatId, message)
    console.log(`✅ WhatsApp message sent to ${numberWithCountryCode}`)

    return { success: true }
  } catch (error: any) {
    console.error("Error sending WhatsApp message:", error)
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    }
  }
}

/**
 * Send WhatsApp messages to multiple recipients
 */
export async function sendBulkWhatsAppMessages(
  recipients: Array<{ phoneNumber: string; message: string }>
): Promise<{ success: number; failed: number; errors: Array<{ phoneNumber: string; error: string }> }> {
  let success = 0
  let failed = 0
  const errors: Array<{ phoneNumber: string; error: string }> = []

  for (const recipient of recipients) {
    const result = await sendWhatsAppMessage(recipient.phoneNumber, recipient.message)
    if (result.success) {
      success++
      // Add delay between messages to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } else {
      failed++
      errors.push({
        phoneNumber: recipient.phoneNumber,
        error: result.error || "Unknown error",
      })
    }
  }

  return { success, failed, errors }
}

/**
 * Check if WhatsApp client is ready
 */
export function isWhatsAppReady(): boolean {
  return state.isReady && state.isInitialized && state.client !== null
}

/**
 * Get WhatsApp client status
 */
export function getWhatsAppStatus(): {
  initialized: boolean
  authenticated: boolean
  ready: boolean
  hasClient: boolean
  qrCode: string | null
  isInitializing: boolean
  error: string | null
  lastQRUpdate: number | null
  loadingPercent: number
  loadingMessage: string
} {
  return {
    initialized: state.isInitialized,
    authenticated: state.isAuthenticated,
    ready: state.isReady,
    hasClient: state.client !== null,
    qrCode: state.currentQRCode,
    isInitializing: state.initializationPromise !== null && !state.isInitialized,
    error: state.initializationError,
    lastQRUpdate: state.lastQRTimestamp,
    loadingPercent: state.loadingPercent,
    loadingMessage: state.loadingMessage
  }
}

/**
 * Check if initialization is in progress
 */
export function isInitializing(): boolean {
  return state.initializationPromise !== null && !state.isInitialized
}

/**
 * Get current QR code
 */
export function getQRCode(): string | null {
  return state.currentQRCode
}

/**
 * Logout and destroy WhatsApp client
 */
export async function logoutWhatsApp(): Promise<boolean> {
  try {
    if (state.client) {
      console.log("📱 Logging out WhatsApp client...")
      await state.client.destroy()
      state.client = null
    }

    // Reset state
    state.isInitialized = false
    state.isReady = false
    state.isAuthenticated = false
    state.currentQRCode = null
    state.initializationPromise = null
    state.initializationError = null

    // Clear auth data directory (optional, but ensures clean slate)
    // Note: We're not deleting the directory here to avoid fs operations complexity
    // but destroying the client effectively disconnects it

    console.log("✅ WhatsApp client logged out successfully")
    return true
  } catch (error) {
    console.error("Error logging out WhatsApp:", error)
    return false
  }
}

