# Sown — Plant Catalogue & Profile Spec

Source of truth: the "Sown — Plant Catalogue & Profile Spec" doc in claude.ai (Nov 2026). Update that doc first, then re-export here.

## Overview

Sown keeps its own UK plant catalogue in Supabase, built once per plant and verified by Jo, rather than renting care data from a paid API. Each plant is written once and then read free by every user, so running costs fall as the catalogue grows.

The data model separates two records:

- **Plant profile**: facts about a plant that are the same for everyone, such as its care, safety and calendar of tasks.
- **User's plant**: one person's plant, with where it is, when it went in, their photos and notes.

All three ways into the app (scanning a label, searching by name and identifying from a photo) end on a plant profile. The user then confirms the match and saves it as one of their plants.

| Part of the profile | Source |
| --- | --- |
| Botanical name and synonyms | Identification APIs plus free taxonomy data (GBIF / Kew) |
| Care profile and tasks | Drafted by Claude in a fixed structure |
| Safety | HTA Guide to Potentially Harmful Plants only, never AI |
| Cross-checks | Plant labels photographed by Jo (facts only, never copied wording or images) |
| Sign-off | Jo |

Reminders combine three inputs: the **plant profile** (care tasks, water need), the **user's plant** (zone, pot, started as) and the **weather** (Open-Meteo for the user's area). They produce two outputs: a **weekly round-up** and a **dry-spell alert**.

## Plant profile: identity and growing conditions

Profiles are stored as a **species parent** with slim **variety children**. A variety (e.g. 'Hidcote') stores only what differs from its species (e.g. *Lavandula angustifolia*) and inherits the rest, so care and safety are verified once per species.

### Identity

| Field | Values | Notes |
| --- | --- | --- |
| parent_id | link to species record | Empty on a species record. A plant with no species (e.g. *Rosa* 'Peace') uses its genus record (*Rosa*) as the parent |
| slug | text, unique | Built from the botanical name, e.g. `lavandula-angustifolia-hidcote`; species records drop the cultivar part. Matches the folder name in the photo archive |
| genus, species, cultivar | text | Cultivar empty on a species record |
| common_names | list | First one is shown by default |
| synonyms | list | Old or alternative botanical names |
| label_aliases | list | Names as growers print them; helps the scanner match |
| family | text | |
| plant_type | annual, biennial, perennial, shrub, tree, bulb, climber, grass, fern, herb, vegetable, fruit | |
| photos | Jo's own images | Never grower or label images |

### Growing conditions

| Field | Values | Notes |
| --- | --- | --- |
| rhs_hardiness | H1a, H1b, H1c, H2, H3, H4, H5, H6, H7 | UK standard; no US zones |
| sun | full sun, partial shade, full shade (choose any) | |
| aspect | N, E, S, W (choose any) | |
| exposure | sheltered, exposed (choose any) | |
| soil_type | clay, loam, sand, chalk (choose any) | |
| soil_moisture | well-drained, moist but well-drained, poorly drained | |
| soil_ph | acid, neutral, alkaline (choose any) | |
| height_cm, spread_cm | min and max | Variety usually overrides |
| years_to_full_size | number range | |
| suits_containers | yes / no | |
| difficulty | beginner, some experience, expert | |
| water_need | low, medium, high | Shown on the care label; drives the dry-spell alert |
| water_notes | short text | e.g. "Water well in its first summer, then only in long dry spells" |
| flowering_months | 1–12, choose any | Standard UK timing |

## Care tasks and reminders

Reminders cover real jobs (sow, prune, feed, protect), not routine watering. Watering moves to one weekly round-up plus an alert in dry spells, so the care list isn't filled with "mark as watered" ticks. Timing uses standard UK months for everyone at launch, with no north/south adjustment.

### Care task fields (one row per task)

| Field | Values | Notes |
| --- | --- | --- |
| plant_id | link to profile | Variety tasks override the species task of the same type |
| task_type | sow indoors, sow outdoors, plant out, plant, feed, mulch, prune, cut back, pinch out, deadhead, support or tie in, take cuttings, repot or top-dress, divide, lift and store, protect for winter, bring indoors, harvest | No routine watering task. Prune is for woody plants; cut back is for herbaceous plants and grasses. Mulch, cut back, support, pinch out, take cuttings, repot and bring indoors added 5 Nov 2026 |
| months | 1–12, choose any | Standard UK timing |
| trigger | none, after last frost | Kept to one trigger at launch |
| repeat | once, ongoing | **Once**: marked as done once a year, then returns next year. **Ongoing** (e.g. deadheading through summer): shown as a reminder only, with no "mark as done" |
| applies_to | grown from seed, grown from bulb, bought as a plant, in a pot, in the ground (choose any) | Matched against the user's plant |
| instructions | short text | Sown's voice; one or two sentences |

