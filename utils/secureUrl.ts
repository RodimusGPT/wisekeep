/**
 * Utility functions for secure URL handling
 */

/**
 * Redacts sensitive parts of URLs (tokens, signatures, credentials) for safe logging
 * @param url - The URL to redact
 * @returns Redacted URL safe for logging
 */
export function redactUrl(url: string | null | undefined): string {
  if (!url) return '[no url]';

  try {
    // Handle blob URLs separately (they don't expose sensitive data but can be long)
    if (url.startsWith('blob:')) {
      return url.substring(0, 50) + '...[blob]';
    }

    // Parse the URL
    const urlObj = new URL(url);

    // Redact query parameters that might contain sensitive data
    const sensitiveParams = [
      'token',
      'key',
      'apikey',
      'api_key',
      'secret',
      'password',
      'auth',
      'authorization',
      'signature',
      'sig',
      'X-Amz-Signature',
      'X-Amz-Credential',
      'X-Amz-Security-Token',
      'GoogleAccessId',
      'Signature',
      'Expires',
    ];

    const params = new URLSearchParams(urlObj.search);
    let hasRedacted = false;

    for (const param of sensitiveParams) {
      if (params.has(param)) {
        params.set(param, '[REDACTED]');
        hasRedacted = true;
      }
      // Also check case-insensitive
      for (const key of Array.from(params.keys())) {
        if (key.toLowerCase() === param.toLowerCase() && key !== param) {
          params.set(key, '[REDACTED]');
          hasRedacted = true;
        }
      }
    }

    // Reconstruct URL with redacted params
    if (hasRedacted) {
      urlObj.search = params.toString();
      return urlObj.toString();
    }

    // If URL is very long (likely contains encoded data), truncate it
    if (url.length > 200) {
      return url.substring(0, 200) + '...[truncated]';
    }

    return url;
  } catch (error) {
    // If URL parsing fails, redact the whole thing to be safe
    if (url.length > 50) {
      return url.substring(0, 50) + '...[redacted-invalid-url]';
    }
    return '[redacted-invalid-url]';
  }
}

/**
 * Redacts an array of URLs for safe logging
 */
export function redactUrls(urls: (string | null | undefined)[]): string[] {
  return urls.map(url => redactUrl(url));
}
