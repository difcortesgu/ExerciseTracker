import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/** The Exercises tab, where a detail or form returns to when there is no history (a deep link). */
const LIBRARY_PATH = '/exercises';

/** Goes back, or to the library when the screen was opened directly (S1-17 "a way back"). */
export function useBackToLibrary(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(LIBRARY_PATH);
    }
  }, [router]);
}
