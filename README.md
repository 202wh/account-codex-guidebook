# 教程网站

本项目整理自 [aabb.plus](https://aabb.plus/) 网站导航中的 8 个入口，包含原页面文字、图片、视频和验证码工具。站内路径已调整为适配 GitHub Pages 子目录；页面中的外部链接仍指向各自原始网站。

- 在线地址：https://202wh.github.io/account-codex-guidebook/
- 默认首页：`dist/change-2fa/`
- 先前的摘要版：`dist/guidebook/`

## 本地运行

```sh
python -m http.server 8000 --directory dist
```

访问 `http://localhost:8000/`。将修改推送到 GitHub 的 `main` 分支后，GitHub Pages 会自动重新部署。

## 验证码工具

原版 2FA 工具在浏览器中计算验证码，默认勾选“保存到浏览器历史”，启用时会在浏览器本地存储密钥配置。使用前请确认设备和浏览器环境可信。
