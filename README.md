# ComfyUI-Character-Multiview-Workbench

独立的角色多视图设置界面扩展。文件夹、Git 仓库和英文显示名统一为本名称；
Registry ID 为 `comfyui-character-multiview-workbench`；启动器显示名追加
`（闲兔角色多视图工作台）`。初始发布版本 `0.1.0`。

功能：13 类内置视图勾选、自定义命名元素、可拖动缩放和边缘吸附的自由布局、分区提示词、服装展示方式与风格。
支持文生图/图生图、全身去头设置、纯白背景白模PNG导出。
输出尺寸沿用调用方已有选择，仅主动选择并应用分辨率才更新。点击“应用到提示词”才返回结果，
取消不改原提示词。布局是给生成模型的约束与示意，不是生成后裁切或像素级合成器；
多视角角色一致性仍需要模型实跑验收。

这是前端设置扩展，不新增采样节点，不加载模型，不导入 H3 工作台或其他自定义插件。
ComfyUI 启动时加载扩展；可由 H3 工作台的“角色多视图设置”按钮打开，也可以由其他
调用方使用下列明确接口。不保存用户角色提示词正文或参考图片的全局缓存。
本浏览器localStorage仅保存布局收藏/历史参数，历史默认24小时过期，可关闭；收藏不过期。
浏览器关闭时不运行清理计时器，下次读取或打开时清理过期记录。

## 接口 v1

`globalThis.ComfyUICharacterMultiview` 提供 `apiVersion: 1`、`pluginId`、
`open({contextId, prompt, settings, width, height, generationMode, referenceImageCount, resolutionOptions})`、
`createApplication(prompt, settings, width, height, generationMode)`、
`stripMultiviewBlocks(prompt)`、`createWhiteModelImage(settings, width, height)`。

`open` 返回 Promise。取消返回 null；应用返回
`{contextId, generationMode, resolution, prompt, settings, layout}`，图生图附带PNG Blob `whiteModelImage`。
settings是独立副本，包含selected、customViews、headless、layout、partPrompts、stylePrompt、clothingMode及
用于幂等更新的appliedBlock；不修改调用方对象，不返回采样参数。调用方负责上传Blob，勿把Blob序列化为工程JSON。
调用方负责把结果写回发起请求的分镜，而不是当前随机活动分镜。

本插件不依赖 H3 插件；H3 的调用按钮是可选集成，缺少本插件时普通生图仍可使用。
当前不提供任意图片的自动抠图、颜色校正、身份训练或真实 3D 重建，不把这些功能混入角色设定图。

## 安装与发布

GitHub：https://github.com/xiantuhenlan/ComfyUI-Character-Multiview-Workbench

通过ComfyUI Manager/Registry安装，或克隆到ComfyUI/custom_nodes下的同名文件夹，
重启ComfyUI并刷新浏览器。安装后没有可搜索的新节点，请通过集成按钮或API打开。
见[CHANGELOG.md](CHANGELOG.md)。后续版本按patch逐一递增，不覆盖旧版本。
本次直接发布Registry，自动发布未启用：当前GitHub登录无workflow写权限。
publish_action.example.yml仅为非执行模板，仓库拥有者可用具备权限的登录将其安装到
.github/workflows/publish_action.yml；凭据来自加密Secret REGISTRY_ACCESS_TOKEN。

## 实验性功能限制

白模和提示词不是像素级控制，也不是生成后裁切器。实际H3生成尚未可靠通过侧视图、
去头及白模到角色外观迁移验收：可能仍有头部、视角错位或输出白模。不要把这些功能
当作已验证的生产级结果。布局工具不承诺模型生成一致性，不做隐藏后处理掩盖失败。
