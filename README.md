# Guidebook · 账号与 Codex 教程库

一个无需后端的中文教程目录，支持关键词搜索、分类筛选和移动设备浏览。内容依据 [aabb.plus](https://aabb.plus/) 导航中 8 个公开入口独立整理，并链接到相应原文；不包含对方视频、截图、完整原文或账号凭据。

## 本地运行

在项目目录执行：

```sh
python -m http.server 8000 --directory dist
```

然后打开 `http://localhost:8000/`。也可以将 `dist/` 发布到任何静态网站托管服务。搜索和筛选在浏览器本地执行；本项目没有账号、密钥或验证码输入功能。

## 在线访问

公开版本通过 [GitHub Pages](https://202wh.github.io/account-codex-guidebook/) 部署，根目录入口会跳转至 `dist/`。向 `main` 分支推送修改后，GitHub Pages 会自动更新。

## 修改内容

教程资料保存在 `dist/guides.js`，每条包括标题、分类、摘要、步骤、提示及原始来源。页面功能在 `dist/app.js`，样式在 `dist/style.css`。

## 范围与说明

参考站导航在整理时包含七篇教程与一个 2FA 工具。本项目将工具整理为安全使用说明，并未复刻其生成验证码功能。第三方服务界面和登录流程会变化，实际操作请以官方页面为准。该项目与 OpenAI、Apple 和参考网站无隶属关系。
