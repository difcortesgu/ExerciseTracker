import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Calls `refresh` whenever the screen is shown again after another screen covered it (e.g. back
 * from the detail or the form), so created, edited or deleted exercises are reflected (S1-16).
 * Not on the first focus: the screen's own initial load covers it. Pass a stable `refresh`.
 */
export function useRefreshOnReturn(refresh: () => void): void {
  const hasBeenShown = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasBeenShown.current) {
        refresh();
      } else {
        hasBeenShown.current = true;
      }
    }, [refresh]),
  );
}
