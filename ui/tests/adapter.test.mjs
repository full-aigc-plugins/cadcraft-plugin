import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {engineTools} from './catalog-fixture.mjs';

const ui=dirname(dirname(fileURLToPath(import.meta.url)));
let root;
const run=promisify(execFile);
before(async()=>{
  root=await mkdtemp(join(tmpdir(),'cadcraft-adapter-'));
  await mkdir(join(root,'seed/assets'),{recursive:true});
  await writeFile(join(root,'seed/assets.json'),JSON.stringify({name:'cadcraft',title:'CADCraft',version:'0.1.0-dev.1',assets:[]}));
  await writeFile(join(root,'seed/tools.json'),JSON.stringify(await engineTools()));
  await writeFile(join(root,'seed/panel.html'),'<!doctype html><html><body><script type="module">/* fixture-client */</script></body></html>');
  await run(process.execPath,[join(ui,'build.mjs'),'--outdir',join(root,'runtime'),'--editor',join(root,'seed')],{cwd:ui});
});
after(async()=>{if(root)await rm(root,{recursive:true,force:true});});
async function client(t) {
  const workspace=await realpath(await mkdtemp(join(tmpdir(),'cadcraft-workspace-')));
  const c=new Client({name:'regression-test',version:'1'});
  await c.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'runtime/adapter.mjs')],cwd:workspace,
    env:{...process.env,CRAFT_WORKSPACE_ROOT:workspace,CRAFT_EDITOR_UPDATE:'off'},stderr:'pipe'}));
  t.after(async()=>{await c.close();await rm(workspace,{recursive:true,force:true});});
  const call=(name,args={})=>c.callTool({name,arguments:args});
  return {c,call,workspace};
}

test('a rejected pre-open command does not lock the workspace',async t=>{
  const s=await client(t);
  assert.equal((await s.call('list_commands')).isError,true);
  const target=join(s.workspace,'drawing');await mkdir(target);
  const result=await s.call('open_editor',{workspace:target});
  assert.equal(result.isError,undefined,JSON.stringify(result));
  assert.equal(result.structuredContent.workspace,target);
});

test('workspace may be corrected while loading, before any panel has attached',async t=>{
  const s=await client(t);
  await s.call('open_editor');
  const target=join(s.workspace,'drawing');await mkdir(target);
  const result=await s.call('open_editor',{workspace:target});
  assert.equal(result.isError,undefined,JSON.stringify(result));
  assert.equal(result.structuredContent.workspace,target);
});

test('status distinguishes not opened, loading, ready and disconnected',async t=>{
  const s=await client(t);
  assert.equal((await s.call('editor_status')).structuredContent.state,'not_opened');
  const opened=await s.call('open_editor');
  assert.equal(opened.structuredContent.state,'loading');
  assert.equal((await s.call('editor_status')).structuredContent.state,'loading');
  const loadingError=await s.call('list_commands');
  assert.equal(loadingError.structuredContent.state,'loading');
  assert.match(loadingError.content[0].text,/still loading/);
  const {token}=(await s.call('_editor_attach')).structuredContent;
  assert.equal((await s.call('editor_status')).structuredContent.state,'ready');
  await s.call('_editor_detach',{token});
  assert.equal((await s.call('editor_status')).structuredContent.state,'disconnected');
});

test('editor_status can wait for a concurrently attaching panel and bounds its wait',async t=>{
  const s=await client(t);await s.call('open_editor');
  const waiting=s.call('editor_status',{wait_ms:1000});
  await s.call('_editor_attach');
  assert.equal((await waiting).structuredContent.state,'ready');
  assert.equal((await s.call('editor_status',{wait_ms:30001})).isError,true);
});

test('an attached session cannot be discarded by changing workspace',async t=>{
  const s=await client(t);await s.call('open_editor');await s.call('_editor_attach');
  const target=join(s.workspace,'other');await mkdir(target);
  const result=await s.call('open_editor',{workspace:target});
  assert.equal(result.isError,true);
  assert.equal((await s.call('editor_status')).structuredContent.workspace,s.workspace);
});

test('browser preflight refuses a duplicate panel before loading WASM',async t=>{
  const s=await client(t);const opened=await s.call('open_browser_editor');await s.call('_editor_attach');
  const url=new URL('rpc',opened.structuredContent.editorUrl);
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Craft-Page':'second-tab'},body:JSON.stringify({method:'editorStatus',params:{}})});
  assert.equal(response.status,200);
  const status=await response.json();
  assert.equal(status.state,'ready');
  assert.equal(status.canAttach,false);
});

test('default open advertises a native thread panel without asking to open a browser',async t=>{
  const s=await client(t);
  const {tools}=await s.c.listTools();
  const tool=tools.find(tool=>tool.name==='open_editor');
  assert.deepEqual(tool._meta['openai/ui'].entrypoints,[{type:'thread'}]);
  assert.equal(tool._meta['openai/ui'].preferredModelDisplayMode,'fullscreen');
  assert.equal(tool._meta.ui.resourceUri,'ui://cadcraft/panel.html');
  const opened=await s.call('open_editor');
  assert.equal(opened.isError,undefined);
  assert.equal(opened.structuredContent.editorUrl,undefined);
  assert.match(opened.content.map(item=>item.text).join('\n'),/设计面板/);
  const fallback=await s.call('open_browser_editor');
  assert.match(fallback.structuredContent.editorUrl,/^http:\/\/127\.0\.0\.1:/);
  assert.equal(tools.find(tool=>tool.name==='open_browser_editor')._meta,undefined);
});

test('resource discovery and resource content both default to the separate editor surface',async t=>{
  const s=await client(t);
  const {resources}=await s.c.listResources();
  const panel=resources.find(item=>item.name==='panel');
  const {contents}=await s.c.readResource({uri:panel.uri});
  for(const resource of [panel,contents[0]]){
    assert.equal(resource.mimeType,'text/html;profile=mcp-app');
    assert.equal(resource._meta['openai/ui'].preferredDisplayMode,'fullscreen');
    assert.deepEqual(resource._meta['openai/ui'].availableDisplayModes,['fullscreen']);
  }
});