### How reminders reach the user

1. **Weekly garden round-up**: one notification a week. It lists the tasks due across all the user's plants and includes one general line on watering.
2. **Dry-spell alert**: a push notification sent only when Open-Meteo shows a dry spell at the user's location. It names the plants with high water need and anything planted in pots.
3. **Plant care label**: each plant's page shows its water need (low, medium or high) and water notes, so users know how much it likes without being nagged.

Dry-spell threshold: agreed starting point is 5 days in a row with under 2 mm of rain between May and September, to be tuned after testing.

On iPhone, push notifications only reach a PWA once it has been added to the home screen. The onboarding flow needs to prompt for that.

## Safety

Safety defaults to **Unknown** and changes only when Jo checks the plant against the HTA Guide to Potentially Harmful Plants. Claude never writes or suggests safety values.

| Field | Values | Notes |
| --- | --- | --- |
| safety_status | Unknown, HTA category A, HTA category B, HTA category C, HTA bulb or ornamental fruit label, Not on HTA list | Default Unknown |
| harmful_to | people, pets, both | Only when on the HTA list |
| harmful_parts | text | e.g. all parts, seeds, sap |
| harmful_if_eaten | yes / no | Fills "if eaten" in the wording below |
| skin_irritant | yes / no | Fills "if touched" in the wording below |
| hta_edition | text | e.g. 3rd edition |
| safety_verified_by, safety_verified_at | person, date | |
| pets_affected | dogs, cats, rabbits, rodents, tortoises, caged birds, poultry (choose any) | As named in the HTA guide; other pets may still be affected |
| hta_condition | short text | When the HTA entry only applies to some plants, e.g. "female plants only", "varieties with ornamental fruit" |

"Not on HTA list" does not mean safe. The HTA list covers serious hazards, so a plant missing from it can still upset a stomach or a pet. The app should never show a "safe" badge.

### What the user sees

| Status | Wording on the plant page |
| --- | --- |
| Unknown | We haven't checked this plant's safety yet. Keep it away from children and pets until you know more. |
| HTA category A / B / C | Can be harmful to [people / pets / both] if [eaten / touched]. Parts: [harmful_parts]. Based on the HTA Guide to Potentially Harmful Plants. |
| Not on HTA list | Not on the HTA list of potentially harmful plants. That doesn't guarantee it's safe, so take care with children and pets. |

A general line on every plant page and in the app's terms should say that Sown's safety information is a guide, not medical or veterinary advice. It should also point people to NHS 111 for people and to their vet for pets. Have this wording checked through BIPC Leeds or a solicitor before launch.

## Content, Sown kits and verification

### Content

| Field | Values | Notes |
| --- | --- | --- |
| summary | 1–2 sentences | Shown at the top of the plant page |
| care_guide | short sections | Planting, ongoing care, through the year |
| common_problems | list | Pests and diseases, with what to do |
| beginner_tips | list | |
| good_for_pollinators | yes / no / unknown | |

### Sown kit (placeholder)

These fields are reserved now and left empty until the product range is developed.

| Field | Values | Notes |
| --- | --- | --- |
| in_sown_kit | yes / no | Default no |
| kit_ids | list | Which gift sets include this plant |
| kit_guide | step-by-step text | Extra growing guide for kit buyers |

**Kit activation (later).** The Grow Code printed in each kit is scanned or typed in once. It confirms which kit was bought, unlocks the Pro trial, and adds every plant in that kit to the user's plants. Those plants arrive with no zone and are flagged as needing details, so the user can fill in the gaps when they plant them.

### Verification

| Field | Values | Notes |
| --- | --- | --- |
| status | draft, verified | Shown to users as "Sown guide (unverified)" or "Verified by Sown". Users see every verified profile, plus drafts linked to their own plants (e.g. one created by their scan). A variety can't be verified before its species |
| field_sources | per field: Claude, label, API, Jo | Shows where each fact came from |
| verified_by, verified_at | person, date | |
| label_photo_refs | links | Jo's label photos used to cross-check; kept private. Stored in their own admin-only table so users who can read a profile can't see them |
| last_reviewed | date | |

## User's plant and garden zones

