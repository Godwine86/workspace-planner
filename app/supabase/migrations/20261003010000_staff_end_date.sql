-- Record when an employee leaves instead of deleting them, so their past
-- attendance stays in History and Analytics.
alter table public.staff add column if not exists end_date date;
comment on column public.staff.end_date is 'Last working day. Null while employed. Days after it are excluded from schedule, history and analytics; earlier days are kept.';
