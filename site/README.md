# tabvault official website

Cloudflare Worker static assets serves docs at https://tabvault.tabplugins.top/. Deploy with the checked-in wrangler.toml. Billing is a separate existing Worker and uses its original D1/secrets. workers.dev stays enabled on billing for old versions and Stripe webhook compatibility. The production API is https://pay-tabvault.tabplugins.top.

The docs/.assetsignore allowlist publishes product pages and visual assets only. Internal Markdown iteration and store-publishing guides are not served. The public site has no repository links and works when the source repository is private. Both products use support@tabplugins.top for customer support.

## Privacy-only rollout · 2026-10-17

The initial rollout published PRIVACY.html using a staged copy of the existing live website and preserved its homepage and screenshots. See rollout-2026-10-17.md for that historical deployment. Billing was unchanged.

## Full product-page rollout · 2026-10-17

The owner subsequently requested immediate publication of the new product pages, superseding the earlier hold on homepage copy and screenshots. The homepage now describes 0.5.0 and uses its English/Chinese release screenshots, updated feature comparison, support text, reading options and social preview. The public store still showed 0.4.1 when checked; a visible bilingual notice distinguishes the described version from actual store availability. No extension or payment backend was deployed. Old screenshot JPEGs and the obsolete promotional banner are excluded from static publication. See product-rollout-2026-10-17.md for validation and deployment records.
