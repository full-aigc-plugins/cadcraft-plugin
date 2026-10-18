import test from 'node:test';
import assert from 'node:assert/strict';

test('editor initialization requests a separate surface when initially inline',async()=>{
  const {requestEditorDisplayMode}=await import('../runtime/display-mode.mjs');
  const requests=[];
  await requestEditorDisplayMode({getHostContext:()=>({displayMode:'inline',availableDisplayModes:['inline','fullscreen']}),
    requestDisplayMode:async request=>{requests.push(request);return {mode:'fullscreen'};}});
  assert.deepEqual(requests,[{mode:'fullscreen'}]);
});

test('an already separate editor does not repeat display requests',async()=>{
  const {requestEditorDisplayMode}=await import('../runtime/display-mode.mjs');
  await requestEditorDisplayMode({getHostContext:()=>({displayMode:'fullscreen'}),requestDisplayMode:()=>assert.fail('unnecessary display request')});
});

test('unsupported or rejected display modes are reported rather than silently accepting inline',async()=>{
  const {requestEditorDisplayMode}=await import('../runtime/display-mode.mjs');
  await assert.rejects(requestEditorDisplayMode({getHostContext:()=>({displayMode:'inline',availableDisplayModes:['inline']})}),/fullscreen/);
  await assert.rejects(requestEditorDisplayMode({getHostContext:()=>({displayMode:'inline'}),requestDisplayMode:async()=>({mode:'inline'})}),/fullscreen/);
});
