// Who builds and runs the system. Rootabytes is the organisation registered with
// the Data Protection Commission of Ghana, so the privacy notice names it.

export const ROOTABYTES = {
  name: 'Rootabytes',
  legalName: 'Rootabytes Enterprise',
  url: 'https://rootabytes.com',
  location: 'Kumasi, Ghana',
  phone: '+233 24 220 3001',
  dpoEmail: 'dpo@rootabytes.com',
  /** Data Protection Commission registration number. Shown on the privacy notice once filled in. */
  dpcRegistration: '',
};

export const DPC = {
  name: 'Data Protection Commission of Ghana',
  url: 'https://www.dataprotection.org.gh',
};

/**
 * GNAT Ashanti pays nothing for this system while the Classpiler partnership continues: Rootabytes builds,
 * hosts and supports it as its in-kind contribution. Shown on the About page and in the Regional Secretary's
 * explainer PDF (backend/scripts/explainer.ts). No amount or end date is published; keep it in line with
 * the letters to the Regional Secretariat.
 */
export const IN_KIND = {
  partner: 'GNAT Ashanti',
  app: 'Classpiler',
  appUrl: 'https://classpiler.com',
  appWhat: 'AI lesson planning for Ghanaian teachers',
};

/** When this privacy notice last changed. Update it with every change to the notice. */
export const PRIVACY_UPDATED = '30 September 2026';
