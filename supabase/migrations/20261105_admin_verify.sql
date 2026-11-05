-- ════════════════════════════════════════════════════════════════════════════
-- Verifying catalogue profiles (needs 20261105_hta_entries.sql first)
--
-- "Verified by Sown" means care AND safety have been checked, so a species
-- can't be verified while its safety is 'unknown'. A variety inherits its
-- species' safety, and the existing trigger already requires its species
-- to be verified first.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plant_profiles
  add column verified_by_name text;

alter table public.plant_profiles
  add constraint plant_profiles_verified_needs_safety check (
    status = 'draft' or parent_id is not null or safety_status <> 'unknown'
  );

-- Mark a profile verified (p_verified = true) or back to draft (false).
-- Back to draft on a species also moves its varieties back to draft, so a
-- verified variety never sits on an unverified species.
-- Returns the updated profile.
create function public.set_profile_verified(p_id uuid, p_verified boolean)
returns public.plant_profiles
language plpgsql
volatile
set search_path = ''
as $$
declare
  p      public.plant_profiles;
  parent public.plant_profiles;
begin
  if not public.is_catalogue_admin() then
    raise exception 'Only an admin can verify plants';
  end if;

  select * into p from public.plant_profiles where id = p_id;
  if not found then
    raise exception 'No plant profile with id %', p_id;
  end if;

  if p_verified then
    if p.parent_id is null and p.safety_status = 'unknown' then
      raise exception 'Check safety against the HTA list before verifying';
    end if;
    if p.parent_id is not null then
      select * into parent from public.plant_profiles where id = p.parent_id;
      if parent.status <> 'verified' then
        raise exception 'Verify the species (%) before this variety', parent.slug;
      end if;
    end if;
    update public.plant_profiles set
      status = 'verified',
      verified_by = auth.uid(),
      verified_by_name = public.current_user_display_name(),
      verified_at = now(),
      last_reviewed = current_date
    where id = p_id
    returning * into p;
  else
    update public.plant_profiles set
      status = 'draft', verified_by = null, verified_by_name = null, verified_at = null
    where parent_id = p_id and status = 'verified';
    update public.plant_profiles set
      status = 'draft', verified_by = null, verified_by_name = null, verified_at = null
    where id = p_id
    returning * into p;
  end if;

  return p;
end;
$$;

revoke execute on function public.set_profile_verified(uuid, boolean) from public, anon;
grant execute on function public.set_profile_verified(uuid, boolean) to authenticated;
