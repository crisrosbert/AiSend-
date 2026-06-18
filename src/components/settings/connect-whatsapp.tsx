'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/**
 * "Connect WhatsApp" — Embedded Signup launcher (AiSensy-style).
 *
 * Loads the Facebook JS SDK, opens Meta's hosted signup popup, captures
 * the returned code + waba_id + phone_number_id, and posts them to
 * /api/whatsapp/embedded-signup which exchanges + stores the client's
 * credentials. The client never touches the Meta developer dashboard.
 *
 * Requires:
 *   - NEXT_PUBLIC_META_APP_ID  (your Meta App ID)
 *   - NEXT_PUBLIC_META_CONFIG_ID (Embedded Signup configuration ID from
 *     Meta App Dashboard → WhatsApp → Embedded Signup)
 *
 * Until the Meta app is published + approved as a Tech Provider with
 * Advanced Access, the popup only works for app admins/testers. The code
 * is correct and goes live unchanged once Meta approves.
 */

declare global {
  interface Window {
    FB?: any
    fbAsyncInit?: () => void
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID
const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID

export function ConnectWhatsApp({ onConnected }: { onConnected?: () => void }) {
  const [sdkReady, setSdkReady] = useState(false)
  const [working, setWorking] = useState(false)
  // Meta delivers the waba_id / phone_number_id through a postMessage
  // event that fires alongside the FB.login callback; we stash it here.
  const sessionInfo = useRef<{ waba_id?: string; phone_number_id?: string }>({})

  useEffect(() => {
    if (!APP_ID) return

    // Capture the WABA/phone IDs Meta posts during signup.
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.data) {
          sessionInfo.current = {
            waba_id: data.data.waba_id,
            phone_number_id: data.data.phone_number_id,
          }
        }
      } catch {
        /* ignore non-JSON messages */
      }
    }
    window.addEventListener('message', onMessage)

    // Load the FB SDK once.
    if (window.FB) {
      setSdkReady(true)
    } else {
      window.fbAsyncInit = () => {
        window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v21.0' })
        setSdkReady(true)
      }
      const id = 'facebook-jssdk'
      if (!document.getElementById(id)) {
        const js = document.createElement('script')
        js.id = id
        js.src = 'https://connect.facebook.net/en_US/sdk.js'
        js.async = true
        js.defer = true
        document.body.appendChild(js)
      }
    }

    return () => window.removeEventListener('message', onMessage)
  }, [])

  function launch() {
    if (!window.FB || !CONFIG_ID) {
      toast.error('WhatsApp signup is not configured yet. Please try again shortly.')
      return
    }
    setWorking(true)
    sessionInfo.current = {}

    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code
        if (!code) {
          setWorking(false)
          // User closed the popup or denied — not an error worth a toast.
          return
        }
        exchange(code)
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      },
    )
  }

  async function exchange(code: string) {
    try {
      const res = await fetch('/api/whatsapp/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          waba_id: sessionInfo.current.waba_id,
          phone_number_id: sessionInfo.current.phone_number_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Connection failed')
      if (data.warning) toast.warning(data.warning)
      toast.success('WhatsApp connected! Your number is ready to send.')
      onConnected?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect WhatsApp')
    } finally {
      setWorking(false)
    }
  }

  if (!APP_ID || !CONFIG_ID) {
    return (
      <Card className="bg-white border-[#e7ece9]">
        <CardContent className="pt-6">
          <h3 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            Connect WhatsApp
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Self-serve WhatsApp connection isn&apos;t enabled yet. For now, connect your number using
            the API Credentials above, or contact support to get set up.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border-[#e7ece9]">
      <CardContent className="pt-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
              Connect WhatsApp in one click
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Link your own WhatsApp Business number through Meta — no developer account needed.
              Takes about 5 minutes.
            </p>
          </div>
          <button
            onClick={launch}
            disabled={!sdkReady || working}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {working ? (
              <><Loader2 className="size-4 animate-spin" />Connecting…</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Z" /></svg>
                Connect WhatsApp
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
