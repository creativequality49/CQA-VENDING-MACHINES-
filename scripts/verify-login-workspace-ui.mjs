import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = new URL(process.env.CQA_UI_BASE_URL || 'http://127.0.0.1:3100');
if (base.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(base.hostname)) throw Error('UI fixture test requires localhost.');
const output='work/login-workspace-ui'; await mkdir(output,{recursive:true});
const userId='10000000-0000-4000-8000-000000000001';
const business={id:'10000000-0000-4000-8000-000000000010',name:'QA Connected Business',slug:'qa-business',category:'Services',plan:'starter',status:'draft',verified:false};
const user={id:userId,email:'qa@example.test',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:userId,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.qa-fixture';
const session={access_token:token,refresh_token:'qa-fixture-refresh',token_type:'bearer',expires_in:3600,user};
const browser=await chromium.launch({executablePath:process.env.CQA_UI_BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']});
const errors=[];
async function context(viewport){
 const ctx=await browser.newContext({viewport});
 await ctx.route('**/*',async route=>{
  const url=new URL(route.request().url());
  const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.hostname==='portal-qa-fixture.supabase.co'){
   if(url.pathname.endsWith('/token'))return send(session);
   if(url.pathname.endsWith('/user'))return send(user);
   if(url.pathname.endsWith('/cqa_businesses'))return send([business]);
   if(url.pathname.endsWith('/cqa_machines'))return send([{id:'10000000-0000-4000-8000-000000000020',slug:'qa-business',title:'QA storefront',status:'draft'}]);
   if(url.pathname.startsWith('/rest/'))return send([]);
   return send({});
  }
  if(url.hostname!==base.hostname&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')return route.abort();
  if(url.pathname==='/api/owner/orders')return send({business:{id:business.id,name:business.name},orders:[],hasMore:false,page:0});
  return route.continue();
 });
 return ctx;
}
try{
 const ctx=await context({width:1440,height:1000});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('/login?next=/owner/dashboard',base).href,{waitUntil:'networkidle'});
 await page.getByLabel('Email address',{exact:true}).fill('qa@example.test');
 await page.getByLabel('Password',{exact:true}).fill('qa-fixture-password');
 await page.screenshot({path:output+'/login-desktop.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'desktop login overflow');
 await page.locator('form button[type="submit"]').click();
 await page.getByRole('heading',{name:business.name,exact:true}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/owner/dashboard');
 await page.getByRole('button',{name:'Zoom map in',exact:true}).click();
 await page.getByRole('button',{name:'Reset map view',exact:true}).filter({hasText:'120%'}).waitFor();
 await page.getByRole('button',{name:'Reset map view',exact:true}).click();
 assert.equal(await page.getByRole('navigation',{name:'Workspace map destinations'}).getByRole('link').count(),6);
 await page.screenshot({path:output+'/dashboard-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile dashboard overflow');
 await page.screenshot({path:output+'/dashboard-mobile.png',fullPage:true});
 await page.getByRole('navigation',{name:'Workspace map destinations'}).getByRole('link',{name:/Orders\./}).click();
 await page.waitForURL('**/owner/orders');
 const cb=await context({width:390,height:844});const cp=await cb.newPage();cp.on('pageerror',e=>errors.push(e.message));
 await cp.goto(new URL('/login',base).href,{waitUntil:'networkidle'});
 assert(await cp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile login overflow');
 await cp.screenshot({path:output+'/login-mobile.png',fullPage:true});
 const callback=new URL('/auth/confirm?next=/owner/dashboard',base);callback.hash=new URLSearchParams({access_token:token,refresh_token:'qa-fixture-refresh',type:'magiclink',expires_in:'3600'}).toString();
 await cp.goto(callback.href,{waitUntil:'networkidle'});
 await cp.getByRole('heading',{name:business.name,exact:true}).waitFor();
 assert.equal(new URL(cp.url()).pathname,'/owner/dashboard');assert.equal(new URL(cp.url()).hash,'');
 assert.deepEqual(errors,[]);
 console.log('PASS intercepted browser QA: password login and email callback reach owner dashboard; callback credentials scrubbed; graph zoom/reset/navigation work; desktop/mobile have no overflow or page errors. This does not prove real Supabase email delivery or its redirect allowlist.');
}finally{await browser.close();}