A user's plant is their own record of one plant: where it is, when it went in, up to two photos and their notes. Zones are areas the user names themselves, so they can filter their plants by place.

### Garden zones

| Field | Values | Notes |
| --- | --- | --- |
| user_id | link | |
| name | text | Chosen by the user, e.g. "Front border", "Patio pots", "Greenhouse" |
| zone_type | border, bed, pots, greenhouse, indoors, lawn, other | Optional |
| sun | full sun, partial shade, full shade | Optional; later can flag plants in the wrong spot |
| aspect, soil_type, soil_drainage, shelter, frost_pocket, notes | as in the existing garden_zones table | Optional; kept from the summer build |

### User's plant

| Field | Values | Notes |
| --- | --- | --- |
| user_id | link | |
| plant_id | link to profile | Species or variety |
| zone_id | link to zone | Used for filtering; empty allowed (e.g. kit plants) |
| nickname | text | Optional |
| planted_month, planted_year | month (optional) and year | Month and year is enough |
| started_as | seed, bulb, bought as a plant | Picks which care tasks apply |
| in_pot | yes / no | Picks which care tasks apply; pots are included in dry-spell alerts |
| quantity | number | Optional, e.g. 6 lobelia in one pot |
| added_via | label scan, search, photo ID, Sown kit | |
| needs_details | yes / no | Worked out automatically: yes when a growing plant is missing its zone, planted year, started-as or pot setting |
| photos | up to 2 | Compressed on the phone before upload, plus a ~30 KB thumbnail |
| notes | dated entries | e.g. "Moved to the sunnier end, May 2027" |
| status | growing, want to grow, gone | 'Want to grow' is a wishlist (kept from the summer build); gone keeps the history without cluttering the list |

**Same plant in more than one place.** Each record is one group of a plant in one place. A tray of lobelia split between pots and a border becomes two records. A **Duplicate** button copies the plant, planted date and started-as onto a new record and leaves the zone and pot setting blank to fill in. The plant list groups records of the same plant under one heading, e.g. "Lobelia · 2 plantings". To revisit when the user plant screens are built.

## Photo storage

Photos are resized on the phone to about 1,200 px / 200 KB before upload, with a ~30 KB thumbnail for lists. Stored in Supabase Storage; Supabase Pro ($25/month) includes 100 GB storage and 250 GB egress, enough for roughly 500,000 photos. Label photos are never uploaded to public storage.

All three buckets are private, and the app shows images through short-lived signed links.

| Bucket | Holds | Who can read | Who can upload |
| --- | --- | --- | --- |
| plant-photos | Users' own plant photos, in a folder per user | The owner only | The owner only |
| catalogue-photos | Jo's photos for plant profiles, in a folder per slug | Anyone signed in | Admin only |
| catalogue-label-photos | Jo's label photos, in a folder per slug | Admin only | Admin only |

## Database notes

- **Catalogue editing.** Only an admin (Jo) can create or change profiles and care tasks. Admin is a flag on Jo's account, set from the Supabase dashboard.
- **New plants from the app.** When a scan or search finds a plant that isn't in the catalogue, the app asks a server-side function to create a draft. The draft has only its name filled in, and its safety is Unknown. Existing profiles are never changed by the app.
- **Stored values.** Fixed lists are stored as short lowercase codes (e.g. `partial_shade`, `hta_a`, `want_to_grow`), and the app turns them into the wording shown here.

## Decisions

| Decision | Status |
| --- | --- |
| Own catalogue, verified by Jo, rather than a paid care API | Agreed |
| No US data sources (Perenual dropped) | Agreed |
| Species parent with variety children | Agreed |
| Safety from the HTA list only, defaulting to Unknown | Agreed |
| Standard UK months; no north/south timing | Agreed for launch; revisit later |
| Weekly round-up plus dry-spell alert instead of per-plant watering reminders | Agreed |
| Sown kit fields reserved, left empty | Agreed |
| Up to 2 photos, month and year planted, notes and zones on each user's plant | Agreed |
| Dry-spell threshold: 5 days in a row under 2 mm of rain, May–September | Agreed; tune after testing |
| Safety disclaimer wording | Open; to be checked before launch |
| Users see verified profiles plus drafts linked to their own plants | Agreed |
| Plants with no species use their genus as the parent record | Agreed |
| Care tasks repeat once a year or are ongoing reminders | Agreed |
| Catalogue edits are admin-only; the app creates drafts through a server-side function | Agreed |
| New catalogue tables built alongside the old ones; old tables dropped once the app has moved over | Agreed |
