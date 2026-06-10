# 本地临时后端（可删除）

本目录模拟云服务器后端，仅用于开发阶段。接入真实后端后：

1. 将 `services/api/config.ts` 中 `USE_LOCAL_BACKEND` 设为 `false`（已完成）
2. 远程 API 实现在 `services/api/remote/` 目录
3. 确认后可删除本目录 `services/local/` 及 `data/` 目录

**注意**：微信小程序需在后台配置 request 合法域名为 `http://1.14.75.15`，开发阶段可在开发者工具中勾选「不校验合法域名」。
