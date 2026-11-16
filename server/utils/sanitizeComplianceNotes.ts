const phoneSequence =
  /(^|[^\d])(\(?09\)?(?:[\s().-]*\d){9})(?!\d)/g;

export function sanitizeComplianceNotes(note: string): string {
  if (typeof note !== "string") return "";

  return note
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(phoneSequence, (_match, prefix: string) => `${prefix}[PHONE_MASKED]`)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}
