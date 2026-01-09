import { useEffect, useRef } from "react";

/**
 * Hook to refetch data when page becomes visible (user returns from another tab/app).
 * This ensures data is fresh when returning to the storefront from admin panel.
 */
export function useVisibilityRefetch(refetchFn: () => void, enabled: boolean = true) {
  const refetchFnRef = useRef(refetchFn);
  
  // Keep the ref updated with the latest refetch function
  useEffect(() => {
    refetchFnRef.current = refetchFn;
  }, [refetchFn]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchFnRef.current();
      }
    };

    const handleFocus = () => {
      refetchFnRef.current();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled]);
}
