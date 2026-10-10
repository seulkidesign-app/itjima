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

# V03 implementation guardrails

Before changing V03 code, read `docs/V03_CREATOR_WORKFLOW.md` and the active V03 issue.

For `codex/v03-creator-workflow`:
- Never write V03 data into the V02 production Supabase project.
- Use a separate V03 Supabase environment/project and verify environment variables before preview/test deployment.
- V02 and V03 user data must not be mixed.
- Keep `main` and `archive/v02-portfolio-20261010` untouched unless explicitly instructed.
- Model Collaboration, Content, Task/Deadline, and Source separately; do not collapse the entire workflow into one Content table.
- Product usage event logging is part of V03 alpha and must include entry source/path where applicable.
- Follower/content performance analytics remain out of scope.
- AI-extracted facts must be reviewable, editable, and traceable to source evidence before save.
- Never fabricate ambiguous dates or requirements.
- Multi-date natural-language input must create a review step rather than silently auto-saving inferred dates.
- Alpha brief inputs support pasted text and screenshots/images. Arbitrary external links are references only unless explicitly implemented later.
- Do not introduce CRM, invoicing, revenue, negotiation, team, or social-publishing features into the alpha.
- Keep the app mobile-first and preserve PWA installability.
