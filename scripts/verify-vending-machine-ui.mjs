import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base=new URL(process.env.CQA_UI_BASE_URL||'http://127.0.0.1:3100');
if(base.protocol!=='http:'||!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Vending UI QA requires localhost.');
const output='work/vending-machine-ui';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CQA_UI_BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('/digital-vending-machine',base).href,{waitUntil:'networkidle',timeout:60000});
 await page.getByRole('heading',{name:'CQA Digital Vending Machine.',exact:true}).waitFor();
 assert(await page.getByRole('img',{name:/CQA branded digital vending machine/}).evaluate(el=>el.complete&&el.naturalWidth>0),'machine image loaded');
 const options=page.getByRole('group',{name:'Choose a destination'});
 for(const [label,href] of [['Merchant marketplace','/marketplace'],['Digital kits','/digital-products'],['Services','/machines'],['Build your machine','/onboarding'],['My workspace','/login']]){
  await options.getByRole('button',{name:label,exact:true}).click();
  assert.equal(await options.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByRole('link',{name:'Enter '+label,exact:true}).getAttribute('href'),href);
 }
 await page.getByRole('button',{name:'Accent lights: on',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Accent lights: off',exact:true}).getAttribute('aria-pressed'),'false');
 await page.getByRole('button',{name:'Accent lights: off',exact:true}).click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'desktop overflow');
 await page.screenshot({path:output+'/machine-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
 const enter=page.getByRole('link',{name:'Enter My workspace',exact:true});
 assert(await enter.evaluate(el=>el.getBoundingClientRect().height>=44),'mobile ENTER target');
 await page.screenshot({path:output+'/machine-mobile.png',fullPage:true});
 await enter.click();await page.waitForURL('**/login');
 await page.goto(base.href,{waitUntil:'networkidle'});
 assert(await page.getByRole('link',{name:/Explore the interactive machine/}).count(),'homepage links to experience');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile homepage overflow');
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:output+'/homepage-machine-desktop.png',fullPage:false});
 assert.deepEqual(errors,[]);console.log('PASS vending experience: full artwork, five selection destinations, ENTER navigation, light toggle, desktop/mobile layout and 44px mobile target; no page errors. No payments or real delivery are exercised.');
}finally{await browser.close();}
