// 从实际候选进程导出启动目录，不手写与运行时不同的工具元数据。
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const [runtime,output]=process.argv.slice(2);
if(!runtime || !output)throw Error('Usage: node snapshot-catalog.mjs RUNTIME OUTPUT');
const client=new Client({name:'cadcraft-package-catalog',version:'1'});
try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:[join(resolve(runtime),'adapter.mjs')],cwd:tmpdir(),
    env:{...process.env,CRAFT_WORKSPACE_ROOT:tmpdir(),CRAFT_EDITOR_UPDATE:'off'},stderr:'inherit'}));
  const catalog={...await client.listTools(),...await client.listResources(),...await client.listResourceTemplates()};
  await writeFile(resolve(output),JSON.stringify(catalog,null,2)+'\n',{flag:'wx'});
}finally{await client.close();}
