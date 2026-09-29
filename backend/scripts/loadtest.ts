// Load test: many chairmen working at the same moment, all from ONE IP address (as on a mobile
// network or a venue's WiFi, where many phones share an address).
//
//   API_URL=http://localhost:4300/api DISTRICTS=20 LOCALS=5 npx tsx scripts/loadtest.ts
//
// Setup: DISTRICTS District Chairmen register and each adds LOCALS locals.
// Then everyone starts together: every Local Chairman opens their code, adds workplaces one
// by one (each change autosaves, like the phone does) and submits; every District Chairman
// keeps refreshing their dashboard. Run it against a test database, never the live one.
const API = process.env.API_URL ?? 'http://localhost:4300/api';
const DISTRICTS = Number(process.env.DISTRICTS ?? 20);
const LOCALS = Number(process.env.LOCALS ?? 5);
const SAVES = Number(process.env.SAVES ?? 8);
const KEY = process.env.REGISTRATION_KEY ?? '';
const RUN = Date.now().toString(36).slice(-4).toUpperCase();

type Sample = { name: string; ms: number; status: number };
const samples: Sample[] = [];

async function call(name: string, method: string, path: string, body?: unknown, token?: string) {
  const t0 = performance.now();
  let status: number;
  let data: any = null;
  try {
    const res = await fetch(API + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status = res.status;
    data = await res.json().catch(() => null);
  } catch {
    status = 0; // connection refused or reset
  }
  samples.push({ name, ms: performance.now() - t0, status });
  return { status, data };
}

const pause = (min: number, max: number) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
const phone = (n: number) => `024${String(1000000 + n).padStart(7, '0')}`;

async function main() {
  const meta = await (await fetch(`${API}/meta`)).json();
  const region = meta.regions.find((r: any) => r.code === 'ASH') ?? meta.regions[0];

  console.log(`Setup: ${DISTRICTS} districts × ${LOCALS} locals, all from one IP…`);
  const districts: { token: string; code: string }[] = [];
  const localCodes: string[] = [];
  for (let d = 0; d < DISTRICTS; d++) {
    const reg = await call('setup register', 'POST', '/register', {
      regionId: region.id,
      registrationKey: KEY || null,
      districtName: `Load ${RUN} District ${d + 1}`,
      chairName: `Chair ${d + 1}`,
      chairPhone: phone(d),
    });
    if (reg.status !== 201) {
      console.log(`  ✗ registration ${d + 1} refused: ${reg.status} ${reg.data?.error ?? ''}`);
      continue;
    }
    districts.push({ token: reg.data.token, code: reg.data.code });
    for (let l = 0; l < LOCALS; l++) {
      const r = await call(
        'setup add local',
        'POST',
        '/district/locals',
        { name: `Local ${l + 1}`, chairName: `Local Chair ${d}-${l}`, chairPhone: phone(1000 + d * 100 + l) },
        reg.data.token,
      );
      const added = r.data?.locals?.find((x: any) => x.name === `Local ${l + 1}`);
      if (added) localCodes.push(added.code);
    }
  }
  const setupFailures = samples.filter((s) => s.status >= 400 || s.status === 0).length;
  samples.length = 0;
  console.log(
    `  ${districts.length} districts and ${localCodes.length} locals ready${setupFailures ? `, ${setupFailures} setup requests refused` : ''}.`,
  );

  const people = localCodes.length + districts.length;
  console.log(`\nGo: ${people} people at once (${localCodes.length} Local + ${districts.length} District Chairmen)…`);
  const t0 = performance.now();
  const outcomes = { submitted: 0, blocked: 0, failed: 0 };

  const localChair = async (code: string, i: number) => {
    await pause(0, 2000); // people tap the link within a couple of seconds of each other
    const acc = await call('POST /access', 'POST', '/access', { code });
    if (acc.status !== 200) return void (acc.status === 429 ? outcomes.blocked++ : outcomes.failed++);
    const t = acc.data.token;
    await call('GET /local/me', 'GET', '/local/me', undefined, t);
    await call('PATCH /local/me', 'PATCH', '/local/me', { chairName: `Local Chair ${i}`, chairPhone: phone(5000 + i), remarks: null }, t);
    const units: { name: string; category: string; gpsAddress: string | null }[] = [];
    for (let s = 0; s < SAVES; s++) {
      await pause(300, 1200); // typing the next school; the phone autosaves after each change
      units.push({ name: `School ${s + 1}`, category: 'Basic Units', gpsAddress: s % 3 === 0 ? 'AK-039-5028' : null });
      const r = await call('PUT /local/units', 'PUT', '/local/units', { units }, t);
      if (r.status !== 200) return void outcomes.failed++;
    }
    const sub = await call('POST /local/submit', 'POST', '/local/submit', {}, t);
    if (sub.status === 200) outcomes.submitted++;
    else outcomes.failed++;
  };

  const districtChair = async (d: { code: string }) => {
    await pause(0, 2000);
    const acc = await call('POST /access', 'POST', '/access', { code: d.code });
    if (acc.status !== 200) return void (acc.status === 429 ? outcomes.blocked++ : outcomes.failed++);
    for (let k = 0; k < 6; k++) {
      await call('GET /district/me', 'GET', '/district/me', undefined, acc.data.token);
      await pause(1500, 3000); // watching locals submit
    }
  };

  await Promise.all([...localCodes.map(localChair), ...districts.map(districtChair)]);
  const secs = (performance.now() - t0) / 1000;

  // Report
  const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];
  const byName = new Map<string, Sample[]>();
  for (const s of samples) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
  console.log(
    `\n${'request'.padEnd(20)} ${'count'.padStart(6)} ${'errors'.padStart(7)} ${'median'.padStart(8)} ${'p95'.padStart(8)} ${'slowest'.padStart(8)}`,
  );
  for (const [name, xs] of byName) {
    const ms = xs.map((x) => x.ms).sort((a, b) => a - b);
    const errs = xs.filter((x) => x.status >= 400 || x.status === 0);
    const codes = [...new Set(errs.map((e) => e.status))].join(',');
    console.log(
      `${name.padEnd(20)} ${String(xs.length).padStart(6)} ${String(errs.length).padStart(7)} ${pct(ms, 50).toFixed(0).padStart(6)}ms ${pct(ms, 95).toFixed(0).padStart(6)}ms ${ms[ms.length - 1].toFixed(0).padStart(6)}ms${codes ? `  (HTTP ${codes})` : ''}`,
    );
  }
  const all = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => s.status >= 400 || s.status === 0).length;
  console.log(
    `\n${samples.length} requests in ${secs.toFixed(1)} s (${(samples.length / secs).toFixed(0)}/s), p95 ${pct(all, 95).toFixed(0)} ms, ${errors} errors.`,
  );
  console.log(
    `Local Chairmen: ${outcomes.submitted} of ${localCodes.length} submitted. Turned away by the rate limit: ${outcomes.blocked}. Other failures: ${outcomes.failed}.`,
  );
  process.exit(errors || outcomes.blocked || outcomes.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
