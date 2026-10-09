# tabvault official website

Cloudflare Worker static assets serves docs at https://tabvault.tabplugins.top/. Deploy with the checked-in wrangler.toml. Billing is a separate existing Worker and uses its original D1/secrets. workers.dev stays enabled on billing for old versions and Stripe webhook compatibility. The production API is https://pay-tabvault.tabplugins.top.
