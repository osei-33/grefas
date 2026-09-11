import { useNavigate, useLocation, NavigateFunction, Location } from 'react-router-dom';

/**
 * Safe wrapper around useNavigate that catches any context boundary / dual-bundle invariant errors
 * and falls back seamlessly to browser navigation, preventing runtime ErrorBoundary crashes.
 */
export function useSafeNavigate(): NavigateFunction {
  try {
    const navigate = useNavigate();
    return navigate;
  } catch (error) {
    console.warn('useSafeNavigate: fallback to native browser navigation due to router context notice:', error);
    const fallbackNavigate: any = (to: any, options?: any) => {
      if (typeof to === 'number') {
        window.history.go(to);
      } else if (typeof to === 'string') {
        if (options?.replace) {
          window.location.replace(to);
        } else {
          window.location.assign(to);
        }
      } else if (to && typeof to === 'object' && to.pathname) {
        const url = `${to.pathname}${to.search || ''}${to.hash || ''}`;
        if (options?.replace) {
          window.location.replace(url);
        } else {
          window.location.assign(url);
        }
      }
    };
    return fallbackNavigate as NavigateFunction;
  }
}

/**
 * Safe wrapper around useLocation that provides reliable location state even if
 * evaluated before router context initialization or during HMR module transitions.
 */
export function useSafeLocation(): Location {
  try {
    const location = useLocation();
    return location;
  } catch (error) {
    console.warn('useSafeLocation: fallback to window.location due to router context notice:', error);
    return {
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
      search: typeof window !== 'undefined' ? window.location.search : '',
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      state: null,
      key: 'safe-fallback'
    };
  }
}
