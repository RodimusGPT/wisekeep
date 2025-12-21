/**
 * Admin Panel Fallback for Native Platforms
 *
 * The actual admin panel is in admin.web.tsx (web-only).
 * This fallback redirects mobile users away since admin is not available on native.
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function AdminScreen() {
  const router = useRouter();

  // Redirect immediately - admin panel is web-only
  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
