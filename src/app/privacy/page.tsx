import LegalShell from '../(marketing)/legal-shell'

export const metadata = {
  title: 'Privacy Policy — AiSend',
  description: 'How AiSend collects, uses, and protects your data.',
}

/**
 * Public Privacy Policy. Required for Razorpay onboarding and Meta Tech
 * Provider / App Review. Covers data collected, WhatsApp/Meta platform
 * data, payment data, sharing, retention, security, and user rights.
 *
 * NOTE: This is a solid, honest baseline written for an Indian SaaS. It
 * is not legal advice — have a lawyer review before relying on it for
 * compliance, and fill in the bracketed company/contact details.
 */
export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" subtitle="Last updated: June 2026">
      <p>
        This Privacy Policy explains how <strong>AiSend</strong> (&quot;AiSend&quot;,
        &quot;we&quot;, &quot;us&quot;) collects, uses, shares, and protects information when you use our
        WhatsApp marketing and engagement platform (the &quot;Service&quot;) available at
        ai-send-henna.vercel.app and related domains. By using the Service, you agree to this Policy.
      </p>

      <h2>1. Who we are</h2>
      <p>
        AiSend provides software that lets businesses send and receive messages, run
        campaigns, automate replies, and manage customers on the WhatsApp Business Platform, using
        the Official WhatsApp Business API provided by Meta Platforms, Inc.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li><strong>Account data:</strong> name, email, phone number, business name, and password.</li>
        <li><strong>Business profile:</strong> your WhatsApp Business Account details, phone number IDs, and message templates you create.</li>
        <li><strong>Contacts you upload:</strong> the phone numbers and contact details of the customers you choose to message.</li>
        <li><strong>Payment data:</strong> when you purchase a plan or credits, payment is processed by our payment partner (Razorpay). We do not store full card numbers.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>Usage data such as features used, campaigns sent, and message delivery status.</li>
        <li>Device and log data such as IP address, browser type, and timestamps, used for security and reliability.</li>
      </ul>
      <h3>WhatsApp / Meta data</h3>
      <p>
        When you connect your WhatsApp Business Account, we process messages and related metadata
        (sender, recipient, timestamp, delivery and read status) strictly to provide the Service.
        This data is handled in accordance with Meta&apos;s WhatsApp Business Platform terms and
        policies.
      </p>

      <h2>3. How we use information</h2>
      <ul>
        <li>To provide, operate, and maintain the Service.</li>
        <li>To send and receive WhatsApp messages on your behalf, as you direct.</li>
        <li>To process payments and manage your subscription and message credits.</li>
        <li>To provide customer support and respond to your requests.</li>
        <li>To improve the Service, prevent fraud, and ensure security.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>4. How we share information</h2>
      <p>We do not sell your personal data. We share information only with:</p>
      <ul>
        <li><strong>Meta / WhatsApp:</strong> to deliver messages through the Official WhatsApp Business API.</li>
        <li><strong>Payment processors (Razorpay):</strong> to process transactions securely.</li>
        <li><strong>Infrastructure providers</strong> (e.g. hosting and database providers) who process data on our behalf under confidentiality obligations.</li>
        <li><strong>Authorities</strong> when required by law or to protect rights and safety.</li>
      </ul>

      <h2>5. Data retention</h2>
      <p>
        We retain your data for as long as your account is active or as needed to provide the
        Service, comply with legal obligations, resolve disputes, and enforce agreements. You may
        request deletion of your account and associated data at any time (see Section 7).
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard measures to protect your data, including encryption of sensitive
        credentials (such as access tokens) and access controls. No method of transmission or
        storage is completely secure, but we work to protect your information and notify you of
        material incidents as required by law.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Subject to applicable law, you may request to access, correct, export, or delete your
        personal data, and you may withdraw consent for certain processing. To exercise these
        rights, contact us at the address in Section 10.
      </p>

      <h2>8. Your customers&apos; data</h2>
      <p>
        You are responsible for obtaining any consents required to message the contacts you upload,
        and for complying with WhatsApp&apos;s policies and applicable laws (including anti-spam and
        data-protection laws). You act as the data controller for your contacts; we act as a
        processor on your behalf.
      </p>

      <h2>9. Children</h2>
      <p>The Service is not directed to individuals under 18, and we do not knowingly collect their data.</p>

      <h2>10. Contact us</h2>
      <p>
        For any privacy questions or requests, contact us at{' '}
        <a href="mailto:crisrosbert@gmail.com">crisrosbert@gmail.com</a>. We aim to respond within a
        reasonable timeframe.
      </p>

      <h2>11. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. Material changes will be posted on this page
        with an updated &quot;Last updated&quot; date.
      </p>
    </LegalShell>
  )
}
