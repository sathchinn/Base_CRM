# Integration notes

This folder is a standalone Vite + React dashboard. It is intentionally nested under `base44-crm/` in the repository so the existing production TanStack application at the repository root is preserved.

## Connected to existing TTC data

- `customer_crm` and `v_people`: customer identity and trial/access summary.
- `lead`: lead records.
- `trial`: current free-trial records.
- `v_inbox_plus` and `conversation`: WhatsApp inbox, unread and automation pause state.
- `message` and `msg_template`: message history and message library.
- `automation` and `v_automation_event`: current automation rules and execution history.
- `app_setting`: existing settings plus namespaced JSON metadata for Kanban and customer notes.
- Existing RPCs: `is_admin`, `register_lead`, `link_whatsapp_number`, and existing WhatsApp send function `whatsapp-webhook/send`.

## Not connected by design

No live transaction ledger, paid subscription table, bookings, products, TradingView post tracking, or multi-user team permissions exist in the current schema. The corresponding screens are visibly marked and write actions are disabled. This avoids storing money-related or operational records in a second database or showing seeded sample numbers as real data.

## Safety

No Supabase schema migrations were applied by this integration. No existing rows were deleted or overwritten. The existing main application and its WhatsApp webhook remain untouched.
