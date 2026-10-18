import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,access,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const ui=dirname(dirname(fileURLToPath(import.meta.url)));

test('fresh runtime build includes the source server as well as adapter and browser host',async t=>{
  const root=await mkdtemp(join(tmpdir(),'cadcraft-build-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const editor=join(root,'seed'),output=join(root,'candidate');
  await mkdir(editor);await writeFile(join(editor,'assets.json'),JSON.stringify({name:'cadcraft'}));
  await writeFile(join(editor,'panel.html'),'<!doctype html><html><body><div id="craft-notice">正在加载…</div><div id="craft-stage">Loading CADCraft...</div><script type="module">/* fixture-client */</script></body></html>');
  await writeFile(join(editor,'BUILD.json'),JSON.stringify({version:'0.7.0',pluginVersion:'0.1.0-dev.20261018.2'}));
  await run(process.execPath,['build.mjs','--outdir',output,'--editor',editor],{cwd:ui});
  for(const file of ['adapter.mjs','host.js','editor/server.mjs']) {
    assert.equal(await access(join(output,file)).then(()=>true,()=>false),true,`missing ${file}`);
  }
  assert.doesNotMatch(await readFile(join(output,'editor/panel.html'),'utf8'),/fixture-client/);
  const panel=await readFile(join(output,'editor/panel.html'),'utf8');
  assert.equal(/<div id="craft-notice" hidden>/.test(panel),true,'notice must be hidden before client initialization');
  assert.match(panel,/<div id="craft-stage">Loading CADCraft\.\.\.<\/div>/);
  const metadata=JSON.parse(await readFile(join(output,'editor/BUILD.json')));
  assert.equal(metadata.pluginVersion,'0.1.0-dev.20261018.4');
  assert.equal(metadata.wasmBuildPluginVersion,'0.1.0-dev.20261018.2');
  assert.equal(metadata.version,'0.7.0');
});
