# tabvault official website

Cloudflare Worker static assets serves docs at https://tabvault.tabplugins.top/. Deploy with the checked-in wrangler.toml. Billing is a separate existing Worker and uses its original D1/secrets. workers.dev stays enabled on billing for old versions and Stripe webhook compatibility. The production API is https://pay-tabvault.tabplugins.top.

The docs/.assetsignore allowlist publishes product pages and visual assets only. Internal Markdown iteration and store-publishing guides are not served. The public site has no repository links and works when the source repository is private. Both products use support@tabplugins.top for customer support.

## Privacy-only rollout · 2026-10-17

The store update is under review. This rollout publishes the current PRIVACY.html using a staged copy of the existing live website, preserving its homepage, landing scripts, support page and visual assets. New product benefits and screenshots in the source tree remain scheduled for the store release window; do not publish the full current docs directory as part of a privacy-only change. Billing is unchanged. See rollout-2026-10-17.md for deployment and validation records.
