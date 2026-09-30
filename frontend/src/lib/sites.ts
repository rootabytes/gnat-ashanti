// The web address of each GNAT region. They all serve the same site and the same API: the address
// only decides which region the register page starts on, and which address links and guides show.
// Plain data at the top: the guide PDF scripts import this file too.
// A new address also needs a Custom Domain on the Cloudflare Worker and an entry in ALLOWED_ORIGINS
// on Railway (DEPLOY.md, "Another region's address").

export interface RegionSite {
  host: string;
  /** Folder of this region's guide PDFs, served from public/. */
  guides: string;
}

export const REGION_SITES: Record<string, RegionSite> = {
  ASH: { host: 'gnatashanti.rootabytes.com', guides: '/guides' },
  EAS: { host: 'gnateastern.rootabytes.com', guides: '/guides/eastern' },
};

/** For pages without a region (the super admin) and regions that have no address of their own yet. */
export const MAIN_REGION = 'ASH';

export const siteFor = (code: string | null | undefined): RegionSite => (code && REGION_SITES[code]) || REGION_SITES[MAIN_REGION];

let sessionRegion: string | null = null;

/** Called once the signed-in person's region is known, so the links they send use their region's address. */
export function setSessionRegion(code: string | null) {
  sessionRegion = code;
}

/** The region whose address this page was opened on, e.g. EAS on gnateastern.rootabytes.com. */
export function hostRegion(): string | null {
  const h = window.location.hostname;
  return Object.keys(REGION_SITES).find((c) => REGION_SITES[c].host === h) ?? null;
}

/** The region this page works for: the signed-in person's, else the address's. */
export const currentRegion = () => sessionRegion ?? hostRegion();

/**
 * Where a region's links point: its own address on the live site. Anywhere else (local testing,
 * the demo, a preview) links stay on this site so they keep working there.
 */
export function siteOrigin(code: string | null = currentRegion()): string {
  return hostRegion() ? `https://${siteFor(code).host}` : window.location.origin;
}
