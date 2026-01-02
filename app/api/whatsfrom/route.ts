import { NextRequest } from 'next/server'

// Basic Twilio webhook receiver for the WhatsApp sandbox.
// Configure your Twilio sandbox 'WHEN A MESSAGE COMES IN' webhook to:
// https://<your-deploy-domain>/api/whatsfrom

export async function GET() {
  return new Response('Twilio WhatsApp webhook endpoint (POST only)')
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let payload: Record<string, any> = {}

    if (contentType.includes('application/json')) {
      payload = await req.json()
    } else {
      const form = await req.formData()
      form.forEach((value, key) => {
        payload[key] = value
      })
    }

    // Log incoming webhook for debugging (Twilio will POST form-encoded data)
    console.log('📩 Incoming Twilio WhatsApp webhook (/api/whatsfrom):', payload)

    // Minimal TwiML reply acknowledging receipt. Twilio accepts 200 without TwiML,
    // but replying with TwiML lets you send an immediate message back.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Received your message — thank you.</Message></Response>`

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err: any) {
    console.error('❌ Error handling Twilio webhook /api/whatsfrom:', err && err.message)
    return new Response('Internal Server Error', { status: 500 })
  }
}
