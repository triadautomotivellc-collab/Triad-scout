TRIAD SCOUT v0.8 — PARTS INTELLIGENT SOURCING
==============================================

RUNTIME STACK
- Front end: index.html + browser JavaScript (current TRIAD Scout stack)
- Shared logic: lib/*.js ES modules
- Backend: Vercel serverless functions in api/
- Tests: Node built-in test runner

NEW RUNTIME FILES
- lib/parts-core.js
- api/parts-search.js
- api/parts-self-test.js
- api/fee-preview.js

WHAT v0.8 DOES
- Parts is now the default mode.
- Default location fallback: McAllen, TX (user edits persist in localStorage).
- Default price range is $0 to $100,000.
- Live donor auction feed + auction fee preview moved to the top of results.
- YardLink import moved to the top of results.
- Licensed interchange bridge import moved to the top of results.
- Parts search automatically runs recycled-part sourcing and donor-auction search in parallel.
- Parts are ranked by verified interchange/fitment first and landed cost.
- Supports cross-year/make/model compatible donor expansion when a licensed interchange group is supplied.
- Never scrapes Hollander/Car-Part public search pages.

AUTHORIZED CONNECTOR ENVIRONMENT VARIABLES (OPTIONAL)
- HOLLANDER_CONNECTOR_URL
- HOLLANDER_CONNECTOR_KEY
- CARPART_CONNECTOR_URL
- CARPART_CONNECTOR_KEY
- EDEN_CONNECTOR_URL
- EDEN_CONNECTOR_KEY

These are intentionally generic TRIAD adapter-gateway settings. No public vendor API endpoint is invented in the code.
Only configure them when TRIAD has licensed/authorized access and the gateway normalizes provider responses to the parts-search contract.

LICENSED INTERCHANGE BRIDGE
The browser can import a normalized licensed interchange CSV for development/yard-owned data.
See TRIAD_Interchange_Bridge_Template.csv.
Do not upload or redistribute proprietary Hollander/Car-Part interchange data unless your license permits it.

SEARCH FLOW — PARTS MODE
1. User enters part query.
2. TRIAD sends parts query + current vehicle context to /api/parts-search.
3. TRIAD resolves licensed interchange groups, if available.
4. Compatible donor years/makes/models are expanded.
5. YardLink + authorized connector inventories are normalized and deduped.
6. Incompatible part types/positions are rejected.
7. Compatible listings are ranked by landed cost, fitment confidence, grade signal, and distance.
8. In parallel, TRIAD searches live donor auctions for the current vehicle.
9. The top deck shows cheapest verified part, donor vehicle count, and auction fee preview.

TESTING
npm test
Also safe in production: GET /api/parts-self-test

