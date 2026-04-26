# 智能研发资源排期系统 - 本地开发与环境搭建指南 (Development Guide)

本文档记录了本项目的本地开发环境搭建步骤、运行方式以及打包构建流程。

**⚠️ 重要维护说明 (For Developers & AI Agents):**
> 随着项目的迭代，如果引入了新的核心依赖（例如新的数据库、外部服务 SDK）、修改了构建脚本（如 `package.json` 中的 scripts）或更改了目录结构，**请务必同步更新本文档**，以确保新加入的开发者能够顺利运行项目。

---

## 1. 环境要求 (Prerequisites)

*   **Node.js**: v18.0.0 或更高版本 (推荐使用 LTS 版本)。
*   **包管理器**: npm 或 pnpm。
*   **浏览器**: Google Chrome (用于加载和调试插件)。

## 2. 本地开发启动步骤 (Local Development Setup)

1.  **克隆或进入项目目录**:
    ```bash
    # 假设已经在项目根目录
    cd extension
    ```

2.  **安装依赖 (Install Dependencies)**:
    ```bash
    npm install
    ```

3.  **启动开发服务器 (Start Dev Server)**:
    执行以下命令，Vite 将会启动热更新 (HMR) 服务，并实时编译插件代码到 `dist` 目录。
    ```bash
    npm run dev
    ```

4.  **在 Chrome 中加载插件**:
    *   打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车。
    *   开启页面右上角的 **“开发者模式” (Developer mode)**。
    *   点击左上角的 **“加载已解压的扩展程序” (Load unpacked)**。
    *   在弹出的文件选择窗口中，选择本项目下的 `extension/dist` 文件夹。
    *   加载成功后，您应该能在扩展栏看到蓝色的“智能排期系统”图标。由于启用了热更新，后续修改代码后，大部分情况下浏览器会自动重新加载插件（若未生效，可在扩展管理页点击刷新按钮）。

## 3. 生产环境构建与打包 (Production Build & Packaging)

**⚠️ 交付要求 (Delivery Requirement):**
> **每次修改完核心功能代码后，必须重新执行生产构建并更新 release 目录下的 ZIP 包**，以确保分发产物与最新代码同步。

1.  **执行构建命令**:
    ```bash
    cd extension
    npm run build
    ```
    此命令会先执行 TypeScript 类型检查 (`tsc -b`)，然后使用 Vite 进行生产级别压缩和打包。产物将生成在 `extension/dist` 目录下。

2. **打包为 ZIP 并更新 Release**:
    ```bash
    cd extension/dist
    mkdir -p ../release
    # 覆盖更新 release 目录下的压缩包
    zip -r ../release/intelligent-resource-planner-v1.0.0.zip .
    ```
    生成的 ZIP 文件位于 `extension/release/` 目录下，即可用于上传至 Chrome Web Store 或直接分发给用户进行本地拖拽安装。

## 4. 项目结构 (Project Structure)

*   `extension/src/`: 核心源代码（包含 Background, Content Scripts, Options Page, Popup）。
*   `extension/src/db/`: 数据库 Schema 定义与 Dexie 服务。
*   `extension/src/services/`: AI 排期逻辑、文件导入解析及 Jira API 工具类。
*   `docs/DEVELOPMENT.md`: **关键** - 详细的本地开发、环境搭建与构建指令。
*   `docs/intelligent-resource-planner.md`: 完整的 PRD、系统架构图及详细设计规范。
*   `docs/TASKS.md`: 项目路线图及当前任务状态。

## 6. 发布与密钥说明 (Publishing & Key)

为了保持插件 ID 的一致性，项目在 `manifest.json` 中配置了固定的 `key`。
*   **Web Store 公钥**：已配置，确保插件 ID 为固定值，便于在生产环境和开发环境之间无缝切换并保留本地存储数据。

## 7. 自动化发布指南 (Automated Publishing)

项目支持通过 CLI 一键发布到 Chrome Web Store。

### 7.1 配置凭证 (Credentials)

您需要准备两类凭证：

#### A. 扩展身份
*   **EXTENSION_ID**: 您插件的 ID (`ofhjhjlmdfjnnadpgfnamljghopgpmfj`)。

#### B. Google Cloud OAuth 凭证 (用于自动化)
1.  **创建项目**: 在 [Google Cloud Console](https://console.cloud.google.com/) 创建新项目。
2.  **开启 API**: 在「库」中搜索并启用 **Chrome Web Store API**。
3.  **同意屏幕**: 在「OAuth 同意屏幕」配置为「外部」，填写应用名称。
4.  **创建凭据**: 在「凭据」中创建「OAuth 客户端 ID」，类型选 **桌面应用 (Desktop App)**。
5.  **获取 ID/Secret**: 复制生成的 `CLIENT_ID` 和 `CLIENT_SECRET` 到 `.env`。
6.  **获取 Token**: 运行 `npx chrome-webstore-upload-cli token`，在浏览器完成授权，将返回的 `REFRESH_TOKEN` 存入 `.env`。


### 7.2 执行发布

#### 离线打包 (CRX)
如果您需要生成 `.crx` 文件进行手动分发：
1.  确保根目录下存在 `privatekey.pem`。
2.  运行命令：
    ```bash
    npm run crx
    ```
    产物将生成在 `release/irp.crx`。

#### 在线上传 (Web Store)
...```bash
# 首先设置环境变量 (建议在 .env 或本地 shell 中配置)
export EXTENSION_ID=your_extension_id
export CLIENT_ID=your_client_id
export CLIENT_SECRET=your_client_secret
export REFRESH_TOKEN=your_refresh_token

# 执行一键构建、打包并上传
npm run publish
```

该脚本会自动完成：
1.  生产环境编译 (`npm run build`)。
2.  生成 ZIP 压缩包 (`npm run zip`)。
3.  上传产物到 Chrome Web Store 后台。

---


*   **框架**: React 19 + TypeScript + Vite 4
*   **插件构建**: `@crxjs/vite-plugin` (Manifest V3)
*   **样式**: Tailwind CSS v3
*   **本地存储**: IndexedDB (通过 `dexie` 和 `dexie-react-hooks` 驱动)
*   **图标库**: `lucide-react`
*   **路由**: `react-router-dom` (用于 Options 管理后台页面)
