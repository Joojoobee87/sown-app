-- ════════════════════════════════════════════════════════════════════════════
-- More care task types (agreed 5 Nov 2026)
--
-- Adds seven jobs to the task_type list. The edge function, admin editor,
-- calendar and catalogue labels are updated to match in the same commit.
-- (New enum values can't be used until this has been committed, so nothing
-- below uses them.)
-- ════════════════════════════════════════════════════════════════════════════

alter type public.task_type add value if not exists 'mulch';
alter type public.task_type add value if not exists 'cut_back';
alter type public.task_type add value if not exists 'support';         -- support or tie in
alter type public.task_type add value if not exists 'pinch_out';
alter type public.task_type add value if not exists 'take_cuttings';
alter type public.task_type add value if not exists 'repot';           -- repot or top-dress
alter type public.task_type add value if not exists 'bring_indoors';
