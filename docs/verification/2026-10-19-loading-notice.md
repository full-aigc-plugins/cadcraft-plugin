# 重复加载提示修复

> 本记录保留发布前修复阶段状态；后续发行验证见 [2026-10-19-release.md](2026-10-19-release.md)。

用户截图中顶部“正在加载编辑器…”来自 `ui/runtime/client.mjs` 的 `craft-notice` 浮层；画布中央的 `Loading CADCraft…` 来自引擎自身。两者在初始化期间同时显示。

## 修改

- 浮层仅在出错时显示；普通加载、打开及就绪状态不再显示额外浮层。
- 构建时为初始 HTML 的 `craft-notice` 设置 `hidden`，避免 MCP 连接、客户端初始化之前闪现提示。
- 编辑器内部加载画面保持原样。启动错误、保存失败及可用的导出重试按钮仍正常显示。
- 重建内嵌客户端并重新生成实际运行时文件摘要；没有仅修改文案。

## 验证

- 新增回归先观察到两项失败：初始化加载浮层可见、初始 HTML 未隐藏通知。
- 修复后 JavaScript 回归 26 项通过。根 Python 回归 8 项通过、2 项因未配置原生 CLI 跳过；包校验和差异检查通过。
- 独立本地候选的真实浏览器加载期间，AX 树只有引擎 `Loading CADCraft…`，没有重复浮层。加载完成后 `craft-notice` 的可见性为 false，编辑器正常就绪，ESP32 图纸 299 个图元，dirty=false。
- 本次视觉验证采用显式浏览器备用入口，不替代默认原生右侧面板验收。
- 候选归档 SHA-256：`da1d9ccbbfcdb36f5f2f878c97fd8572da8f9c4ab54fe3905ef0db9605acb1de`。候选只位于忽略目录 `.local/quiet-loading-runtime` 与 `.local/quiet-loading-release`，未发布。

## 其他插件

只读检查确认 DeckCraft、FigCraft、PrintCraft、SoundCraft、PhotoCraft、DesignCraft、VectorCraft、GridCraft、WordCraft 共 9 个仓库有相同客户端通知逻辑；初次排查时均为 main；现已完成授权分支创建。用户已授权创建修复分支；这 9 个仓库均已在 `feature/REQ-20261019-wandl-loading-notice` 完成同样的客户端与初始打包模板修复。


## 9 个插件同步结果

| 插件 | JavaScript 回归 |
|---|---:|
| DeckCraft | 4 / 4 通过 |
| FigCraft | 4 / 4 通过 |
| PrintCraft | 7 / 7 通过 |
| SoundCraft | 4 / 4 通过 |
| PhotoCraft | 19 / 19 通过 |
| DesignCraft | 4 / 4 通过 |
| VectorCraft | 13 / 13 通过 |
| GridCraft | 4 / 4 通过 |
| WordCraft | 6 / 6 通过 |

9 个仓库合计 65 项通过；加 CADCraft 26 项共 91 项通过。各仓库新增打包器回归，检查生成 HTML 初始隐藏通知，同时保留引擎加载元素，并接入 UI CI 工作流。CI 配置已修改，远端 CI 未执行。

DesignCraft 的 103 项 Python 回归及包/规格检查通过；SoundCraft 5 项、WordCraft 6 项 Python 回归通过。PrintCraft 完整回归有 3 个失败、3 个错误；PhotoCraft 和 VectorCraft 各有 4 个失败。以上失败已在各自修改前 HEAD 的隔离副本复现，分别涉及场景摘要、版本身份/文档门禁。PrintCraft/DesignCraft OpenSpec 严格检查通过；PhotoCraft/VectorCraft 严格检查仍因原有超长需求警告失败。未修改无关门禁或将整仓结果写成全部通过。

其他插件当前仅完成源码、本地回归和夹具打包验证，未逐插件安装或升级，未完成真实宿主视觉验收，未提交推送或发布。历史公开运行时锁保留原制品身份。
