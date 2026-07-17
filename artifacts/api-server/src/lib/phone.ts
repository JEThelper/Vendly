export function normalizePhone(phone: string): string {
  // Remove all whitespace and leading '+'
  return phone.replace(/\s+/g, '').replace(/^\+/, '');
}
