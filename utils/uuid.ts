// Simple UUID v4 generator that works on all platforms (web, iOS, Android)
// Uses crypto.getRandomValues when available, falls back to Math.random

export function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers and Node 19+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: generate UUID v4 using crypto.getRandomValues or Math.random
  const getRandomValues =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? (arr: Uint8Array) => crypto.getRandomValues(arr)
      : (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        };

  const bytes = new Uint8Array(16);
  getRandomValues(bytes);

  // Set version (4) and variant (RFC4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Convert to hex string
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
