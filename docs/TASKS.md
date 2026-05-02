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

## 阶段九：AI 优先级微批次与完整性回滚 (Phase 9: Priority-based Mini-Batches & Integrity Rollback)

- [x] **DONE** 9.1 **重构排期循环为优先级小批量 (Priority Mini-Batches)**
    - [x] **DONE** 9.1.1 按项目优先级顺序（CSV 导入顺序），将项目切分为小批次（如 3 个一组）。
    - [x] **DONE** 9.1.2 针对每个小批次，按序执行 Dev 阶段和 Test 阶段的批量请求与扣减，确保高优项目优先闭环。
- [x] **DONE** 9.2 **引入排期完整性回滚机制 (All-or-Nothing Rollback)**
    - [x] **DONE** 9.2.1 在全局排期完成后，增加完整性审计 (Integrity Audit) 阶段。
    - [x] **DONE** 9.2.2 扫描项目：若某项目同时需要 Dev 和 Test，但仅分配了其一（严重脱节的“半拉子工程”），则视为分配失败。
    - [x] **DONE** 9.2.3 触发回滚：自动撤销该项目已分配的所有资源，将档期人天释放回资源池。
- [x] **DONE** 9.3 **验证与交互更新**
    - [x] **DONE** 9.3.1 更新排期面板文案，展示“正在进行小批量优先级排期”与“审计与回滚校验”状态。
    - [x] **DONE** 9.3.2 执行编译并更新。

## 阶段十：极限产能收割与自适应调度 (Phase 10: Adaptive Matching & Capacity Harvesting)

- [x] **DONE** 10.1 **AI 引擎支持“解除封印”模式 (Relaxed Matching Mode)**
    - [x] **DONE** 10.1.1 在 `ai.ts` 的 Prompt 中增加强制指令：当进入补排模式时，彻底忽略 `skills` 标签，转为纯角色匹配（Role-only matching）。
- [x] **DONE** 10.2 **实现“三段式”收割调度流 (Three-Pass Workflow)**
    - [x] **DONE** 10.2.1 第一段：按批次执行技能优先排期（现有逻辑）。
    - [x] **DONE** 10.2.2 第二段：执行完整性审计回滚，释放无效占位的资源（现有逻辑）。
    - [x] **DONE** 10.2.3 第三段：**全量收割补排 (Harvest Pass)**。将所有剩余缺口项目和回滚释放的资源汇总，执行“解除封印”的批量 AI 调用，消除闲置。
- [x] **DONE** 10.3 **构建与发布验证**
    - [x] 10.3.1 执行全流程测试，验证“高优被回滚后，人力是否被低优迅速捡漏”。

## 阶段十一：Prompt 增强与日历感知 (Optimization Phase 1 - Solution C)

- [x] **DONE** 11.1 **资源信息摘要增强**：在 `suggestAllocationsForBatch` 传给 AI 的资源对象中，增加 `scheduleSummary` 字段，描述该员工在当前排期窗口内的已占用时间段，让 AI 感知“哪里有空档”。
- [x] **DONE** 11.2 **强制贪心指令注入**：在系统 Prompt 中加入「资源利用率惩罚」逻辑，明确告知 AI：留下闲置资源是失败的，必须最大化总 MD 分配。

## 阶段十二：并行排期支持与循环收割 (Optimization Phase 2 - Solution B.1 & B.3)

- [x] **DONE** 12.1 **支持百分比并行 (B.1)**：重构 `findNextAvailableDate` 为 `findEarliestAvailableDate`。不再简单找 `max(endDate)`，而是计算每一天的「已占用百分比」，只要「当日已用 + 本次建议 <= 100%」即可排入，支持 50%+50% 并行。
- [x] **DONE** 12.2 **循环补排至收敛 (B.3)**：将 PASS 3 的收割逻辑改为 `while` 循环，只要本轮有新增分配且资源未耗尽，就持续迭代（上限 3 轮），解决 AI 建议保守的问题。

## 阶段十三：回滚重排与填充优先级 (Optimization Phase 3 - Solution B.2 & B.4)

- [x] **DONE** 13.1 **回滚项目重试队列 (B.2)**：PASS 2 审计回滚的项目进入 `retryQueue`。在 PASS 3 开始前，先对这些项目进行一次「Dev+Test 联合补排」。
- [x] **DONE** 13.2 **填充优先级逻辑 (B.4)**：收割阶段的请求按优先级梯度发送，确保高优项目的残余缺口（残余工时）比低优项目更早触达 AI。

## 阶段十四：时间槽位矩阵重构 (Optimization Phase 4 - Solution A)

- [x] **DONE** 14.1 **DailySlot 矩阵建模**：彻底重构资源可用性模型，建立以「人/天」为单位的百分比矩阵。
- [x] **DONE** 14.2 **AI 窗口协议对接**：传给 AI 标准的 `availableWindows` 阵列，实现像素级的资源匹配。
## 阶段十一：资源利用率深度优化 - 时间槽位与循环收敛 (Phase 11: Deep Utilization Optimization)

### P0 - Prompt 贪心策略（零逻辑改动，立即见效）

