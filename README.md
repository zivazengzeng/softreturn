# 慢慢回来 fresh

这是独立重做的一份「慢慢回来」MVP，使用新的 localStorage key，避免和旧地址的数据混在一起。

## 运行

```bash
npm run dev
```

默认新地址：

```text
http://localhost:5188/
```

## 功能

- 首页「今日只做 3 件事」
- 文字/语音记录，语音使用 Web Speech API，中文识别结果填入“我今天担心了什么？”
- 保存「今日证据卡」
- 3 个月计划
- 历史记录列表

## GitHub Pages 发布

项目已包含 GitHub Actions 配置：

```text
.github/workflows/pages.yml
```

推送到 `main` 分支后，GitHub 会自动执行：

```bash
npm ci
npm run build
```

并把 `dist/` 发布到 GitHub Pages。

首次使用时，在 GitHub 仓库中打开：

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

启用后等待 Actions 跑完即可访问 Pages 地址。

## iOS App 工程

当前项目已经使用 Capacitor 封装为 iOS App，保留现有 React + Vite H5 页面和 localStorage 数据逻辑。

### 技术栈判断

- 前端：React + TypeScript + Vite
- 样式：CSS
- 本地数据：localStorage
- iOS 封装：Capacitor
- iOS 工程目录：`ios/App/App.xcodeproj`

### 常用命令

```bash
npm install
npm run build
npm run ios:sync
npm run ios:open
```

说明：

- `npm run dev`：只启动 H5 开发预览，地址为 `http://localhost:5188/`
- `npm run build`：构建 H5 到 `dist/`
- `npm run ios:assets`：生成 iOS App 图标和启动页资源
- `npm run ios:sync`：生成资源、构建 H5，并同步到 `ios/App/App/public`
- `npm run ios:open`：用 Xcode 打开 iOS 工程
- `npm run ios:run`：同步后尝试运行到 iOS 设备或模拟器

### 用 Xcode 运行到模拟器

1. 安装 Xcode，并首次打开完成组件安装。
2. 在项目目录执行：

```bash
npm run ios:sync
npm run ios:open
```

3. Xcode 打开后选择 `App` scheme。
4. 顶部设备选择一个 iPhone / iPad 模拟器。
5. 点击 Run。

### 用 Xcode 运行到真机

1. 用数据线连接 iPhone / iPad。
2. 在 Xcode 的 `Signing & Capabilities` 里选择你的 Apple Team。
3. 如果 Bundle Identifier 冲突，把 `com.manmanhuilai.app` 改成你自己的唯一 ID，例如 `com.yourname.manmanhuilai`。
4. 选择真机，点击 Run。
5. 首次安装如提示不受信任，在 iPhone 的“设置”里信任开发者证书。

### 打包发布

1. 在 Xcode 中选择真机或 `Any iOS Device`。
2. 菜单选择 `Product > Archive`。
3. Archive 完成后进入 Organizer。
4. 选择 `Distribute App`，按需选择 TestFlight、App Store 或 Ad Hoc。

### 当前环境说明

当前 Codex 环境已经完成：

- 安装 Capacitor iOS 依赖
- 生成 `ios/` 原生工程
- 同步 H5 构建产物
- 配置 App 名称「慢慢回来」
- 生成 App 图标和启动页
- 添加麦克风和语音识别权限说明

但当前环境没有可用的 Xcode 命令行工具，所以不能在这里直接运行模拟器或执行 Archive。请在本地 Mac 上安装 Xcode 后执行：

```bash
cd /Users/zengziying1/Documents/Codex/2026-06-01/app-mvp-react-typescript-tailwind-css/fresh-manmanhuilai
npm install
npm run ios:sync
npm run ios:open
```
