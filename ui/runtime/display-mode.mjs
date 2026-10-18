// 独立设计界面是产品契约；宿主拒绝时明确报错，避免悄悄退回对话内小组件。
export async function requestEditorDisplayMode(app) {
  const context = app.getHostContext();
  if (context?.displayMode === 'fullscreen') return;
  if (context?.availableDisplayModes && !context.availableDisplayModes.includes('fullscreen'))
    throw new Error('Host does not support fullscreen design panels; use open_browser_editor explicitly.');
  const result = await app.requestDisplayMode({mode:'fullscreen'});
  if (result.mode !== 'fullscreen') throw new Error('Host declined the fullscreen design panel; use open_browser_editor explicitly.');
}
