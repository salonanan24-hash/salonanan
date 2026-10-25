/** Store managers. Registration never grants this role. */
export const adminEmails = ['salonanan24@gmail.com'] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  const folded = email?.trim().toLowerCase() ?? '';
  return adminEmails.some((item) => item === folded);
}
