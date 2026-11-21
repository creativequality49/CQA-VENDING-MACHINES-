import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base=new URL(process.env.CQA_UI_BASE_URL||'http://127.0.0.1:3100');
if(base.protocol!=='http:'||!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Theme QA requires localhost.');
const output='work/color-theme-ui';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CQA_UI_BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']});
const routes=['/','/machines','/marketplace','/pricing','/workers','/digital-vending-machine','/login','/reset-password','/contact','/terms','/privacy','/refund-policy','/onboarding','/founding-customers','/digital-products','/compliance','/quiz','/age-check','/machine/demo-cqa-activewear'];
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['localhost','127.0.0.1'].includes(host)?route.continue():route.abort()});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 for(const route of routes){
  const response=await page.goto(new URL(route,base).href,{waitUntil:'networkidle',timeout:60000});
  assert.equal(response.status(),200,route+' page exists');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light',route+' defaultlight');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)',route+' whitebody');
  const main=page.locator('main').first();
  if(await main.count())assert.equal(await main.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)',route+' whitemain');
  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(12, 14, 18)',route+' darkbody');
  if(await main.count())assert.equal(await main.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(12, 14, 18)',route+' darkmain');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark',route+' savedtheme');
  await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
 }
 await page.goto(base.href,{waitUntil:'networkidle'});await page.screenshot({path:output+'/home-light.png',fullPage:false});
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await page.screenshot({path:output+'/home-dark.png',fullPage:false});
 const other=await context.newPage();await other.goto(new URL('/login',base).href,{waitUntil:'networkidle'});assert.equal(await other.locator('html').getAttribute('data-theme'),'dark');
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();await other.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 await page.setViewportSize({width:390,height:844});for(const route of ['/','/pricing','/login','/machine/demo-cqa-activewear']){
  await page.goto(new URL(route,base).href,{waitUntil:'networkidle'});const toggle=page.getByRole('button',{name:'Switch to dark mode',exact:true});assert(await toggle.isVisible());const bounds=await toggle.boundingBox();assert(bounds.width>=44&&bounds.height>=44);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' mobileoverflow');await toggle.click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' darkmobileoverflow');await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
 }
 await page.goto(new URL('/login',base).href,{waitUntil:'networkidle'});await page.screenshot({path:output+'/login-light-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await page.screenshot({path:output+'/login-dark-mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'No page runtime errors');
 const blocked=await browser.newContext();await blocked.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Storage blocked')};Storage.prototype.setItem=()=>{throw Error('Storage blocked')}});
 const bp=await blocked.newPage();await bp.goto(base.href,{waitUntil:'networkidle'});await bp.getByRole('button',{name:'Switch to dark mode',exact:true}).click();assert.equal(await bp.locator('html').getAttribute('data-theme'),'dark');await blocked.close();
 console.log(`PASS ${routes.length} public routes: white light backgrounds, dark backgrounds, saved preference, cross-tab sync, mobile 44px toggle, no overflow, storage-blocked fallback and no page errors. Provider workflows not exercised.`);
 await context.close();
}finally{await browser.close();}
