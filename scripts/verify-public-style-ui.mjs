import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base=new URL(process.env.CQA_UI_BASE_URL||'http://127.0.0.1:3100');
if(base.protocol!=='http:'||!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Public UI QA requires a local server.');
const output='work/public-style-ui';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CQA_UI_BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const url=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base.href,{waitUntil:'networkidle',timeout:60000});await page.locator('main h1').first().waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('main h1').count(),1,'one clear primary heading');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'desktop overflow');
 assert(await page.locator('main a[href="/founding-customers"]').count(),'early access route retained');
 assert(await page.locator('main a[href="#machine-build-demo"]').count(),'walkthrough route retained');
 await page.screenshot({path:output+'/home-desktop.png',fullPage:false});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
 await page.screenshot({path:output+'/home-mobile.png',fullPage:false});
 await page.locator('summary[aria-label="Open navigation menu"]').click();
 const mobileNav=page.getByRole('navigation',{name:'Primary navigation'}).filter({visible:true});
 await mobileNav.getByRole('link',{name:'Home',exact:true}).click();
 assert.equal(await page.locator('summary[aria-label="Open navigation menu"]').evaluate(el=>el.closest('details').open),false,'menu closes after navigation');
 await page.setViewportSize({width:844,height:390});
 await page.locator('summary[aria-label="Open navigation menu"]').click();
 const shortMenu=page.getByRole('navigation',{name:'Primary navigation'}).filter({visible:true});
 assert(await shortMenu.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'short-screen menu stays within viewport');
 const workspace=shortMenu.getByRole('link',{name:'Your workspace →',exact:true});await workspace.scrollIntoViewIfNeeded();await workspace.hover();
 assert(await workspace.evaluate(el=>{
  const style=getComputedStyle(el),lum=c=>{const a=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};
  const a=lum(style.color),b=lum(style.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;
 }),'workspace hover has readable text contrast');
 await workspace.press('Escape');assert.equal(await page.locator('summary[aria-label="Open navigation menu"]').evaluate(el=>el.closest('details').open),false,'Escape closes menu');
 for(const path of ['/machines','/workers','/pricing']){
  await page.setViewportSize({width:1440,height:1000});await page.goto(new URL(path,base).href,{waitUntil:'networkidle',timeout:60000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' desktop overflow');
  await page.screenshot({path:output+path+'-desktop.png',fullPage:false});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' mobile overflow');
  await page.screenshot({path:output+path+'-mobile.png',fullPage:false});
 }
 assert.deepEqual(errors,[]);console.log('PASS homepage/catalogue/workers/pricing desktop/mobile layout, one main heading, preserved early-access/walkthrough paths, mobile menu open/close, no page errors (local UI only).');
}finally{await browser.close();}
