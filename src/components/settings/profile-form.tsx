'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Mail, CircleAlert } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileForm() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setEmail(profile.email ?? '');
  }, [profile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentAvatar = previewUrl ?? (!removeAvatar ? profile?.avatar_url ?? null : null);
  const initial = (fullName || profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error('Unsupported image type', { description: 'Use PNG, JPG, WebP, or GIF.' });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image is too large', { description: 'Maximum 2 MB.' });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const onRemoveAvatar = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const trimmedName = fullName.trim();
    if (!trimmedName) { toast.error('Display name is required'); return; }
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) { toast.error('Enter a valid email address'); return; }

    setSaving(true);
    try {
      let nextAvatarUrl: string | null = profile.avatar_url ?? null;
      if (pendingAvatar) {
        const ext = pendingAvatar.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, pendingAvatar, { cacheControl: '3600', upsert: true, contentType: pendingAvatar.type });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        nextAvatarUrl = publicUrl;
      } else if (removeAvatar) {
        nextAvatarUrl = null;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: trimmedName, avatar_url: nextAvatarUrl })
        .eq('user_id', user.id);
      if (updateError) throw new Error(`Save failed: ${updateError.message}`);

      let emailSent = false;
      if (trimmedEmail.toLowerCase() !== profile.email.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailError) {
          toast.success('Profile saved');
          toast.error(`Email change failed: ${emailError.message}`);
          setSaving(false);
          await refreshProfile();
          return;
        }
        emailSent = true;
      }

      setEmailChangePending(emailSent);
      setPendingAvatar(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      await refreshProfile();
      toast.success(emailSent ? 'Profile saved — check your email to confirm the address change' : 'Profile saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!profile &&
    (fullName.trim() !== (profile.full_name ?? '') ||
      email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase() ||
      pendingAvatar !== null ||
      removeAvatar);

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="rounded-xl border border-[#e7ece9] bg-white shadow-sm">
      {/* Card header */}
      <div className="border-b border-[#e7ece9] px-6 py-5">
        <h2 className="text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
          Profile
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          How you show up across the app. Your avatar and name appear in the header and sidebar.
        </p>
      </div>

      {/* Card body */}
      <form onSubmit={onSubmit} className="space-y-6 px-6 py-6">
        {/* Avatar row */}
        <div className="flex flex-wrap items-center gap-5">
          <Avatar size="lg" className="size-16 ring-2 ring-emerald-100">
            {currentAvatar ? <AvatarImage src={currentAvatar} alt={fullName || 'Avatar'} /> : null}
            <AvatarFallback className="bg-emerald-50 text-lg font-bold text-emerald-600">
              {initial}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={onPickFile}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={saving}>
              <Upload className="size-4" />
              {currentAvatar ? 'Change photo' : 'Upload photo'}
            </Button>
            {currentAvatar && (
              <Button type="button" variant="ghost" onClick={onRemoveAvatar} disabled={saving} className="text-slate-500 hover:text-red-600">
                <Trash2 className="size-4" />
                Remove
              </Button>
            )}
            <p className="w-full text-xs text-slate-400">PNG, JPG, WebP, or GIF. Up to 2 MB.</p>
          </div>
        </div>

        {/* Two-column grid for name + email */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-full-name" className="text-sm font-semibold text-slate-700">
              Display name
            </Label>
            <Input
              id="profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Lovelace"
              maxLength={120}
              disabled={saving}
              required
              className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email" className="text-sm font-semibold text-slate-700">
              Email
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
              required
              className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            />
          </div>
        </div>

        {emailChangePending && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Check the inbox for <strong>{profile?.email}</strong> and <strong>{email}</strong> — both need to confirm before the change takes effect.
            </span>
          </p>
        )}

        {/* Account details */}
        <div className="rounded-lg border border-[#e7ece9] bg-[#f8faf9] p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Account details</p>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Role</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-700">{profile?.role ?? 'user'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Joined</dt>
              <dd className="mt-0.5 font-semibold text-slate-700">{joined}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-400">User ID</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-slate-500">{user?.id ?? '—'}</dd>
            </div>
          </dl>
        </div>

        {!profile && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <CircleAlert className="size-4" />
            Loading your profile…
          </p>
        )}

        <div className="flex justify-end border-t border-[#e7ece9] pt-5">
          <Button
            type="submit"
            disabled={saving || !dirty || !profile}
            className="bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
