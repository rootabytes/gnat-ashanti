import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandBar, Footer } from '../components/Brand';
import { Card } from '../components/ui';
import { DPC, PRIVACY_UPDATED, ROOTABYTES } from '../lib/org';

// Privacy notice under the Data Protection Act, 2012 (Act 843). Keep it in plain
// language and true to what the code does: if what is collected, who sees it or
// where it is stored changes, update this page and PRIVACY_UPDATED.

export default function Privacy() {
  return (
    <div className="min-h-dvh">
      <BrandBar subtitle="Privacy notice" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-ink">
            <ShieldCheck className="h-6 w-6 text-brand" aria-hidden />
            Privacy notice
          </h1>
          <p className="mt-1 text-sm text-ink-3">Last updated {PRIVACY_UPDATED}</p>
        </div>

        <Section title="Who we are">
          <p>
            GNAT Mapping is built and run by <b>{ROOTABYTES.legalName}</b> ({ROOTABYTES.location}) for the Ghana National Association of
            Teachers (GNAT), Ashanti Region. {ROOTABYTES.name} is registered with the {DPC.name}
            {ROOTABYTES.dpcRegistration ? ` (registration number ${ROOTABYTES.dpcRegistration})` : ''} and is responsible for the personal
            data held in this system, under the Data Protection Act, 2012 (Act 843).
          </p>
        </Section>

        <Section title="What we collect">
          <List
            items={[
              ['District Secretaries', 'Name, phone number and, if given, a name or group. You enter these when you register.'],
              ['Local Secretaries', 'Name and phone number, entered by you or by your District Secretary.'],
              [
                'Regional Secretary and other admins',
                'Name, phone number, email address, a scrambled (hashed) password, and when they last signed in.',
              ],
              [
                'Workplaces',
                'School and workplace names, their category, and, if given, their Ghana Post GPS address. These describe places, not people.',
              ],
              ['Activity log', 'What was changed and when, and by which secretary or admin, so mistakes can be traced and corrected.'],
              ['Server records', 'The time, page and result of each request. Not what you typed, and not your IP address.'],
            ]}
          />
          <p className="mt-3">
            Your phone keeps your sign-in and any list that has not reached us yet, so you do not lose work on a bad network. We use no
            cookies, no advertising and no tracking or analytics tools.
          </p>
        </Section>

        <Section title="Why we use it">
          <p>
            Only to map GNAT's structure (region, districts, locals and workplaces) and to contact secretaries about their submissions. You
            give the details for this purpose when you register or fill in the form. We never sell them, never use them for marketing, and
            never use them for anything else.
          </p>
        </Section>

        <Section title="Who can see it">
          <List
            items={[
              [
                'Regional Secretary and GNAT admins',
                'Everything in their region, including downloads for GNAT use. Every download is logged.',
              ],
              [
                'District Secretary',
                'Their own district and its locals, including the Local Secretaries’s names, phone numbers and access codes.',
              ],
              ['Local Secretary', 'Their own local only.'],
              [ROOTABYTES.name, 'Only what is needed to run, support and fix the system.'],
            ]}
          />
          <p className="mt-3">Nobody else, unless the law requires it.</p>
          <p className="mt-3">
            <b>If you enter someone else's details</b>, for example a Local Secretary's phone number, please tell them and share this notice
            with them.
          </p>
        </Section>

        <Section title="Where it is kept, and how it is protected">
          <p>
            The database and server run on Railway, and the website on Cloudflare. Their servers are outside Ghana, and they handle the data
            under their standard data processing terms. Your browser's address (IP address) passes through their networks to deliver the
            pages.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Every connection is encrypted (HTTPS).</li>
            <li>Access codes are stored hashed and encrypted, and admin passwords are hashed.</li>
            <li>Sign-in attempts are limited, and a reset code signs out every device that used the old one.</li>
            <li>Every change is recorded in the activity log, and the database is backed up daily.</li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <p>
            Contact details are kept only while GNAT needs them for the mapping exercise. Within 12 months after the Regional Secretary
            approves the final structure, secretaries' names and phone numbers are deleted or anonymised. The approved list of districts,
            locals and workplaces is GNAT's official record and is kept.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Under Act 843 you can:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>ask what we hold about you and get a copy;</li>
            <li>correct it: you can edit your own details at any time until your form is approved, or ask us to;</li>
            <li>ask us to delete it or stop using it;</li>
            <li>
              complain to the{' '}
              <a href={DPC.url} target="_blank" rel="noopener" className="font-semibold text-brand">
                {DPC.name}
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            Write to our data protection officer at{' '}
            <a href={`mailto:${ROOTABYTES.dpoEmail}`} className="font-semibold text-brand">
              {ROOTABYTES.dpoEmail}
            </a>{' '}
            or call {ROOTABYTES.phone}. You can also ask your GNAT Regional Secretary.
          </p>
          <p className="mt-3">
            <Link to="/" className="inline-flex min-h-10 items-center font-semibold text-brand">
              Back to GNAT Mapping
            </Link>
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <div className="text-[15px] leading-relaxed text-ink-2">{children}</div>
    </Card>
  );
}

function List({ items }: { items: [string, string][] }) {
  return (
    <dl className="divide-y divide-line rounded-lg border border-line">
      {items.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
          <dt className="font-semibold text-ink">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
