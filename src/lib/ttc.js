import { format, differenceInCalendarDays } from 'date-fns';

export const LEAD_STAGES = [
  { key: 'new', label: 'New Lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'interested', label: 'Interested' },
  { key: 'demo_scheduled', label: 'Demo Scheduled' },
  { key: 'demo_completed', label: 'Demo Completed' },
  { key: 'trial_requested', label: 'Trial Requested' },
  { key: 'trial_active', label: 'Trial Active' },
  { key: 'payment_pending', label: 'Payment Pending' },
  { key: 'converted', label: 'Converted' },
  { key: 'not_interested', label: 'Not Interested' },
];

export const leadStage = (key) => LEAD_STAGES.find((s) => s.key === key) || { key, label: key || '—' };

export const LEAD_SOURCES = ['TradingView', 'WhatsApp', 'Website', 'Referral', 'Direct', 'Other'];

export const SESSIONS = ['Asian Session', 'European Session', 'US Session'];

export const PLAN_TYPES = ['trial', 'daily', 'weekly', 'monthly', 'custom'];

export const BOOKING_STATUSES = ['requested', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show'];

export const SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'pending_payment',
  'expired',
  'cancelled',
  'suspended',
  'payment_failed',
];

export const TRANSACTION_STATUSES = [
  'created',
  'pending',
  'successful',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
];

export const GATEWAYS = ['razorpay', 'cashfree', 'stripe', 'manual'];

export const TEAM_ROLES = [
  { key: 'super_admin', label: 'Super Admin' },
  { key: 'admin', label: 'Admin' },
  { key: 'lead_manager', label: 'Lead Manager' },
  { key: 'whatsapp_support', label: 'WhatsApp Support' },
  { key: 'trainer', label: 'Trainer' },
  { key: 'finance_manager', label: 'Finance Manager' },
];

export const PERMISSION_KEYS = [
  'Dashboard',
  'Leads',
  'Kanban',
  'WhatsApp',
  'Marketing',
  'Bookings',
  'Customers',
  'Subscriptions',
  'Payments',
  'Reports',
  'Settings',
];

const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ' };

export const currencySymbol = (code = 'INR') => SYMBOLS[code] || `${code} `;

export const fmtMoney = (amount, currency = 'INR') =>
  `${currencySymbol(currency)}${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const fmtMoneyExact = (amount, currency = 'INR') =>
  `${currencySymbol(currency)}${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtCompact = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
};

export const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd MMM yyyy');
};

export const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd MMM, HH:mm');
};

export const fmtTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'HH:mm');
};

export const toInputDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
};

export const toInputDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "yyyy-MM-dd'T'HH:mm");
};

export const normalizePhone = (value = '') => String(value).replace(/[^\d]/g, '').slice(-10);

export const normalizeTv = (value = '') => String(value).trim().toLowerCase().replace(/^@/, '');

export const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return differenceInCalendarDays(d, new Date());
};

export const isOverdue = (value) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || 'T';

export const downloadCsv = (filename, rows) => {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const titleCase = (value = '') =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());