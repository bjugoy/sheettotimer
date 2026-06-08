import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, ArrowLeft } from 'lucide-react';

type Lang = 'en' | 'de';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>('en');

  return (
    <div className="min-h-screen bg-warm-950 text-warm-200">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 h-12
        border-b border-warm-800/50 bg-warm-950/90 backdrop-blur">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-2 text-warm-500 hover:text-warm-200 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <Radio className="w-4 h-4" />
          <span className="font-semibold tracking-wide">SheetToTimer</span>
        </button>
        <div className="flex items-center gap-1 bg-warm-900 border border-warm-800 rounded-lg p-0.5">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              lang === 'en' ? 'bg-warm-700 text-warm-100' : 'text-warm-500 hover:text-warm-300'
            }`}>EN</button>
          <button
            onClick={() => setLang('de')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              lang === 'de' ? 'bg-warm-700 text-warm-100' : 'text-warm-500 hover:text-warm-300'
            }`}>DE</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {lang === 'en' ? <PrivacyEN /> : <PrivacyDE />}
      </main>

      <footer className="border-t border-warm-800/50 py-6 text-center text-xs text-warm-700">
        © {new Date().getFullYear()} Notwey · <a href="/terms" className="hover:text-warm-400 transition-colors">Terms of Service</a>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-warm-100 mb-3 pb-2 border-b border-warm-800/60">{title}</h2>
      <div className="space-y-3 text-sm text-warm-400 leading-relaxed">{children}</div>
    </section>
  );
}

