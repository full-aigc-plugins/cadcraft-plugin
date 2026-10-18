import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {verifyRuntime,extractRuntime} from '../bootstrap.mjs';
import {engineTools} from './catalog-fixture.mjs';
const run=promisify(execFile),ui=dirname(dirname(fileURLToPath(import.meta.url)));

test('packaged source version, archive hashes and bootstrap catalog agree without downloading an old runtime',async t=>{
  const root=await mkdtemp(join(tmpdir(),'cadcraft-package-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const seed=join(root,'seed'),runtime=join(root,'runtime'),pkg=join(root,'plugin');
  await mkdir(join(seed,'assets'),{recursive:true});await mkdir(join(pkg,'ui'),{recursive:true});
  const version='0.1.0-dev.20261018.4';
  await writeFile(join(pkg,'plugin.json'),JSON.stringify({name:'cadcraft',version,repository:'https://github.com/full-aigc-plugins/cadcraft-plugin'}));
  await writeFile(join(seed,'assets.json'),JSON.stringify({name:'cadcraft',title:'CADCraft',version,assets:[]}));
  await writeFile(join(seed,'tools.json'),JSON.stringify(await engineTools()));
  await writeFile(join(seed,'panel.html'),'<!doctype html><html><body><script type="module">/* fixture-client */</script></body></html>');
  await run(process.execPath,[join(ui,'build.mjs'),'--editor',seed,'--outdir',runtime]);
  const archive=join(root,'cadcraft-runtime.tgz');
  const result=await run('python3',[join(ui,'../scripts/package_runtime.py'),'--runtime',runtime,'--output',archive,'--package-root',pkg,'--write-locks'])
    .then(()=>({ok:true}),error=>({ok:false,error:error.stderr}));
  assert.equal(result.ok,true,result.error);
  const lock=JSON.parse(await readFile(join(pkg,'ui/runtime.lock.json')));
  assert.equal(lock.version,version);
  assert.match(lock.url,/v0\.1\.0-dev\.20261018\.4\/cadcraft-runtime.tgz$/);
  const bytes=await readFile(archive);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),lock.sha256);
  const extracted=join(root,'extracted');await mkdir(extracted);
  await extractRuntime(bytes,extracted);
  assert.equal(await verifyRuntime(extracted,lock.files),true);
  await cp(extracted,join(pkg,'ui/dist'),{recursive:true});
  await cp(join(ui,'bootstrap.mjs'),join(pkg,'ui/bootstrap.mjs'));
  const direct=new Client({name:'runtime-version-test',version:'1'});
  await direct.connect(new StdioClientTransport({command:process.execPath,args:[join(runtime,'adapter.mjs')],cwd:pkg,env:{...process.env,CRAFT_EDITOR_UPDATE:'off'},stderr:'pipe'}));
  try{assert.equal(direct.getServerVersion().version,version);}finally{await direct.close();}
  const client=new Client({name:'package-test',version:'1'});
  t.after(()=>client.close());
  await client.connect(new StdioClientTransport({command:process.execPath,args:[join(pkg,'ui/bootstrap.mjs')],cwd:pkg,
    env:{...process.env,CRAFT_EDITOR_UPDATE:'off'},stderr:'pipe'}));
  assert.equal(client.getServerVersion().version,version);
  const {tools}=await client.listTools();
  assert.deepEqual(tools.find(item=>item.name==='open_editor')._meta['openai/ui'].entrypoints,[{type:'thread'}]);
  const opened=await client.callTool({name:'open_editor',arguments:{}});
  assert.equal(opened.isError,undefined);
  assert.equal(opened.structuredContent.editorUrl,undefined);
  await client.close();
  await writeFile(join(extracted,'adapter.mjs'),'tampered');
  assert.equal(await verifyRuntime(extracted,lock.files),false);
});
