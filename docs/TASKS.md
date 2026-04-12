# 智能研发资源排期系统 - 任务清单 (Task List)

## 阶段零：本地环境运行指南 (Phase 0: Local Environment Setup)
- [x] **DONE** 0.1 本地环境安装与启动步骤记录。
    - **环境要求**: Node.js (v18+), npm/pnpm.
    - **启动步骤**:
        1. 进入插件目录: `cd extension`
        2. 安装依赖: `npm install`
        3. 启动开发服务器 (热更新): `npm run dev`
        4. 加载到浏览器: 打开 Chrome 浏览器，进入 `chrome://extensions/`，开启右上角的“开发者模式”，点击“加载已解压的扩展程序”，选择本项目下的 `extension/dist` (或使用 Vite 热更新支持的 `extension` 根目录/配置目录，取决于构建方式，使用 CRXjs 会实时输出到 dist，所以选择 `extension/dist`)。
    - **打包构建**: `npm run build`，产物将生成在 `extension/dist` 目录下。

## 阶段一：项目初始化与基础设施 (Phase 1: Setup & Infrastructure)
- [x] **DONE** 1.1 初始化 Vite + React + TypeScript 项目结构。
- [x] **DONE** 1.2 配置 CRXjs 以支持 Chrome 插件开发环境（Manifest V3）。
- [x] **DONE** 1.3 配置 Tailwind CSS 样式引擎。
- [x] **DONE** 1.4 设置基本的插件目录结构（Background, Content Script, Options Page, Popup）。

## 阶段二：本地数据层设计与实现 (Phase 2: Local Data Layer - Dexie.js)
- [x] **DONE** 2.1 定义 IndexedDB 数据库结构 (Schema)，包括 `Settings`, `Resources`, `Projects`, `Allocations`, `JiraWorklogs`。
- [x] **DONE** 2.2 实现基础的 CRUD 业务逻辑服务层 (Data Access Layer)。
- [x] **DONE** 2.3 实现对 `chrome.storage.local` 的封装（用于敏感信息如 API Key 的存储）。

## 阶段三：核心业务逻辑服务 (Phase 3: Core Business Services)
- [ ] **TODO** 3.1 **Jira 同步服务 (Jira Sync Service)**
    - [ ] **TODO** 3.1.1 封装调用 Jira API 的工具类（处理 Auth、分页等）。
    - [ ] **TODO** 3.1.2 实现拉取 Jira 项目和 Issue 的逻辑，并持久化到 IndexedDB。
    - [ ] **TODO** 3.1.3 实现 Service Worker (Background) 定时轮询机制。
- [ ] **TODO** 3.2 **AI 排期引擎服务 (AI Scheduler Service)**
    - [ ] **TODO** 3.2.1 实现组装上下文 Prompt 的逻辑（从 IndexedDB 提取可用资源和待排期项目）。
    - [ ] **TODO** 3.2.2 封装调用 OpenAI (或兼容大模型) 接口的方法。
    - [ ] **TODO** 3.2.3 解析 AI 返回的 JSON 结构并转换为内部的排期草稿结构。

## 阶段四：UI 界面开发 (Phase 4: User Interface)
- [ ] **TODO** 4.1 **Options Page (管理大盘)**
    - [ ] **TODO** 4.1.1 设置页面路由（配置、人员管理、排期看板）。
    - [ ] **TODO** 4.1.2 开发人员与技能标签管理界面。
    - [ ] **TODO** 4.1.3 集成 ECharts 实现排期甘特图与资源热力图。
    - [ ] **TODO** 4.1.4 AI 排期触发面板及结果预览与微调界面。
- [ ] **TODO** 4.2 **Popup (快捷操作面板)**
    - [ ] **TODO** 4.2.1 快速查看当前个人的负荷概览。
    - [ ] **TODO** 4.2.2 快速跳转到 Options 大盘的入口。
- [ ] **TODO** 4.3 **Content Script (Jira 页面注入预警)**
    - [ ] **TODO** 4.3.1 监听 Jira Issue 页面 URL 变化。
    - [ ] **TODO** 4.3.2 读取后台数据，计算当前 Issue 指派人的实时负荷状态。
    - [ ] **TODO** 4.3.3 将红黄绿预警状态无侵入式注入到 Jira 页面 DOM 中。

## 阶段五：测试与发布 (Phase 5: Testing & Release)
- [ ] **TODO** 5.1 整体流程联调与测试（Jira 同步 -> 人员管理 -> AI 排期 -> 页面注入）。
- [ ] **TODO** 5.2 性能优化（针对大量 Issue 数据的 IndexedDB 查询优化）。
- [ ] **TODO** 5.3 准备 Chrome Web Store 上架素材并打包扩展程序。