function PrivacyEN() {
  return (
    <>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-warm-100 mb-2">Privacy Policy</h1>
        <p className="text-xs text-warm-600">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <Section title="1. Controller & Contact">
        <p>
          The data controller for SheetToTimer (sheettotimer.com) is:
        </p>
        <p className="bg-warm-900/60 border border-warm-800/50 rounded-lg p-4 text-warm-300">
          Richard Libres, operating as <strong>Notwey</strong><br />
          [ADDRESS — see note below]<br />
          Austria<br />
          Email: <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a>
        </p>
        <p className="text-warm-600 text-xs italic">
          Note: A verified business address will be published here once registered. Until then, contact us via email for any data-related requests.
        </p>
      </Section>

      <Section title="2. What Data We Collect">
        <p><strong className="text-warm-300">Account data:</strong> When you create an account we collect your email address, display name, and authentication method (email/password or Google sign-in).</p>
        <p><strong className="text-warm-300">Billing data:</strong> If you subscribe to a paid plan, Stripe processes your payment. We store only your Stripe customer ID and current subscription plan. We never see or store your card number.</p>
        <p><strong className="text-warm-300">Content data:</strong> Schedule items, production names, event names, and speaker notes you create and save within the app.</p>
        <p><strong className="text-warm-300">Onboarding survey (planned):</strong> We plan to collect first name, age, the type of events you manage, how you found SheetToTimer, and an estimate of how many events you run per year. This is voluntary and used only to improve the product.</p>
        <p><strong className="text-warm-300">Technical data:</strong> Your IP address, browser type, and error/crash data collected automatically by our error monitoring service (Sentry). No session recordings are made.</p>
      </Section>

      <Section title="3. How We Use Your Data">
        <p>We use your data to:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Provide, operate, and maintain the SheetToTimer service</li>
          <li>Process your subscription and manage billing via Stripe</li>
          <li>Authenticate your identity and protect your account</li>
          <li>Diagnose technical errors and improve service reliability</li>
          <li>Respond to support requests</li>
          <li>Understand how users use the product (onboarding survey, aggregated only)</li>
        </ul>
        <p>We do not sell your data, use it for advertising, or share it with third parties for their own marketing purposes.</p>
      </Section>

      <Section title="4. Legal Bases (GDPR Art. 6)">
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong className="text-warm-300">Contract performance (Art. 6(1)(b)):</strong> Processing your account and billing data to deliver the service you signed up for.</li>
          <li><strong className="text-warm-300">Legitimate interests (Art. 6(1)(f)):</strong> Error monitoring and abuse prevention.</li>
          <li><strong className="text-warm-300">Consent (Art. 6(1)(a)):</strong> Onboarding survey responses and non-essential cookies (where applicable).</li>
          <li><strong className="text-warm-300">Legal obligation (Art. 6(1)(c)):</strong> Retaining billing records as required by Austrian tax law.</li>
        </ul>
      </Section>

      <Section title="5. Third-Party Services">
        <p>We share data with the following processors:</p>
        <div className="space-y-3">
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Supabase (Supabase Inc., USA)</p>
            <p>Database and authentication provider. Stores your account, schedule, and production data. Data is processed under a Data Processing Agreement with EU Standard Contractual Clauses.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Stripe (Stripe Inc., USA)</p>
            <p>Payment processor. Handles all subscription billing. Stripe is a PCI-DSS Level 1 certified provider. Data transfer is covered by Stripe's EU–US Data Privacy Framework certification.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Google (Alphabet Inc., USA)</p>
            <p>Used only when you explicitly connect your Google account to access Google Sheets. We access your spreadsheet data on your behalf using OAuth tokens. We do not store your Google credentials. OAuth tokens are used only for the duration of your session and discarded when you disconnect.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Sentry (Functional Software Inc., USA)</p>
            <p>Error tracking and crash reporting. May receive error context including your IP address, browser type, and the action that triggered the error. No session recordings or screen captures are made. Data is processed under a Data Processing Agreement.</p>
          </div>
        </div>
      </Section>

      <Section title="6. Cookies & Local Storage">
        <p>We use the following types of cookies and browser storage:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong className="text-warm-300">Strictly necessary:</strong> Session authentication cookies (Supabase), Stripe fraud-prevention cookies. These are required to operate the service and cannot be declined.</li>
          <li><strong className="text-warm-300">Local storage:</strong> Your schedule state and session preferences are saved locally in your browser to provide a seamless experience across page refreshes.</li>
        </ul>
        <p>A cookie consent banner will be shown on your first visit to manage any non-essential cookies we may introduce in the future.</p>
      </Section>

      <Section title="7. Data Retention">
        <p>We retain your data for as long as your account is active. When you delete your account:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Your account, profile, productions, events, and schedule data are deleted within <strong className="text-warm-300">90 days</strong>.</li>
          <li>Billing records are retained for <strong className="text-warm-300">7 years</strong> as required by Austrian tax law (§ 132 BAO).</li>
          <li>Error logs in Sentry are retained for up to 90 days per Sentry's default policy.</li>
        </ul>
      </Section>

      <Section title="8. Your Rights (GDPR)">
        <p>As a data subject under GDPR, you have the right to:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li><strong className="text-warm-300">Access</strong> — request a copy of your personal data</li>
          <li><strong className="text-warm-300">Rectification</strong> — correct inaccurate data</li>
          <li><strong className="text-warm-300">Erasure</strong> — request deletion of your data ("right to be forgotten")</li>
          <li><strong className="text-warm-300">Portability</strong> — receive your data in a machine-readable format</li>
          <li><strong className="text-warm-300">Restriction</strong> — restrict how we process your data</li>
          <li><strong className="text-warm-300">Objection</strong> — object to processing based on legitimate interests</li>
          <li><strong className="text-warm-300">Withdraw consent</strong> — where processing is based on consent, withdraw it at any time</li>
        </ul>
        <p>To exercise any of these rights, contact us at <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a>. We will respond within 30 days.</p>
        <p>You also have the right to lodge a complaint with the Austrian data protection authority:</p>
        <p className="bg-warm-900/60 border border-warm-800/50 rounded-lg p-3 text-warm-300">
          <strong>Datenschutzbehörde</strong><br />
          Barichgasse 40–42, 1030 Wien, Austria<br />
          <a href="https://www.dsb.gv.at" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">www.dsb.gv.at</a>
        </p>
      </Section>

      <Section title="9. Children">
        <p>SheetToTimer is not directed at children. You must be at least <strong className="text-warm-300">16 years old</strong> to create an account. If you believe a child under 16 has created an account, please contact us and we will delete it promptly.</p>
      </Section>

      <Section title="10. International Transfers">
        <p>Our service providers (Supabase, Stripe, Sentry, Google) may process your data in the United States. All transfers are safeguarded by EU Standard Contractual Clauses or an equivalent adequacy mechanism as required by GDPR Chapter V.</p>
      </Section>

      <Section title="11. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. Material changes will be communicated by email or by a notice within the application. The date at the top of this page reflects the most recent update.</p>
      </Section>
    </>
  );
}

