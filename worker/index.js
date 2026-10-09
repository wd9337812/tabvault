// Shared billing implementation. Each deployment has its own product, D1 and secrets.
// Stripe/administrator/webhook secrets never leave the Worker. Provisioning is disabled after setup.
const VERSION='2.1.1',te=new TextEncoder();
const SESSION=/^cs_(?:live|test)_[A-Za-z0-9]{6,}$/,ID=/^[a-z]+_[A-Za-z0-9]+$/;
const EVENTS=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired','charge.refunded'];
function b64urlBytes(bytes){let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export async function computeKey(secret,sid){const payload=b64urlBytes(te.encode(JSON.stringify({plan:'pro',label:sid,via:'stripe'})));const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return payload+'.'+b64urlBytes(new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(payload))))}
class BillingError extends Error{constructor(code,status=400){super(code);this.status=status}}
const fail=(code,status=400)=>{throw new BillingError(code,status)};
const now=()=>Math.floor(Date.now()/1000),app=env=>env.PRODUCT_SLUG||'legacy',objectId=value=>typeof value==='string'?value:value?.id;
function site(env){const value=env.SITE_ORIGIN||'https://wd9337812.github.io/'+app(env);let url;try{url=new URL(value)}catch{fail('configured',503)}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)fail('configured',503);return value.replace(/\/$/,'')}

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const lang=url=>url.searchParams.get('lang')==='zh'?'zh':'en';
const words={
 claim_expired:['This checkout link has expired. Start a new purchase.','本次付款链接已过期，请重新发起购买。'],
 recovery_configured:['Email recovery is not available yet. Use your saved license or contact support.','邮件恢复尚未配置，可使用已保存的授权码或联系支持。'],
 recovery_code:['The recovery code is invalid or expired.','验证码不正确或已过期，请重新获取。'],
 rate_limit:['Please wait before requesting another code.','请求过于频繁，请稍后再试。'],
 configured:['Payment service is not ready. Please contact support.','付款服务尚未配置完成，请联系支持。'],
 stripe:['Could not confirm with Stripe. Please retry or contact support.','无法向 Stripe 确认，请重试或联系支持。'],
 missing:['A valid checkout reference is required.','需要有效的付款编号。'],
 wrong:['This order does not belong to this product.','该订单不属于本商品。'],
 unpaid:['Payment has not completed. Return after payment succeeds.','付款尚未完成，请在付款成功后返回。'],
 refunded:['This payment has a refund. Please contact support about your license.','这笔付款存在退款，请联系支持处理授权。'],
 test:['Test payments cannot activate the live product.','测试付款不能激活正式商品。'],
 storage:['Could not save the order. Please retry; your Stripe payment is unaffected.','订单暂时无法保存，请重试；你的 Stripe 付款不受影响。'],
 method:['This request method is not supported.','不支持此请求方式。'],
 unauthorized:['Administrator access is required.','需要管理员授权。'],
 setup:['Provisioning is disabled or incomplete.','配置入口已关闭或配置不完整。'],
 schema:['Unexpected payment data. Please contact support.','付款数据异常，请联系支持。']
};
function text(code,l){return words[code]?.[l==='zh'?1:0]||words.schema[l==='zh'?1:0]}
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'none'"};
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}})}
function page(body,env,l='en',status=200){const name=env.PRODUCT_NAME||'Pro',accent=app(env)==='tabvault'?'#11836e':'#6154df';return new Response(`<!doctype html><html lang="${l==='zh'?'zh-CN':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} · Billing</title><style>:root{--accent:${accent}}*{box-sizing:border-box}body{margin:0;background:#f7f9fc;color:#26303e;font:14px/1.7 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;padding:48px 20px}main{max-width:1040px;margin:auto}.card{background:white;border:1px solid #e1e7ef;border-radius:18px;padding:32px;max-width:580px;margin:36px auto}.brand{font-weight:700;font-size:19px;letter-spacing:-.6px}.eyebrow{color:var(--accent);letter-spacing:2px;font-size:10px}h1{font-size:28px;letter-spacing:-1px;line-height:1.25;margin:16px 0}h2{font-size:18px;margin:0}.quiet{color:#738094;font-size:12px}a{color:var(--accent)}button,.button{font:inherit;cursor:pointer;background:var(--accent);color:white;border:0;border-radius:9px;padding:10px 17px;display:inline-block;text-decoration:none}button:disabled{opacity:.45;cursor:default}button.secondary{background:#eef1f7;color:#405168}input,select{font:inherit;padding:10px 12px;border:1px solid #dce3ed;border-radius:9px;min-width:0;background:white;color:inherit}input{width:100%}textarea{width:100%;min-height:110px;resize:vertical;padding:14px;border:1px solid #dfe6ef;border-radius:10px;font:12px/1.8 monospace;word-break:break-all}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.error{color:#b03c54}.admin-card{max-width:none}.toolbar{display:flex;gap:10px;margin:18px 0}.toolbar input{flex:1}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:760px;font-size:12px}td,th{padding:13px 12px;text-align:left;border-bottom:1px solid #e5eaf1;vertical-align:top}th{font-weight:600;color:#738094}.tag{display:inline-block;border-radius:6px;background:#edf1f7;padding:3px 8px;font-size:10px}.tag.paid{background:#e8f5ef;color:#13795f}td button{font-size:11px;padding:5px 9px;margin:3px}.small{font-size:10px;color:#8490a2;word-break:break-all}.hide{display:none}label{display:block;margin:16px 0 7px}#message{min-height:23px}#license-dialog{max-width:580px;border:1px solid #dce3ed;border-radius:16px;padding:28px;width:calc(100% - 40px)}#license-dialog::backdrop{background:#26303e55}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(max-width:600px){body{padding:24px 14px}.card{padding:22px}.toolbar{flex-wrap:wrap}.toolbar input{flex-basis:100%}}</style><script src="/assets/billing.js" defer></script></head><body><main data-app="${esc(app(env))}" data-lang="${l}"><div class="brand">${esc(name)}</div>${body}<p class="quiet" style="text-align:center"><a href="${esc(site(env))}/SUPPORT.html">${l==='zh'?'支持':'Support'}</a> · <a href="${esc(site(env))}/PRIVACY.html">${l==='zh'?'隐私政策':'Privacy'}</a></p></main></body></html>`,{status,headers:{...headers,'content-type':'text/html; charset=utf-8'}})}
async function stripe(env,route,{method='GET',data,idempotency}={}){
 if(!env.STRIPE_SECRET_KEY)fail('configured',503);
 const h={Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':'2025-02-24.acacia'};if(data)h['Content-Type']='application/x-www-form-urlencoded';if(idempotency)h['Idempotency-Key']=idempotency;
 let response;try{response=await fetch('https://api.stripe.com/v1'+route,{method,headers:h,body:data?new URLSearchParams(data):undefined,signal:AbortSignal.timeout(15000)})}catch{fail('stripe',502)}
 if(!response.ok)fail('stripe',502);try{return await response.json()}catch{fail('stripe',502)}
}
async function first(env,sql,...args){if(!env.ORDERS_DB)fail('configured',503);return env.ORDERS_DB.prepare(sql).bind(...args).first()}
async function run(env,sql,...args){if(!env.ORDERS_DB)fail('configured',503);return env.ORDERS_DB.prepare(sql).bind(...args).run()}
function requireMode(value,env){if(typeof value!=='boolean')fail('schema');if(!value&&env.ALLOW_TEST_PAYMENTS!=='true')fail('test')}
function origin(req,env){const value=env.PUBLIC_ORIGIN||new URL(req.url).origin;let url;try{url=new URL(value)}catch{fail('configured',503)}if(url.protocol!=='https:'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)fail('configured',503);return url.origin}
async function secureEqual(a,b){const digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(value)));const [aa,bb]=await Promise.all([digest(a),digest(b)]);let mismatch=0;for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];return mismatch===0}
async function admin(req,env){const match=/^Bearer (\S+)$/.exec(req.headers.get('authorization')||'');if(!env.ADMIN_TOKEN||!match||!await secureEqual(match[1],env.ADMIN_TOKEN))fail('unauthorized',401)}
async function checkoutPrice(env){
 if(!env.ORDERS_DB||!env.LIC_SECRET||!/^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_ID||''))fail('configured',503);
 const price=await stripe(env,'/prices/'+encodeURIComponent(env.STRIPE_PRICE_ID));
 if(price.object!=='price'||price.id!==env.STRIPE_PRICE_ID||price.active!==true||price.type!=='one_time'||!Number.isSafeInteger(price.unit_amount)||price.unit_amount<=0||price.recurring||!objectId(price.product)||!/^[a-z]{3}$/.test(price.currency||''))fail('schema');requireMode(price.livemode,env);
 return price;
}
async function purchasePage(env,l,claim=''){
 const price=await checkoutPrice(env),zh=l==='zh',amount=new Intl.NumberFormat(zh?'zh-CN':'en',{style:'currency',currency:price.currency.toUpperCase()}).format(price.unit_amount/100),support=site(env)+'/SUPPORT.html';
 return page(`<section class="card"><span class="eyebrow">GET PRO</span><h1>${esc(env.PRODUCT_NAME)}</h1><h2>${esc(amount)} · ${zh?'一次性付款':'One-time payment'}</h2><p class="quiet">${zh?'结账页会显示适用的税费与优惠后的最终金额。从插件发起的购买会在付款后自动激活，无需复制授权码。':'Checkout displays the final total, including any applicable tax and discounts. Purchases started in the extension activate automatically after payment.'}</p><p>${zh?'付款由 Stripe 处理。继续结账表示你同意我们使用 Cloudflare 保存订单编号、商品与价格编号、金额、币种、付款和退款状态及时间，并保存购买邮箱和自动激活凭证的不可直接读取摘要，用于签发授权、恢复购买和处理订单支持。主动申请邮件恢复时，邮箱将发送给邮件服务商 Resend 用于投递验证码。银行卡信息由 Stripe 处理；插件中的任务和标签会话不会上传到订单服务。':'Stripe processes payment. By continuing, you agree that we use Cloudflare to store order identifiers, product and price identifiers, amount, currency, payment and refund status, timestamps, and hashes of the purchase email and activation capability for license delivery, purchase recovery and order support. If you request email recovery, the email address is sent to Resend to deliver a verification code. Stripe handles card details. Your extension’s tasks and saved tab sessions are not uploaded to the order service.'}</p><p class="quiet"><a href="${esc(site(env))}/PRIVACY.html">${zh?'查看隐私政策':'Read the privacy policy'}</a> · <a href="${esc(support)}">${zh?'销售条款：14 天内可申请退款':'Sales terms: request a refund within 14 days'}</a></p><form action="/checkout?lang=${l}${claim?'&claim='+claim:''}" method="post"><button>${zh?'同意并前往 Stripe 结账':'Agree and continue to Stripe'}</button></form><div class="actions"><a href="/buy?lang=${zh?'en':'zh'}${claim?'&claim='+claim:''}">${zh?'English':'简体中文'}</a></div></section>`,env,l);
}
async function createCheckout(req,env,l){
 const price=await checkoutPrice(env);
 const claim=claimFrom(new URL(req.url)),claimHash=claim?await digest(claim):'',existing=claim?await first(env,'SELECT * FROM activation_claims WHERE app=? AND token_hash=?',app(env),claimHash):null;
 if(existing){if(existing.expires_at<now())fail('claim_expired',410);const order=await first(env,'SELECT * FROM orders WHERE app=? AND id=?',app(env),existing.order_id);if(order?.session_id){const owned=await ownSession(env,order.session_id);if(owned.session.status==='expired')fail('claim_expired',410);const destination=owned.session.status==='complete'?origin(req,env)+'/success?sid='+order.session_id+'&claim='+claim+'&lang='+l:owned.session.url;let checked;try{checked=new URL(destination)}catch{fail('stripe',502)}if(checked.protocol!=='https:'||![new URL(origin(req,env)).hostname,'checkout.stripe.com'].includes(checked.hostname))fail('schema');return new Response(null,{status:303,headers:{...headers,location:destination}})}}
 const id=existing?.order_id||crypto.randomUUID(),at=now(),host=origin(req,env);
 if(!existing){const statements=[env.ORDERS_DB.prepare('INSERT INTO orders(id,app,price_id,product_id,currency,unit_amount,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,app(env),price.id,objectId(price.product),price.currency,price.unit_amount,at,at)];if(claim)statements.push(env.ORDERS_DB.prepare('INSERT INTO activation_claims(token_hash,app,order_id,created_at,expires_at) VALUES(?,?,?,?,?)').bind(claimHash,app(env),id,at,at+30*86400));await env.ORDERS_DB.batch(statements);}
 const params={mode:'payment','adaptive_pricing[enabled]':'false','line_items[0][price]':price.id,'line_items[0][quantity]':'1',success_url:host+'/success?sid={CHECKOUT_SESSION_ID}&lang='+l+(claim?'&claim='+claim:''),cancel_url:host+'/cancel?lang='+l,locale:l,'client_reference_id':id,'metadata[app]':app(env),'metadata[order_id]':id,'metadata[flow]':'worker_checkout_v2','payment_intent_data[metadata][app]':app(env),'payment_intent_data[metadata][order_id]':id};
 if(env.ALLOW_PROMOTION_CODES==='true')params.allow_promotion_codes='true';if(env.AUTOMATIC_TAX==='true')params['automatic_tax[enabled]']='true';
 let session;try{session=await stripe(env,'/checkout/sessions',{method:'POST',data:params,idempotency:app(env)+'-order-'+id})}catch(error){await run(env,"UPDATE orders SET checkout_status='creation_failed',updated_at=? WHERE id=? AND app=?",now(),id,app(env));throw error}
 if(session.object!=='checkout.session'||!SESSION.test(session.id||'')||session.mode!=='payment'||session.status!=='open'||session.metadata?.app!==app(env)||session.metadata?.order_id!==id)fail('schema');requireMode(session.livemode,env);
 let destination;try{destination=new URL(session.url)}catch{fail('schema')};if(destination.protocol!=='https:'||destination.hostname!=='checkout.stripe.com')fail('schema');
 await run(env,'UPDATE orders SET session_id=?,checkout_status=?,payment_status=?,amount_subtotal=?,amount_total=?,updated_at=? WHERE id=? AND app=?',session.id,session.status,session.payment_status||'unpaid',session.amount_subtotal??null,session.amount_total??null,now(),id,app(env));
 return new Response(null,{status:303,headers:{...headers,location:destination.href}});
}
async function ownSession(env,sid){
 if(!SESSION.test(sid||''))fail('missing');
 const session=await stripe(env,'/checkout/sessions/'+encodeURIComponent(sid)+'?expand[]=payment_intent.latest_charge');
 if(session.object!=='checkout.session'||session.id!==sid||session.mode!=='payment'||!['open','complete','expired'].includes(session.status)||!['paid','unpaid','no_payment_required'].includes(session.payment_status))fail('schema');requireMode(session.livemode,env);
 let record=env.ORDERS_DB?await first(env,'SELECT * FROM orders WHERE app=? AND session_id=?',app(env),sid):null,source='api';
 const linkId=objectId(session.payment_link);
 if(linkId){
  if(!/^plink_[A-Za-z0-9]+$/.test(linkId))fail('wrong');if(env.EXPECTED_PAYMENT_LINK_ID&&linkId!==env.EXPECTED_PAYMENT_LINK_ID)fail('wrong');
  const link=await stripe(env,'/payment_links/'+encodeURIComponent(linkId));if(link.object!=='payment_link'||link.id!==linkId||link.url!==env.STRIPE_PAYMENT_LINK)fail('wrong');source='payment_link';
 }else{
  if(!record&&env.ORDERS_DB&&session.metadata?.order_id)record=await first(env,'SELECT * FROM orders WHERE app=? AND id=?',app(env),session.metadata.order_id);
  if(!record||record.source!=='api'||(record.session_id&&record.session_id!==sid)||session.metadata?.flow!=='worker_checkout_v2'||session.metadata?.app!==app(env)||session.metadata?.order_id!==record.id||session.client_reference_id!==record.id)fail('wrong');
 }
 let items=null;
 if(env.ORDERS_DB||source==='api'){
  const list=await stripe(env,'/checkout/sessions/'+encodeURIComponent(sid)+'/line_items?limit=100');
  if(list.object!=='list'||list.has_more||!Array.isArray(list.data)||!list.data.length)fail('schema');items=list.data;
  if(source==='api'){
   const item=items[0];if(items.length!==1||item.quantity!==1||item.price?.id!==record.price_id||objectId(item.price?.product)!==record.product_id||item.price?.currency!==record.currency||item.price?.unit_amount!==record.unit_amount||session.currency!==record.currency||session.amount_subtotal!==record.unit_amount)fail('wrong');
   if(!Number.isSafeInteger(session.amount_total)||session.amount_total<0)fail('schema');
  }
 }
 return {session,record,source,items};
}
async function reconcile(env,sid,event){
 const owned=await ownSession(env,sid),{session,source,items}=owned;let record=owned.record;
 if(!env.ORDERS_DB)return{session,payment:session.payment_status,record:null};
 const charge=typeof session.payment_intent==='object'?session.payment_intent?.latest_charge:null;
 const refund=typeof charge==='object'&&Number.isSafeInteger(charge?.amount_refunded)?charge.amount_refunded:0;
 const effectiveRefund=Math.max(record?.refunded_amount||0,refund),payment=effectiveRefund>0?(effectiveRefund>=(session.amount_total||Infinity)?'refunded':'partially_refunded'):session.payment_status;
 const paid=session.status==='complete'&&(session.payment_status==='paid'||(source==='api'&&session.payment_status==='no_payment_required'&&session.amount_total===0))&&!effectiveRefund,id=record?.id||'legacy-'+sid,at=now(),item=items?.[0],eventAt=event?.created||0;
 const statement=env.ORDERS_DB.prepare(`INSERT INTO orders(id,app,session_id,price_id,product_id,currency,unit_amount,amount_subtotal,amount_total,payment_intent_id,checkout_status,payment_status,fulfillment_status,refunded_amount,source,created_at,updated_at,fulfilled_at,last_event_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,amount_subtotal=excluded.amount_subtotal,amount_total=excluded.amount_total,payment_intent_id=excluded.payment_intent_id,checkout_status=CASE WHEN orders.checkout_status='complete' THEN 'complete' ELSE excluded.checkout_status END,payment_status=CASE WHEN MAX(orders.refunded_amount,excluded.refunded_amount)>0 THEN CASE WHEN MAX(orders.refunded_amount,excluded.refunded_amount)>=COALESCE(excluded.amount_total,orders.amount_total,9223372036854775807) THEN 'refunded' ELSE 'partially_refunded' END WHEN orders.payment_status='paid' THEN 'paid' ELSE excluded.payment_status END,fulfillment_status=CASE WHEN orders.fulfillment_status='issued' THEN 'issued' ELSE excluded.fulfillment_status END,refunded_amount=MAX(orders.refunded_amount,excluded.refunded_amount),updated_at=excluded.updated_at,fulfilled_at=COALESCE(orders.fulfilled_at,excluded.fulfilled_at),last_event_at=MAX(orders.last_event_at,excluded.last_event_at)`).bind(id,app(env),sid,record?.price_id||item?.price?.id||null,record?.product_id||objectId(item?.price?.product)||null,record?.currency||session.currency||null,record?.unit_amount??item?.price?.unit_amount??null,session.amount_subtotal??null,session.amount_total??null,objectId(session.payment_intent)||null,session.status,payment,paid?'issued':'pending',effectiveRefund,source,record?.created_at||session.created||at,at,paid?at:null,eventAt);
 const statements=[statement];if(event)statements.push(env.ORDERS_DB.prepare('INSERT INTO stripe_events(id,app,type,stripe_created_at,processed_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(event.id,app(env),event.type,event.created,at));
 await env.ORDERS_DB.batch(statements);record=await first(env,'SELECT * FROM orders WHERE id=? AND app=?',id,app(env));await rememberEmail(env,session,record);return{session,payment:record.payment_status,record};
}
async function issue(env,sid){if(!env.LIC_SECRET)fail('configured',503);const result=await reconcile(env,sid);if(result.record?.refunded_amount>0)fail('refunded');if(result.session.status!=='complete'||!(result.session.payment_status==='paid'||(result.record?.source==='api'&&result.session.payment_status==='no_payment_required'&&result.session.amount_total===0)))fail('unpaid');return{...result,key:await computeKey(env.LIC_SECRET,sid)}}
async function verifyWebhook(raw,signature,secret){
 if(!secret)return false;const parts=String(signature||'').split(',').map(part=>part.trim().split('=')),timestamps=parts.filter(([key])=>key==='t'),signatures=parts.filter(([key])=>key==='v1').map(([,value])=>value);
 if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1]||''))return false;const timestamp=Number(timestamps[0][1]);if(Math.abs(now()-timestamp)>300)return false;
 const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(timestamp+'.'+raw))),expected=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 for(const candidate of signatures)if(/^[a-f0-9]{64}$/.test(candidate||'')&&await secureEqual(candidate,expected))return true;return false;
}
async function webhook(req,env){
 if(req.method!=='POST')fail('method',405);if(!env.STRIPE_WEBHOOK_SECRET||!env.ORDERS_DB)fail('configured',503);if(Number(req.headers.get('content-length'))>262144)fail('schema',413);
 const raw=await req.text();if(te.encode(raw).length>262144)fail('schema',413);if(!await verifyWebhook(raw,req.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return json({error:'Invalid webhook signature'},400);
 let event;try{event=JSON.parse(raw)}catch{fail('schema')};if(!/^evt_[A-Za-z0-9]+$/.test(event.id||'')||!Number.isSafeInteger(event.created)||!event.data?.object)fail('schema');
 if(!EVENTS.includes(event.type)||(!event.livemode&&env.ALLOW_TEST_PAYMENTS!=='true'))return json({received:true,ignored:true});
 if(await first(env,'SELECT id FROM stripe_events WHERE id=? AND app=?',event.id,app(env)))return json({received:true,duplicate:true});
 try{
  if(event.type==='charge.refunded'){
   const id=event.data.object.id;if(!/^ch_[A-Za-z0-9]+$/.test(id||''))fail('schema');const charge=await stripe(env,'/charges/'+encodeURIComponent(id));requireMode(charge.livemode,env);if(charge.object!=='charge'||charge.id!==id||!Number.isSafeInteger(charge.amount_refunded)||charge.amount_refunded<0)fail('schema');
   const intent=objectId(charge.payment_intent);if(!/^pi_[A-Za-z0-9]+$/.test(intent||''))return json({received:true,ignored:true});
   const list=await stripe(env,'/checkout/sessions?payment_intent='+encodeURIComponent(intent)+'&limit=100');if(list.object!=='list'||list.has_more||!Array.isArray(list.data))fail('schema');
   let found=false;for(const session of list.data){try{await reconcile(env,session.id,event);found=true}catch(error){if(!['wrong','test'].includes(error.message))throw error}}
   if(!found)return json({received:true,ignored:true});
  }else await reconcile(env,event.data.object.id,event);
  return json({received:true});
 }catch(error){if(['wrong','test'].includes(error.message))return json({received:true,ignored:true});throw error}
}
async function provision(req,env){
 if(env.ENABLE_PROVISIONING!=='true')fail('setup',403);await admin(req,env);if(req.method!=='POST')fail('method',405);
 let matched=null,cursor='';for(let page=0;page<20;page++){const list=await stripe(env,'/payment_links?limit=100'+(cursor?'&starting_after='+encodeURIComponent(cursor):''));if(!Array.isArray(list.data))fail('schema');matched=list.data.find(link=>link.url===env.STRIPE_PAYMENT_LINK);if(matched||!list.has_more)break;cursor=list.data.at(-1)?.id||'';if(!cursor)fail('schema')}
 if(!matched||!/^plink_[A-Za-z0-9]+$/.test(matched.id))fail('setup');requireMode(matched.livemode,env);
 const items=await stripe(env,'/payment_links/'+encodeURIComponent(matched.id)+'/line_items?limit=100'),price=items.data?.[0]?.price;
 if(items.object!=='list'||items.has_more||items.data?.length!==1||items.data[0].quantity!==1||price?.type!=='one_time'||!Number.isSafeInteger(price.unit_amount)||price.unit_amount<=0)fail('setup');
 const url=origin(req,env)+'/webhook',params={url,api_version:'2025-02-24.acacia',description:(env.PRODUCT_NAME||app(env))+' order management','metadata[app]':app(env),'metadata[flow]':'worker_checkout_v2'};for(let i=0;i<EVENTS.length;i++)params[`enabled_events[${i}]`]=EVENTS[i];
 const endpoint=await stripe(env,'/webhook_endpoints',{method:'POST',data:params,idempotency:app(env)+'-billing-v2-webhook-2026-10-05'});
 if(endpoint.object!=='webhook_endpoint'||endpoint.url!==url||!/^whsec_/.test(endpoint.secret||''))fail('setup');requireMode(endpoint.livemode,env);
 // Only the authenticated deployment helper receives this one-time signing secret.
 return json({price_id:price.id,product_id:objectId(price.product),unit_amount:price.unit_amount,currency:price.currency,payment_link_id:matched.id,allow_promotion_codes:!!matched.allow_promotion_codes,automatic_tax:!!matched.automatic_tax?.enabled,webhook_id:endpoint.id,webhook_secret:endpoint.secret,webhook_url:url});
}
async function bodyJSON(req){if(Number(req.headers.get('content-length'))>8192)fail('schema',413);const raw=await req.text();if(raw.length>8192)fail('schema',413);try{return JSON.parse(raw)}catch{fail('schema')}}
async function adminAPI(req,env,url){
 await admin(req,env);const path=url.pathname;
 if(path==='/api/admin/config'){
  if(req.method!=='GET')fail('method',405);if(!/^we_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_ID||''))fail('configured',503);
  const endpoint=await stripe(env,'/webhook_endpoints/'+encodeURIComponent(env.STRIPE_WEBHOOK_ID));
  return json({webhook:{id:endpoint.id,url:endpoint.url,status:endpoint.status,livemode:endpoint.livemode,api_version:endpoint.api_version,enabled_events:endpoint.enabled_events},price_id:env.STRIPE_PRICE_ID});
 }
 if(path==='/api/admin/orders'){
  if(req.method!=='GET')fail('method',405);const limit=Math.min(100,Math.max(1,Math.floor(Number(url.searchParams.get('limit'))||40))),q=(url.searchParams.get('q')||'').slice(0,120),status=url.searchParams.get('status')||'all';
  if(!['all','paid','unpaid','no_payment_required','refunded','partially_refunded','expired','creation_failed'].includes(status))fail('schema');
  const args=[app(env)];let sql='SELECT * FROM orders WHERE app=?';const encoded=url.searchParams.get('cursor');
  if(encoded){let cursor;try{cursor=JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')))}catch{fail('schema')};if(!Number.isSafeInteger(cursor.at)||cursor.at<0||typeof cursor.id!=='string'||cursor.id.length>120)fail('schema');sql+=' AND (created_at<? OR (created_at=? AND id<?))';args.push(cursor.at,cursor.at,cursor.id)}
  if(q){sql+=' AND (instr(id,?)>0 OR instr(session_id,?)>0 OR instr(payment_intent_id,?)>0)';args.push(q,q,q)}
  if(['expired','creation_failed'].includes(status)){sql+=' AND checkout_status=?';args.push(status)}else if(status!=='all'){sql+=' AND payment_status=?';args.push(status)}sql+=' ORDER BY created_at DESC,id DESC LIMIT ?';args.push(limit+1);
  const rows=await env.ORDERS_DB.prepare(sql).bind(...args).all(),orders=rows.results.slice(0,limit),last=orders.at(-1);const count=await first(env,"SELECT COUNT(*) AS total,SUM(payment_status IN ('paid','no_payment_required')) AS paid,SUM(payment_status IN ('refunded','partially_refunded')) AS refunds FROM orders WHERE app=?",app(env));return json({orders,stats:count,next_cursor:rows.results.length>limit&&last?b64urlBytes(te.encode(JSON.stringify({at:last.created_at,id:last.id}))):null});
 }
 if(['/api/admin/reconcile','/api/admin/expire','/api/admin/license'].includes(path)){
  if(req.method!=='POST')fail('method',405);const data=await bodyJSON(req);if(!SESSION.test(data.sid||''))fail('missing');
  if(path==='/api/admin/license'){const result=await issue(env,data.sid);return json({key:result.key,sid:data.sid})}
  if(path==='/api/admin/expire'){const {session,record,source}=await ownSession(env,data.sid);if(source!=='api'||!record||session.status!=='open'||session.payment_status!=='unpaid')fail('wrong');await stripe(env,'/checkout/sessions/'+encodeURIComponent(data.sid)+'/expire',{method:'POST',data:{},idempotency:app(env)+'-expire-'+data.sid})}
  const result=await reconcile(env,data.sid);return json({order:result.record});
 }
 return json({error:'Not found'},404);
}
const CLAIM = /^[a-f0-9]{64}$/;
async function digest(value) { return b64urlBytes(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(value)))); }
async function privateHash(env, value) {
  if (!env.LIC_SECRET) fail('configured', 503);
  const key = await crypto.subtle.importKey('raw', te.encode(env.LIC_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64urlBytes(new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(value))));
}
function claimFrom(url) { const claim = url.searchParams.get('claim') || ''; if (claim && !CLAIM.test(claim)) fail('schema'); return claim; }
async function activation(req, env, url) {
  if (req.method !== 'GET') fail('method', 405);
  const token = url.searchParams.get('token'); if (!CLAIM.test(token || '')) fail('schema');
  const claim = await first(env, 'SELECT * FROM activation_claims WHERE app=? AND token_hash=?', app(env), await digest(token));
  if (!claim) return json({ status: 'awaiting_checkout' });
  if (claim.expires_at < now()) fail('claim_expired', 410);
  const order = await first(env, 'SELECT * FROM orders WHERE app=? AND id=?', app(env), claim.order_id);
  if (!order?.session_id) return json({ status: 'awaiting_checkout' });
  const result = await reconcile(env, order.session_id);
  if (result.record.refunded_amount > 0) fail('refunded');
  if (result.session.status === 'expired') return json({ status: 'expired' });
  if (result.session.status !== 'complete' || !['paid', 'no_payment_required'].includes(result.session.payment_status)) return json({ status: 'pending' });
  const issued = await issue(env, order.session_id); return json({ status: 'paid', key: issued.key, sid: order.session_id });
}
async function rememberEmail(env, session, order) {
  const email = session.customer_details?.email || session.customer_email;
  if (!order || typeof email !== 'string' || email.length > 254) return;
  await run(env, 'INSERT INTO order_emails(order_id,app,email_hash) VALUES(?,?,?) ON CONFLICT(order_id) DO UPDATE SET email_hash=excluded.email_hash', order.id, app(env), await privateHash(env, 'email:' + email.trim().toLowerCase()));
}
async function requestRecovery(req, env, l) {
  if (req.method !== 'POST') fail('method', 405);
  if (!env.RESEND_API_KEY || !env.BILLING_EMAIL_FROM) fail('recovery_configured', 503);
  const data = await bodyJSON(req), email = String(data.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('schema');
  const emailHash = await privateHash(env, 'email:' + email), ipHash = await privateHash(env, 'ip:' + (req.headers.get('cf-connecting-ip') || 'unknown'));
  // Reserve the challenge before sending. Neither email addresses nor plaintext codes are stored.
  await run(env, 'DELETE FROM recovery_requests WHERE created_at<?', now() - 86400);
  const recent = await first(env, 'SELECT COUNT(*) AS n,MAX(created_at) AS last FROM recovery_requests WHERE app=? AND email_hash=? AND created_at>?', app(env), emailHash, now() - 3600);
  const byIP = await first(env, 'SELECT COUNT(*) AS n FROM recovery_requests WHERE app=? AND ip_hash=? AND created_at>?', app(env), ipHash, now() - 3600);
  if (recent.n >= 5 || recent.last > now() - 60 || byIP.n >= 20) fail('rate_limit', 429);
  const id = crypto.randomUUID(), code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  await run(env, 'INSERT INTO recovery_requests(id,app,email_hash,ip_hash,code_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?)', id, app(env), emailHash, ipHash, await privateHash(env, 'code:' + id + ':' + code), now(), now() + 600);
  const order = await first(env, "SELECT o.* FROM orders o JOIN order_emails e ON e.order_id=o.id WHERE o.app=? AND e.email_hash=? AND o.fulfillment_status='issued' AND o.refunded_amount=0 ORDER BY o.created_at DESC LIMIT 1", app(env), emailHash);
  if (order) {
    const zh = l === 'zh', product = env.PRODUCT_NAME || 'Pro'; let response;
    try { response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'recovery-' + id }, body: JSON.stringify({ from: env.BILLING_EMAIL_FROM, to: [email], subject: product + (zh ? '：恢复购买验证码' : ': restore purchase code'), text: zh ? `你的 ${product} 恢复购买验证码是 ${code}，10 分钟内有效。请在插件中输入。若非本人操作，可忽略此邮件。` : `Your ${product} restore purchase code is ${code}. It expires in 10 minutes. Enter it in the extension. If you did not request this, ignore this email.` }), signal: AbortSignal.timeout(15000) }); } catch { fail('recovery_configured', 503); }
    if (!response.ok) fail('recovery_configured', 503);
  }
  // Identical responses for known and unknown addresses prevent purchase enumeration.
  return json({ recoveryId: id, expiresIn: 600 });
}
async function verifyRecovery(req, env) {
  if (req.method !== 'POST') fail('method', 405);
  const data = await bodyJSON(req); if (!/^[\w-]{36}$/.test(data.id || '') || !/^\d{6}$/.test(data.code || '')) fail('recovery_code');
  const challenge = await env.ORDERS_DB.prepare('UPDATE recovery_requests SET attempts=attempts+1 WHERE id=? AND app=? AND expires_at>=? AND attempts<5 AND verified_at IS NULL RETURNING *').bind(data.id, app(env), now()).first();
  if (!challenge || !await secureEqual(challenge.code_hash, await privateHash(env, 'code:' + data.id + ':' + data.code))) fail('recovery_code');
  const order = await first(env, "SELECT o.* FROM orders o JOIN order_emails e ON e.order_id=o.id WHERE o.app=? AND e.email_hash=? AND o.fulfillment_status='issued' AND o.refunded_amount=0 ORDER BY o.created_at DESC LIMIT 1", app(env), challenge.email_hash);
  if (!order) fail('recovery_code');
  const issued = await issue(env, order.session_id);
  const consumed = await env.ORDERS_DB.prepare('UPDATE recovery_requests SET verified_at=? WHERE id=? AND app=? AND verified_at IS NULL RETURNING id').bind(now(), data.id, app(env)).first();
  if (!consumed) fail('recovery_code');
  return json({ status: 'paid', key: issued.key, sid: order.session_id });
}

