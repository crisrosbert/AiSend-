// The picture beside the heading: one campaign, three channels, and the
// profit each leaves. Drawn with plain shapes. The figures are the same
// example numbers the calculator opens with, not results anyone should expect.

import { Icon } from '@/components/tools/landing/icons'

const BARS = [
  { name: 'WhatsApp', value: '₹17,860', width: 100, tone: 'wa' },
  { name: 'SMS', value: '₹860', width: 5, tone: 'sms' },
  { name: 'Email', value: '₹2,492', width: 14, tone: 'mail' },
] as const

export function RoiHeroStage() {
  return (
    <div className="tl-stage" aria-hidden="true">
      <div className="tl-chip tl-chip--e" style={{ top: -8 }}>
        <Icon name="calc" size={18} />
        Your numbers, not guesses
      </div>

      <div className="tl-roistage">
        <p className="tl-roistage__title">Net profit in a month</p>
        <p className="tl-roistage__sub">Same list, same offer, three channels</p>
        <ul className="tl-roistage__bars">
          {BARS.map((b) => (
            <li key={b.name}>
              <div className="tl-roistage__row">
                <span>{b.name}</span>
                <b>{b.value}</b>
              </div>
              <div className="tl-roistage__track">
                <i className={`tl-roistage__fill tl-roistage__fill--${b.tone}`} style={{ width: `${b.width}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="tl-roistage__note">Example numbers</p>
      </div>

      <div className="tl-chip tl-chip--f" style={{ bottom: 0 }}>
        <Icon name="trend" size={17} />
        Break-even shown too
      </div>
    </div>
  )
}
