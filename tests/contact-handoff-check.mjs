import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const Link = { __esModule: true, default: ({children, ...props}) => React.createElement('a', props, children) };
const css = { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) };
function evaluate(path, mocks = {}, context = {}) {
  const output = ts.transpileModule(fs.readFileSync(path,'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module={exports:{}};
  new Function('require','module','exports',...Object.keys(context),output)(id => Object.hasOwn(mocks,id) ? mocks[id] : require(id),module,module.exports,...Object.values(context));
  return module.exports;
}
function find(node,predicate){if(!node||typeof node!=='object')return; if(predicate(node))return node; for(const child of [].concat(node.props?.children||[])){const got=find(child,predicate);if(got)return got;}}
function contactHarness(fetcher) {
 const states=['idle',''],refs=[];let si=0,ri=0;
 const h=evaluate('app/contact/page.tsx',{'next/link':()=>null,'next/navigation':{useSearchParams:()=>new URLSearchParams('service=automation-implementation')},react:{Suspense:props=>props.children,useState:initial=>{const i=si++;states[i]??=initial;return[states[i],v=>{states[i]=v}]},useRef:initial=>refs[ri++]||={current:initial}},'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}},{fetch:fetcher,FormData:class{get(name){return{name:'Test Owner',email:'owner@example.test',phone:'',businessName:'Test business',message:'A synthetic workflow implementation brief'}[name]}}});
 return {states,render(){si=ri=0;return h.default().props.children.props.children.type();}};
}
for(const fetcher of [async()=>{throw new TypeError('Failed to fetch')},async()=>Response.json({}),async()=>new Response('bad json'),async()=>Response.json({error:'Try again'},{status:503})]) {
 const h=contactHarness(fetcher);const form=find(h.render(),n=>n.type==='form');await form.props.onSubmit({preventDefault(){},currentTarget:{}});
 assert.equal(h.states[0],'idle');assert.ok(find(h.render(),n=>n.props.role==='alert'));assert.ok(!JSON.stringify(h.render()).includes('Your CQA request is saved.'));
}
console.log('PASS real contact form: network/503/malformed/false-success responses show errors, clear busy state and permit retry');
let calls=0,finish,payload;
const h=contactHarness(async(_url,options)=>{calls++;payload=JSON.parse(options.body);await new Promise(resolve=>{finish=resolve});return Response.json({ok:true});});
const submit=find(h.render(),n=>n.type==='form').props.onSubmit;
const first=submit({preventDefault(){},currentTarget:{}});await submit({preventDefault(){},currentTarget:{}});
assert.equal(calls,1);finish();await first;assert.equal(h.states[0],'sent');assert.equal(payload.service,'automation-implementation');
assert.equal(payload.message,'A synthetic workflow implementation brief');
console.log('PASS real implementation brief: duplicate submits make one request and verified API success preserves service and workflow details');
