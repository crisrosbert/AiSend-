// The picture beside the heading: a website with the chat button and its
// welcome popup floating in the corner. Drawn with plain shapes, so it holds
// no real brand or page. The wording is an example only.

import { Icon } from '@/components/tools/landing/icons'

export function WidgetHeroStage() {
  return (
    <div className="tl-stage" aria-hidden="true">
      <div className="tl-chip tl-chip--e" style={{ top: -8 }}>
        <Icon name="code" size={18} />
        One block of code
      </div>

      <div className="tl-site">
        <div className="tl-site__bar">
          <i /><i /><i />
          <span>yourwebsite.com</span>
        </div>
        <div className="tl-site__body">
          <b />
          <b />
          <em />
          <em />
          <div className="tl-site__cards"><i /><i /></div>
        </div>

        <div className="tl-site__card">
          <div className="tl-site__who">
            <span>S</span>
            <div>
              <b>Store support</b>
              <small>Ask us anything</small>
            </div>
          </div>
          <p className="tl-site__msg">Hi! Need help choosing? Ask us here.</p>
          <span className="tl-site__cta">Start chat</span>
        </div>
        <div className="tl-site__btn"><Icon name="chat" size={28} strokeWidth={1.9} /></div>
      </div>

      <div className="tl-chip tl-chip--f">
        <Icon name="globe" size={17} />
        Works on any site
      </div>
    </div>
  )
}
