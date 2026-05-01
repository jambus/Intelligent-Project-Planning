# 智能研发资源排期系统 - 任务清单 (Task List)

## 阶段零：本地环境运行指南 (Phase 0: Local Environment Setup)
- [x] **DONE** 0.1 本地环境安装与启动步骤已提取为独立文档：请参阅 [`docs/DEVELOPMENT.md`](./DEVELOPMENT.md)。

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
- [x] **DONE** 3.1 **Jira 同步服务 (Jira Sync Service)**
    - [x] **DONE** 3.1.1 封装调用 Jira API 的工具类（处理 Auth、分页等）。
    - [x] **DONE** 3.1.2 实现拉取 Jira 项目和 Issue 的逻辑，并持久化到 IndexedDB。
    - [x] **DONE** 3.1.3 实现 Service Worker (Background) 定时轮询机制。
- [x] **DONE** 3.2 **AI 排期引擎服务 (AI Scheduler Service)**
    - [x] **DONE** 3.2.1 实现组装上下文 Prompt 的逻辑（从 IndexedDB 提取可用资源和待排期项目）。
    - [x] **DONE** 3.2.2 封装调用 OpenAI (或兼容大模型) 接口的方法。
    - [x] **DONE** 3.2.3 解析 AI 返回的 JSON 结构并转换为内部的排期草稿结构。

## 阶段四：UI 界面开发 (Phase 4: User Interface)
- [x] **DONE** 4.1 **Options Page (管理大盘)**
    - [x] **DONE** 4.1.1 设置页面路由（配置、人员管理、排期看板）。
    - [x] **DONE** 4.1.2 开发人员与技能标签管理界面。
    - [x] **DONE** 4.1.3 集成 ECharts 实现排期甘特图与资源热力图。 (注: 简化为表格展示分配状态)
    - [x] **DONE** 4.1.4 AI 排期触发面板及结果预览与微调界面。
- [x] **DONE** 4.2 **Popup (快捷操作面板)**
    - [x] **DONE** 4.2.1 快速查看当前个人的负荷概览。
    - [x] **DONE** 4.2.2 快速跳转到 Options 大盘的入口。
- [x] **DONE** 4.3 **Content Script (Jira 页面注入预警)**
    - [x] **DONE** 4.3.1 监听 Jira Issue 页面 URL 变化。
    - [x] **DONE** 4.3.2 读取后台数据，计算当前 Issue 指派人的实时负荷状态。
    - [x] **DONE** 4.3.3 将红黄绿预警状态无侵入式注入到 Jira 页面 DOM 中。

## 阶段五：测试与发布 (Phase 5: Testing & Release)
- [x] **DONE** 5.1 整体流程联调与测试（Jira 同步 -> 人员管理 -> AI 排期 -> 页面注入）。
- [x] **DONE** 5.2 性能优化（针对大量 Issue 数据的 IndexedDB 查询优化）。
- [x] **DONE** 5.3 准备 Chrome Web Store 上架素材并打包扩展程序。

## 阶段六：架构重构 - 步进式扣减排期法 (Phase 6: Step-by-Step Deduction Scheduling)
- [x] **DONE** 6.1 **核心逻辑状态管理 (State Management)**
    - [x] 6.1.1 建立本地「资源池 (Resource Bank)」模型，精确跟踪每个人员的可用工时。
    - [x] 6.1.2 建立本地「需求池 (Project Queue)」模型，跟踪每个项目的剩余开发/测试缺口。
- [x] **DONE** 6.2 **AI 调度引擎重构 (AI Engine Refactoring)**
    - [x] 6.2.1 废弃全局盲排 Prompt，改为**逐项目 (Per-Project)** 候选人匹配的微调用模式。
- [x] **DONE** 6.3 **硬扣减执行器 (Hard Deduction Executor)**
    - [x] 6.3.1 JS 代码拦截 AI 建议，执行强制截断：`Math.min(AI建议人天, 项目缺口, 资源余量)`。
    - [x] 6.3.2 动态计算精确的起止日期，落库并扣减池子余额。
- [x] **DONE** 6.4 **交互与文档同步 (UI & Docs)**
    - [x] 6.4.1 更新大盘排期按钮的 Loading 状态，展示「正在处理项目 X...」的进度流。
    - [x] 6.4.2 更新 `docs/intelligent-resource-planner.md` 的架构设计图与逻辑说明。

## 阶段七：AI 排期精准度与资源利用率优化 (Phase 7: AI Scheduling Precision & Resource Optimization)

### P0 - 关键优化

