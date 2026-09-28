import { useEffect, useState } from 'react';
import { api } from './api';
import type { Meta } from './types';

let cache: Meta | null = null;
let inflight: Promise<Meta> | null = null;

export function loadMeta(): Promise<Meta> {
  if (cache) return Promise.resolve(cache);
  inflight ??= api.pub
    .get<Meta>('/meta')
    .then((m) => (cache = m))
    .finally(() => (inflight = null));
  return inflight;
}

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (cache) return;
    loadMeta().then(setMeta, (e) => setError(e.message));
  }, []);
  return { meta, error };
}
