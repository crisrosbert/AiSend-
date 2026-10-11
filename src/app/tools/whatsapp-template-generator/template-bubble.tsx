// A template message as it looks in a WhatsApp chat: header, body, footer and
// the buttons that sit under the bubble. Used by the tool's live preview and
// by the picture beside the page heading, so both always look the same.

import { Icon, type IconName } from '@/components/tools/landing/icons'
import { formatWhatsApp } from '@/lib/tools/wa-format'
import type { ButtonType } from '@/lib/tools/template-checker'

export interface BubbleButton {
  kind: ButtonType
  label: string
}

const BUTTON_ICON: Record<ButtonType, IconName> = {
  quick_reply: 'chat',
  url: 'external',
  phone: 'phone',
  copy_code: 'copy',
}

function Formatted({ text }: { text: string }) {
  return (
    <>
      {formatWhatsApp(text).map((run, i) => {
        const style = {
          fontWeight: run.bold ? 700 : undefined,
          fontStyle: run.italic ? 'italic' : undefined,
          textDecoration: run.strike ? 'line-through' : undefined,
          fontFamily: run.mono ? "'JetBrains Mono', ui-monospace, monospace" : undefined,
        }
        return <span key={i} style={style}>{run.text}</span>
      })}
    </>
  )
}

export function TemplateBubble({
  header,
  body,
  footer,
  buttons,
  time = '10:42',
}: {
  header?: string
  body: string
  footer?: string
  buttons: readonly BubbleButton[]
  time?: string
}) {
  return (
    <>
      <div className="tl-bubble tl-bubble--in tl-tpl">
        {header ? <p className="tl-tpl__head">{header}</p> : null}
        <p className="tl-tpl__body">{body ? <Formatted text={body} /> : <span className="tl-tpl__empty">Your message appears here</span>}</p>
        {footer ? <p className="tl-tpl__foot">{footer}</p> : null}
        <div className="tl-bubble__meta">{time}</div>
      </div>
      {buttons.length > 0 && (
        <div className="tl-tplbtns">
          {buttons.map((b, i) => (
            <span key={`${b.kind}-${i}`} className="tl-tplbtn">
              <Icon name={BUTTON_ICON[b.kind]} size={15} strokeWidth={2} />
              {b.label || 'Button'}
            </span>
          ))}
        </div>
      )}
    </>
  )
}
