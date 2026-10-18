import test from 'node:test';
import assert from 'node:assert/strict';

// 使用真实打包器构建最小站点，验证交付 HTML，而不把夹具 WASM 当作引擎实测。
test('source package starts quiet and preserves the engine loader',async t=>{
  const {mkdtemp,mkdir,writeFile,rm,readFile}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join,dirname}=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const {promisify}=await import('node:util');
  const {execFile}=await import('node:child_process');
  const ui=dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
  const root=await mkdtemp(join(tmpdir(),'craft-notice-package-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const site=join(root,'site'),out=join(root,'editor');
  await mkdir(join(site,'licenses'),{recursive:true});
  await writeFile(join(site,'licenses/fixture.txt'),'Test fixture, no third-party engine');
  await writeFile(join(site,'index.html'),'<!doctype html><html><head></head><body><div id="engine-loading">Loading engine fixture...</div><script type="module">import init from "./engine.js"; init();</script></body></html>');
  await writeFile(join(site,'engine.js'),'export default async function init() {}');
  await writeFile(join(site,'engine.wasm'),Buffer.from([0,97,115,109,1,0,0,0]));
  await writeFile(join(site,'tools.json'),'[]');
  await promisify(execFile)(process.execPath,[join(ui,'package-editor.mjs'),site,out],{cwd:ui});
  const panel=await readFile(join(out,'panel.html'),'utf8');
  assert.equal(/<div id="craft-notice" hidden>/.test(panel),true,'notice must be hidden before client initialization');
  assert.equal(panel.includes('<div id="engine-loading">Loading engine fixture...</div>'),true,'preserve engine loader');
  const scripts=[...panel.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,1,'bundle one actual client module');
  assert.ok(scripts[0][1].length>1000,'client must actually be bundled');
});
