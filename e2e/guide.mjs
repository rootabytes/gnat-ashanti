// The role guide opens by itself on a person's first sign-in. Check it is there, then close it.
export async function closeGuide(page, role) {
  const dialog = page.getByRole('dialog', { name: `${role} guide` });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Skip guide' }).click();
  await dialog.waitFor({ state: 'hidden' });
}
