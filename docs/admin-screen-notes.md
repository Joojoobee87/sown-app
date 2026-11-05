# Admin screen notes (from planning with Jo, 5 Nov 2026)

Read alongside `docs/plant-catalogue-spec.md`. These are the agreed requirements and the rules that matter most.

## Purpose
An in-app, admin-only area (e.g. `/admin`) where Jo builds and verifies the plant catalogue. Not the Supabase Table Editor.

## Must have
1. **Review queue**: draft profiles, newest first, including drafts created by user scans. Show which fields Claude filled (`field_sources`).
2. **Plant editor**: every spec field, with the profile's label photos shown alongside. Species/variety aware: editing a variety only stores what differs from its species.
3. **Add from a label**: upload label front + back (and optional plant photos); Claude reads them and drafts the profile. Facts taken from the label are marked `label` in `field_sources`. Never copy label wording or images into public content.
4. **HTA safety lookup** (see rules below).
5. **Verify**: marks the profile verified with Jo's name and date.
6. **Photos**: label photos go to the private `catalogue-label-photos` bucket; Jo's own plant photos to `catalogue-photos`.

## HTA lookup rules (important)
- Data: `~/Library/Mobile Documents/com~apple~CloudDocs/Sown/Reference/hta_potentially_harmful_plants_2022.csv` (363 rows: 300 entries + 63 "see" cross-references). Load into an admin-only table. **Do not commit the CSV**: the list is HTA copyright.
- **Never auto-fill safety.** Show matching rows and let Jo choose one, or choose "Not on HTA list".
- Search genus, taxon, synonyms and common names; follow `see_also` cross-references.
- Match on the plant, not just the genus. Examples: "Salvia" rows are only *S. rosmarinus* and *S. divinorum*; hardy *Geranium* is not listed but *Pelargonium* is a different genus; `hta_condition` limits some rows (e.g. *Laurus nobilis*, female plants only; *Prunus*, varieties bearing ornamental fruit).
- Show `hta_condition`, the HTA label wording and `more_than_one_label_applies` so Jo can judge.
- On pick, fill: `safety_status`, `harmful_to`, `pets_affected` ("all pets" = every pet value), `harmful_if_eaten`, `skin_irritant`, `hta_condition`, `hta_edition` = "3rd edition (2022)", `safety_verified_by`, `safety_verified_at`.
- Safety is set on the species record; varieties inherit it.

## Open question for Jo
- Should **Verify** require safety to have been checked (not `unknown`) first? Suggested: yes, since "Verified by Sown" should mean care and safety have both been checked.

## Later (not now)
- Bulk import: Jo's iCloud archive (`Sown/Sown Plant Catalogue`, ~205 plant folders) holds `label_NN_front/back` and `plant_NN` photos per plant. A batch tool that turns each folder into a draft would save a lot of manual work.
