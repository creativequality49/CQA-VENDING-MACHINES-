import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const jsx = (type, props) => ({type, props});
function text(tree) { if (tree == null || typeof tree === 'boolean') return ''; if (typeof tree !== 'object') return String(tree); if (Array.isArray(tree)) return tree.map(text).join(' '); return text(tree.props?.children); }
function find(tree, predicate) { if (!tree || typeof tree !== 'object') return; if (Array.isArray(tree)) { for (const node of tree) { const found=find(node,predicate); if(found)return found; } return; } if(predicate(tree))return tree; return find(tree.props?.children,predicate); }
function pageFor(data, error = null) {
 const queries=[];
 const q={select(){return q},eq(key,value){queries.push([key,value]);return q},order(){return q},async limit(){return {data,error}}};
 const code=ts.transpileModule(fs.readFileSync('app/marketplace/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};const mocks={'next/link':{default:'Link'},'./marketplace.module.css':{default:{}},'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/cqa-marketplace':{getPublicSupabaseClient:()=>({from:()=>q}),DEMO_MACHINES:[{id:'demo',slug:'demo-store',business:{name:'Example only'}}]}};
 new Function('require','module','exports',code)(name=>{if(!(name in mocks))throw Error('Unexpected dependency '+name);return mocks[name]},module,module.exports);
 return {page:module.exports.default,queries};
}
const machine={id:'store',slug:'haircare',title:'Hair care',subtitle:'Products from a real merchant',business:{name:'Test Hair',category:'Beauty',location_text:'Australia'},offers:[{id:'active',name:'Shampoo',price_cents:2900,currency:'aud',active:true},{id:'inactive',name:'Archived secret listing',price_cents:9900,currency:'aud',active:false}]};
let h=pageFor([machine]);let tree=await h.page({searchParams:Promise.resolve({q:'shampoo'})});
assert(h.queries.some(([k,v])=>k==='status'&&v==='live'));assert(h.queries.some(([k,v])=>k==='business.status'&&v==='live'));
assert.match(text(tree),/Shampoo/);assert.doesNotMatch(text(tree),/Archived secret listing/);assert(find(tree,n=>n.type==='Link'&&n.props.href==='/machine/haircare'));
assert(find(tree,n=>n.type==='Link'&&n.props.href==='/machine/demo-store'));assert.match(text(tree),/Design demonstrations only/);
h=pageFor([machine]);tree=await h.page({searchParams:Promise.resolve({q:'nonexistent'})});assert.match(text(tree),/No matching machines/);assert(!find(tree,n=>n.type==='Link'&&n.props.href==='/machine/haircare'));
h=pageFor(null,Error('Provider private detail'));tree=await h.page({searchParams:Promise.resolve({})});assert.match(text(tree),/couldn’t load/);assert.doesNotMatch(text(tree),/Provider private detail/);
h=pageFor([]);tree=await h.page({searchParams:Promise.resolve({})});assert.match(text(tree),/first merchant machines/);
console.log('PASS merchant directory: published-only queries, active products, search, isolated demos, empty and provider failure states. No real provider used.');
