// Purchase capabilities are installation-local. Web pages only notify; the Worker verifies payment.
const BillingClient = (() => {
  const origin = () => new URL(CONFIG.STRIPE_PAYMENT_LINK).origin;
  const storageKey = () => CONFIG.PRODUCT === 'tabvault' ? 'tv_billing' : 'tt_billing';
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const error = code => Data.fail('billing', code);
  async function api(route, body) {
    let response;
    try { response = await fetch(origin() + route, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(20000) }); } catch { error('billingUnavailable'); }
    let data; try { data = await response.json(); } catch { error('billingUnavailable'); }
    if (!response.ok) error({ recovery_code: 'recoveryInvalid', rate_limit: 'recoveryRateLimit', recovery_configured: 'recoveryUnavailable', refunded: 'billingRefunded', claim_expired: 'billingExpired' }[data.code] || 'billingUnavailable');
    return data;
  }
  async function read() { const raw = await chrome.storage.local.get(storageKey()); return raw[storageKey()] || {}; }
  async function start(lang) {
    const stored = await read();
    const pending = stored.pending && Date.now() - stored.pending.at < 30 * 864e5 ? stored.pending : { token: token(), at: Date.now() };
    await chrome.storage.local.set({ [storageKey()]: { ...stored, pending } });
    const url = new URL('/buy', origin()); url.searchParams.set('claim', pending.token); url.searchParams.set('lang', lang === 'zh' ? 'zh' : 'en');
    return { checkoutUrl: url.href, billingStatus: 'waiting' };
  }
  async function activate(data) {
    const verification = await Lic.verify(data.key, CONFIG.SECRET);
    if (!verification.ok || verification.plan !== 'pro') error('billingInvalidLicense');
    const stored = await read(), patch = { [storageKey()]: { ...stored, pending: null, sid: data.sid, activatedAt: Date.now() } };
    if (CONFIG.PRODUCT === 'tabvault') patch.tv_license = { key: data.key, ...verification }; else patch.licenseKey = data.key;
    await chrome.storage.local.set(patch);
    return { billingStatus: 'activated' };
  }
  async function check(expectedToken) {
    const stored = await read(), pending = stored.pending;
    if (!pending) return { billingStatus: 'idle' };
    if (expectedToken && pending.token !== expectedToken) error('billingInvalidClaim');
    let data; try { data = await api('/api/activation?token=' + encodeURIComponent(pending.token)); } catch (error) { if (error.message === 'billingExpired') return { billingStatus: 'expired' }; throw error; }
    if (data.status === 'paid') return activate(data);
    return { billingStatus: data.status === 'expired' ? 'expired' : 'waiting' };
  }
  async function dispatch(op, payload = {}) {
    if (op === 'BILLING_START') return start(payload.lang);
    if (op === 'BILLING_CHECK') return check(payload.token);
    if (op === 'BILLING_RESET') { const stored = await read(); await chrome.storage.local.set({ [storageKey()]: { ...stored, pending: null } }); return { billingStatus: 'idle' }; }
    if (op === 'BILLING_RECOVERY_REQUEST') return api('/api/recovery/request?lang=' + (payload.lang === 'zh' ? 'zh' : 'en'), { email: payload.email });
    if (op === 'BILLING_RECOVERY_VERIFY') return activate(await api('/api/recovery/verify', { id: payload.id, code: payload.code }));
    error('billingUnavailable');
  }
  function attach(request) {
    chrome.runtime.onMessageExternal?.addListener((message, sender, reply) => {
      let source; try { source = new URL(sender.url); } catch { return; }
      if (source.origin !== origin() || source.pathname !== '/success' || message?.type !== 'BILLING_COMPLETE' || !/^[a-f0-9]{64}$/.test(message.token || '')) return;
      request('BILLING_CHECK', { token: message.token }).then(reply, () => reply({ ok: false })); return true;
    });
    const resume = () => request('BILLING_CHECK').catch(() => {});
    chrome.runtime.onStartup.addListener(resume);
  }
  return { dispatch, attach };
})();
