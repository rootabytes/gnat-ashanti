// Step-by-step guides for each role. One source for both the on-screen guide shown at first
// sign-in (components/Guide.tsx) and the printable PDFs in public/guides/, made with
// `npm --prefix backend run guides`. Plain data only: the PDF script imports this file too.
// Button names are written exactly as they appear on screen.

import { MAIN_REGION, siteFor } from './sites';

export type GuideRole = 'local' | 'district' | 'admin' | 'super';

export type GuideIcon =
  | 'link'
  | 'user'
  | 'list'
  | 'excel'
  | 'send'
  | 'returned'
  | 'map'
  | 'share'
  | 'track'
  | 'review'
  | 'key'
  | 'download'
  | 'tree'
  | 'userMinus'
  | 'userPlus';

export interface GuideStep {
  icon: GuideIcon;
  title: string;
  body: string;
}

export interface Guide {
  role: GuideRole;
  /** Who the guide is for, e.g. "Local Secretary". */
  name: string;
  /** One sentence: what this person does in the system. */
  summary: string;
  steps: GuideStep[];
  tips: string[];
  /** Path of the printable PDF, served by the website. */
  pdf: string;
  /** The web address the guide sends people to. */
  site: string;
  /** Another guide that also applies to this person. */
  related?: GuideRole;
}

/** The main address, used by the Ashanti explainer PDF. */
export const SITE = siteFor(MAIN_REGION).host;
/** Printed on the PDFs. Change it when the guides change. */
export const GUIDES_UPDATED = '2026-09-29';

