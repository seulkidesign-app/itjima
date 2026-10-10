<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# V03 Codex instructions

When working on branch `codex/v03-creator-workflow`, read `docs/V03_CREATOR_WORKFLOW.md` before changing product behavior.

Key constraints:
- Treat V02 as frozen. The portfolio snapshot is `archive/v02-portfolio-20261010`.
- V03 is a creator content workflow product, not a generic calendar or full CRM.
- The primary object is a content item; calendar/event views are secondary.
- Mobile-first PWA behavior must remain intact.
- Reuse existing auth, Supabase, PWA, design tokens, and safe natural-language parsing where possible.
- Do not invent ambiguous dates or collaboration requirements.
- Keep AI-extracted brief fields reviewable/editable before save.
- Avoid large rewrites in the first milestone; prefer an incremental end-to-end alpha flow.
- Do not force-push or rewrite shared Git history.

First milestone:
1. creator-focused home/work queue;
2. content item model;
3. content detail view;
4. quick add flow;
5. preserve installability/auth/infrastructure.
