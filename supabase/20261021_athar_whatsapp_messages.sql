create table if not exists public.athar_whatsapp_messages (
  message_id text primary key,
  from_number text not null,
  message_text text not null default '',
  status text not null default 'received'
    check (status in ('received', 'processing', 'sent', 'failed', 'ignored')),
  reply_text text,
  provider_status integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athar_whatsapp_messages_created_at_idx
  on public.athar_whatsapp_messages (created_at desc);

alter table public.athar_whatsapp_messages enable row level security;

comment on table public.athar_whatsapp_messages is
  'Private idempotency and delivery log for the Athar WhatsApp webhook. Access is restricted to server-side service role.';
