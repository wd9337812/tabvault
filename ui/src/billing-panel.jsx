import React, { useEffect, useState } from 'react';
import { ChevronRight, Check, ShieldCheck } from 'lucide-react';
import { Button } from './shared';

export function LicenseSection({ ws, onUpgrade }) {
  return <div className="settings-section"><h4>{ws.isPro ? 'Pro' : ws.t('proTitle')}</h4><div className="pro-summary"><ShieldCheck size={22}/><div><b>{ws.isPro ? ws.t('activated') : (ws.vault ? 'TabVault' : 'TabTasks') + ' Pro'}</b><p>{ws.t(ws.isPro ? 'proActiveNote' : ws.vault ? 'proVaultLead' : 'proTaskLead')}</p></div></div><Button variant="outline" className="wide-action" onClick={onUpgrade}>{ws.t(ws.isPro ? 'managePurchase' : 'explorePro')}<ChevronRight size={15}/></Button></div>;
}

export function UpgradePanel({ ws, reason }) {
  const { t, isPro, rpc, busy } = ws;
  const [key, setKey] = useState(''), [email, setEmail] = useState(''), [code, setCode] = useState(''), [recoveryId, setRecoveryId] = useState('');
  const [status, setStatus] = useState(''), [recovering, setRecovering] = useState(false), [working, setWorking] = useState(false);
  const check = async () => { const result = await rpc('BILLING_CHECK'); if (result) setStatus(result.billingStatus); return result; };
  useEffect(() => { let alive = true; rpc('BILLING_CHECK').then(result => { if (alive && result) setStatus(result.billingStatus); }); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (status !== 'waiting' || isPro) return;
    const end = Date.now() + 120000, timer = setInterval(async () => { if (Date.now() >= end) return clearInterval(timer); const result = await rpc('BILLING_CHECK'); if (result?.billingStatus === 'activated' || result?.billingStatus === 'expired') setStatus(result.billingStatus); }, 5000);
    return () => clearInterval(timer);
  }, [status, isPro]);
  const buy = async () => {
    if (working) return; setWorking(true);
    try { const result = await rpc('BILLING_START', { lang: ws.lang }); if (!result) return; setStatus('waiting'); await chrome.tabs.create({ url: result.checkoutUrl }); }
    catch { ws.notify(t('billingUnavailable')); } finally { setWorking(false); }
  };
  const requestCode = async event => { event.preventDefault(); const result = await rpc('BILLING_RECOVERY_REQUEST', { email: email.trim(), lang: ws.lang }); if (result) { setRecoveryId(result.recoveryId); setCode(''); ws.notify(t('recoverySent')); } };
  const recover = async event => { event.preventDefault(); const result = await rpc('BILLING_RECOVERY_VERIFY', { id: recoveryId, code }); if (result) { setStatus('activated'); setRecovering(false); setRecoveryId(''); setCode(''); ws.notify(t('activated')); } };
  return <>
    {isPro ? <div className="pro-success"><ShieldCheck size={32}/><h3>{t('activated')}</h3><p>{t('proActiveNote')}</p></div> : <div className="paywall"><span className="eyebrow">{ws.vault ? 'TABVAULT PRO' : 'TABTASKS PRO'}</span><h3>{t(ws.vault ? 'proVaultHeadline' : 'proTaskHeadline')}</h3><p>{t(ws.vault ? 'proVaultLead' : 'proTaskLead')}</p>{reason && <div className="upgrade-context">{t(reason)}</div>}<ul>{t(ws.vault ? 'proVaultFeatures' : 'proTaskFeatures').split('|').map(feature => <li key={feature}><Check size={14}/>{feature}</li>)}</ul>
      {ws.vault && <div className="plan-comparison"><div><b>Free</b><span>{t('vaultFreeSummary')}</span></div><div><b>Pro</b><span>{t('vaultProSummary')}</span></div></div>}
      <div className="price-line"><b>$6</b><span>{t('once')} · {t('noSubscription')}</span></div><Button className="primary-action" disabled={busy || working} onClick={buy}>{t(working ? 'billingOpening' : 'buy')}<ChevronRight size={16}/></Button><p className="settings-note">{t('buyNote')}</p>{!ws.vault && <p className="settings-note">{t('aiBillingNote')}</p>}
    </div>}
    {!isPro && status === 'waiting' && <div className="purchase-status" role="status"><p>{t('billingWaiting')}</p><Button variant="outline" disabled={busy} onClick={check}>{t('billingCheck')}</Button><p className="settings-note">{t('billingWaitNote')}</p></div>}
    {!isPro && status === 'expired' && <div className="purchase-status"><p>{t('billingExpired')}</p><Button variant="outline" onClick={async () => { if (await rpc('BILLING_RESET')) setStatus('idle'); }}>{t('billingRestart')}</Button></div>}
    <div className="settings-section"><Button variant="ghost" className="wide-action" onClick={() => setRecovering(!recovering)}>{t('restorePurchase')}</Button>{recovering && <div className="recovery-form"><p className="settings-note">{t('recoveryDesc')}</p><form onSubmit={requestCode}><label className="form-label">{t('purchaseEmail')}<input id="purchaseEmail" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setRecoveryId(''); setCode(''); }}/></label><Button type="submit" variant="outline" disabled={busy || !email.trim()}>{t('sendRecoveryCode')}</Button></form>{recoveryId && <form onSubmit={recover}><label className="form-label">{t('recoveryCode')}<input id="recoveryCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}/></label><Button type="submit" variant="outline" disabled={busy || code.length !== 6}>{t('restorePurchase')}</Button></form>}</div>}
      <details className="license-fallback"><summary>{t('haveLicense')}</summary><label className="form-label">{t('license')}<textarea id="licenseInput" rows={3} value={key} onChange={event => setKey(event.target.value)} spellCheck="false" autoComplete="off" placeholder={t('licensePlaceholder')}/></label><Button id="btnActivate" variant="outline" disabled={busy || !key.trim()} onClick={async () => { if (await rpc('LICENSE_SET', { key: key.trim() })) { setKey(''); ws.notify(t('activated')); } }}>{t('activate')}</Button></details>
      {isPro && <Button id="btnDeactivate" variant="outline" className="wide-action" disabled={busy} onClick={async () => { if (confirm(t('confirmDeactivate')) && await rpc('LICENSE_RELEASE')) ws.notify(t('released')); }}>{t('deactivate')}</Button>}
    </div>
  </>;
}
