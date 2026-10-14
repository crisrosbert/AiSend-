// WhatsApp vs email, written as how each channel works, not as percentages.
// Open-rate and conversion figures online mostly come from vendors with
// something to sell and differ wildly, so none are quoted here.

const ROWS: Array<[string, string, string]> = [
  ['Where the customer sees it', 'In the chat app they already open many times a day, as a conversation.', 'In an inbox next to newsletters, receipts and work mail.'],
  ['Replying', 'One tap, in the same thread. A person or an AI assistant can answer.', 'The reply lands in a mailbox and is easy to lose track of.'],
  ['Format', 'Short messages, images, PDFs, buttons, catalogues and payment links.', 'Long-form, rich layouts, detailed attachments.'],
  ['Permission', 'Customers must opt in. WhatsApp Business policy requires it.', 'Consent rules depend on your country and your sending tool.'],
  ['What you pay for', 'Per message, priced by category on the WhatsApp Business Platform.', 'Usually by list size or monthly sends.'],
  ['Best for', 'Order updates, reminders, offers, quick questions, cart nudges.', 'Newsletters, long guides, invoices, detailed announcements.'],
]

export function WhatsAppVsEmail() {
  return (
    <section className="py-20 bg-white border-t border-gray-100" aria-labelledby="wa-vs-email">
      <div className="max-w-5xl mx-auto px-4">
        <h2 id="wa-vs-email" className="text-3xl md:text-4xl font-extrabold tracking-tight text-center">WhatsApp or email? Use each where it is strong.</h2>
        <p className="mt-3 text-center text-gray-600 max-w-2xl mx-auto">They do different jobs. Most businesses use both: email for long content, WhatsApp for fast, two-way conversations.</p>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-left text-[15px] border border-gray-200 rounded-2xl overflow-hidden">
            <thead className="bg-emerald-50">
              <tr><th className="p-4 font-bold"><span className="sr-only">Topic</span></th><th className="p-4 font-bold">WhatsApp</th><th className="p-4 font-bold">Email</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([k, w, e]) => (
                <tr key={k} className="border-t border-gray-100 align-top">
                  <th scope="row" className="p-4 font-semibold whitespace-nowrap">{k}</th>
                  <td className="p-4 text-gray-700">{w}</td>
                  <td className="p-4 text-gray-700">{e}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          We do not quote open-rate percentages: published numbers come mostly from vendors and vary widely. Check your own results. See{' '}
          <a className="underline" href="https://business.whatsapp.com/policy" target="_blank" rel="noopener noreferrer">WhatsApp Business policy</a> for the opt-in rules.
        </p>
      </div>
    </section>
  )
}
