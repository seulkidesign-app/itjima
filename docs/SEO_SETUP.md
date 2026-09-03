# SEO Setup — 잊지마(Itjima)

Last updated: 2026-09-03

## Goal

Build a consistent search entity relationship across the queries **잊지마**, **잊지마 앱**, **Itjima**, and **Itjima app** so search engines can distinguish the product from unrelated uses of “잊지마”.

The preferred entity definition is:

> 잊지마(Itjima)는 메모·할 일·일정을 구분하지 않고 자연어 한 문장으로 기록하면 날짜와 행동을 읽어 자동으로 구조화하고 다시 보기 쉽게 정리해주는 AI 메모·일정 앱입니다.

Keep the product name and definition materially consistent across the website and official external profiles. Search ranking and generated AI summaries are ultimately determined by the search engine and cannot be guaranteed by metadata alone.

## Public crawlable surfaces

The product remains available under `https://itjima.app/` and `/app`. Search-facing public content is provided through:

- `index.html` metadata and `<noscript>` fallback content
- `/` — official landing page with localized runtime SEO and structured data
- `/about` — dedicated crawlable brand/entity definition page
- `public/sitemap.xml`
- `public/robots.txt`

`/about` has its own canonical URL (`https://itjima.app/about`) and Korean/English alternate-language links.

## Structured data

The home page publishes an entity graph containing:

- `Brand` — preferred name **잊지마**, alternate names including **Itjima**, **잊지마 앱**, and **Itjima app**
- `Organization` — official Itjima profiles and product topic relationships
- `WebSite` — official website identity
- `WebPage` — homepage relationship
- `SoftwareApplication` — AI note/scheduling product definition
- `FAQPage` — visible landing FAQ content

The `/about` route additionally publishes an `AboutPage` that points to the same brand and software entity IDs.

## Google Search Console

The HTML verification meta tag is already present in `index.html`.

After each meaningful SEO deploy:

1. Open the `https://itjima.app/` property.
2. Submit or re-submit `https://itjima.app/sitemap.xml` if necessary.
3. Use URL Inspection → **Request indexing** for:
   - `https://itjima.app/`
   - `https://itjima.app/about`
4. Confirm both URLs are indexable and each reports its intended canonical.
5. Check Performance over time for branded queries:
   - `잊지마`
   - `잊지마 앱`
   - `Itjima`
   - `Itjima app`

## Bing Webmaster Tools

1. Add `https://itjima.app/`.
2. Submit the same sitemap.
3. Run URL inspection after meaningful deployments.

## Post-deployment validation

- [ ] `https://itjima.app/` returns 200
- [ ] `https://itjima.app/about` returns 200 without redirecting to `/`
- [ ] Home source contains the `잊지마(Itjima)` definition in metadata/noscript
- [ ] `/about` visibly contains the official product definition and name-origin explanation
- [ ] `robots.txt` is accessible
- [ ] `sitemap.xml` lists `/` and `/about`
- [ ] No `noindex` on public pages
- [ ] Canonical is `/` on home and `/about` on About
- [ ] Open Graph preview renders
- [ ] JSON-LD parses successfully

## Brand consistency

Use **잊지마(Itjima)** when first defining the product in Korean. Use **Itjima** as the Roman/English product name. Avoid publishing conflicting definitions such as treating Itjima only as a translation of the Korean phrase.

Recommended external-profile pattern:

> 잊지마(Itjima) — 자연어로 메모·할 일·일정을 남기면 AI가 날짜와 행동을 읽어 자동으로 구조화하고 다시 보기 쉽게 정리하는 메모·일정 앱.

Official profile links used in structured data live in `src/lib/brand.ts`. Keep those URLs accurate and remove any profile that is no longer official.

## Metadata reference

| Field | Preferred value |
|---|---|
| Home title | 잊지마(Itjima) \| 자연어 AI 메모·일정 앱 |
| Korean description | 잊지마(Itjima)는 메모·할 일·일정을 구분하지 않고 자연어 한 문장으로 기록하면 날짜와 행동을 읽어 자동으로 구조화하고 다시 보기 쉽게 정리해주는 AI 메모·일정 앱입니다. |
| Home canonical | https://itjima.app/ |
| About canonical | https://itjima.app/about |
| SoftwareApplication URL | https://itjima.app/ |
| App entry | https://itjima.app/app |
