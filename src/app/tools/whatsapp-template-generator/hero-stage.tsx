// The picture beside the heading: a phone showing an order update template
// with its button, and two chips for what the tool does with it. The wording
// is an example only.

import { Icon } from '@/components/tools/landing/icons'
import { TemplateBubble } from './template-bubble'

export function TemplateHeroStage() {
  return (
    <div className="tl-stage" aria-hidden="true">
      <div className="tl-chip tl-chip--e">
        <Icon name="shield" size={18} />
        Rules checked
      </div>
      <div className="tl-chip tl-chip--f tl-chip--mono" style={{ bottom: 92 }}>
        <Icon name="code" size={17} />
        template.json
      </div>

      <div className="tl-phone">
        <div className="tl-phone__head">
          <span className="tl-phone__avatar">
            <Icon name="store" size={17} />
          </span>
          <div>
            <div className="tl-phone__name">Your business</div>
            <div className="tl-phone__status">Business account</div>
          </div>
        </div>
        <div className="tl-phone__body">
          <span className="tl-day">Today</span>
          <TemplateBubble
            header="Your order is on its way"
            body="Hi *Priya*, your order *#A1043* has shipped and should reach you by Friday."
            footer="Reply if you need help"
            buttons={[{ kind: 'url', label: 'Track order' }]}
          />
        </div>
        <div className="tl-phone__foot">
          <span className="tl-phone__input">Message</span>
          <span className="tl-phone__send">
            <Icon name="send" size={16} />
          </span>
        </div>
      </div>
    </div>
  )
}
