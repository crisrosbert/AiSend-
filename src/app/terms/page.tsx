import LegalShell from '../(marketing)/legal-shell'

export const metadata = {
  title: 'Terms & Conditions — AiSend',
  description: 'The terms governing your use of AiSend.',
}

/**
 * Public Terms & Conditions. Required for Razorpay (which specifically
 * checks for clear pricing, refund/cancellation, and acceptable-use
 * terms) and for Meta review. Baseline for an Indian SaaS — not legal
 * advice; have a lawyer review and fill bracketed details.
 */
export default function TermsPage() {
  return (
    <LegalShell title="Terms &amp; Conditions" subtitle="Last updated: June 2026">
      <p>
        These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the
        <strong> AiSend</strong> platform (the &quot;Service&quot;). By creating an account or
        using the Service, you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        AiSend provides software to send and receive messages, run campaigns, automate
        replies, and manage customers on the WhatsApp Business Platform via the Official WhatsApp
        Business API. We are an independent software provider; WhatsApp and Meta are trademarks of
        Meta Platforms, Inc.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must provide accurate information and keep your credentials secure.</li>
        <li>You are responsible for all activity under your account.</li>
        <li>You must be at least 18 and able to enter into a binding contract.</li>
      </ul>

      <h2>3. Plans, message credits &amp; billing</h2>
      <ul>
        <li>We offer a Free plan and paid plans (Starter ₹999/month, Growth ₹1,999/month) billed in advance.</li>
        <li>
          WhatsApp message charges apply per message in addition to your plan:
          approximately <strong>₹1.09</strong> per marketing message and <strong>₹0.145</strong> per
          utility/authentication message; service replies are free. Rates are set by Meta and may
          change.
        </li>
        <li>Message credits are prepaid and deducted from your wallet as messages are sent.</li>
        <li>Applicable taxes (e.g. GST) may be added.</li>
      </ul>

      <h2>4. Refunds &amp; cancellation</h2>
      <ul>
        <li>You may cancel your subscription at any time; cancellation takes effect at the end of the current billing cycle.</li>
        <li>
          Subscription fees are generally non-refundable once a billing cycle has begun, except
          where required by law. If you believe you were charged in error, contact us within 7 days
          and we will review the request in good faith.
        </li>
        <li>
          Prepaid message credits are non-refundable once purchased, but unused credits remain
          available in your wallet while your account is active.
        </li>
        <li>Refunds, where approved, are processed to the original payment method via our payment partner.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Send spam, unsolicited, or unlawful messages, or message people without required consent.</li>
        <li>Violate WhatsApp&apos;s or Meta&apos;s policies, or any applicable law.</li>
        <li>Send content that is fraudulent, abusive, hateful, or infringing.</li>
        <li>Attempt to disrupt, reverse-engineer, or gain unauthorized access to the Service.</li>
      </ul>
      <p>
        Violations may result in suspension or termination, and may cause Meta to restrict your
        WhatsApp Business Account — for which we are not responsible.
      </p>

      <h2>6. Your content and contacts</h2>
      <p>
        You retain ownership of your content and contact data. You grant us a limited license to
        process it solely to provide the Service. You are solely responsible for obtaining consent
        to message your contacts and for the content you send.
      </p>

      <h2>7. Service availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service. The Service depends
        on third parties (including Meta/WhatsApp and payment and hosting providers) whose outages or
        policy changes may affect functionality.
      </p>

      <h2>8. Disclaimers &amp; limitation of liability</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties of any kind. To the maximum
        extent permitted by law, AiSend shall not be liable for indirect, incidental, or
        consequential damages, and our total liability shall not exceed the amount you paid to us in
        the three months preceding the claim.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access for breach of
        these Terms or for legal/safety reasons. On termination, your right to use the Service ends;
        certain provisions survive termination.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These Terms are governed by the laws of India, and any disputes are subject to the exclusive
        jurisdiction of the courts at [your city], India.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href="mailto:crisrosbert@gmail.com">crisrosbert@gmail.com</a>.
      </p>
    </LegalShell>
  )
}
