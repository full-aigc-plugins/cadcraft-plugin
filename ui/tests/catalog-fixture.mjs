import {readFile} from 'node:fs/promises';

// 协议回归只需工具契约，不依赖本地下载缓存或已编译 WASM；真实引擎另做浏览器验收。
export async function engineTools() {
  const catalog=JSON.parse(await readFile(new URL('../catalog.lock.json',import.meta.url),'utf8'));
  return catalog.tools.filter(tool=>!tool.name.startsWith('_editor_') && !['open_editor','open_browser_editor','editor_status'].includes(tool.name));
}
