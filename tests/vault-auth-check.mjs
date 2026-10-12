import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile = path => ts.transpileModule(fs.readFileSync(path,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,''), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
for (const test of [
  {name:'verified Supabase buyer',header:'Bearer valid',valid:true},
  {name:'editable user metadata cannot grant admin',header:'Bearer valid',valid:true,metadataRole:'admin'},
  {name:'invalid token fails even with legacy session',header:'Bearer invalid',legacy:true},
  {name:'malformed authorization fails',header:'Basic invalid'},
  {name:'legacy session remains supported',legacy:true},
  {name:'anonymous denied'}
]) {
  let verified=0;
  const requireSession=new Function('getServerSession','getPublicSupabaseClient',compile('lib/auth.ts')+';return requireUserSession;')(
    async()=>test.legacy?{user:{id:'legacy',role:'customer'}}:null,
    ()=>({auth:{getUser:async token=>{verified++;assert.equal(token,test.valid?'valid':'invalid');return{data:{user:test.valid?{id:'buyer',email:'buyer@example.test',user_metadata:{role:test.metadataRole},app_metadata:{}}:null},error:test.valid?null:Error('invalid')}}}})
  );
  const request=new Request('https://example.test',{headers:test.header?{authorization:test.header}:{}});
  if(test.valid || (!test.header && test.legacy)){const session=await requireSession(request);assert.equal(session.user.id,test.valid?'buyer':'legacy');assert.equal(session.user.role,'customer')}
  else await assert.rejects(()=>requireSession(request),/Authentication required/);
  assert.equal(verified,test.header?.startsWith('Bearer')?1:0);
  console.log('PASS '+test.name);
}
for(const test of [{allowed:false},{allowed:true},{allowed:true,missingAsset:true}]) {
  const { allowed } = test;
  let signed=0;
  const get=new Function('NextResponse','requireUserSession','getProductById','hasEntitlement','logDownload','createSignedDownloadUrl',compile('app/api/signed-download/route.ts')+';return GET;')(
    {json:(body,options)=>({body,status:options?.status||200})},
    async request=>{assert.equal(request.headers.get('authorization'),'Bearer buyer');return{user:{id:'buyer'}}},
    ()=>({assetKey:test.missingAsset?'':'private/product.zip'}),async user=>{assert.equal(user,'buyer');return allowed},async()=>{},async()=>{signed++;return{url:'https://signed.example.test',expiresIn:600}}
  );
  const response=await get(new Request('https://example.test/api/signed-download?productId=product&userId=attacker',{headers:{authorization:'Bearer buyer'}}));
  assert.equal(response.status,!allowed?403:test.missingAsset?409:200);assert.equal(signed,allowed&&!test.missingAsset?1:0);
  console.log('PASS '+(test.missingAsset?'missing delivery asset never signed':allowed?'entitled buyer gets signed URL':'unentitled buyer denied before signing'));
}
let saved;
const reactivate=new Function('getSupabaseAdminClient',compile('lib/entitlements.ts')+';return upsertCheckoutEntitlement;')(()=>({from:()=>({upsert:async input=>{saved={expires_at:'2020-01-01',...input};return{error:null}}})}));
await reactivate({userId:'buyer',productId:'product',tier:'pro',machineSlug:'store',source:'checkout'});
assert.equal(saved.status,'active');assert.equal(saved.expires_at,null);
console.log('PASS repurchase clears previous entitlement expiration');
for (const test of [{name:'vault uses verified identity and active expiry filter'}, {name:'vault database failure stays closed',dbError:true}, {name:'vault anonymous denied before database',anonymous:true}]) {
  let reads=0;const filters=[];
  const get=new Function('NextResponse','requireUserSession','getSupabaseAdminClient','getProductById',compile('app/api/vault/route.ts')+';return GET;')(
    {json:(body,options)=>({body,status:options?.status||200,headers:options?.headers})},
    async()=>{if(test.anonymous)throw Error('Authentication required');return{user:{id:'buyer'}}},
    ()=>({from(table){reads++;assert.equal(table,'customer_entitlements');const c={select(){return c},eq(key,value){filters.push([key,value]);return c},or(value){assert.match(value,/^expires_at\.is\.null,expires_at\.gt\./);return Promise.resolve({data:[{product_id:'product',source:'checkout',expires_at:null},{product_id:'product',source:'manual',expires_at:null},{product_id:'unknown',source:'checkout',expires_at:null}],error:test.dbError?Error('database'):null})}};return c}}),
    id=>id==='product'?{id,title:'Purchased product',assetKey:'private/product.zip'}:null
  );
  const response=await get(new Request('https://example.test/api/vault?userId=attacker'));
  assert.equal(response.status,test.anonymous?401:test.dbError?503:200);
  assert.equal(reads,test.anonymous?0:1);assert.equal(response.headers['Cache-Control'],'no-store');
  if(!test.anonymous)assert.deepEqual(filters,[['user_id','buyer'],['status','active']]);
  if(response.status===200){assert.equal(response.body.products.length,1);assert.equal(response.body.products[0].downloadable,true)}
  console.log('PASS '+test.name);
}
