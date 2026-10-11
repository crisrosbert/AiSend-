// The picture beside the heading: a printed sheet with a real QR code on it.
// The code opens a chat with our team, so scanning it from a phone works.
// It is drawn on the server with the same engine as the tool below.

import { Icon } from '@/components/tools/landing/icons'
import { teamWhatsAppLink } from '@/lib/tools/landing-config'
import { buildMatrix, renderQrSvg } from '@/lib/tools/qr-svg'

export function QrHeroStage() {
  const opts = {
    fg: '#14523a',
    bg: '#ffffff',
    dots: 'rounded' as const,
    logo: { kind: 'chat' as const, color: '#14523a' },
  }
  const link = teamWhatsAppLink('Hi, I scanned your QR code.')
  const svg = renderQrSvg(buildMatrix(link, 'H'), opts)
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  return (
    <div className="tl-stage" aria-hidden="true">
      <div className="tl-chip tl-chip--e">
        <Icon name="scan" size={18} />
        Scan with a phone
      </div>

      <div className="tl-sheet">
        <div className="tl-sheet__bar">
          <span className="tl-icon"><Icon name="store" size={18} /></span>
          Your business
        </div>
        <div className="tl-sheet__qr">
          {/* data: URL generated on the server, so next/image has nothing to optimise */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" width={250} height={250} />
        </div>
        <p className="tl-sheet__cap">Scan to chat</p>
      </div>

      <div className="tl-chip tl-chip--f tl-chip--mono">
        <Icon name="download" size={17} />
        whatsapp-qr.svg
      </div>
    </div>
  )
}
