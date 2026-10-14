// Records which sites were scanned by the free chatbot tool and reads back the
// most-scanned brands for the showcase. Best-effort: never breaks the tool.

import { supabaseAdmin } from '@/lib/automations/admin-client'

export type ScannedBrand = { host: string; name: string; logoUrl: string; demoId?: string }

const enabled = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

export async function recordScan(host: string, name: string | null, logoUrl: string | null): Promise<void> {
  if (!enabled() || !host) return
  if (logoUrl && !/^https:\/\//i.test(logoUrl)) logoUrl = null
  try {
    await supabaseAdmin().rpc('record_tool_scan', {
      p_host: host.slice(0, 120),
      p_name: name ? name.slice(0, 80) : null,
      p_logo: logoUrl ? logoUrl.slice(0, 500) : null,
    })
  } catch {
    /* showcase is optional */
  }
}

export async function getTopScanned(limit = 10): Promise<ScannedBrand[]> {
  if (!enabled()) return []
  try {
    const { data } = await supabaseAdmin()
      .from('tool_scanned_sites')
      .select('host, brand_name, logo_url, demo_id')
      .eq('hidden', false)
      .not('logo_url', 'is', null)
      .order('scan_count', { ascending: false })
      .order('last_scanned_at', { ascending: false })
      .limit(limit)
    return (data ?? []).map((r: { host: string; brand_name: string | null; logo_url: string; demo_id: string | null }) => ({
      host: r.host,
      name: r.brand_name || r.host,
      logoUrl: r.logo_url,
      demoId: r.demo_id ?? undefined,
    }))
  } catch {
    return []
  }
}
