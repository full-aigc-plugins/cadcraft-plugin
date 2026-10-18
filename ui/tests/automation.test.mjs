import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, access, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installAutomation} from '../runtime/automation.mjs';
import {engineTools} from './catalog-fixture.mjs';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';

// 模拟面板回复，验证真实宿主文件落盘与请求参数；WASM 绘制另做集成验收。
async function session(t) {
  const root = await mkdtemp(join(tmpdir(), 'cadcraft-automation-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  await writeFile(join(root, 'tools.json'), JSON.stringify(await engineTools()));
  const handlers = new Map();
  const bridge = await installAutomation({registerTool:(name, schema, fn) => handlers.set(name, fn)},
    {directory:root, workspace:root, name:'cadcraft', files:new Map()});
  const {token} = (await handlers.get('_editor_attach')({})).structuredContent;
  t.after(() => bridge.close());
  async function call(name, args, reply) {
    const pending = handlers.get(name)(args, {});
    const request = await bridge.poll(token);
    bridge.reply(token, request.id, reply);
    return {request, result:await pending};
  }
  return {root, call, handlers, bridge, token};
}

test('render(path) writes exactly the returned PNG and reports the completed file', async t => {
  const s = await session(t);
  const {result} = await s.call('render', {path:'exports/preview.png', width:64, height:64},
    {content:[{type:'image', mimeType:'image/png', data:png}]});
  assert.equal(result.isError, undefined);
  assert.equal(await access(join(s.root, 'exports/preview.png')).then(()=>true,()=>false), true);
  assert.deepEqual(await readFile(join(s.root, 'exports/preview.png')), Buffer.from(png, 'base64'));
  assert.deepEqual(result.structuredContent.written, [{complete:true, path:'exports/preview.png', bytes:Buffer.from(png,'base64').length}]);
  assert.equal(result.content[0].type, 'image');
});

test('render without path returns image only and does not invent a file', async t => {
  const s = await session(t);
  const {result} = await s.call('render', {}, {content:[{type:'image',mimeType:'image/png',data:png}]});
  assert.equal(result.content.length, 1);
  assert.equal(result.structuredContent?.written, undefined);
});

test('render failure does not overwrite an existing output', async t => {
  const s = await session(t);
  await writeFile(join(s.root,'preview.png'), 'original');
  const {result} = await s.call('render', {path:'preview.png'}, {isError:true, content:[{type:'text',text:'bad viewport'}]});
  assert.equal(result.isError,true);
  assert.equal(await readFile(join(s.root,'preview.png'),'utf8'),'original');
});

test('render with no PNG cannot report successful persistence', async t => {
  const s = await session(t);
  const {result} = await s.call('render',{path:'preview.png'},{content:[{type:'text',text:'ok'}]});
  assert.equal(result.isError,true);
  assert.match(result.content[0].text,/PNG/);
  assert.equal(await access(join(s.root,'preview.png')).then(()=>true,()=>false),false);
});

test('render rejects malformed image bytes instead of writing a corrupt PNG', async t => {
  const s = await session(t);
  const {result} = await s.call('render',{path:'preview.png'},{content:[{type:'image',mimeType:'image/png',data:'bm90IGEgcG5n'}]});
  assert.equal(result.isError,true);
  assert.equal(await access(join(s.root,'preview.png')).then(()=>true,()=>false),false);
});

test('output path traversal is rejected before any request reaches the panel', async t => {
  const s = await session(t);
  const result=await s.handlers.get('render')({path:'../outside.png'},{});
  assert.equal(result.isError,true);
  assert.equal(s.bridge.requests.size,0);
});

test('output through a symlink outside the workspace is rejected before dispatch', async t => {
  const s = await session(t);
  const outside=await mkdtemp(join(tmpdir(),'cadcraft-outside-'));
  t.after(()=>rm(outside,{recursive:true,force:true}));
  await symlink(outside,join(s.root,'escape'),'dir');
  const result=await s.handlers.get('render')({path:'escape/preview.png'},{});
  assert.equal(result.isError,true);
  assert.equal(s.bridge.requests.size,0);
});

test('inspect_drawing defaults to summary and preserves explicit detail requests', async t => {
  const s = await session(t);
  const reply={content:[{type:'text',text:'{}'}]};
  const summary=await s.call('inspect_drawing',{},reply);
  assert.equal(summary.request.arguments.entities,false);
  const details=await s.call('inspect_drawing',{entities:true,limit:7},reply);
  assert.deepEqual(details.request.arguments,{entities:true,limit:7});
});

test('a disconnected bridge identifies its state without implying open_editor was never called', async () => {
  const {EditorBridge}=await import('../runtime/bridge.mjs');
  const bridge=new EditorBridge();
  const initial=await bridge.call('list_commands',{});
  assert.equal(initial.structuredContent?.state,'not_opened');
  const token=bridge.attach();
  bridge.check(token);bridge.close();
  const disconnected=await bridge.call('list_commands',{});
  assert.equal(disconnected.structuredContent?.state,'disconnected');
});
