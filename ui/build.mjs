import {build,transform} from 'esbuild';
import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{outdir:{type:'string'},editor:{type:'string'}}});
const here=dirname(fileURLToPath(import.meta.url));
const output=resolve(values.outdir || join(here,'dist'));
const editor=resolve(values.editor || join(here,'dist/editor'));
// 指定输出目录时创建独立候选；保留原有内置运行时与正在使用的编辑器。
await mkdir(output,{recursive:!values.outdir});
if(editor!==join(output,'editor'))await cp(editor,join(output,'editor'),{recursive:true,dereference:true});
const node={bundle:true,platform:'node',format:'esm',target:'node24',banner:{js:'import {createRequire as __createRequire} from "node:module"; const require=__createRequire(import.meta.url);'},legalComments:'linked'};
await build({...node,entryPoints:[join(here,'adapter.mjs')],outfile:join(output,'adapter.mjs')});
await build({entryPoints:[join(here,'host.mjs')],outfile:join(output,'host.js'),bundle:true,platform:'browser',format:'esm',target:'chrome120',legalComments:'linked'});
// runtime/server.mjs 包含导出落盘、查询默认值与会话桥接，不能沿用旧 server bundle。
await build({...node,entryPoints:[join(here,'runtime/server.mjs')],outfile:join(output,'editor/server.mjs')});
// panel.html 内嵌了 UI 客户端，必须同步重建，不能复制旧的显示模式协商逻辑。
const manifestPath=join(output,'editor/assets.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const plugin=JSON.parse(await readFile(join(here,'../plugin.json'),'utf8'));
const panelPath=join(output,'editor/panel.html');
const panel=await readFile(panelPath,'utf8');
const modulePattern=/<script\b[^>]*type=["']module["'][^>]*>[\s\S]*?<\/script>/gi;
if([...panel.matchAll(modulePattern)].length!==1)throw Error('Expected one bundled editor client; refusing to replace an unknown panel');
const client=await build({entryPoints:[join(here,'runtime/client.mjs')],bundle:true,platform:'browser',format:'esm',target:'chrome120',write:false,minify:true,legalComments:'inline',
 define:{__CRAFT_SETTINGS__:JSON.stringify({name:manifest.name,version:plugin.version})}});
const javascript=client.outputFiles[0].text.replaceAll('</script','<\\/script');
await transform(javascript,{loader:'js'});
const quietPanel=panel.replace(/<div\b[^>]*\bid=["']craft-notice["'][^>]*>/gi,
 tag=>/\bhidden(?:\s|=|>)/i.test(tag)?tag:tag.replace(/>$/,' hidden>'));
await writeFile(panelPath,quietPanel.replace(modulePattern,()=>`<script type="module">${javascript}</script>`));
await writeFile(manifestPath,JSON.stringify({...manifest,version:plugin.version},null,2)+'\n');
const buildPath=join(output,'editor/BUILD.json');
try {
 const provenance=JSON.parse(await readFile(buildPath,'utf8'));
 await writeFile(buildPath,JSON.stringify({...provenance,pluginVersion:plugin.version,
  wasmBuildPluginVersion:provenance.wasmBuildPluginVersion??provenance.pluginVersion},null,2)+'\n');
} catch(error) {
 if(error.code!=='ENOENT')throw error;
}
console.log(output);
