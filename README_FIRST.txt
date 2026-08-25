TRIAD SCOUT — LIVE SALVAGEALERT API TEST
=========================================

IMPORTANT
---------
Do NOT put your SalvageAlert API key inside index.html or any GitHub file.
The code expects the key only as a private Vercel Environment Variable named:

SALVAGEALERT_KEY

FASTEST DEPLOYMENT
------------------
1. Upload these files/folders to the ROOT of your existing Triad-scout GitHub repo:
      index.html
      api/salvage-search.js
      api/health.js
      package.json

2. Go to https://vercel.com and sign in with GitHub.

3. Choose "Add New Project" and import your existing:
      triadautomotivellc-collab / Triad-scout

4. In Vercel Project Settings > Environment Variables, add:
      Name:  SALVAGEALERT_KEY
      Value: <paste your key there>
   Do not add quotes.

5. Deploy/redeploy.

6. Open the VERCEL URL (not GitHub Pages for this live API test).

7. First test backend health:
      https://YOUR-VERCEL-URL.vercel.app/api/health

   Expected:
      {"ok":true,...}

8. Open the Vercel home page.
   In TRIAD Scout, find "Live Auction Feed".
   Start with "Copart US" and click "Load live vehicles".

9. If Copart works, try IAA US.
   "All 3" can use multiple API credits, so save it until individual sources work.

NOTES
-----
- GitHub Pages cannot securely hold the API secret.
- Vercel serves the same index.html AND the private /api functions.
- The frontend never receives the SalvageAlert key.
- This is the first live auction connector test.
- YardLink CSV import remains available for direct recycler inventory.
- SalvageAlert documents /v1/lots/search as a backend API using Bearer auth.
