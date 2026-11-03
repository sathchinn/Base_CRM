import { useCallback, useEffect, useState } from 'react';
import { ttcDataClient } from '@/api/ttcDataClient';

export default function useRecords(entityName, sort = '-created_date', limit = 500) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await ttcDataClient.entities[entityName].list({ sort, limit });
      setItems(page?.items || (Array.isArray(page) ? page : []));
      setError('');
    } catch (e) {
      setError(e?.message || 'Could not load records');
    } finally {
      setLoading(false);
    }
  }, [entityName, sort, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, setItems, loading, error, reload };
}