const clientJS="(()=>{\n 'use strict';\n const zh=document.querySelector('main')?.dataset.lang==='zh',t=(en,cn)=>zh?cn:en;\n const element=id=>document.getElementById(id),notice=(message,error=false)=>{const node=element('message');if(node){node.textContent=message;node.className=error?'error':'quiet'}};\n element('copy-key')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(element('license-key').value);notice(t('License key copied.','授权 Key 已复制。'))}catch{notice(t('Select and copy the key manually.','请选中 Key 后手动复制。'),true)}});\n element('close-dialog')?.addEventListener('click',()=>element('license-dialog').close());\n const automatic=element('auto-activation');\n if(automatic&&/^[a-p]{32}$/.test(automatic.dataset.extension||'')&&/^[a-f0-9]{64}$/.test(automatic.dataset.claim||'')){\n  try{if(globalThis.chrome?.runtime?.sendMessage)chrome.runtime.sendMessage(automatic.dataset.extension,{type:'BILLING_COMPLETE',token:automatic.dataset.claim},response=>{const failed=chrome.runtime.lastError;if(!failed&&response?.ok&&response.billingStatus==='activated'){automatic.textContent=t('Pro activated. Return to your extension.','Pro 已激活，返回插件即可使用。')}else{automatic.textContent=t('Return to the extension and select Check payment.','请返回插件，点击检查付款状态。')}});else automatic.textContent=t('Return to the extension to finish activation.','返回插件即可完成激活。')}catch{automatic.textContent=t('Return to the extension to finish activation.','返回插件即可完成激活。')}\n }\n if(!element('login'))return;\n let token='',busy=false,cursor='',nextCursor='',history=[];\n const statusText={paid:t('Paid','已付款'),unpaid:t('Unpaid','未付款'),no_payment_required:t('Free promotion','优惠免付'),refunded:t('Refunded','已退款'),partially_refunded:t('Partial refund','部分退款'),open:t('Open','待支付'),complete:t('Complete','已完成'),expired:t('Expired','已过期'),creating:t('Creating','创建中'),creation_failed:t('Creation failed','创建失败'),issued:t('Issued','已签发'),pending:t('Pending','未签发')};\n async function api(route,data){const response=await fetch(route+(route.includes('?')?'&':'?')+'lang='+(zh?'zh':'en'),{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store'});const body=await response.json();if(!response.ok){if(response.status===401)logout();throw new Error(body.error||t('Request failed.','请求失败。'))}return body}\n function logout(){token='';cursor='';nextCursor='';history=[];element('orders').replaceChildren();element('workspace').classList.add('hide');element('login').classList.remove('hide');element('login').reset();element('license-key').value='';element('license-dialog').close()}\n function node(tag,value,className){const result=document.createElement(tag);if(value!==undefined)result.textContent=value;if(className)result.className=className;return result}\n async function action(type,order,button){\n  if(busy)return;if(type==='expire'&&!confirm(t('Expire this unpaid checkout? The customer will need a new checkout to pay.','关闭这笔未付款结账？客户之后需重新发起购买。')))return;\n  busy=true;button.disabled=true;notice(t('Checking with Stripe…','正在向 Stripe 核对…'));\n  try{const result=await api('/api/admin/'+type,{sid:order.session_id});if(type==='license'){element('license-key').value=result.key;element('license-dialog').showModal();notice(t('License retrieved.','已找回授权。'))}else{await load();notice(t('Order updated.','订单已更新。'))}}catch(error){notice(error.message,true)}finally{busy=false;button.disabled=false}\n }\n function render(orders){\n  const body=element('orders');body.replaceChildren();\n  if(!orders.length){const row=node('tr'),cell=node('td',t('No matching orders.','没有匹配订单。'));cell.colSpan=5;row.append(cell);body.append(row);return}\n  for(const order of orders){\n   const row=node('tr'),reference=node('td');reference.append(node('div',order.id),node('div',order.session_id||'—','small'),node('div',order.source==='api'?'API Checkout':'Payment Link','small'));row.append(reference);\n   let amount='—';if(order.amount_total!=null&&order.currency){try{amount=new Intl.NumberFormat(zh?'zh-CN':'en',{style:'currency',currency:order.currency.toUpperCase()}).format(order.amount_total/100)}catch{amount=order.amount_total+' '+order.currency}}\n   const money=node('td',amount);if(order.refunded_amount)money.append(node('div',t('Refund: ','退款：')+(order.refunded_amount/100).toFixed(2)+' '+order.currency,'small'));row.append(money);\n   const states=node('td');states.append(node('span',statusText[order.payment_status]||order.payment_status,'tag '+(order.payment_status==='paid'?'paid':'')),node('div',(statusText[order.checkout_status]||order.checkout_status)+' · '+(statusText[order.fulfillment_status]||order.fulfillment_status),'small'));row.append(states,node('td',new Date(order.created_at*1000).toLocaleString(zh?'zh-CN':'en')));\n   const actions=node('td');if(order.session_id){for(const [type,title]of [['reconcile',t('Refresh','核对')],['license',t('License','授权')],['expire',t('Expire','关闭')]]){const button=node('button',title,type==='license'?'':'secondary');button.type='button';button.disabled=type==='expire'&&(order.source!=='api'||order.checkout_status!=='open'||order.payment_status!=='unpaid')||type==='license'&&(order.fulfillment_status!=='issued'||order.refunded_amount>0);button.addEventListener('click',()=>action(type,order,button));actions.append(button)}}row.append(actions);body.append(row);\n  }\n }\n async function load(){const params=new URLSearchParams({q:element('query').value.trim(),status:element('status').value,...(cursor?{cursor}:{})}),result=await api('/api/admin/orders?'+params);render(result.orders);const stats=result.stats;element('stats').textContent=t('Orders: ','订单：')+(stats.total||0)+' · '+t('Paid: ','已付款：')+(stats.paid||0)+' · '+t('Refunds: ','退款：')+(stats.refunds||0);nextCursor=result.next_cursor||'';element('older').disabled=!nextCursor;element('newer').disabled=!history.length}\n element('login').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;token=element('token').value.trim();busy=true;try{await load();element('login').reset();element('login').classList.add('hide');element('workspace').classList.remove('hide');notice(t('Connected.','已连接。'))}catch(error){token='';notice(error.message,true)}finally{busy=false}});\n element('filters').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;cursor='';history=[];try{await load();notice('')}catch(error){notice(error.message,true)}});\n element('older').addEventListener('click',async()=>{if(!nextCursor||busy)return;history.push(cursor);cursor=nextCursor;try{await load()}catch(error){cursor=history.pop();notice(error.message,true)}});\n element('newer').addEventListener('click',async()=>{if(!history.length||busy)return;cursor=history.pop();try{await load()}catch(error){notice(error.message,true)}});\n element('reconcile-reference').addEventListener('click',()=>{const sid=element('query').value.trim();if(!/^cs_(?:live|test)_[A-Za-z0-9]{6,}$/.test(sid)){notice(t('Enter a complete checkout reference (cs_…).','请输入完整付款编号（cs_…）。'),true);return}action('reconcile',{session_id:sid},element('reconcile-reference'))});\n element('logout').addEventListener('click',()=>{logout();notice(t('Signed out.','已退出。'))});\n})();\n";
function adminPage(env,l){const zh=l==='zh';return page(`<section class="card admin-card"><span class="eyebrow">ORDER MANAGEMENT</span><h1>${zh?'订单与授权':'Orders & licenses'}</h1><div class="actions"><a href="/admin?lang=${zh?'en':'zh'}">${zh?'English':'简体中文'}</a></div><form id="login"><label for="token">${zh?'管理员访问密钥':'Administrator access token'}</label><input id="token" type="password" autocomplete="off" required><div class="actions"><button>${zh?'进入订单后台':'Open order manager'}</button></div><p class="quiet">${zh?'访问密钥仅用于本页请求；关闭页面后需重新输入。':'The token is used only for this page’s requests. Enter it again after closing the page.'}</p></form><p id="message" class="quiet" role="status"></p><section id="workspace" class="hide"><p id="stats" class="quiet"></p><form id="filters" class="toolbar"><input id="query" aria-label="${zh?'搜索订单':'Search orders'}" placeholder="${zh?'订单号 / Session / PaymentIntent':'Order / Session / PaymentIntent'}"><select id="status" aria-label="${zh?'状态':'Status'}">${[['all','All','全部'],['paid','Paid','已付款'],['no_payment_required','Free promotion','优惠免付'],['unpaid','Unpaid','未付款'],['refunded','Refunded','已退款'],['partially_refunded','Partial refund','部分退款'],['expired','Expired','已过期'],['creation_failed','Creation failed','创建失败']].map(([value,en,cn])=>`<option value="${value}">${zh?cn:en}</option>`).join('')}</select><button>${zh?'查询':'Search'}</button><button type="button" class="secondary" id="reconcile-reference">${zh?'核对输入的付款编号':'Reconcile checkout reference'}</button><button type="button" class="secondary" id="logout">${zh?'退出':'Sign out'}</button></form><div class="table-wrap"><table><thead><tr><th>${zh?'订单':'Order'}</th><th>${zh?'金额':'Amount'}</th><th>${zh?'支付 / 授权':'Payment / License'}</th><th>${zh?'创建时间':'Created'}</th><th>${zh?'操作':'Actions'}</th></tr></thead><tbody id="orders"></tbody></table></div><div class="actions"><button id="newer" class="secondary" type="button">${zh?'较新订单':'Newer orders'}</button><button id="older" class="secondary" type="button">${zh?'更早订单':'Older orders'}</button></div><p class="quiet">${zh?'每页显示 40 个匹配订单。退款请在 Stripe 后台处理；这里可以核对状态、领取授权和关闭未付款订单。':'Shows 40 matching orders per page. Process refunds in Stripe; here you can reconcile status, retrieve a license and expire an unpaid checkout.'}</p><p class="quiet">${zh?'退款会记录在后台；已经激活的离线授权不会自动撤销。':'Refunds are recorded here; already activated offline licenses are not automatically revoked.'}</p></section></section><dialog id="license-dialog"><h2>${zh?'订单授权':'Order license'}</h2><textarea id="license-key" readonly aria-label="License key"></textarea><div class="actions"><button id="copy-key">${zh?'复制授权 Key':'Copy license key'}</button><button class="secondary" id="close-dialog">${zh?'关闭':'Close'}</button></div></dialog>`,env,l)}
export default {async fetch(req,env){const url=new URL(req.url),l=lang(url);try{
 if(url.pathname==='/health')return new Response('ok',{headers:{...headers,'content-type':'text/plain'}});
 if(url.pathname==='/status')return json({version:VERSION,mode:env.CHECKOUT_MODE==='api'?'checkout-api':'payment-link',orders:!!env.ORDERS_DB,webhook:!!env.STRIPE_WEBHOOK_SECRET,provisioning:env.ENABLE_PROVISIONING==='true',activation:!!env.EXTENSION_ID,emailRecovery:!!(env.RESEND_API_KEY&&env.BILLING_EMAIL_FROM)});
 if(url.pathname==='/assets/billing.js'){if(req.method!=='GET')fail('method',405);return new Response(clientJS,{headers:{...headers,'content-type':'application/javascript; charset=utf-8'}})}
 if(url.pathname==='/admin')return adminPage(env,l);
 if(url.pathname==='/api/admin/provision')return await provision(req,env);
 if(url.pathname.startsWith('/api/admin/'))return await adminAPI(req,env,url);
 if(url.pathname==='/webhook')return await webhook(req,env);
 if(url.pathname==='/api/activation')return await activation(req,env,url);
 if(url.pathname==='/api/recovery/request')return await requestRecovery(req,env,l);
 if(url.pathname==='/api/recovery/verify')return await verifyRecovery(req,env);
 if(url.pathname==='/buy'||url.pathname==='/checkout'){
  if(!['GET','POST'].includes(req.method)||(url.pathname==='/checkout'&&req.method!=='POST'))fail('method',405);
  if(env.CHECKOUT_MODE!=='api')return new Response(null,{status:302,headers:{...headers,location:env.STRIPE_PAYMENT_LINK}});
  if(req.method==='GET')return await purchasePage(env,l,claimFrom(url));
  return await createCheckout(req,env,l);
 }
 if(url.pathname==='/success'){
  const sid=url.searchParams.get('sid')||url.searchParams.get('reference')||'',result=await issue(env,sid),zh=l==='zh',claim=claimFrom(url);
  return page(`<section class="card"><span class="eyebrow">PAYMENT CONFIRMED</span><h1>${zh?'付款成功，可以继续了。':'Payment confirmed. You’re ready to continue.'}</h1><p class="quiet">${zh?'通过插件发起的购买会自动激活 Pro。返回侧栏即可继续使用。':'Purchases started in the extension activate Pro automatically. Return to the side panel to continue.'}</p><p id="auto-activation" class="quiet" role="status" data-extension="${esc(env.EXTENSION_ID||'')}" data-claim="${esc(claim)}">${zh?'正在为插件激活 Pro…':'Activating Pro in your extension…'}</p><details><summary>${zh?'保存授权码 / 手动激活':'Save license / activate manually'}</summary><textarea id="license-key" readonly aria-label="License key">${esc(result.key)}</textarea><div class="actions"><button id="copy-key">${zh?'复制 Pro 授权码':'Copy Pro license code'}</button></div><ol><li>${zh?'打开插件设置，选择“管理购买”或“了解 Pro”。':'Open extension Settings, then Manage purchase or Explore Pro.'}</li><li>${zh?'展开“已有授权码？”，粘贴并激活。':'Expand “Have a license code?”, paste and activate.'}</li></ol></details><div class="actions"><a href="/success?sid=${encodeURIComponent(sid)}&lang=${zh?'en':'zh'}${claim?'&claim='+claim:''}">${zh?'English':'简体中文'}</a></div><p class="quiet" id="message" role="status"></p><p class="quiet">${zh?'保留此页面地址可重新领取授权；也可在插件中通过购买邮箱恢复。':'Keep this page’s address to retrieve your license, or restore using the purchase email in the extension.'}</p></section>`,env,l);
 }
 if(url.pathname==='/cancel')return page(`<section class="card"><h1>${l==='zh'?'结账尚未完成。':'Checkout is not complete.'}</h1><p class="quiet">${l==='zh'?'你可以稍后重新购买。如果已付款，请使用付款成功页领取授权或联系支持。':'You can return to purchase later. If you already paid, use your confirmation page to retrieve the license or contact support.'}</p><a class="button" href="/buy?lang=${l}">${l==='zh'?'重新购买':'Return to checkout'}</a></section>`,env,l);
 if(url.pathname==='/')return page(`<section class="card"><h1>${esc(env.PRODUCT_NAME||'Pro')} Billing</h1><p class="quiet">${l==='zh'?'由 Stripe 安全处理付款。':'Payments are securely handled by Stripe.'}</p><div class="actions"><a class="button" href="/buy?lang=${l}">${l==='zh'?'购买 Pro':'Get Pro'}</a></div></section>`,env,l);
 return json({error:'Not found'},404);
 }catch(error){const known=error instanceof BillingError,status=known?error.status:503,code=known?error.message:'storage';if(url.pathname.startsWith('/api/')||url.pathname==='/webhook')return json({error:text(code,l),code},status);return page(`<section class="card"><h1>${l==='zh'?'暂时无法完成。':'Could not complete this request.'}</h1><p class="error">${esc(text(code,l))}</p><p class="quiet">${l==='zh'?'请保留订单编号并联系支持，勿重复支付。':'Keep your checkout reference and contact support. Avoid paying twice.'}</p></section>`,env,l,status)}}};
