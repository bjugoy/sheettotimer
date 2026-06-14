import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

type Lang = 'en' | 'de';

export function TermsOfServicePage() {
  const navigate = useNavigate();
  const user     = useAuthStore(s => s.user);
  const [lang, setLang] = useState<Lang>('en');

  return (
    <div className="min-h-screen bg-warm-950 text-warm-200">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 h-12
        border-b border-warm-800/50 bg-warm-950/90 backdrop-blur">
        <button
          onClick={() => navigate(user ? '/dashboard' : '/landing')}
          className="flex items-center gap-2 text-warm-500 hover:text-warm-200 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <Radio className="w-4 h-4" />
          <span className="font-semibold tracking-wide">{user ? 'Dashboard' : 'SheetToTimer'}</span>
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
        {lang === 'en' ? <TermsEN /> : <TermsDE />}
      </main>

      <footer className="border-t border-warm-800/50 py-6 text-center text-xs text-warm-700">
        © {new Date().getFullYear()} Notwey · <a href="/privacy" className="hover:text-warm-400 transition-colors">Privacy Policy</a>
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

function TermsEN() {
  return (
    <>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-warm-100 mb-2">Terms of Service</h1>
        <p className="text-xs text-warm-600">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <Section title="1. Provider">
        <p>
          SheetToTimer (sheettotimer.com) is operated by:
        </p>
        <p className="bg-warm-900/60 border border-warm-800/50 rounded-lg p-4 text-warm-300">
          Richard Libres, operating as <strong>Notwey</strong><br />
          Austria<br />
          Email: <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a>
        </p>
      </Section>

      <Section title="2. Acceptance of Terms">
        <p>By creating an account or using SheetToTimer in any way, you agree to these Terms of Service and our <a href="/privacy" className="text-amber-400 hover:underline">Privacy Policy</a>. If you do not agree, you may not use the service.</p>
        <p>We may update these Terms from time to time. Continued use of the service after changes are published constitutes acceptance of the updated Terms.</p>
      </Section>

      <Section title="3. Eligibility">
        <p>You must be at least <strong className="text-warm-300">16 years old</strong> to create an account. By registering, you confirm that you meet this age requirement.</p>
        <p>By using SheetToTimer, you also confirm that you are not located in a jurisdiction where using this service is prohibited by law.</p>
      </Section>

      <Section title="4. The Service">
        <p>SheetToTimer is a real-time event schedule management tool designed for live event producers, conference organizers, and show operators. It allows you to create, manage, and synchronize countdown timers across multiple devices.</p>
        <p>The service is provided on an <strong className="text-warm-300">"as is"</strong> basis. We do not guarantee uninterrupted availability, particularly for the free tier.</p>
      </Section>

      <Section title="5. Plans & Pricing">
        <p>SheetToTimer offers the following plans:</p>
        <div className="space-y-2">
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Free — €0/month</p>
            <p>Upload schedules, run the timer locally, unlimited schedule rows. No room sharing, no Google Sheets, no cloud saves.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Pro — €4.99/month</p>
            <p>Everything in Free plus: Google Sheets integration, schedule editor, presenter screen, room for up to 5 devices, save productions and events.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Studio — €6.99/month</p>
            <p>Everything in Pro plus: room for up to 15 devices, custom schedule columns.</p>
          </div>
        </div>
        <p>Prices are in EUR and exclude any applicable local taxes. You are responsible for any taxes applicable in your jurisdiction.</p>
      </Section>

      <Section title="6. Subscriptions & Billing">
        <p>Paid subscriptions are billed monthly through <strong className="text-warm-300">Stripe</strong>. By subscribing, you authorize Stripe to charge your payment method on a recurring basis until you cancel.</p>
        <p>Subscriptions renew automatically at the end of each billing period. You can cancel or manage your subscription at any time through the billing portal accessible from your account settings. Cancellation takes effect at the end of the current billing period.</p>
        <p>If a payment fails, Stripe will retry according to its standard retry schedule. Access to paid features may be suspended if payment cannot be collected.</p>
      </Section>

      <Section title="7. Refund Policy">
        <p>We offer a <strong className="text-warm-300">24-hour refund</strong> on new subscriptions. If you are unsatisfied within 24 hours of your first payment for a plan, contact us at <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a> and we will issue a full refund.</p>
        <p>After 24 hours, no refunds are issued for the current billing period. This does not affect any statutory rights you may have under applicable law.</p>
        <p className="bg-warm-900/60 border border-warm-800/50 rounded-lg p-3">
          <strong className="text-warm-300">EU / Austrian consumers — Right of Withdrawal:</strong> Under EU Directive 2011/83/EU, you normally have a 14-day right of withdrawal for digital services. By subscribing and confirming that you want the service to start immediately, you <strong>expressly request immediate access</strong> and acknowledge that your right of withdrawal expires once the service has been fully performed or has begun. The 24-hour refund window above is our voluntary policy on top of this.
        </p>
      </Section>

      <Section title="8. Plan Downgrade & Data">
        <p>If you downgrade from a paid plan to the Free plan (either manually or due to non-payment), your paid features (room sharing, Google Sheets, saved productions, etc.) will be locked. Your data — including saved productions and events — will be <strong className="text-warm-300">retained</strong> and will become accessible again if you re-upgrade.</p>
        <p>We do not automatically delete your content on downgrade.</p>
      </Section>

      <Section title="9. Account Deletion">
        <p>You may delete your account at any time from your account settings. Deleting your account cancels any active subscription and initiates deletion of your personal data as described in our <a href="/privacy" className="text-amber-400 hover:underline">Privacy Policy</a>.</p>
      </Section>

      <Section title="10. Acceptable Use">
        <p>You agree not to use SheetToTimer to:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Upload, store, or transmit illegal content or content that violates third-party rights</li>
          <li>Attempt to reverse-engineer, scrape, or abuse the service infrastructure</li>
          <li>Share your account credentials or room access in a way that circumvents plan limits</li>
          <li>Use the service in any way that violates applicable law</li>
        </ul>
        <p>Commercial use of the service (e.g. using SheetToTimer on paid client productions) is permitted under any paid plan.</p>
      </Section>

      <Section title="11. Intellectual Property">
        <p>SheetToTimer and its underlying software, design, and branding are owned by Notwey. You are granted a limited, non-exclusive, non-transferable licence to use the service in accordance with these Terms.</p>
        <p>You retain ownership of all content you upload or create within the service (schedules, productions, event data). By using the service, you grant Notwey a limited licence to process and store your content solely to provide the service to you.</p>
      </Section>

      <Section title="12. Disclaimer of Warranties">
        <p>The service is provided <strong className="text-warm-300">"as is" and "as available"</strong> without warranties of any kind. We do not warrant that the service will be uninterrupted, error-free, or suitable for any particular purpose.</p>
        <p>SheetToTimer is a timing and schedule management tool. We are not liable for any delays, overtime, or miscommunication at live events arising from reliance on the service.</p>
      </Section>

      <Section title="13. Limitation of Liability">
        <p>To the maximum extent permitted by applicable law, Notwey's total liability to you for any claim arising from the use of SheetToTimer shall not exceed the amount you paid us in the <strong className="text-warm-300">3 months preceding the claim</strong>.</p>
        <p>We are not liable for indirect, incidental, consequential, or punitive damages, including loss of profit, loss of data, or reputational harm.</p>
        <p>Nothing in these Terms limits liability for death or personal injury caused by our negligence, or for fraud.</p>
      </Section>

      <Section title="14. Termination">
        <p>We reserve the right to suspend or terminate your account if you materially breach these Terms, with or without notice depending on the severity of the breach. We will generally attempt to notify you before termination unless the breach is severe (e.g. illegal activity).</p>
        <p>You may terminate your account at any time as described in Section 9.</p>
      </Section>

      <Section title="15. Data Security &amp; Breach Notification">
        <p>We implement appropriate technical and organizational security measures to protect your personal data against unauthorized access, alteration, loss, or destruction.</p>
        <p>In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify the relevant supervisory authority within <strong className="text-warm-300">72 hours</strong> as required by GDPR. If the breach is likely to result in a high risk to your rights and freedoms, we will also notify you directly without undue delay at the email address associated with your account.</p>
      </Section>

      <Section title="16. Governing Law &amp; Dispute Resolution">
        <p>These Terms are governed by the laws of <strong className="text-warm-300">Austria</strong>, without regard to conflict-of-law principles.</p>
        <p>Any disputes shall be submitted to the exclusive jurisdiction of the competent courts in <strong className="text-warm-300">Vienna, Austria</strong>.</p>
        <p>If you are a consumer resident in the EU, you may also use the European Commission's Online Dispute Resolution platform: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">ec.europa.eu/consumers/odr</a>.</p>
      </Section>

      <Section title="17. Contact">
        <p>For questions about these Terms, contact us at <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a>.</p>
      </Section>
    </>
  );
}

function TermsDE() {
  return (
    <>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-warm-100 mb-2">Nutzungsbedingungen</h1>
        <p className="text-xs text-warm-600">Zuletzt aktualisiert: {new Date().toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <Section title="1. Anbieter">
        <p>SheetToTimer (sheettotimer.com) wird betrieben von:</p>
        <p className="bg-warm-900/60 border border-warm-800/50 rounded-lg p-4 text-warm-300">
          Richard Libres, handelnd als <strong>Notwey</strong><br />
          Österreich<br />
          E-Mail: <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a>
        </p>
      </Section>

      <Section title="2. Zustimmung zu den Bedingungen">
        <p>Mit der Erstellung eines Kontos oder der Nutzung von SheetToTimer stimmen Sie diesen Nutzungsbedingungen und unserer <a href="/privacy" className="text-amber-400 hover:underline">Datenschutzerklärung</a> zu. Falls Sie nicht zustimmen, dürfen Sie den Dienst nicht nutzen.</p>
        <p>Wir können diese Bedingungen von Zeit zu Zeit aktualisieren. Die fortgesetzte Nutzung des Dienstes nach der Veröffentlichung von Änderungen gilt als Zustimmung zu den aktualisierten Bedingungen.</p>
      </Section>

      <Section title="3. Nutzungsvoraussetzungen">
        <p>Sie müssen mindestens <strong className="text-warm-300">16 Jahre alt</strong> sein, um ein Konto zu erstellen. Mit der Registrierung bestätigen Sie, diese Altersanforderung zu erfüllen.</p>
        <p>Mit der Nutzung von SheetToTimer bestätigen Sie außerdem, dass Sie sich nicht in einem Rechtssystem befinden, in dem die Nutzung dieses Dienstes gesetzlich verboten ist.</p>
      </Section>

      <Section title="4. Der Dienst">
        <p>SheetToTimer ist ein Echtzeit-Zeitplanverwaltungstool für Live-Event-Produzenten, Konferenzorganisatoren und Show-Operatoren. Es ermöglicht das Erstellen, Verwalten und Synchronisieren von Countdown-Timern auf mehreren Geräten.</p>
        <p>Der Dienst wird <strong className="text-warm-300">„wie besehen"</strong> bereitgestellt. Wir garantieren keine ununterbrochene Verfügbarkeit, insbesondere nicht für den kostenlosen Tarif.</p>
      </Section>

      <Section title="5. Tarife & Preise">
        <p>SheetToTimer bietet folgende Tarife an:</p>
        <div className="space-y-2">
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Free — €0/Monat</p>
            <p>Zeitpläne hochladen, Timer lokal nutzen, unbegrenzte Zeitplanzeilen. Kein Room-Sharing, kein Google Sheets, keine Cloud-Speicherung.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Pro — €4,99/Monat</p>
            <p>Alles aus Free plus: Google-Sheets-Integration, Zeitplaneditor, Presenter-Screen, Room für bis zu 5 Geräte, Produktionen und Veranstaltungen speichern.</p>
          </div>
          <div className="bg-warm-900/40 border border-warm-800/40 rounded-lg p-3">
            <p className="font-medium text-warm-300">Studio — €6,99/Monat</p>
            <p>Alles aus Pro plus: Room für bis zu 15 Geräte, benutzerdefinierte Zeitplanspalten.</p>
          </div>
        </div>
        <p>Preise sind in EUR angegeben und verstehen sich ohne etwaige lokale Steuern. Sie sind für alle in Ihrer Jurisdiktion anfallenden Steuern selbst verantwortlich.</p>
      </Section>

      <Section title="6. Abonnements & Abrechnung">
        <p>Kostenpflichtige Abonnements werden monatlich über <strong className="text-warm-300">Stripe</strong> abgerechnet. Mit dem Abonnement autorisieren Sie Stripe, Ihr Zahlungsmittel wiederkehrend zu belasten, bis Sie kündigen.</p>
        <p>Abonnements verlängern sich automatisch am Ende jedes Abrechnungszeitraums. Sie können Ihr Abonnement jederzeit über das Abrechnungsportal in Ihren Kontoeinstellungen kündigen oder verwalten. Die Kündigung wird am Ende des aktuellen Abrechnungszeitraums wirksam.</p>
        <p>Bei Zahlungsfehlschlag wiederholt Stripe die Abbuchung gemäß seinem Standard-Wiederholungsplan. Bei nicht einziehbarer Zahlung kann der Zugang zu kostenpflichtigen Funktionen gesperrt werden.</p>
      </Section>

      <Section title="7. Rückerstattungsrichtlinie">
        <p>Wir bieten eine <strong className="text-warm-300">24-Stunden-Rückerstattung</strong> für neue Abonnements an. Wenn Sie innerhalb von 24 Stunden nach Ihrer ersten Zahlung für einen Tarif nicht zufrieden sind, kontaktieren Sie uns unter <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a> und wir erstatten den vollen Betrag.</p>
        <p>Nach 24 Stunden werden keine Rückerstattungen für den laufenden Abrechnungszeitraum gewährt. Dies berührt keine gesetzlichen Rechte, die Sie nach geltendem Recht haben.</p>
        <p className="bg-warm-900/60 border border-warm-800/50 rounded-lg p-3">
          <strong className="text-warm-300">EU-/österreichische Verbraucher — Widerrufsrecht:</strong> Nach der EU-Richtlinie 2011/83/EU steht Ihnen bei digitalen Dienstleistungen grundsätzlich ein 14-tägiges Widerrufsrecht zu. Mit dem Abschluss des Abonnements und der Bestätigung, dass Sie den sofortigen Zugang wünschen, <strong>beantragen Sie ausdrücklich den sofortigen Leistungsbeginn</strong> und erkennen an, dass Ihr Widerrufsrecht erlischt, sobald der Dienst vollständig erbracht wurde oder begonnen hat. Das 24-Stunden-Rückerstattungsfenster oben ist unsere freiwillige Kulanzregelung.
        </p>
      </Section>

      <Section title="8. Tarifwechsel & Daten">
        <p>Wenn Sie von einem kostenpflichtigen Tarif auf Free downgraden (manuell oder wegen Zahlungsausfall), werden Ihre kostenpflichtigen Funktionen (Room-Sharing, Google Sheets, gespeicherte Produktionen usw.) gesperrt. Ihre Daten — einschließlich gespeicherter Produktionen und Veranstaltungen — bleiben <strong className="text-warm-300">erhalten</strong> und werden bei erneutem Upgrade wieder zugänglich.</p>
        <p>Beim Downgrade werden Ihre Inhalte nicht automatisch gelöscht.</p>
      </Section>

      <Section title="9. Kontolöschung">
        <p>Sie können Ihr Konto jederzeit über Ihre Kontoeinstellungen löschen. Die Kontolöschung kündigt etwaige aktive Abonnements und leitet die Löschung Ihrer personenbezogenen Daten ein, wie in unserer <a href="/privacy" className="text-amber-400 hover:underline">Datenschutzerklärung</a> beschrieben.</p>
      </Section>

      <Section title="10. Zulässige Nutzung">
        <p>Sie verpflichten sich, SheetToTimer nicht zu nutzen, um:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>illegale Inhalte oder Inhalte, die Rechte Dritter verletzen, hochzuladen, zu speichern oder zu übertragen</li>
          <li>die Dienstinfrastruktur zu reverse-engineeren, zu scrapen oder zu missbrauchen</li>
          <li>Ihre Zugangsdaten oder Room-Zugang so zu teilen, dass Tarifgrenzen umgangen werden</li>
          <li>den Dienst in einer Weise zu nutzen, die gegen geltendes Recht verstößt</li>
        </ul>
        <p>Die kommerzielle Nutzung des Dienstes (z. B. der Einsatz von SheetToTimer bei bezahlten Kundenproduktionen) ist unter jedem kostenpflichtigen Tarif erlaubt.</p>
      </Section>

      <Section title="11. Geistiges Eigentum">
        <p>SheetToTimer sowie die zugrunde liegende Software, das Design und die Markenzeichen sind Eigentum von Notwey. Ihnen wird eine eingeschränkte, nicht ausschließliche, nicht übertragbare Lizenz zur Nutzung des Dienstes gemäß diesen Bedingungen eingeräumt.</p>
        <p>Sie behalten das Eigentum an allen Inhalten, die Sie in den Dienst hochladen oder darin erstellen (Zeitpläne, Produktionen, Veranstaltungsdaten). Durch die Nutzung des Dienstes gewähren Sie Notwey eine eingeschränkte Lizenz zur Verarbeitung und Speicherung Ihrer Inhalte ausschließlich zur Erbringung des Dienstes.</p>
      </Section>

      <Section title="12. Gewährleistungsausschluss">
        <p>Der Dienst wird <strong className="text-warm-300">„wie besehen" und „wie verfügbar"</strong> ohne jegliche Gewährleistung bereitgestellt. Wir gewährleisten nicht, dass der Dienst ununterbrochen, fehlerfrei oder für einen bestimmten Zweck geeignet ist.</p>
        <p>SheetToTimer ist ein Timing- und Zeitplanverwaltungstool. Wir haften nicht für Verzögerungen, Zeitüberschreitungen oder Kommunikationsfehler bei Live-Veranstaltungen, die auf die Nutzung des Dienstes zurückzuführen sind.</p>
      </Section>

      <Section title="13. Haftungsbeschränkung">
        <p>Soweit nach geltendem Recht zulässig, ist die Gesamthaftung von Notwey gegenüber Ihnen für alle Ansprüche aus der Nutzung von SheetToTimer auf den Betrag begrenzt, den Sie uns in den <strong className="text-warm-300">3 Monaten vor dem Anspruch</strong> gezahlt haben.</p>
        <p>Wir haften nicht für indirekte, zufällige, mittelbare oder Strafschäden, einschließlich entgangener Gewinne, Datenverluste oder Reputationsschäden.</p>
        <p>Diese Bedingungen schränken die Haftung für Tod oder Körperverletzung durch unsere Fahrlässigkeit oder für Betrug nicht ein.</p>
      </Section>

      <Section title="14. Kündigung durch uns">
        <p>Wir behalten uns das Recht vor, Ihr Konto bei wesentlichem Verstoß gegen diese Bedingungen zu sperren oder zu kündigen, je nach Schwere des Verstoßes mit oder ohne vorherige Ankündigung. In der Regel werden wir Sie vor einer Kündigung benachrichtigen, es sei denn, der Verstoß ist schwerwiegend (z. B. illegale Aktivität).</p>
        <p>Sie können Ihr Konto jederzeit wie in Abschnitt 9 beschrieben kündigen.</p>
      </Section>

      <Section title="15. Datensicherheit &amp; Meldung von Datenpannen">
        <p>Wir implementieren angemessene technische und organisatorische Sicherheitsmaßnahmen zum Schutz Ihrer personenbezogenen Daten vor unbefugtem Zugriff, Veränderung, Verlust oder Zerstörung.</p>
        <p>Im Falle einer Datenpanne, die voraussichtlich zu einem Risiko für Ihre Rechte und Freiheiten führt, werden wir die zuständige Aufsichtsbehörde innerhalb von <strong className="text-warm-300">72 Stunden</strong> gemäß DSGVO benachrichtigen. Wenn die Datenpanne voraussichtlich ein hohes Risiko darstellt, werden wir Sie zusätzlich direkt und ohne unangemessene Verzögerung unter der mit Ihrem Konto verknüpften E-Mail-Adresse benachrichtigen.</p>
      </Section>

      <Section title="16. Anwendbares Recht &amp; Streitbeilegung">
        <p>Diese Bedingungen unterliegen dem Recht <strong className="text-warm-300">Österreichs</strong>, ohne Berücksichtigung von Kollisionsnormen.</p>
        <p>Alle Streitigkeiten unterliegen der ausschließlichen Zuständigkeit der zuständigen Gerichte in <strong className="text-warm-300">Wien, Österreich</strong>.</p>
        <p>Als EU-Verbraucher können Sie auch die Online-Streitbeilegungsplattform der Europäischen Kommission nutzen: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">ec.europa.eu/consumers/odr</a>.</p>
      </Section>

      <Section title="17. Kontakt">
        <p>Bei Fragen zu diesen Bedingungen kontaktieren Sie uns unter <a href="mailto:support@notwey.com" className="text-amber-400 hover:underline">support@notwey.com</a>.</p>
      </Section>
    </>
  );
}