function PrivacyDE() {
  return (
    <>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-warm-100 mb-2">Datenschutzerklärung</h1>
        <p className="text-xs text-warm-600">Zuletzt aktualisiert: {new Date().toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <Section title="1. Verantwortlicher & Kontakt">
        <p>Verantwortlicher im Sinne der DSGVO für SheetToTimer (sheettotimer.com) ist:</p>
        <p className="bg-warm-900/60 border border-warm-800/50 rounded-lg p-4 text-warm-300">
          Richard Libres, handelnd als <strong>Notwey</strong><br />
          [ADRESSE — wird nach Gewerbeanmeldung ergänzt]<br />
          Österreich<br />
          E-Mail: <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a>
        </p>
        <p className="text-warm-600 text-xs italic">
          Hinweis: Eine verifizierte Geschäftsadresse wird nach erfolgter Gewerbeanmeldung hier veröffentlicht. Bis dahin stehen wir per E-Mail für alle datenschutzrechtlichen Anfragen zur Verfügung.
        </p>
      </Section>

      <Section title="2. Welche Daten wir erheben">
        <p><strong className="text-warm-300">Kontodaten:</strong> Bei der Kontoerstellung erheben wir Ihre E-Mail-Adresse, Ihren Anzeigenamen sowie Ihre Anmeldemethode (E-Mail/Passwort oder Google-Anmeldung).</p>
        <p><strong className="text-warm-300">Abrechnungsdaten:</strong> Bei kostenpflichtigen Abonnements verarbeitet Stripe Ihre Zahlung. Wir speichern ausschließlich Ihre Stripe-Kunden-ID und den aktuellen Abonnementstatus. Kartendaten sehen oder speichern wir nicht.</p>
        <p><strong className="text-warm-300">Inhaltsdaten:</strong> Zeitplanelemente, Produktionsnamen, Veranstaltungsnamen und Sprechernotizen, die Sie in der App erstellen und speichern.</p>
        <p><strong className="text-warm-300">Onboarding-Umfrage (geplant):</strong> Wir planen, freiwillig Vorname, Alter, Art der betreuten Veranstaltungen, wie Sie SheetToTimer gefunden haben sowie eine Schätzung der jährlich verwalteten Veranstaltungen zu erheben. Die Teilnahme ist freiwillig und dient ausschließlich der Produktverbesserung.</p>
        <p><strong className="text-warm-300">Technische Daten:</strong> Ihre IP-Adresse, Browsertyp und Absturzdaten werden automatisch durch unser Fehlerüberwachungssystem (Sentry) erfasst. Sitzungsaufzeichnungen werden nicht erstellt.</p>
      </Section>

      <Section title="3. Zweck der Datenverarbeitung">
        <p>Wir verwenden Ihre Daten, um:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>den SheetToTimer-Dienst bereitzustellen, zu betreiben und zu verbessern</li>
          <li>Ihr Abonnement über Stripe zu verwalten und abzurechnen</li>
          <li>Ihre Identität zu verifizieren und Ihr Konto zu schützen</li>
          <li>technische Fehler zu diagnostizieren und die Zuverlässigkeit zu verbessern</li>
          <li>Support-Anfragen zu beantworten</li>
          <li>die Nutzung des Produkts zu verstehen (Onboarding-Umfrage, nur aggregiert)</li>
        </ul>
        <p>Wir verkaufen Ihre Daten nicht, verwenden sie nicht für Werbezwecke und geben sie nicht zu Marketingzwecken an Dritte weiter.</p>
      </Section>

      <Section title="4. Rechtsgrundlagen (Art. 6 DSGVO)">
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong className="text-warm-300">Vertragserfüllung (Art. 6 Abs. 1 lit. b):</strong> Verarbeitung von Konto- und Abrechnungsdaten zur Erbringung des gebuchten Dienstes.</li>
          <li><strong className="text-warm-300">Berechtigte Interessen (Art. 6 Abs. 1 lit. f):</strong> Fehlerüberwachung und Missbrauchsprävention.</li>
          <li><strong className="text-warm-300">Einwilligung (Art. 6 Abs. 1 lit. a):</strong> Antworten auf die Onboarding-Umfrage und nicht notwendige Cookies (soweit zutreffend).</li>
          <li><strong className="text-warm-300">Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c):</strong> Aufbewahrung von Abrechnungsunterlagen gemäß österreichischem Steuerrecht.</li>
        </ul>
      </Section>

      <Section title="5. Drittanbieter">
        <p>Wir geben Daten an folgende Auftragsverarbeiter weiter:</p>
        <div className="space-y-3">
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Supabase (Supabase Inc., USA)</p>
            <p>Datenbank- und Authentifizierungsanbieter. Speichert Konto-, Zeitplan- und Produktionsdaten. Die Verarbeitung erfolgt auf Basis eines Auftragsverarbeitungsvertrags mit EU-Standardvertragsklauseln.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Stripe (Stripe Inc., USA)</p>
            <p>Zahlungsdienstleister. Verarbeitet alle Abonnementzahlungen. Stripe ist PCI-DSS Level 1 zertifiziert. Der Datentransfer ist durch Stripes EU-US-Datenschutzrahmen-Zertifizierung abgesichert.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Google (Alphabet Inc., USA)</p>
            <p>Wird nur verwendet, wenn Sie Ihr Google-Konto explizit verbinden, um auf Google Sheets zuzugreifen. Wir greifen per OAuth-Token in Ihrem Auftrag auf Ihre Tabelle zu. Wir speichern Ihre Google-Zugangsdaten nicht. OAuth-Token werden nur für die Dauer Ihrer Sitzung verwendet und danach verworfen.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Sentry (Functional Software Inc., USA)</p>
            <p>Fehlerüberwachung und Absturzmeldungen. Kann Fehlerkontext einschließlich IP-Adresse, Browsertyp und der auslösenden Aktion erhalten. Sitzungsaufzeichnungen werden nicht erstellt. Die Verarbeitung erfolgt auf Basis eines Auftragsverarbeitungsvertrags.</p>
          </div>
        </div>
      </Section>

      <Section title="6. Cookies & Lokaler Speicher">
        <p>Wir verwenden folgende Arten von Cookies und Browser-Speicher:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong className="text-warm-300">Unbedingt erforderlich:</strong> Sitzungs-Authentifizierungscookies (Supabase), Stripe-Betrugsschutz-Cookies. Diese sind für den Betrieb des Dienstes erforderlich und können nicht abgelehnt werden.</li>
          <li><strong className="text-warm-300">Lokaler Speicher:</strong> Ihr Zeitplanstatus und Ihre Sitzungseinstellungen werden lokal in Ihrem Browser gespeichert, um ein nahtloses Erlebnis über Seitenaktualisierungen hinweg zu gewährleisten.</li>
        </ul>
        <p>Bei Ihrem ersten Besuch wird ein Cookie-Zustimmungsbanner angezeigt, mit dem Sie nicht notwendige Cookies verwalten können, die wir in Zukunft einführen könnten.</p>
      </Section>

      <Section title="7. Datenspeicherung">
        <p>Wir speichern Ihre Daten, solange Ihr Konto aktiv ist. Bei Kontolöschung:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Ihr Konto, Ihr Profil, Ihre Produktionen, Veranstaltungen und Zeitplandaten werden innerhalb von <strong className="text-warm-300">90 Tagen</strong> gelöscht.</li>
          <li>Abrechnungsunterlagen werden <strong className="text-warm-300">7 Jahre</strong> lang aufbewahrt, wie nach österreichischem Steuerrecht (§ 132 BAO) vorgeschrieben.</li>
          <li>Fehlerprotokolle in Sentry werden entsprechend der Sentry-Standardrichtlinie bis zu 90 Tage lang aufbewahrt.</li>
        </ul>
      </Section>

      <Section title="8. Ihre Rechte (DSGVO)">
        <p>Als betroffene Person nach der DSGVO haben Sie folgende Rechte:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li><strong className="text-warm-300">Auskunft</strong> — Kopie Ihrer personenbezogenen Daten anfordern</li>
          <li><strong className="text-warm-300">Berichtigung</strong> — unrichtige Daten korrigieren lassen</li>
          <li><strong className="text-warm-300">Löschung</strong> — Löschung Ihrer Daten beantragen („Recht auf Vergessenwerden")</li>
          <li><strong className="text-warm-300">Datenübertragbarkeit</strong> — Daten in maschinenlesbarem Format erhalten</li>
          <li><strong className="text-warm-300">Einschränkung</strong> — Verarbeitung einschränken lassen</li>
          <li><strong className="text-warm-300">Widerspruch</strong> — Verarbeitung auf Basis berechtigter Interessen widersprechen</li>
          <li><strong className="text-warm-300">Widerruf der Einwilligung</strong> — Einwilligung jederzeit widerrufen</li>
        </ul>
        <p>Um diese Rechte auszuüben, kontaktieren Sie uns unter <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a>. Wir antworten innerhalb von 30 Tagen.</p>
        <p>Sie haben außerdem das Recht, Beschwerde bei der österreichischen Datenschutzbehörde einzulegen:</p>
        <p className="bg-warm-900/60 border border-warm-800/50 rounded-lg p-3 text-warm-300">
          <strong>Datenschutzbehörde</strong><br />
          Barichgasse 40–42, 1030 Wien<br />
          <a href="https://www.dsb.gv.at" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">www.dsb.gv.at</a>
        </p>
      </Section>

      <Section title="9. Minderjährige">
        <p>SheetToTimer richtet sich nicht an Kinder. Sie müssen mindestens <strong className="text-warm-300">16 Jahre alt</strong> sein, um ein Konto zu erstellen. Wenn Sie glauben, dass ein Kind unter 16 Jahren ein Konto erstellt hat, kontaktieren Sie uns bitte, und wir werden es unverzüglich löschen.</p>
      </Section>

      <Section title="10. Internationale Datenübermittlungen">
        <p>Unsere Dienstleister (Supabase, Stripe, Sentry, Google) können Ihre Daten in den Vereinigten Staaten verarbeiten. Alle Übermittlungen sind durch EU-Standardvertragsklauseln oder einen gleichwertigen Angemessenheitsmechanismus gemäß Kapitel V DSGVO abgesichert.</p>
      </Section>

      <Section title="11. Änderungen dieser Erklärung">
        <p>Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren. Wesentliche Änderungen werden per E-Mail oder durch einen Hinweis in der Anwendung mitgeteilt. Das Datum oben auf dieser Seite gibt die letzte Aktualisierung an.</p>
      </Section>
    </>
  );
}
