# 开发说明

## 环境

- Node.js `^20.19.0` 或 `>=22.12.0`；
- 浏览器回归测试与截图使用 Playwright Core 和本机 Edge；
- 非默认 Edge 路径可通过 `CHROME_PATH` 指定 Chromium／Chrome／Edge 可执行文件。

## 安装与启动

```bash
cd app
npm install
npm run dev
```

`npm run dev` 支持 Vite 的 host／port 参数，例如：

```bash
npm run dev -- --host 127.0.0.1 --port 7100
```

## 验证

```bash
npm run test:prompt
npm run build
npm run test:smoke
```

覆盖范围：三次提示词、个人信息隔离、500 字符限制、key 两种模式、102 条虚构 CSV 保存、累计文献继承、每方向精读数量下限、2 个优先方向从 10 个调整为 14 个精读槽位、调整数量时保留题名、全文分级、持久化、进度导入导出、桌面与移动端。

测试完全使用虚构数据，不读取私有 CSV，不调用 LeapSpace、OpenAlex 或大模型。通过测试不证明外部 AI 的检索与科研结论正确。

测试输出写入 `app/artifacts/`，该目录已被忽略，不进入公开仓库。

## 重新生成 README 截图

```bash
npm run capture:readme
```

脚本在独立浏览器上下文中载入虚构演示，输出一张概览图和四张全页截图到 `docs/assets/readme/`。它不会读取或清除用户日常浏览器中的工作台记录。

## 技术边界

这是原生 HTML／CSS／JavaScript 与 Vite 构成的本地前端。工作台没有项目云端后端，也不内置 LeapSpace、OpenAlex 或大模型 API 调用。文件与进度依赖当前浏览器存储，清理浏览器数据前应备份。
