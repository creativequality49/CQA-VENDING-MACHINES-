import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8').replace(/^import .*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const moduleFor=()=>new Function('exports',compile('lib/cqa-auth-callback.ts')+';return {completeCqaAuthCallback,cqaAuthDestination,cqaAuthCleanUrl};')({});
const page=compile('app/auth/confirm/page.tsx');
const flush=()=>new Promise(r=>setTimeout(r,0));
function harness(url){const api=moduleFor(),refs=[],state=[],timers=new Map(),navigations=[];let si=0,ri=0,effect,resolve,calls=0,timerId=0;
 const client={auth:{exchangeCodeForSession:()=>{calls++;return new Promise(r=>resolve=r)},getSession:async()=>({data:{session:null},error:null})}};
 const win={location:{href:url,replace:path=>navigations.push(path)},history:{replaceState(_a,_b,path){win.location.href=new URL(path,win.location.href).href}},setTimeout:f=>{const id=++timerId;timers.set(id,f);return id},clearTimeout:id=>timers.delete(id)};
 const component=new Function('require','exports','useRef','useState','useMemo','useEffect','getBrowserSupabaseClient','completeCqaAuthCallback','cqaAuthCleanUrl','cqaAuthDestination','window','const Link=()=>null;'+page+';return ConfirmEmailContent;')(()=>({jsx:()=>null,jsxs:()=>null}),{},x=>refs[ri++]||={current:x},initial=>{const i=si++;if(!(i in state))state[i]=initial;return[state[i],v=>state[i]=v]},f=>f(),f=>{effect=f},()=>client,api.completeCqaAuthCallback,api.cqaAuthCleanUrl,api.cqaAuthDestination,win);
 return{state,win,navigations,render(){si=ri=0;component()},mount(){this.render();return effect()},replay(){return effect()},resolve(session,error=null){resolve({data:{session},error})},get calls(){return calls},timeout(){for(const f of timers.values())f()},get timers(){return timers.size}};
}
{
 const api=moduleFor();for(const unsafe of ['https://evil.test','//evil.test','/\\evil.test','/owner\n/setup'])assert.equal(api.cqaAuthDestination(new URL('https://example.test/auth/confirm?next='+encodeURIComponent(unsafe))),'/owner/dashboard');
 const original=new URL('https://example.test/auth/confirm?code=fake&token_hash=fake&next=%2Fowner%2Fsetup%3Fx%3D1#error');const cleaned=api.cqaAuthCleanUrl(original);assert.ok(!/fake|#/.test(cleaned));assert.equal(new URL(cleaned,original).searchParams.get('next'),'/owner/setup?x=1');console.log('PASS safe destination and credential scrub preserve requested local path');
}
{
 const h=harness('https://example.test/auth/confirm?code=fake&next=%2Fowner%2Fsetup');const cleanup=h.mount();assert.ok(!h.win.location.href.includes('code='));h.render();cleanup();h.replay();assert.equal(h.calls,1);h.resolve({user:{id:'verified'}});await flush();assert.deepEqual(h.navigations,['/owner/setup']);assert.equal(h.timers,0);console.log('PASS history scrub rerender and StrictMode exchange once then full document navigation');
}
for(const session of [null,{user:{id:'verified'}}]){
 const h=harness('https://example.test/auth/confirm?code=fake');h.mount();h.timeout();assert.equal(h.state[0],'');assert.match(h.state[1],/longer than expected/);assert.equal(h.navigations.length,0);h.resolve(session);await flush();assert.equal(h.navigations.length,session?1:0);if(!session)assert.match(h.state[0],/No active session/);console.log('PASS timeout grants nothing and late '+(session?'verified session navigates':'empty session stays closed'));
}
{
 const h=harness('https://example.test/auth/confirm?code=fake');const cleanup=h.mount();cleanup();h.resolve({user:{id:'verified'}});await flush();assert.equal(h.navigations.length,0);assert.equal(h.timers,0);console.log('PASS unmounted confirmation never navigates after late completion');
}
{
 const h=harness('https://example.test/auth/confirm?code=fake&type=recovery');h.mount();h.resolve({user:{id:'verified'}});await flush();assert.deepEqual(h.navigations,['/reset-password?flow=recovery']);console.log('PASS verified recovery navigates to password recovery');
}
for(const [suffix,method] of [['?code=fake','exchangeCodeForSession'],['?token_hash=fake&type=magiclink','verifyOtp'],['#access_token=fake&refresh_token=fake','setSession']]){
 const api=moduleFor(),calls=[];const client={auth:{}};for(const name of ['exchangeCodeForSession','verifyOtp','setSession','getSession'])client.auth[name]=async()=>{calls.push(name);return{data:{session:{user:{id:'verified'}}},error:null}};
 await api.completeCqaAuthCallback(client,new URL('https://example.test/auth/confirm'+suffix));assert.deepEqual(calls,[method]);console.log('PASS '+method+' explicitly verifies callback without stale session fallback');
}
assert.ok(!/console\.(log|error|warn)/.test(fs.readFileSync('app/auth/confirm/page.tsx','utf8')+fs.readFileSync('lib/cqa-auth-callback.ts','utf8')));console.log('PASS callback contains no credential logging');
for(const suffix of ['#error_code=otp_expired','?error=access_denied','#access_token=fake','?token_hash=fake&type=unknown']){
 let reads=0;const api=moduleFor();await assert.rejects(api.completeCqaAuthCallback({auth:{getSession:async()=>{reads++;return{data:{session:{user:{id:'old-owner'}}},error:null}}}},new URL('https://example.test/auth/confirm'+suffix)));assert.equal(reads,0);console.log('PASS invalid callback refuses preexisting owner session');
}
{
 const h=harness('https://example.test/auth/confirm?code=fake');h.mount();h.timeout();h.resolve(null,Error('Invalid single-use link'));await flush();assert.equal(h.navigations.length,0);assert.match(h.state[1],/Invalid single-use link/);console.log('PASS timed-out callback failure never grants access');
}
