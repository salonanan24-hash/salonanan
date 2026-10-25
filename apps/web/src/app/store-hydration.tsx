import { useEffect } from 'react';
import { useCartStore } from '@/stores/cart-store';
import { useCompareStore } from '@/stores/compare-store';
import { useFavoritesStore } from '@/stores/favorites-store';

export function StoreHydration() {
  useEffect(() => {
    const markCart = () => {
      useCartStore.setState({ hydrated: true });
    };
    const markFavorites = () => {
      useFavoritesStore.setState({ hydrated: true });
    };
    const markCompare = () => {
      useCompareStore.setState({ hydrated: true });
    };

    if (useCartStore.persist.hasHydrated()) markCart();
    if (useFavoritesStore.persist.hasHydrated()) markFavorites();
    if (useCompareStore.persist.hasHydrated()) markCompare();

    const stops = [
      useCartStore.persist.onFinishHydration(markCart),
      useFavoritesStore.persist.onFinishHydration(markFavorites),
      useCompareStore.persist.onFinishHydration(markCompare),
    ];

    return () => {
      for (const stop of stops) stop();
    };
  }, []);

  return null;
}
