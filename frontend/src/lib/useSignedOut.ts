import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Sends the user to sign-in when the API says their session ended (e.g. code was reset). */
export function useSignedOutRedirect(to = '/') {
  const nav = useNavigate();
  useEffect(() => {
    const h = () => nav(to, { replace: true });
    window.addEventListener('gnat:signed-out', h);
    return () => window.removeEventListener('gnat:signed-out', h);
  }, [nav, to]);
}
