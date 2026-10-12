import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const js=ts.transpileModule(fs.readFileSync('app/onboarding/page.tsx','utf8').replace(/^import .*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const find=(n,p)=>{if(!n||typeof n!=='object')return;if(p(n))return n;for(const c of [].concat(n.props?.children||[])){const f=find(c,p);if(f)return f}};
class TestButton{constructor(value){this.value=value}}
function harness(t){let index=0;const state=['owner',false,'Test Business','Trades & Services','Business description','SA','','owner@example.test','pro',true,'',false,'activate'],refs=[],requests=[],redirects=[];let ri=0,effect;
 const fn=new Function('require','exports','useState','useMemo','useRef','useEffect','useRouter','useSearchParams','getBrowserSupabaseClient','CQA_PLANS','fetch','window','HTMLButtonElement','const Link=()=>null;'+js+';return OnboardingForm;')(()=>({jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}),{},initial=>{const i=index++;return[state[i]??initial,v=>state[i]=v]},f=>f(),value=>refs[ri++]||={current:value},f=>{effect=f},()=>({push:p=>redirects.push(p)}),()=>new URLSearchParams('plan=pro'),()=>({auth:{getSession:async()=>{if(t.sessionThrow)throw Error('network');return{data:{session:t.noSession?null:{access_token:'fake-token'}}}}}}),[],async(path,options)=>{requests.push([path,options]);if(t.pending)await t.pending;if(t.network&&path==='/api/onboarding')throw Error('network');if(t.billingNetwork&&path.includes('checkout'))throw Error('network');return{ok:path==='/api/onboarding'?!t.workspaceError:true,status:200,json:async()=>path==='/api/onboarding'?t.missingWorkspace?{}:{businessId:'business'}:{url:'https://checkout.stripe.test/session'}}},{location:{assign:p=>redirects.push(p)}},TestButton);
 return{state,refs,requests,redirects,mount(){this.render();return effect()},render(){index=ri=0;return fn()},submit(mode=t.mode){return find(this.render(),n=>n.type==='form').props.onSubmit({preventDefault(){},nativeEvent:{submitter:mode?new TestButton(mode):null}})}};
}
for(const unmount of [false,true]){
 const h=harness({sessionThrow:true});h.state[1]=true;const cleanup=h.mount();if(unmount)cleanup();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(h.state[1],unmount);assert.equal(Boolean(h.state[10]),!unmount);console.log('PASS initial session failure '+(unmount?'avoids updates after unmount':'releases checking and shows recovery'));
}
for(const t of [{name:'draft saves owned workspace without checkout',mode:'draft'},{name:'activate preserves checkout and launch package',mode:'activate'},{name:'Enter key retains checkout by default'},{name:'expired session cannot save',mode:'draft',noSession:true},{name:'session network failure clears busy',mode:'draft',sessionThrow:true},{name:'missing workspace prevents navigation',mode:'draft',missingWorkspace:true},{name:'workspace rejection prevents navigation',mode:'draft',workspaceError:true},{name:'workspace network failure reports unsaved',mode:'draft',network:true},{name:'billing network failure reports saved',billingNetwork:true}]){
 const h=harness(t);await h.submit();assert.equal(h.state[11],false,t.name);assert.equal(h.state[11],h.refs[0].current,t.name);
 const failure=t.noSession||t.sessionThrow||t.missingWorkspace||t.workspaceError||t.network||t.billingNetwork;
 assert.equal(h.redirects.length,failure?0:1,t.name);
 if(t.noSession||t.sessionThrow)assert.equal(h.requests.length,0,t.name);
 else if(t.mode==='draft'){assert.equal(h.requests.length,1,t.name);assert.equal(h.requests[0][0],'/api/onboarding');if(!failure)assert.equal(h.redirects[0],'/owner/dashboard')}
 else if(!failure){assert.equal(h.requests.length,2);const body=JSON.parse(h.requests[1][1].body);assert.equal(body.plan,'pro');assert.equal(body.launchPackage,true)}
 if(t.network)assert.match(h.state[10],/could not be saved/);if(t.billingNetwork)assert.match(h.state[10],/workspace is saved/);
 console.log('PASS '+t.name);
}
{
 let resolve;const pending=new Promise(r=>resolve=r);const h=harness({mode:'draft',pending});const first=h.submit();await Promise.resolve();await h.submit();assert.equal(h.requests.length,1);resolve();await first;assert.equal(h.state[11],false);console.log('PASS duplicate draft submissions invoke workspace once');
 const select=find(h.render(),n=>n.type==='select');assert.equal(select.props.children.length,8);assert.equal(select.props.value,'Trades & Services');console.log('PASS category select retains all 8 choices and one selected value');
}


