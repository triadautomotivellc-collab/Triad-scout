# TRIAD Scout v0.8 — Parts Intelligent Sourcing Architecture

## Current stack
TRIAD Scout remains on its current proven stack for this release:
- static `index.html` front end
- shared ES modules in `lib/`
- Vercel serverless endpoints in `api/`
- Node built-in test runner in `tests/`

A React/Next.js migration is intentionally deferred; it would add migration risk without improving the interchange/data model.

## Legal/licensing boundary
TRIAD does not scrape Hollander or Car-Part public search pages.

Hollander Interchange is a licensed index of interchangeable equivalents, offered as a downloadable database and integrated with Powerlink/EDEN. TRIAD therefore treats Hollander as a licensed catalog provider, not a public scraping target.

Car-Part Web Services supports inventory-management systems including Hollander, Powerlink, Pinnacle, Checkmate and others, and its Trading Partners workflow can locate recycler inventory. TRIAD only enables a Car-Part native connector when an authorized Web Services/integration endpoint is supplied. Public Car-Part search automation and reconstruction of interchange data remain disabled.

## Core data model
### PartQuery
- partType
- side/position
- OEM part number
- interchange number
- current vehicle: year/make/model/trim/engine/transmission/VIN

### InterchangeRecord
- source/license
- interchange group
- part type
- compatible year/make/model/trim
- engine/transmission qualifiers
- side/position
- OEM part number
- qualifier/notes
- confidence

### ScoutPartListing
- source / yard / stock number
- donor year/make/model/trim
- part type and description
- interchange and OEM numbers
- price / shipping / core
- distance
- ARA/yard grade when supplied
- mileage / condition / warranty
- listing URL / image / contact/location

## Search pipeline
1. Parse part query.
2. Resolve licensed interchange group if available.
3. Expand compatible donor vehicles across years/makes/models.
4. Search YardLink and authorized provider adapters.
5. Normalize provider rows.
6. Deduplicate.
7. Reject wrong part type and wrong side/position.
8. Prefer OEM/interchange verified matches.
9. Rank by landed cost, fitment confidence, quality signal and distance.
10. In parallel, search live salvage auctions for donor vehicles.
11. Preview auction fees for the cheapest donor using the verified fee engine.
12. Render cheapest part + donor economics at the top of the results before the detailed list.

## Landed part cost
Known landed cost:

`price + shipping + core + local pickup estimate`

If shipping is unspecified, the current ranking engine can apply a configurable unknown-shipping reserve rather than treating unknown shipping as free.

## Interchange ranking
Highest-confidence checks:
1. Exact OEM part-number match
2. Licensed interchange-group match
3. Expanded compatible donor match
4. Exact donor vehicle match
5. Otherwise: not verified, do not show as a compatible result

## Rebuild basket
The shared engine supports a list of required parts. For each part, TRIAD chooses the cheapest verified compatible listing and sums landed cost. Missing parts are explicitly marked unresolved rather than estimated as $0.

## Provider adapters
Environment variables are intentionally connector-gateway settings rather than invented vendor APIs:
- `HOLLANDER_CONNECTOR_URL`
- `HOLLANDER_CONNECTOR_KEY`
- `CARPART_CONNECTOR_URL`
- `CARPART_CONNECTOR_KEY`
- `EDEN_CONNECTOR_URL`
- `EDEN_CONNECTOR_KEY`

Each gateway must have licensed/authorized access and return normalized recycler inventory. Unconfigured providers return `not_configured` and do not cause search failure.

## Front-end structure
At the very top of results:
1. **Live Donor Feed + Fees** — donor count, cheapest donor, fee preview, source selector.
2. **Interchange + Cheapest Part** — resolved groups, donor expansion, YardLink import, licensed interchange import.
3. **Rebuild Cost Snapshot** — cheapest verified part, match count, location controls.

The old hidden side-panel live-feed controls are removed from the primary workflow.

## Defaults
- Mode: Parts
- Default location fallback: McAllen, TX; manual changes persist locally.
- Default minimum price: $0
- Default maximum price: $100,000

## Test policy
`npm test` must pass before a release package is handed off.
Production-safe check: `/api/parts-self-test`.
