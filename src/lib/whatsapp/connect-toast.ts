// src/lib/whatsapp/connect-toast.ts
//
// Shows an error toast. When the error means "WhatsApp is not connected yet"
// the toast also carries a "Connect WhatsApp" button that opens
// Settings > WhatsApp, so the user is never left with only a message.

import { toast } from 'sonner'

/** Messages the API routes return while no WhatsApp Business account is saved. */
export function isWhatsappNotConnectedMessage(message: unknown): boolean {
  if (typeof message !== 'string') return false
  return /whatsapp (is )?not (configured|connected)|connect your (whatsapp|account)|waba .*missing|re-?connect your account/i.test(message)
}

export function notifyWhatsappError(message: string): void {
  if (isWhatsappNotConnectedMessage(message)) {
    toast.error(message, {
      duration: 10000,
      action: {
        label: 'Connect WhatsApp',
        onClick: () => {
          window.location.href = '/settings?tab=whatsapp'
        },
      },
    })
    return
  }
  toast.error(message)
}
