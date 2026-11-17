import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const baseURL = new URL(process.env.CQA_UI_BASE_URL || 'http://127.0.0.1:3100');
if (baseURL.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(baseURL.hostname)) throw new Error('Intercepted browser QA must run only on a local HTTP server.');
const output = path.resolve('work/customer-portal-ui');
await mkdir(output, { recursive: true });
import assert from 'node:assert/strict';
// Browser fixtures are isolated from real providers. SQL/API tests separately
// exercise the real migration and route handlers. These checks prove UI only.
const browser = await chromium.launch({ executablePath:process.env.CQA_UI_BROWSER_EXECUTABLE, headless:true, args:['--no-sandbox'] });
const id = '10000000-0000-4000-8000-000000000040';
const now = new Date().toISOString();
let order = { id,title:'Business Launch System',businessName:'CQA Test Business',businessId:'10000000-0000-4000-8000-000000000010',machineSlug:'qa-test-machine',offerType:'service',fulfillmentType:'service',paymentStatus:'paid',amountCents:12900,currency:'aud',createdAt:now,workspace:{state:'awaiting_intake',intake:null,deliveryMessage:null,hasAsset:false,assetName:null,revision:0,updatedAt:now} };
const events = [];
const ownerOrder = () => ({id,status:order.paymentStatus,amountCents:order.amountCents,currency:order.currency,createdAt:now,customerEmail:'qa-customer@example.test',offerName:order.title,digital:false,workspace:{...order.workspace,intake:order.workspace.intake||{}}});
async function createContext(who, viewport) {
 const context = await browser.newContext({viewport});
 const userId = who==='owner'?'10000000-0000-4000-8000-000000000001':'10000000-0000-4000-8000-000000000002';
 await context.addInitScript(({userId})=>{
  if(sessionStorage.getItem('qa-seeded'))return;
  const exp=Math.floor(Date.now()/1000)+3600;
  const encode=x=>btoa(JSON.stringify(x)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:userId,aud:'authenticated',role:'authenticated',exp})+'.qa-fixture-signature';
  const user={id:userId,email:'qa-customer@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString(),email_confirmed_at:new Date().toISOString()};
  localStorage.setItem('sb-portal-qa-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'qa-fixture-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user}));
  sessionStorage.setItem('qa-seeded','1');
 },{userId});
 await context.route('**/*', async route=>{
  const url=new URL(route.request().url()); const path=url.pathname;
  if(url.hostname==='portal-qa-fixture.supabase.co')return route.fulfill({status:path.endsWith('/logout')?204:200,contentType:'application/json',body:path.endsWith('/logout')?'':'{}'});
  if(url.hostname!=='127.0.0.1'&&url.hostname!=='localhost')return route.abort();
  const send=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(path.startsWith('/api/customer/orders')){
   if(path.endsWith('/intake')){const p=route.request().postDataJSON();assert.equal(p.expectedRevision,order.workspace.revision);order.workspace={...order.workspace,intake:{businessName:p.businessName,goals:p.goals,details:p.details},state:'queued',revision:order.workspace.revision+1};events.push({id:'event-1',kind:'intake_submitted',message:'Customer brief received.',createdAt:now});return send({order,events});}
   if(path==='/api/customer/orders')return send({orders:[order],hasMore:false,nextOffset:null,nextCursor:null});
   return send({order,events});
  }
  if(path.startsWith('/api/owner/orders')){
   if(path==='/api/owner/orders')return send({business:{id:order.businessId,name:order.businessName},orders:[ownerOrder()],hasMore:false,page:0});
   if(route.request().method()==='POST'){
    const p=route.request().postDataJSON();assert.equal(p.expectedRevision,order.workspace.revision);
    if(p.action==='start')order.workspace={...order.workspace,state:'in_progress',revision:order.workspace.revision+1};
    else if(p.action==='deliver')order.workspace={...order.workspace,state:'delivered',deliveryMessage:p.message,revision:order.workspace.revision+1};
    else throw Error('Unexpected browser QA action');
    return send({updated:true,order:ownerOrder()});
   }
   return send({order:ownerOrder(),events:events.map(x=>({id:x.id,actor_role:'buyer',kind:x.kind,message:x.message,created_at:x.createdAt}))});
  }
  return route.continue();
 });
 return context;
}
try{
 const customer=await createContext('buyer',{width:1440,height:1000});const page=await customer.newPage();
 const failures=[];page.on('pageerror',e=>failures.push(e.message));
 await page.goto(new URL('/account',baseURL).href,{waitUntil:'networkidle',timeout:60000});
 await page.getByRole('heading',{name:'Your orders',exact:true}).waitFor();
 await page.getByRole('link',{name:'Business Launch System',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'desktop account overflow');
 await page.screenshot({path:path.join(output,'customer-account-desktop.png'),fullPage:true});
 await page.getByRole('link',{name:'Business Launch System',exact:true}).click();
 await page.getByLabel('Business or project name',{exact:false}).fill('QA business');
 await page.getByLabel('What would you like to achieve?',{exact:false}).fill('Launch a useful customer workflow.');
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.waitForTimeout(200);
 assert.equal(await page.getByLabel('Business or project name',{exact:false}).inputValue(),'QA business','unchanged session focus must preserve draft');
 await page.getByRole('button',{name:'Send project brief'}).click();
 await page.getByText('Brief received',{exact:true}).waitFor();assert.equal(order.workspace.state,'queued');
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile detail overflow');
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(output,'customer-order-mobile.png'),fullPage:true});
 console.log('PASS browser customer order overview, detail, persisted intake and desktop/mobile layout (intercepted QA fixtures)');
 const owner=await createContext('owner',{width:1440,height:1000});const op=await owner.newPage();op.on('pageerror',e=>failures.push(e.message));
 await op.goto(new URL('/owner/orders',baseURL).href,{waitUntil:'networkidle',timeout:60000});
 await op.getByRole('button').filter({hasText:'Business Launch System'}).click();
 await op.getByRole('button',{name:'Start work',exact:true}).click();
 await op.getByLabel('Message for your customer').fill('Your delivery is ready. This is a browser QA fixture.');
 await op.getByRole('button',{name:'Mark delivered',exact:true}).click();
 await op.getByRole('heading',{name:'Delivered to your customer',exact:true}).waitFor();assert.equal(order.workspace.state,'delivered');
 assert.equal(await op.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'owner desktop overflow');
 await op.evaluate(()=>window.scrollTo(0,0));
 await op.screenshot({path:path.join(output,'owner-fulfillment-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:/Refresh/}).last().click();
 await page.getByRole('heading',{name:'Your delivery is here.',exact:true}).waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(output,'customer-delivery-mobile.png'),fullPage:true});
 await op.setViewportSize({width:390,height:844});assert.equal(await op.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'owner mobile overflow');
 assert.deepEqual(failures,[]);
 console.log('PASS browser owner start/deliver and customer handover refresh; no page errors (intercepted QA fixtures)');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login?next=**');assert.equal(await page.getByText('Your delivery is here.',{exact:true}).count(),0);console.log('PASS browser sign-out clears the private view and returns to customer login');
 await customer.close();await owner.close();
}finally{await browser.close();}
