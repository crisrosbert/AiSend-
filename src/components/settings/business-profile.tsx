'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Upload, Globe, MapPin, Mail, Info, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

/**
 * Business Profile editor — sets the logo, about, description, website,
 * address, email and category that customers see on WhatsApp. Talks to
 * /api/whatsapp/profile (GET load, POST json update, POST multipart for
 * the photo). Lives inside the WhatsApp Config tab.
 *
 * Note: the bold DISPLAY NAME (e.g. "AiSend") is set + approved in
 * Meta WhatsApp Manager, not here — Meta requires manual review for it.
 */

// Meta's business verticals (category). Subset of the common ones.
const VERTICALS = [
  ['UNDEFINED', 'Not set'],
  ['OTHER', 'Other'],
  ['AUTO', 'Automotive'],
  ['BEAUTY', 'Beauty & Personal Care'],
  ['APPAREL', 'Clothing & Apparel'],
  ['EDU', 'Education'],
  ['ENTERTAIN', 'Entertainment'],
  ['EVENT_PLAN', 'Event Planning'],
  ['FINANCE', 'Finance & Banking'],
  ['GROCERY', 'Food & Grocery'],
  ['GOVT', 'Public Service'],
  ['HOTEL', 'Hotel & Lodging'],
  ['HEALTH', 'Medical & Health'],
  ['NONPROFIT', 'Non-profit'],
  ['PROF_SERVICES', 'Professional Services'],
  ['RETAIL', 'Shopping & Retail'],
  ['TRAVEL', 'Travel & Transportation'],
  ['RESTAURANT', 'Restaurant'],
] as const

interface ProfileState {
  about: string
  description: string
  email: string
  address: string
  vertical: string
  website: string
  profile_picture_url: string
}

const empty: ProfileState = {
  about: '', description: '', email: '', address: '',
  vertical: 'UNDEFINED', website: '', profile_picture_url: '',
}

export function BusinessProfile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState<ProfileState>(empty)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      const res = await fetch('/api/whatsapp/profile')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load profile')
      const p = data.profile || {}
      setForm({
        about: p.about || '',
        description: p.description || '',
        email: p.email || '',
        address: p.address || '',
        vertical: p.vertical || 'UNDEFINED',
        website: Array.isArray(p.websites) && p.websites[0] ? p.websites[0] : '',
        profile_picture_url: p.profile_picture_url || '',
      })
    } catch (err) {
      // Most common cause: WhatsApp not configured yet. Keep it quiet-ish.
      console.error('profile load:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const res = await fetch('/api/whatsapp/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          about: form.about,
          description: form.description,
          email: form.email,
          address: form.address,
          vertical: form.vertical === 'UNDEFINED' ? undefined : form.vertical,
          websites: form.website ? [form.website] : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save')
      toast.success('Business profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      return
    }
    try {
      setUploading(true)
      const fd = new FormData()
      fd.append('photo', file)
      const res = await fetch('/api/whatsapp/profile', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Upload failed')
      toast.success('Profile photo updated')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <Card className="bg-white border-[#e7ece9]">
      <CardContent className="pt-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            Business Profile
          </h2>
          <p className="text-sm text-slate-500">
            This is what your customers see on WhatsApp. The bold display name is set &amp; approved
            separately in Meta WhatsApp Manager.
          </p>
        </div>

        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-full border border-[#e7ece9] bg-slate-50">
            {form.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.profile_picture_url} alt="Profile" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-slate-300 text-xl">🏢</div>
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="border-[#e7ece9] bg-white text-slate-600 hover:bg-slate-50"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? 'Uploading…' : 'Upload logo'}
            </Button>
            <p className="mt-1 text-[11px] text-slate-400">Square image, under 5 MB. JPG or PNG.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-slate-700"><Info className="size-3.5" />About</Label>
            <Input
              maxLength={139}
              placeholder="Open 9am–9pm · Free delivery"
              value={form.about}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
              className="bg-white border-[#e7ece9] text-[#0c1f17]"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-slate-700"><TagIcon className="size-3.5" />Category</Label>
            <Select value={form.vertical} onValueChange={(v) => setForm({ ...form, vertical: v ?? 'UNDEFINED' })}>
              <SelectTrigger className="w-full bg-white border-[#e7ece9] text-[#0c1f17]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#e7ece9] max-h-64">
                {VERTICALS.map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-[#0c1f17] focus:bg-slate-100">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-700">Description</Label>
          <Textarea
            maxLength={512}
            rows={3}
            placeholder="Tell customers about your business…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="bg-white border-[#e7ece9] text-[#0c1f17] resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-slate-700"><Globe className="size-3.5" />Website</Label>
            <Input
              placeholder="https://yourbusiness.com"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="bg-white border-[#e7ece9] text-[#0c1f17]"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-slate-700"><Mail className="size-3.5" />Email</Label>
            <Input
              type="email"
              placeholder="hello@yourbusiness.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-white border-[#e7ece9] text-[#0c1f17]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-slate-700"><MapPin className="size-3.5" />Address</Label>
          <Input
            placeholder="Shop 12, MG Road, Bengaluru 560001"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="bg-white border-[#e7ece9] text-[#0c1f17]"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white">
            {saving ? (<><Loader2 className="size-4 animate-spin" />Saving…</>) : 'Save profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
