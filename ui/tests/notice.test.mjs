import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../runtime/client.mjs',import.meta.url),'utf8');
// 执行实际客户端的通知函数，隔离 WASM 与 MCP，不复制通知实现。
const message=source.match(/^function message\(value, error = false\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(message,'client notice function must be available');
function show(value,error,{loaded=false,lastExport=null}={}){
  const context={loaded,lastExport,status:{textContent:'',dataset:{}},notice:{hidden:false},retry:{hidden:true},value,error};
  runInNewContext(message+'\nmessage(value,error);',context);
  return context;
}
test('startup loading does not add a second overlay above the engine loader',()=>{
  assert.equal(show('正在加载编辑器…',false).notice.hidden,true);
});
test('errors remain visible before and after editor readiness',()=>{
  for(const loaded of [false,true]){
    const result=show('编辑器启动失败',true,{loaded});
    assert.equal(result.notice.hidden,false);
    assert.equal(result.status.textContent,'编辑器启动失败');
    assert.equal(result.retry.hidden,true);
  }
});
test('failed exports retain retry while normal messages clear the overlay',()=>{
  const failed=show('保存失败',true,{loaded:true,lastExport:{name:'drawing.dxf'}});
  assert.equal(failed.retry.hidden,false);
  const recovered=show('就绪',false,{loaded:true,lastExport:{name:'drawing.dxf'}});
  assert.equal(recovered.notice.hidden,true);
  assert.equal(recovered.retry.hidden,true);
});
