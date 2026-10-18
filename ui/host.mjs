import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
const status=document.querySelector('#status');
const connect=document.querySelector('#connect');
const frame=document.querySelector('iframe');
const pageId=crypto.randomUUID();
let started=false;
const rpc=async(method,params)=>{
 const response=await fetch('rpc',{method:'POST',headers:{'Content-Type':'application/json','X-Craft-Page':pageId},body:JSON.stringify({method,params})});
 const result=await response.json();if(!response.ok)throw Error(result.error);return result;
};
const bridge=new AppBridge(null,{name:'Craft host browser',version:'0.1.0'},
 {serverResources:{},serverTools:{},downloadFile:{}},
 {hostContext:{theme:'dark',locale:'zh-CN',displayMode:'fullscreen'}});
bridge.onreadresource=p=>rpc('readResource',p);
bridge.oncalltool=p=>rpc('callTool',p);
bridge.ondownloadfile=p=>rpc('downloadFile',p);
bridge.onsizechange=()=>{};
bridge.oninitialized=async()=>{
 await bridge.sendToolInput({arguments:{}});
 await bridge.sendToolResult(await rpc('initial',{}));
 status.textContent='页面已连接 · 正在加载编辑器，自动化尚未就绪';
};
const stream=new EventSource('events');
stream.onmessage=async({data})=>{
 const event=JSON.parse(data);
 if(event.type==='tool-result')await bridge.sendToolResult(event.result);
 if(event.type==='saved')status.textContent=`已保存：${event.paths.join('，')}`;
 if(event.type==='editor-status')void showStatus().catch(error=>{status.textContent=error.message;});
};
stream.onerror=()=>{status.textContent='连接中断；保留页面并检查 MCP 服务，勿重复编辑。';};
async function showStatus(){
 const session=await rpc('editorStatus',{});
 if(session.attached && !session.canAttach){
  status.textContent='编辑器已在其他面板打开，请复用该面板；关闭原面板后可重新检查并连接。';
  connect.hidden=false;
 }else if(session.attached){
  status.textContent='编辑器就绪 · 工程与工具共享当前会话';connect.hidden=true;
 }else{
  status.textContent=started?'正在加载或重新连接编辑器…':'正在连接编辑器…';
  connect.hidden=started;
 }
 return session;
}
async function start(){
 const session=await showStatus();
 if(started || !session.canAttach)return;
 started=true;connect.hidden=true;
 try{
  await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));
  frame.src='panel?webgl';
 }catch(error){started=false;throw error;}
}
connect.onclick=()=>{void start().catch(error=>{status.textContent=error.message;connect.hidden=false;});};
await start().catch(error=>{status.textContent=error.message;connect.hidden=false;});
window.addEventListener('pagehide',()=>{navigator.sendBeacon('detach',JSON.stringify({pageId}));stream.close();});
