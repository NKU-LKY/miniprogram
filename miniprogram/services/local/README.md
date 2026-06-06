# 本地临时后端（可删除）

本目录模拟云服务器后端，仅用于开发阶段。接入真实后端后：

1. 将 `services/api/config.ts` 中 `USE_LOCAL_BACKEND` 设为 `false`
2. 实现 `services/api/remote/` 中的远程 API
3. 删除本目录 `services/local/` 及 `data/` 目录
