import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source=fs.readFileSync('app/page.tsx','utf8');
const page=ts.createSourceFile('app/page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const hrefs=[];let demoCount=0;
function visit(node){
 if(ts.isJsxAttribute(node)&&node.name.getText(page)==='href'&&node.initializer&&ts.isStringLiteral(node.initializer))hrefs.push(node.initializer.text);
 if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(page)==='MachineBuildDemo')demoCount++;
 ts.forEachChild(node,visit);
}
visit(page);
assert.equal(demoCount,1,'Homepage actually mounts the existing walkthrough');
assert.ok(hrefs.includes('/founding-customers'),'Interest funnel is reachable from homepage');
assert.ok(hrefs.includes('#machine-build-demo'),'Homepage CTA reaches the video anchor');
assert.ok(fs.existsSync('app/founding-customers/page.tsx'));
const demo=fs.readFileSync('components/MachineBuildDemo.tsx','utf8');
assert.match(demo,/id="machine-build-demo"/);
for(const path of ['/videos/cqa-machine-build.mp4','/videos/cqa-machine-build.webm','/videos/cqa-machine-build.vtt','/videos/cqa-machine-build-poster.jpg'])assert.ok(fs.existsSync(`public${path}`),`Published demo asset exists: ${path}`);
assert.match(source,/Customer payments remain paused/);
const wizard=fs.readFileSync('app/onboarding/page.tsx','utf8');
assert.match(wizard,/Customer payments are paused while CQA completes launch verification/);
assert.match(wizard,/Save a draft without paying/);
const style=fs.readFileSync('app/ux-release.css','utf8');
assert.match(style,/select option,select optgroup\{background-color:#101722;color:#fff\}/,'Existing native dropdown choices retain readable explicit colours');
console.log('PASS acquisition entry: reachable waitlist + mounted video/assets + clear prelaunch + free draft + existing dropdown contrast');
