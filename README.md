# 速写计时器

本地速写练习计时：导入图片文件夹，预设单张时长，随机/上一张/下一张，练习总时长与重复选项等。桌面端基于 **Tauri 2** + **Vite**，界面逻辑在 `simple/src`。

**许可证：[MIT](LICENSE)**（可自由使用、修改与再分发，需保留许可证原文。）

## 从源码运行

需要 [Node.js](https://nodejs.org/)、[Rust（rustup）](https://rustup.rs/)。

```bash
git clone https://github.com/你的账号/仓库名.git
cd 仓库名/simple
npm install
npm run tauri:dev
```
（把地址与目录名换成你在 GitHub 上实际使用的仓库。）

生产构建（生成 `src-tauri/target/release/` 下的可执行文件；可选 NSIS 安装包）：

```bash
cd simple
npm run build
npm run tauri:build
```

图标：在 `simple` 目录用源图生成 `src-tauri/icons/`（示例）：

```bash
cd simple
npx tauri icon ../icon.png
```

`tauri.conf.json` 中 `bundle` 与 `icon` 路径需与 `icons/` 中文件一致。

## 仓库说明

- 主程序代码在 **`simple/`**。
- 根目录的 `main.py` 等为历史/实验脚本，与当前 Tauri 版无直接关系，可忽略或自行删除。

## 第三方与致谢

本应用使用 [Tauri](https://tauri.app/)、[Vite](https://vitejs.dev/) 及各自依赖，遵循其开源许可证。Rust 与 npm 依赖的许可证见各 crate / package 元数据。

## 分发说明

未做代码签名的 Windows 可执行文件可能触发 SmartScreen「未知发布者」提示，属常见情况；需要时可购买证书对二进制签名。向他人分发时，请同时提供本 **MIT 许可证** 或仓库链接。
