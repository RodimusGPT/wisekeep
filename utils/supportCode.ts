/**
 * Support Code Utility
 *
 * Generates short, readable codes from user UUIDs for customer support.
 * Format: WK-XXXX (e.g., WK-7X3M)
 *
 * The code is deterministic - same user always gets same code.
 * Codes are case-insensitive and avoid confusing characters (0/O, 1/I/L).
 */

// Characters used in support codes (no 0, O, 1, I, L to avoid confusion)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;
const PREFIX = 'WK';

/**
 * Generate a support code from a user ID (UUID)
 * @param userId - The user's UUID
 * @returns Support code like "WK-7X3M"
 */
export function generateSupportCode(userId: string): string {
  // Remove hyphens from UUID and convert to a numeric hash
  const cleanId = userId.replace(/-/g, '').toLowerCase();

  // Create a simple hash from the UUID
  let hash = 0;
  for (let i = 0; i < cleanId.length; i++) {
    const char = cleanId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Make hash positive
  hash = Math.abs(hash);

  // Convert hash to our alphabet
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[hash % ALPHABET.length];
    hash = Math.floor(hash / ALPHABET.length);
  }

  return `${PREFIX}-${code}`;
}

/**
 * Validate support code format
 * @param code - The support code to validate
 * @returns True if format is valid
 */
export function isValidSupportCodeFormat(code: string): boolean {
  const pattern = new RegExp(`^${PREFIX}-[${ALPHABET}]{${CODE_LENGTH}}$`, 'i');
  return pattern.test(code.trim());
}

/**
 * Normalize a support code (uppercase, trim)
 * @param code - The support code to normalize
 * @returns Normalized code
 */
export function normalizeSupportCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Extract the code part (without prefix)
 * @param fullCode - The full support code (e.g., "WK-7X3M")
 * @returns Just the code part (e.g., "7X3M")
 */
export function extractCodePart(fullCode: string): string {
  const normalized = normalizeSupportCode(fullCode);
  return normalized.replace(`${PREFIX}-`, '');
}
