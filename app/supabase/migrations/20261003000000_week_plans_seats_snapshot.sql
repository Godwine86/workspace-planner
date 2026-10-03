-- Snapshot the office seat count on each published week so that changing the
-- "seats" setting later does not rewrite utilization for past weeks.

alter table public.week_plans
  add column if not exists seats integer check (seats > 0);

-- Published weeks take the current seats setting when they are published (unless
-- the client supplies a value). Unpublished weeks drop the snapshot and follow
-- the live setting again, so re-publishing picks up whatever is current then.
create or replace function public.week_plans_snapshot_seats()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.status = 'published' then
    if new.seats is null then
      begin
        select (value #>> '{}')::int into new.seats from public.app_settings where key = 'seats';
      exception when others then
        new.seats := null;
      end;
      if new.seats is null or new.seats < 1 then
        new.seats := 7;
      end if;
    end if;
  else
    new.seats := null;
  end if;
  return new;
end;
$fn$;

create trigger week_plans_snapshot_seats
  before insert or update on public.week_plans
  for each row execute function public.week_plans_snapshot_seats();

-- Backfill already-published weeks with the seat count in effect today
-- (the trigger above fills in the current setting for each touched row).
update public.week_plans set seats = null where status = 'published' and seats is null;
