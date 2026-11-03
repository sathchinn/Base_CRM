import { useEffect, useState } from 'react';
import { ttcDataClient } from '@/api/ttcDataClient';

export default function useDashboardData() {
  const [state, setState] = useState({
    loading: true,
    leads: [],
    subscriptions: [],
    transactions: [],
    bookings: [],
    activity: [],
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [leads, subscriptions, transactions, bookings, audit] = await Promise.all([
          ttcDataClient.entities.TTCLead.list({ sort: '-created_date', limit: 500 }),
          ttcDataClient.entities.TTCSubscription.list({ sort: '-created_date', limit: 500 }),
          ttcDataClient.entities.TTCTransaction.list({ sort: '-paid_at', limit: 500 }),
          ttcDataClient.entities.TTCBooking.list({ sort: 'scheduled_at', limit: 200 }),
          ttcDataClient.entities.TTCAuditLog.list({ sort: '-at', limit: 20 }),
        ]);
        if (cancelled) return;
        const activity = (audit?.items || []).map((a) => ({
          id: a.id,
          type: a.action,
          text: a.summary,
          at: a.at || a.created_date,
        }));
        setState({
          loading: false,
          leads: leads?.items || [],
          subscriptions: subscriptions?.items || [],
          transactions: transactions?.items || [],
          bookings: bookings?.items || [],
          activity,
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}