export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  digit: boolean;
};

/** At least 8 characters, one uppercase letter, and one digit. */
export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    upper: /\p{Lu}/u.test(password),
    digit: /\d/.test(password),
  };
}

export function passwordIsStrong(password: string): boolean {
  const checks = passwordChecks(password);
  return checks.length && checks.upper && checks.digit;
}
