import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from './router';

const REQUIRED_TAPS = 10;
const TAP_RESET_MS = 4000;

export function useSecretAdminTap() {
  const { navigate } = useRouter();
  const countRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    countRef.current += 1;
    if (countRef.current >= REQUIRED_TAPS) {
      countRef.current = 0;
      timerRef.current = null;
      navigate('/admin');
      return;
    }

    timerRef.current = window.setTimeout(() => {
      countRef.current = 0;
      timerRef.current = null;
    }, TAP_RESET_MS);
  }, [navigate]);
}
