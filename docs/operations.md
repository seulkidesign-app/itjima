# Production operations

## Supabase Edge Functions

The production project reference is declared in `supabase/config.toml` and the deployment workflow.

Functions deployed from `main`:

- `process-reminders`
- `test-push`
- `test-push-ios`
- `delete-account`

Required GitHub Actions configuration:

1. Add the repository secret `SUPABASE_ACCESS_TOKEN` using a Supabase personal access token that can deploy to the production project.
2. Review and approve the GitHub `production` environment when environment protection rules require it.
3. Run **Deploy Supabase functions** manually once after adding the secret. Future edits under `supabase/functions/` deploy automatically after merge to `main`.

The workflow verifies that all four functions appear in the remote function inventory after deployment. Function-specific secrets such as push credentials remain managed in the Supabase project and must not be stored in GitHub or committed to the repository.

## Dependency security

CI creates two audit reports:

- runtime dependencies, which block a merge when high or critical vulnerabilities exist;
- the full dependency graph, including developer tooling, which is retained as an artifact for remediation planning.

This prevents build-tool-only findings from being confused with code shipped to users while keeping the complete audit visible.

## JavaScript bundle budget

The production build fails when:

- any JavaScript chunk exceeds 700 KiB uncompressed; or
- total JavaScript under `dist/assets` exceeds 2.5 MiB uncompressed.

Core routes remain bundled together for predictable cached/offline behavior. Large shared libraries are separated into stable vendor chunks for browser caching and regression visibility.
