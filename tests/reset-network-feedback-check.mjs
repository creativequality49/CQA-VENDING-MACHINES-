import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8').replace(/^import .*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const format=new Function('exports',compile('lib/cqa-auth-error.ts')+';return cqaRecoveryError;')({});
const find=(node,p)=>{if(!node||typeof node!=='object')return;if(p(node))return node;for(const child of [].concat(node.props?.children||[])){const found=find(child,p);if(found)return found}};
function harness(auth,recovery=false,callback=async()=>({session:null,recovery:false})){
 const state=['owner@example.test','password123','password123',recovery,false,'',''],refs=[];let si=0,ri=0,effect;
 const page=new Function('require','exports','useState','useMemo','useRef','useEffect','getBrowserSupabaseClient','completeCqaAuthCallback','clearCqaRecoveryMarker','requireCqaRecoverySession','cqaRecoveryError','window','const Link=()=>null;'+compile('app/reset-password/page.tsx')+';return ResetPasswordPage;')(()=>({jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}),{},initial=>{const i=si++;return[state[i]??=initial,v=>{state[i]=v}]},f=>f(),initial=>refs[ri++]||={current:initial},f=>{effect=f},()=>({auth:{...auth,onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}),callback,()=>{},async()=>{},format,{location:{href:'https://cqa.test/reset-password',origin:'https://cqa.test',pathname:'/reset-password'},history:{replaceState(){}}});
 return{state,render(){si=ri=0;return page()},effect(){effect()}};
}
for(const failure of [new TypeError('Failed to fetch'),{name:'AuthRetryableFetchError',message:'fetch failed'},{message:'Network request failed'}]){
 const h=harness({resetPasswordForEmail:async()=>({error:failure})});
 await find(h.render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(h.state[4],false);assert.equal(h.state[5],'');assert.match(find(h.render(),n=>n.props.role==='alert').props.children,/No recovery email has been confirmed/);assert.equal(find(h.render(),n=>n.props.role==='status'),undefined);
}
const update=harness({updateUser:async()=>{throw new TypeError('Failed to fetch')}},true);
await find(update.render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});
assert.match(update.state[6],/could not confirm whether your password was updated/);assert.equal(update.state[5],'');assert.equal(update.state[3],true);
const callback=harness({},false,async()=>{throw new TypeError('Failed to fetch')});callback.render();callback.effect();await new Promise(resolve=>setImmediate(resolve));assert.match(callback.state[6],/recovery link could not be verified/);assert.equal(callback.state[5],'');
assert.equal(format({message:'This email link has expired.'},'callback'),'This email link has expired.');
assert.equal(format({message:'Password should contain at least 8 characters.'},'update'),'Password should contain at least 8 characters.');
console.log('PASS genuine reset page: request/update/callback network failures show contextual alerts, never success; useful auth errors preserved');