- [x] **DONE** 7.1 **AI Prompt 策略增强 (Prompt Engineering)**
    - [x] 7.1.1 在 Prompt 中注入技能匹配权重：将项目所属产品域/技术栈与人员 `skills[]` 进行交叉标注，让 AI 优先匹配「专业对口」的候选人，而非随机选择空闲人员。
    - [x] 7.1.2 在 Prompt 中传递项目时间窗口约束（`startDate` / `endDate`），让 AI 优先选择在项目周期内空闲的人员。
    - [x] 7.1.3 引入「测试前置依赖」约束：在 Prompt 中加入规则，测试工程师的 `startDate` 应晚于对应项目开发排期的中点，避免测试资源过早锁定、空等开发交付。

- [x] **DONE** 7.2 **Dev-first / Test-second 两阶段排期 (Two-Phase Scheduling)**
    - [x] 7.2.1 将排期循环拆分为两阶段：第一轮只排 `devGap`，第二轮基于开发结束时间动态计算测试最早可开始时间后再排 `testGap`。
    - [x] 7.2.2 在第二轮测试排期中，确保全栈工程师严格归属开发力量、仅分配 `devGap`，测试资源池仅包含测试工程师。

### P1 - 重要改进

- [x] **DONE** 7.3 **数据模型增强 (Data Model Enhancement)**
    - [x] 7.3.1 `Allocation` 表增加 `allocationType: 'dev' | 'test'` 字段，从 AI 返回的 `targetGap` 直接写入，使审计逻辑不再依赖角色推断分配类型。
    - [x] 7.3.2 `Project` 表增加 `techStack` / `domain` 字段，CSV 导入时支持读取"技术栈/产品域"列，用于 AI 精准匹配。
    - [x] 7.3.3 增加 `ResourceCalendar` 表或在 `Resource` 上增加 `unavailableDates: string[]`，支持录入请假/不可用日期，让排期贴近现实。

- [x] **DONE** 7.4 **排期算法优化 - 防止贪心独占 (Anti-Greedy Scheduling)**
    - [x] 7.4.1 引入「时间切片」概念：在 AI Prompt 中增加分时策略指引，当资源 `idleMd` 远超单项目需求时，建议 `allocationPercentage = 50%` 同时服务多个项目。
    - [x] 7.4.2 支持用户选择排期策略模板：均衡模式（每人并行 2-3 项目，50%）、专注模式（每人同时 1 项目，100%）、紧急模式（高优项目可获得加班系数）。

### P2 - 体验与可持续性

- [x] **DONE** 7.5 **节假日与日历可配置 (Configurable Holiday Calendar)**
    - [x] 7.5.1 将 `dateUtils.ts` 中硬编码的 2026 年节假日改为可配置数据（存储在 IndexedDB 或 Settings），支持多年份切换，避免跨年失效。

- [x] **DONE** 7.6 **Content Script 预警精准度提升 (Alert Accuracy)**
    - [x] 7.6.1 Jira 页面预警从简单累加 `allocationPercentage` 改为按当前时间范围计算，排除已结束的历史分配，只统计进行中和未来的负荷。

- [x] **DONE** 7.7 **排期快照与方案对比 (Schedule Snapshots)**
    - [x] 7.7.1 排期时不再 `allocations.clear()` 全量清除，改为引入 `batchId` / `createdAt` 标记，保留历史排期快照，支持不同方案的对比与回滚。

- [x] **DONE** 7.8 **导入与调用优化 (Import & API Optimization)**
    - [x] 7.8.1 CSV 导入改为按表头名称匹配列位置（替代当前硬编码列序号），增强文件格式兼容性。
    - [x] 7.8.2 AI API 调用从逐项目单次调用改为小批量分组调用（3-5 个项目一组），降低 20+ 项目场景下的延迟和 Token 成本。

- [x] **DONE** 7.9 **全局补排轮次 (Global Refinement Round)**
    - [x] 7.9.1 在所有项目逐项扣减完成后，对仍有缺口的项目执行一轮全局补排，将碎片化闲置资源"拼接"分配，消除分配盲区。

## 阶段八：AI 批量排期与 Token 优化 (Phase 8: AI Batch Scheduling & Token Optimization)

- [x] **DONE** 8.1 **重构AI排期为批量调用模式 (Batch Scheduling Refactoring)**
    - [x] 8.1.1 收集当前阶段的所有缺口项目，一次性发送给 AI。
- [x] **DONE** 8.2 **实现 Prompt Caching 优化 token 使用 (Prompt Caching)**
    - [x] 8.2.1 分离静态系统提示词（如资源列表、排期规则）与动态项目数据。
- [x] **DONE** 8.3 **优化AI响应解析逻辑 (Response Parsing Optimization)**
    - [x] 8.3.1 支持解析多项目的批量返回结果（按 projectId 区分分配建议）。
- [x] **DONE** 8.4 **更新Dashboard UI交互逻辑 (Dashboard UI Update)**
    - [x] 8.4.1 将逐个项目加载的动画更新为批量处理状态展示。
- [x] **DONE** 8.5 **验证构建和功能测试 (Build & Test Verification)**
    - [x] 8.5.1 执行 `npm run build && npm run zip`，确保逻辑正确性。
