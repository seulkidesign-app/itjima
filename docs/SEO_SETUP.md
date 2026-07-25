# SEO Setup — 잊지마 Itjima

Last updated: 2026-07-25

## Architecture note

The PWA remains at `https://itjima.app/` to preserve installed-app `start_url` compatibility. Public crawlable content is provided via:

- `<noscript>` HTML in `index.html` (H1, description, links)
- `/about` — full marketing landing with FAQ and structured data
- `public/sitemap.xml`, `public/robots.txt`

A future `/app` split is documented as optional; migrating requires manifest `start_url` update and reinstall guidance.

## Google Search Console

1. Verify property `https://itjima.app/` (DNS TXT or HTML file).
2. Submit sitemap: `https://itjima.app/sitemap.xml`
3. URL Inspection → Request indexing for:
   - `https://itjima.app/`
   - `https://itjima.app/about`
4. Confirm `lang="ko"` and canonical `https://itjima.app/`

## Bing Webmaster Tools

1. Add site `https://itjima.app/`
2. Submit the same sitemap
3. Run URL inspection after deploy

## Post-deployment validation

- [ ] `curl -I https://itjima.app/` returns 200
- [ ] View page source shows H1 text (noscript block)
- [ ] `robots.txt` accessible
- [ ] `sitemap.xml` lists only public routes
- [ ] No `noindex` on public pages
- [ ] Open Graph preview renders (Twitter Card Validator / Meta debugger)
- [ ] JSON-LD validates (Google Rich Results Test)

## Brand consistency

Use **잊지마 Itjima** consistently across:

- Page titles and meta descriptions
- App store / PWA install name: **잊지마**
- Roman name in English contexts: **Itjima**

See `docs/BRAND_SEO_CHECKLIST.md` for external profile naming.

## Metadata reference

| Field | Value |
|-------|-------|
| Home title | 잊지마 Itjima \| 생각을 던지고 안심하고 잊는 기억 관리 앱 |
| Meta description | 잊지마 Itjima는 떠오른 생각을 빠르게 기록하고 일정, 할 일, 보관으로 정리해주는 기억 관리 앱입니다. 대충 던지고 안심하고 잊으세요. |
| Canonical | https://itjima.app/ |
| SoftwareApplication url | https://itjima.app/ |
