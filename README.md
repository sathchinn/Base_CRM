# Thanks To Chart CRM Dashboard

A Vite + React CRM dashboard adapted to use the existing Thanks To Chart Supabase project.

## Run locally

```bash
cp .env.example .env.local
# Set VITE_SUPABASE_PUBLISHABLE_KEY in .env.local
npm install
npm run dev
```

The application uses the Supabase project configured by `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Sign-in is through Supabase Auth. Access is restricted by the existing `public.is_admin()` authorization check and the database's row-level security policies.

## Current live data connections

The dashboard reads existing TTC data for:

- Customer profiles (`customer_crm`, `v_people`, `person`, `identifier`)
- Leads (`lead`)
- Trial and TradingView access state (`trial`, `v_people`)
- WhatsApp inbox and conversations (`v_inbox_plus`, `conversation`)
- WhatsApp message history and saved message templates (`message`, `msg_template`)
- Existing automation rules and execution events (`automation`, `v_automation_event`)
- Application settings (`app_setting`)

Supported actions use existing database functions and the existing WhatsApp send endpoint. Lead pipeline metadata and supplementary customer notes are stored as JSON settings in `app_setting` because the current production schema does not yet have dedicated CRM extension tables for those fields.

## Modules that are intentionally read-only / awaiting schema

The existing TTC database does not currently contain a verified payment ledger, paid-subscription contract table, booking table, product catalogue, TradingView post/interaction tables or a full team-role model. Those pages show explicit connection notices and disable write actions. No fake financial or marketing records are created, and no payment is recorded or subscription activated by this dashboard.

## Security

- Never put Supabase service-role keys in the browser.
- Use only the Supabase publishable/anon key in `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Keep `.env.local` out of Git.
- Existing RLS and `is_admin()` checks remain authoritative.
- Payment gateway processing is not enabled by this dashboard.

## Notes

This app is kept in its own folder so the existing root TTC/TanStack application remains untouched. It is a parallel dashboard branch for review; it does not replace the current production application.