- [x] **DONE** 11.1 **Prompt 贪心指令强化 (Greedy Prompt Enhancement)**
    - [x] **DONE** 11.1.1 在 AI 系统消息中注入强制贪心指令：`MUST allocate ALL idleMd`，惩罚留余量行为，要求 AI 尽量将所有闲置资源分配殆尽。
    - [x] **DONE** 11.1.2 Prompt 中传入资源的已排日历摘要（如 `已排: 04-01~04-10 @项目A, 空闲: 04-11~04-30`），让 AI 做出时间感知的决策，避免盲目建议导致 `scheduleMaxDate` 截断。
    - [x] **DONE** 11.1.3 AI 调用时按优先级分梯度传入项目：先传 P0 项目让 AI 分完，再传 P1 项目，避免 AI 在单次调用中"均摊"资源给低优项目。

### P1 - 并行排期修复与循环补排（核心逻辑改造）

- [x] **DONE** 11.2 **修复 `findNextAvailableDate` 支持并行排期 (Parallel Scheduling Fix)**
    - [x] **DONE** 11.2.1 当 `allocationPercentage < 100` 时，不再等前一个项目结束才开始下一个。改为检查资源当日已用百分比之和，只要 `已用 + 本次 <= 100` 即可从当天开始，实现真正的多项目并行。
    - [x] **DONE** 11.2.2 新增 `getResourceDailyUsage(resourceId, date, currentAllocations)` 工具函数，返回指定资源在指定日期的已占用百分比总和。

- [x] **DONE** 11.3 **PASS 3 循环补排直到收敛 (Iterative Harvesting Until Convergence)**
    - [x] **DONE** 11.3.1 将当前单次全局补排改为 `while` 循环：每轮调用 AI 后 `applySuggestions`，重新计算 gaps & idle，直到满足退出条件。
    - [x] **DONE** 11.3.2 退出条件：① gaps 为空 ② idle 为空 ③ AI 返回空数组（无法继续优化）④ 达到最大轮次（3 轮）。
    - [x] **DONE** 11.3.3 每轮循环前重新构建项目缺口列表，按优先级排序，确保高优项目残余缺口始终优先被填充。

### P2 - 回滚重排与填充优先级（消除浪费）

- [x] **DONE** 11.4 **回滚后立即重排机制 (Retry After Rollback)**
    - [x] **DONE** 11.4.1 PASS 2 回滚的项目不直接丢弃，加入 `retryQueue`。
    - [x] **DONE** 11.4.2 在 PASS 3 之前，对 `retryQueue` 中的项目执行一次完整的 dev+test 联合排期（此时资源池已包含回滚释放的余量），优先恢复被回滚的高优项目。

- [x] **DONE** 11.5 **填充优先级排序 (Gap-Fill Priority Ordering)**
    - [x] **DONE** 11.5.1 PASS 3 全局补排时，项目缺口列表严格按优先级（DB ID 自增序）排序传给 AI。
    - [x] **DONE** 11.5.2 Prompt 中显式标注"第 1 个项目优先级最高，必须优先满足"，避免 AI 均摊。

### P3 - 时间槽位矩阵（架构级优化，接近理论最优）

- [x] **DONE** 11.6 **引入资源日历槽位矩阵 (Resource Calendar Slot Matrix)**
    - [x] **DONE** 11.6.1 定义 `DailySlot` 数据结构：`{ date, totalCapacity, usedCapacity, available }`，为每个资源在排期窗口内生成完整的每日可用百分比数组。
    - [x] **DONE** 11.6.2 实现 `buildResourceCalendar(resources, allocations, rangeStart, rangeEnd)` 函数，遍历现有分配填充槽位占用。

- [x] **DONE** 11.7 **基于槽位的智能起止日期计算 (Slot-Aware Date Calculation)**
    - [x] **DONE** 11.7.1 实现 `findAvailableSlotWindow(resourceId, calendar, neededMd, percentage)` 函数：在日历矩阵中寻找连续 N 天 `available >= percentage` 的最早窗口。
    - [x] **DONE** 11.7.2 替换当前 `findNextAvailableDate`，使排期引擎能感知真实的每日空闲分布。

- [x] **DONE** 11.8 **传递可用时间窗口给 AI (Availability Windows in Prompt)**
    - [x] **DONE** 11.8.1 将资源信息从 `{id, name, idleMd}` 升级为 `{id, name, availableWindows: [{from, to, dailyAvailable}]}`，让 AI 做出时间对齐的精准建议。
    - [x] **DONE** 11.8.2 AI 返回结构增加 `suggestedStartDate` 字段，减少 JS 层的日期推算偏差。

- [x] **DONE** 11.9 **验证与度量 (Validation & Metrics)**
    - [x] **DONE** 11.9.1 排期完成后，输出全局利用率统计：`总可用人天 / 总已排人天 = 利用率 %`，作为排期质量评分展示在大盘上。
    - [x] **DONE** 11.9.2 执行 `npm run build` 确保所有改动通过编译。

    ## 阶段十五：UI 概览增强 (Phase 15: UI Summary Enhancements)

    - [x] **DONE** 15.1 **已排项目汇总看板**：在排期大盘新增“已排项目”区块，展示开发/测试均已到位的项目及其负责人与参与人。