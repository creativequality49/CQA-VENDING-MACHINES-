import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8').replace(/^import .*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const feedback=new Function('exports',compile('lib/cqa-login-feedback.ts')+';return cqaLoginFailure;')({});
const find=(node,p)=>{if(!node||typeof node!=='object')return;if(p(node))return node;for(const child of [].concat(node.props?.children||[])){const found=find(child,p);if(found)return found}};
const button=(h,text)=>find(h.render(),n=>n.type==='button'&&n.props.children===text);
function harness(auth,mode='login'){
 const state=[mode,' owner@example.test ','password123','','',false,null,0],refs=[];let si=0,ri=0,effect,tick;const pushes=[];
 const fn=new Function('require','exports','useState','useMemo','useRef','useEffect','useRouter','useSearchParams','getBrowserSupabaseClient','cqaLoginFailure','window','const Link=()=>null;'+compile('app/login/page.tsx')+';return LoginForm;')(
 ()=>({jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}),{},initial=>{const i=si++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=v}]},f=>f(),initial=>refs[ri++]||=( {current:initial}),f=>{effect=f},()=>({push:p=>pushes.push(p),refresh(){}}),()=>new URLSearchParams('next=/vault'),()=>({auth}),feedback,{location:{origin:'https://example.test'},setInterval:f=>{tick=f;return 1},clearInterval(){}}
 );return{state,refs,pushes,render(){si=ri=0;const tree=fn();effect();return tree},tick(){tick?.()}};
}
let clock=100000;const realNow=Date.now;Date.now=()=>clock;
try{
 {
  let calls=0,resolve;const h=harness({signInWithOtp:p=>{calls++;assert.equal(p.email,'owner@example.test');assert.equal(p.options.shouldCreateUser,false);return new Promise(r=>resolve=r)}});
  const click=button(h,'Email me a sign-in link').props.onClick;const pending=click();await click();assert.equal(calls,1);resolve({error:null});await pending;
  assert.equal(h.state[5],false);assert.equal(h.state[7],60);assert.equal(button(h,'Email me a sign-in link').props.disabled,true);
  await click();assert.equal(calls,1);clock+=61000;h.tick();assert.equal(h.state[7],0);assert.equal(button(h,'Email me a sign-in link').props.disabled,false);
  const next=click();assert.equal(calls,2);resolve({error:null});await next;console.log('PASS duplicate clicks blocked, success cooldown and expiry permit retry');
 }
 {
  let sends=0,passwords=0;const h=harness({signInWithOtp:async()=>{sends++;return{error:{code:'over_email_send_rate_limit',status:429,message:'For security purposes, you can only request this after 90 seconds.'}}},signInWithPassword:async()=>{passwords++;return{data:{session:{user:{id:'owner'}}},error:null}}});
  const click=button(h,'Email me a sign-in link').props.onClick;await click();await click();assert.equal(sends,1);assert.equal(h.state[7],90);assert.equal(h.state[5],false);assert.equal(button(h,'Log in').props.disabled,false);
  await find(h.render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(passwords,1);assert.deepEqual(h.pushes,['/vault']);
  clock+=91000;h.render();h.tick();assert.equal(h.state[7],0);console.log('PASS provider rate limit honored while password sign-in remains available');
 }
 for(const rejection of ['network','provider']){
  let calls=0;const h=harness({signInWithOtp:async()=>{calls++;if(rejection==='network')throw Error('secret provider details owner@example.test');return{error:{code:'unexpected',message:'account does not exist'}}}});
  const click=button(h,'Email me a sign-in link').props.onClick;await click();assert.equal(h.state[5],false);assert.equal(h.refs[0].current,false);assert.equal(h.state[7],0);assert.ok(!/secret|does not exist|owner@/.test(h.state[3]));await click();assert.equal(calls,2);console.log('PASS '+rejection+' rejection releases busy and hides provider/account details');
 }
 {
  const messages=[];for(const identities of [[],[{}]]){const h=harness({signUp:async()=>({data:{session:null,user:{identities}},error:null})},'signup');await find(h.render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});messages.push(h.state[4]);assert.equal(h.state[7],60);assert.equal(h.pushes.length,0)}assert.equal(messages[0],messages[1]);console.log('PASS signup response does not distinguish existing accounts');
 }
 {
  let confirmations=0;const h=harness({signInWithPassword:async()=>({data:{session:null},error:{code:'email_not_confirmed'}}),resend:async()=>{confirmations++;return{error:null}}});
  await find(h.render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(h.state[6],'confirmation');assert.equal(h.state[5],false);
  await button(h,'Resend confirmation email').props.onClick();assert.equal(confirmations,1);assert.equal(h.state[7],60);assert.equal(h.pushes.length,0);console.log('PASS unconfirmed password login offers confirmation resend with cooldown');
 }
 for(const [value,expected] of [[{code:'over_email_send_rate_limit',message:'after 5 seconds'},60],[{status:429,message:'after 99999 seconds'},3600],[{status:429,message:'unparseable'},60]])assert.equal(feedback(value,true).cooldown,expected);
 assert.equal(feedback({status:429},false).cooldown,0);console.log('PASS cooldown is bounded and unrelated password throttles cannot lock email');
}finally{Date.now=realNow}
