# tabvault official website

Cloudflare Worker static assets serves docs at https://tabvault.tabplugins.top/. Deploy with the checked-in wrangler.toml. Billing is a separate existing Worker and uses its original D1/secrets. workers.dev stays enabled on billing for old versions and Stripe webhook compatibility. The production API is https://pay-tabvault.tabplugins.top.

The docs/.assetsignore allowlist publishes product pages and visual assets only. Internal Markdown iteration and store-publishing guides are not served. The public site has no repository links and works when the source repository is private. Both products use support@tabplugins.top for customer support.
