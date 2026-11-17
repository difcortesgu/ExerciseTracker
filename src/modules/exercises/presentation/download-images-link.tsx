import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { Button } from '@shared/ui';

import { exerciseRoutes } from './exercise-routes';

export const DOWNLOAD_IMAGES_LINK_LABEL = 'Download all images in Settings';

/**
 * Link from an "Image not available offline" placeholder to Settings → "Offline images" (S1-28,
 * T8), where the bulk download lives. Returns to the tabs underneath and switches to Settings:
 * pushing the Settings route would stack a second tab bar above the current screen.
 */
export function DownloadImagesLink(): ReactElement {
  const router = useRouter();
  const openSettings = () => {
    router.dismissAll();
    router.navigate(exerciseRoutes.offlineImages());
  };

  return <Button label={DOWNLOAD_IMAGES_LINK_LABEL} variant="secondary" onPress={openSettings} />;
}
