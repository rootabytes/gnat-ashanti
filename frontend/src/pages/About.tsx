import type { ReactNode } from 'react';
import { HeartHandshake, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandBar, Footer } from '../components/Brand';
import { Card } from '../components/ui';
import { IN_KIND, ROOTABYTES } from '../lib/org';

// What GNAT Mapping is, who built it, and on what terms: GNAT Ashanti pays nothing, because the system
// is Rootabytes' in-kind contribution to the Classpiler partnership. The partner details live in lib/org.ts.

export default function About() {
  return (
    <div className="min-h-dvh">
      <BrandBar subtitle="About" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-ink">
          <Info className="h-6 w-6 text-brand" aria-hidden />
          About GNAT Mapping
        </h1>

        <Section title="What it is">
          <p>
            GNAT Mapping records the structure of the Ghana National Association of Teachers: region, GNAT districts, locals, and the
            schools and workplaces where members serve. District Secretaries list their locals, Local Secretaries list their workplaces, and
            the Regional Secretary reviews, approves and downloads the result. It follows the <i>GNAT Mapping Activity</i> form.
          </p>
        </Section>

        <section className="rounded-xl border border-line border-l-4 border-l-accent bg-surface shadow-sm">
          <div className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <HeartHandshake className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
              At no cost to {IN_KIND.partner}
            </h2>
            <div className="mt-3 text-[15px] leading-relaxed text-ink-2">
              <p>
                {ROOTABYTES.legalName} built GNAT Mapping, and hosts, maintains and supports it, <b>at no cost to {IN_KIND.partner}</b>.
                This is {ROOTABYTES.name}’ in-kind contribution to its partnership with {IN_KIND.partner}, in recognition of the Regional
                Secretariat’s endorsement of{' '}
                <a href={IN_KIND.appUrl} target="_blank" rel="noopener" className="font-semibold text-brand">
                  {IN_KIND.app}
                </a>
                , {ROOTABYTES.name}’ {IN_KIND.appWhat}.
              </p>
              <List
                items={[
                  [
                    'What it covers',
                    'Design and build, hosting, daily backups, security updates, and support for the Regional Secretary and secretaries.',
                  ],
                  [
                    'For how long',
                    `For as long as the partnership continues. Any change will be agreed with ${IN_KIND.partner} in advance.`,
                  ],
                  ['Agreed separately', 'Major new features, and use by other regions or the National Secretariat.'],
                ]}
              />
            </div>
          </div>
        </section>

        <Section title="Who owns what">
          <List
            items={[
              ['GNAT', 'All the information entered: districts, locals, workplaces and secretaries’ details. GNAT decides how it is used.'],
              [ROOTABYTES.name, `The software itself. ${IN_KIND.partner} has a licence to use it; it is not a sale.`],
            ]}
          />
        </Section>

        <Section title={`Kept apart from ${IN_KIND.app}`}>
          <p>
            The partnership is about support, not data. Nothing in GNAT Mapping, such as secretaries’ names or phone numbers, is shared with{' '}
            {IN_KIND.app} or used to promote it. See the{' '}
            <Link to="/privacy" className="font-semibold text-brand">
              privacy notice
            </Link>
            .
          </p>
        </Section>

        <Section title="Other regions and the National Secretariat">
          <p>
            GNAT Mapping is ready for every GNAT region, with each region’s data seen only by its own Regional Secretary. Regions and the
            National Secretariat that would like to use it can contact {ROOTABYTES.name}.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a href={ROOTABYTES.url} target="_blank" rel="noopener" className="font-semibold text-brand">
              {ROOTABYTES.legalName}
            </a>
            , {ROOTABYTES.location} · <span className="whitespace-nowrap">{ROOTABYTES.phone}</span>
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
    <dl className="mt-3 divide-y divide-line rounded-lg border border-line">
      {items.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="font-semibold text-ink">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