/** The guides for one region: its own address and PDFs. The super admin's guide is the same everywhere. */
export function guidesFor(code: string | null): Record<GuideRole, Guide> {
  const { host: site, guides: dir } = siteFor(code);
  const main = siteFor(MAIN_REGION);
  return {
    local: {
      role: 'local',
      name: 'Local Secretary',
      summary: 'You list every school and workplace where members of your GNAT local work.',
      pdf: `${dir}/GNAT-Mapping-Guide-Local-Secretary.pdf`,
      site,
      steps: [
        {
          icon: 'link',
          title: 'Open your link',
          body: `Your District Secretary sends you a link and an access code by WhatsApp or SMS. Tap the link, or go to ${site} and type the code. Keep the code private: anyone who has it can change your local.`,
        },
        {
          icon: 'user',
          title: 'Add your details',
          body: 'Step 1, Secretary: enter your name and phone number, then tap Save & continue.',
        },
        {
          icon: 'list',
          title: 'List the workplaces',
          body: 'Step 2, Workplaces: type each school, office or institution, choose its category and tap Add. The GPS address (for example AK-039-5028) is optional.',
        },
        {
          icon: 'excel',
          title: 'Long list? Use Excel',
          body: 'Tap Excel template, fill it in on your phone or a computer, then tap Import from Excel. Check the preview before you add them.',
        },
        {
          icon: 'send',
          title: 'Review and submit',
          body: 'Step 3, Review & submit: check the list, then tap Submit local. It is then locked while the Regional Secretary reviews it.',
        },
        {
          icon: 'returned',
          title: 'If it comes back',
          body: 'If your local is returned, the Regional Secretary’s note appears in red. Make the corrections and submit again.',
        },
      ],
      tips: [
        'Your work is saved as you go. If the network drops, it stays on your phone until you are back online.',
        'Come back any time with the same link or code, on any phone.',
        'Lost your code? Ask your District Secretary or the Regional Secretary to send it again.',
        'List each workplace once, with its correct category.',
      ],
    },

    district: {
      role: 'district',
      name: 'District Secretary',
      summary: 'You set up your GNAT district, add your Local Secretaries and send each one their access code.',
      pdf: `${dir}/GNAT-Mapping-Guide-District-Secretary.pdf`,
      site,
      steps: [
        {
          icon: 'link',
          title: 'Get in',
          body: 'Register from the link the Regional Secretary shares, using the registration key in the same message. Your district code then appears on screen: tap Send to my WhatsApp to keep a copy. If you were sent a code instead, just open its link.',
        },
        {
          icon: 'user',
          title: 'Add your details',
          body: 'Step 1, Secretary: your name and phone number, so the Regional Secretary can reach you. Tap Save & continue.',
        },
        {
          icon: 'map',
          title: 'Choose political districts',
          body: 'Step 2: tick the political administrative district(s) your GNAT district covers. Type in the search box to find them quickly.',
        },
        {
          icon: 'userPlus',
          title: 'Add your Local Secretaries',
          body: 'Tap Add Local Secretary (at the top of every step). Enter the local’s name and its secretary’s name and phone number, then tap Add Local Secretary. Their code appears straight away: tap WhatsApp or SMS to send it from your own phone.',
        },
        {
          icon: 'userMinus',
          title: 'Remove a Local Secretary',
          body: 'Tap Remove secretary on a local: their code stops working at once and the workplaces already listed are kept. Then tap Add secretary for the new one.',
        },
        {
          icon: 'track',
          title: 'Follow up',
          body: 'Each local shows In progress, Submitted, Returned or Approved. If a Local Secretary cannot do it, tap Fill workplaces and list them on their behalf.',
        },
        {
          icon: 'send',
          title: 'Review and submit',
          body: 'Step 4, Review & submit: check everything and tap Submit district. Locals that have not finished can still submit after you.',
        },
        {
          icon: 'returned',
          title: 'If it comes back',
          body: 'A returned district shows the Regional Secretary’s note. Correct it and submit again. Once approved it can no longer be changed.',
        },
      ],
      tips: [
        'Code sent to the wrong person? Open Share code on that local and tap Make new code, then send the new one.',
        'Everything is saved as you go. Stop and continue later on any phone.',
        'The system never sends messages or uses your credit by itself. Your normal SMS rate applies to SMS you send.',
      ],
    },

    admin: {
      role: 'admin',
      name: 'Regional Secretary',
      summary:
        'You run the mapping for your region: add the District Secretaries, follow progress, review submissions and download the results.',
      pdf: `${dir}/GNAT-Mapping-Guide-Regional-Secretary.pdf`,
      site,
      steps: [
        {
          icon: 'key',
          title: 'Sign in',
          body: `Go to ${site}/admin and sign in with your email or phone number. The first time, add your email and choose your own password.`,
        },
        {
          icon: 'userPlus',
          title: 'Add District Secretaries',
          body: 'Tap Add District Secretary (top of the menu, and on Overview). Enter the GNAT district and the secretary’s name and WhatsApp number, then send them the code that appears. Or tap Share sign-up link to post the registration link and key in their WhatsApp group.',
        },
        {
          icon: 'userMinus',
          title: 'Remove a District Secretary',
          body: 'On Districts, tap Remove secretary. Their code stops working at once. The district’s locals and workplaces are kept; tap Add secretary to add the new one. A district with nothing filled in yet is removed completely.',
        },
        {
          icon: 'track',
          title: 'Follow progress',
          body: 'Overview shows live totals and the political districts not yet covered. Districts lists every district and its status. Tap Remind to send a WhatsApp or SMS reminder.',
        },
        {
          icon: 'review',
          title: 'Review submissions',
          body: 'Open a submitted district to check its locals and workplaces. Tap Approve district, or Return for correction with a short note the District Secretary will see.',
        },
        {
          icon: 'key',
          title: 'Access codes',
          body: 'Access codes lists every code. Send one by WhatsApp or SMS, read it out on a call, or Print code slips for a meeting. Reset a code if the wrong person has it.',
        },
        {
          icon: 'download',
          title: 'Download the results',
          body: 'Downloads gives Excel, CSV and a PDF report, always built from the latest data.',
        },
        {
          icon: 'tree',
          title: 'Structure and Activity',
          body: 'Structure shows districts, locals and workplaces as a tree. Activity shows who changed what, and when.',
        },
      ],
      tips: [
        'Every Send button opens your own WhatsApp or SMS with the message ready. The system has no messaging provider.',
        'Downloads contain names and phone numbers. Keep them within GNAT.',
        'Forgot your password? Ask the super admin for a new temporary one.',
      ],
    },

    super: {
      role: 'super',
      name: 'Super Admin',
      summary: 'You run the system: you add and remove admins and keep everything working. You do not see the data the regions collect.',
      pdf: `${main.guides}/GNAT-Mapping-Guide-Super-Admin.pdf`,
      site: main.host,
      steps: [
        {
          icon: 'key',
          title: 'Set up your account',
          body: 'Sign in with the email and temporary password set on the server. Add your phone number and choose your own password.',
        },
        {
          icon: 'userPlus',
          title: 'Add an admin',
          body: 'Admins › Add admin: their name, WhatsApp number and region. The system makes a temporary password.',
        },
        {
          icon: 'send',
          title: 'Send their sign-in',
          body: 'Tap WhatsApp or SMS to send the sign-in link, their phone number and temporary password from your own phone. It works for 7 days.',
        },
        {
          icon: 'user',
          title: 'Their first sign-in',
          body: 'They sign in with their phone number, add their email and choose their own password. The temporary password then stops working.',
        },
        {
          icon: 'key',
          title: 'Forgotten passwords',
          body: 'Admins › New password gives them a fresh temporary password. Send it the same way.',
        },
        {
          icon: 'userMinus',
          title: 'Remove access',
          body: 'Remove an admin who no longer needs access. They are signed out straight away.',
        },
        {
          icon: 'track',
          title: 'Check the system',
          body: 'System shows whether the database is working, the version running, which regions are open, and admins who have not finished setting up. Activity lists every admin sign-in and change.',
        },
      ],
      tips: [
        'Districts, locals, workplaces, names and phone numbers, and downloads are only for each region’s admins. The system does not show them to the super admin.',
        'Open a region under System only when its Regional Secretary has an admin account.',
        'The temporary password in the server settings works only once: after your first sign-in, your own password replaces it.',
      ],
    },
  };
}
