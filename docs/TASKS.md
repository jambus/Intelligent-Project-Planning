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
    - [x] 6.4.2 更新 `docs/requirement.md` 的架构设计图与逻辑说明。

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

## 阶段十六：人员管理功能增强 (Phase 16: Resource Management Enhancements)

    - [x] **DONE** 16.1 **人员批量导入**：支持通过上传 CSV/Excel 文件批量录入团队成员。
    - [x] **DONE** 16.2 **导入模板下载**：在人员管理页面提供标准 CSV 模板下载。
    - [x] **DONE** 16.3 **人员数据导出**：支持将当前人力库一键导出为 CSV。

## 阶段十七：技能管理体系 (Phase 17: Skills Management System)

    - [x] **DONE** 17.1 **独立技能管理页**：新增 Skills 页面，支持业务领域能力与技术能力的分类展示。
    - [x] **DONE** 17.2 **技能标签 CRUD**：实现技能标签的新增与删除，并内置初始化常用标签。
    - [x] **DONE** 17.3 **数据持久化**：升级 IndexedDB Schema (v4) 以存储技能数据。
## 阶段十八：算法调优与反碎片化 (Phase 18: Algorithm Tuning & Anti-Fragmentation)

    - [x] **DONE** 18.1 **反碎片化指令注入**：在 Prompt 中明确禁止将项目拆解为 1-2 天的小碎片。
    - [x] **DONE** 18.2 **最小分配单元约束**：设定建议最小分配为 3 天，并要求 AI 保持负责人集中（1-2人）。
    ## 阶段十九：负责人锁定与明细深度匹配 (Phase 19: Lead Locking & Detailed Skill Matching)

    - [x] **DONE** 19.1 **关键负责人锁定**：在 Prompt 中增加强制指令，确保项目的 Tech Lead 和 Quality Lead 只要在库且有空，就必须被排入该项目。
    - [x] **DONE** 19.2 **任务明细关联匹配**：将 `Details Product DEV/TEST MD` 传给 AI，要求其根据明细中的产品/业务关键词，优先匹配具备相应技能标签的人员。
    - [x] **DONE** 19.3 **字段透传优化**：在 `Dashboard.tsx` 的所有排期 Pass 中增加负责人和明细字段的透传。

## 阶段二十：调度引擎性能与准确性优化 (Phase 20: Scheduling Engine Optimization)

> 来源：2026-05-09 代码审查，关联架构文档：`docs/requirement.md § 3.3.8`

### P0 — 立即执行（性能，直接影响使用体验）

- [x] **DONE** **20.1 [PERF-01] 增量矩阵更新，消除 `applySuggestions` 内循环全量 `runAudit`**
    - [x] 20.1.1 将 `DailySlot` 矩阵以 `Map<resourceId, DailySlot[]>` 形式在调度会话内存中共享维护。
    - [x] 20.1.2 `applySuggestions` 应用每条建议后，仅对受影响资源做增量 slot 更新，不再触发全量 `runAudit`。
    - [x] 20.1.3 `runAudit` 在 PASS 间汇总审计时仍可调用，但频率从「每条建议」降为「每个 PASS 结束时」。
    - [x] 20.1.4 执行 `npm run build` 验证通过，排期结果与优化前行为一致。

- [x] **DONE** **20.2 [PERF-02] `HOLIDAYS` / `SPECIAL_WORKDAYS` 改为 `Set<string>` O(1) 查找**
    - [x] 20.2.1 在 `dateUtils.ts` 模块初始化时，将 `HOLIDAYS` 和 `SPECIAL_WORKDAYS` 数组转为 `Set<string>`。
    - [x] 20.2.2 `isWorkingDay` 中的 `.includes()` 调用改为 `.has()`。
    - [x] 20.2.3 `updateHolidaysConfig` 函数同步维护 Set 引用。
    - [x] 20.2.4 执行 `npm run build` 验证通过。

### P1 — 近期执行（准确性 & 中等性能）

- [x] **DONE** **20.3 [PERF-03] 消除 `generateResourceCalendar` 重复构建**
    - [x] 20.3.1 将 calendar 矩阵作为调度会话共享状态（与 PERF-01 的 Map 合并），`findEarliestFitDate` 直接复用已有矩阵，不再独立构建。
    - [x] 20.3.2 执行 `npm run build` 验证通过。

- [x] **DONE** **20.4 [ACCURACY-01] 修正测试准入日期为开发跨度中点（对齐 PRD § 3.3.3）**
    - [x] 20.4.1 修改 `calculateTestStartDate`：遍历所有 dev 分配，取 `earliest_start` 和 `latest_end`。
    - [x] 20.4.2 计算中点日期 `midpoint = earliest_start + (latest_end - earliest_start) / 2`，向前取最近工作日。
    - [x] 20.4.3 以中点日期作为测试最早准入，替代当前的「最早开发开始日期」逻辑。
    - [x] 20.4.4 执行 `npm run build` 验证，测试分配 `startDate` >= dev 时间跨度中点。

- [x] **DONE** **20.5 [ROBUST-01] AI 返回结果增加 Schema 验证与过滤**
    - [x] 20.5.1 在 `services/ai.ts` 的 `extractJsonArray` 返回前，过滤不合法条目。
    - [x] 20.5.2 合法范围：`projectId > 0`、`resourceId > 0`、`allocatedMd >= 1`、`allocationPercentage ∈ [1, 200]`。
    - [x] 20.5.3 非法条目以 `console.warn('[AI Schema] invalid entry:', entry)` 输出。
    - [x] 20.5.4 执行 `npm run build` 验证通过。

### P2 — 计划执行（健壮性 & 边界准确性）

- [x] **DONE** **20.6 [ROBUST-02] 用 `AbortController` 实现 fetch 即时中断**
    - [x] 20.6.1 在 `SchedulingContext` 中增加 `abortControllerRef`，每次排期开始时创建新实例。
    - [x] 20.6.2 `callAI` 函数签名增加 `signal?: AbortSignal` 参数，传入 `fetch` 的第二个参数。
    - [x] 20.6.3 `stopScheduling` 在设置 `stopRequestedRef` 同时调用 `abortControllerRef.current?.abort()`。
    - [x] 20.6.4 处理 `AbortError`，与 `MANUAL_STOP` 同路径处理，不弹出错误弹窗。
    - [x] 20.6.5 执行 `npm run build` 验证通过。

- [x] **DONE** **20.7 [ACCURACY-02] 放宽 PASS 2 回滚条件，覆盖 dev 严重欠配场景**
    - [x] 20.7.1 在现有回滚条件基础上，增加补充条件：`dev 已排 < devTotalMd × 0.5 && testGap === testTotalMd`。
    - [x] 20.7.2 执行 `npm run build` 并手动验证：dev 仅分配 30% 且 test 完全未排的项目可被正确回滚。

- [x] **DONE** **20.8 [ACCURACY-03] Cap 公式统一精度，仅在最终写入时取整**
    - [x] 20.8.1 `runAudit` 中 `devGap`、`testGap`、`idleMd` 内部计算保留浮点数。
    - [x] 20.8.2 `applySuggestions` 内 `finalMd` 计算时对浮点 cap 取 `Math.ceil` 后再与 1 比较。
    - [x] 20.8.3 写入 IndexedDB 和 UI 显示前统一执行 `Math.round`。
    - [x] 20.8.4 执行 `npm run build` 验证通过。

### P3 — 酌情执行（Token 成本 & 低频性能）

- [x] **DONE** **20.9 [COST-01] 裁剪发送 AI 的资源 JSON，减少 Token 消耗**
    - [x] 20.9.1 `scheduleSummary` 字段超过 200 字符时，截断为最近 3 个 Free Window 信息。
    - [x] 20.9.2 确认 dev pass 只传开发人员、test pass 只传测试人员（当前外层已过滤，确认一致）。
    - [x] 20.9.3 执行 `npm run build` 验证通过。

- [x] **DONE** **20.10 [PERF-04] `getWorkingDays` 预计算，避免重复逐日遍历**
    - [x] 20.10.1 调度开始时，预先生成排期窗口内的工作日 `Set<string>`（`workingDaySet`）。
    - [x] 20.10.2 `getWorkingDays` 接受可选的 `workingDaySet` 参数，命中时直接过滤计数而非逐日调用 `isWorkingDay`。
    - [x] 20.10.3 执行 `npm run build` 验证通过，工作日计数结果与原实现一致。

## 阶段二十一：数据持久化与交互健壮性加固 (Phase 21: Persistence & UI Robustness)

### P0 — 关键修复 (Persistence)

- [x] **DONE** **21.1 [FIX-01] 修复 Dexie Schema 演进导致的删表 Bug**
    - [x] 21.1.1 在 `db/index.ts` 的所有版本定义中显式包含全量 Table 定义，防止升级时丢表。
- [x] **DONE** **21.2 [FIX-02] 稳定扩展 ID，保护 Origin 存储**
    - [x] 21.2.1 从私钥提取公钥并配置到 `manifest.json` 的 `key` 字段，确保 Extension ID 恒定。

### P1 — 体验优化 (UI/UX)

- [x] **DONE** **21.3 [UI-01] 抽象化通用 ErrorModal 组件**
    - [x] 21.3.1 封装 `ErrorModal.tsx`，支持结构化报错展示。
- [x] **DONE** **21.4 [UI-02] 全系统报错反馈升级**
    - [x] 21.4.1 在项目、人员、技能导入入口全面集成 `ErrorModal`。
    - [x] 21.4.2 确保报错同步输出至 Console 详细日志。

### P2 — 文档归档 (Docs)

- [x] **DONE** **21.5 [DOC-01] 更新 PRD 与 Changelog**
    - [x] 21.5.1 同步 3.3.9 和 3.3.10 章节至 `requirement.md`。
    - [x] 21.5.2 更新 `CHANGELOG.md` 归档 v1.0.3 变更。

## 阶段二十二：v1.0.4 迭代开启 (Phase 22: Version 1.0.4 Initialization)

### P0 — 版本基座 (Infrastructure)

- [x] **DONE** **22.1 [BUMP-01] 全局版本号升级至 1.0.4**
    - [x] 22.1.1 更新根目录 `package.json`。
    - [x] 22.1.2 更新 `extension/package.json` 及其 zip/publish 脚本。
    - [x] 22.1.3 更新 `extension/manifest.json`。
    - [x] 22.1.4 改进 `Layout.tsx` 侧边栏版本显示：改为通过 `chrome.runtime.getManifest()` 动态获取，消除硬编码。
- [x] **DONE** **22.2 [LOG-01] 初始化 v1.0.4 Release Note**
    - [x] 22.2.1 在 `CHANGELOG.md` 中新增 v1.0.4 占位符。

## 阶段二十三：Jira 管理与工时排期扣减 (Phase 23: Jira Management & Hours Deduction)

### P0 — 核心功能 (Core Features)

- [x] **DONE** **23.1 [JIRA-01] 数据模型与 API 扩展**
    - [x] 23.1.1 升级 Dexie DB Schema 至 `version(6)`。
    - [x] 23.1.2 在 `Project` 模型中新增 `devLoggedMd` 和 `testLoggedMd` 字段。
    - [x] 23.1.3 在 `services/jira.ts` 新增 `syncEpicLoggedHours` 批量拉取逻辑，根据 Issue Type 智能区分研发与测试。
- [x] **DONE** **23.2 [JIRA-02] UI 交互与路由**
    - [x] 23.2.1 创建 `JiraSync.tsx` 页面，展示带 Epic Key 的项目并提供一键同步。
    - [x] 23.2.2 配置路由并在左侧边栏增加「Jira 管理」入口。
- [x] **DONE** **23.3 [JIRA-03] 排期动态扣减**
    - [x] 23.3.1 更新 `SchedulingContext.tsx`，在计算 `devGap` 和 `testGap` 时动态扣减已录入工时。
    - [x] 23.3.2 同样更新大盘仪表盘 (`Dashboard.tsx`)，让可视化审计表也能反映净缺口。
- [x] **DONE** **23.4 [DOC-01] 文档归档**
    - [x] 23.4.1 更新 `requirement.md` 的 3.3.12 章节。
    - [x] 23.4.2 更新 `CHANGELOG.md` 补充新特性。

## 阶段二十四：Jira 同步范围时间窗口限制 (Phase 24: Jira Sync Time Window Restriction)

### P0 — 核心功能 (Core Features)

- [x] **DONE** **24.1 [JIRA-04] Epic 创建时间过去一年限制**
    - [x] 24.1.1 在 `services/jira.ts` 的模糊搜索 JQL 中已添加 `created >= -365d` 的限制（第 124-126 行）。当前架构已统一为模糊搜索路径（所有 Epic Key 均通过 `summary ~ "key*"` 查询），不再区分 `standardKeys` 和 `fuzzyNames` 两条路径。
    - [x] 24.1.2 编译验证通过。
    - [x] 24.1.3 PRD `docs/requirement.md` § 3.3.12 第 6 条已包含此功能说明。

## 阶段二十五：Jira 工时扣减与排期逻辑优化 (Phase 25: Jira Hours Deduction & Scheduling Logic Enhancement)

> 来源：2026-05-24 代码审计，关联架构文档：`docs/requirement.md § 3.3.12`

### P0 — 已完成功能归档 (Completed Features Archive)

- [x] **DONE** **25.1 [JIRA-SYNC] Jira 智能模糊搜索与工时聚合**
    - [x] 25.1.1 模糊搜索 Epic：通过 `summary ~ "key*"` + `issuetype in (Epic, "长篇故事")` + `created >= -365d` 实现。
    - [x] 25.1.2 多 Epic 合并累加：同一用户输入关键字匹配多个 Epic 时，自动累加所有子任务工时。
    - [x] 25.1.3 防重防漏机制：Epic 节点取 `timespent`，子 Issue 取 `aggregatetimespent`，防止重复计算。
    - [x] 25.1.4 跨项目工时兜底：Phase 2 工时聚合不拼 `project in (...)`，防止跨项目子任务工时遗漏。
    - [x] 25.1.5 自定义工时折算率：`totalLoggedMd = totalLoggedSeconds / 3600 / hoursPerManDay`（默认 6 小时/天）。

- [x] **DONE** **25.2 [DEDUCTION] Dev-First 排期扣减引擎**
    - [x] 25.2.1 统一字段模型：使用 `totalLoggedMd` 单一字段（`devLoggedMd`/`testLoggedMd` 已废弃）。
    - [x] 25.2.2 扣减公式实现：`effectiveDevMd = max(0, devTotalMd - totalLoggedMd)`，溢出扣减测试 `effectiveTestMd = max(0, testTotalMd - max(0, totalLoggedMd - devTotalMd))`。
    - [x] 25.2.3 排期引擎集成：`SchedulingContext.runAudit()` 在 PASS 1/2/3 中均使用扣减后的净缺口。
    - [x] 25.2.4 大盘展示对齐：`Dashboard.runAuditForUI()` 使用相同公式，确保展示与排期计算一致。

### P1 — 待优化项 (Planned Improvements)

- [x] **DONE** **25.3 [JIRA-05] 分类工时扣减（按角色区分开发/测试）**
    - [x] 25.3.1 增加 `jiraTestIssueTypes` 设置项区分 Dev/Test。
    - [x] 25.3.2 优化 `syncEpicLoggedHours()` 返回精确分离的 `devLoggedMd` 和 `testLoggedMd`。
    - [x] 25.3.3 更新 `runAudit()` 扣减逻辑：新增无溢出的精确扣减公式，并在无测试工时时回退至 Dev-First 溢出模式。

- [x] **DONE** **25.4 [JIRA-06] 同步进度与错误反馈增强**
    - [x] 25.4.1 在 JiraSync 页面增加项目维度的批量同步与进度条。
    - [x] 25.4.2 同步失败时在页面统一汇总展示具体的 Epic Key 与错误原因。
    - [x] 25.4.3 支持选择性同步，新增 Checkbox 单选与全选。

- [x] **DONE** **25.5 [JIRA-07] 同步数据缓存与增量更新**
    - [x] 25.5.1 Project 模型新增 `lastJiraSyncAt` 字段，JiraSync 页面展示最近同步时间。
    - [x] 25.5.2 引入同步频率拦截，30分钟内重复请求给出警告提示，防范 API 超限。

## 阶段二十六：动态排期与模糊匹配兜底 (Phase 26: Dynamic Scheduling & Fuzzy Fallback)

### P0 — 核心能力与健壮性

- [x] **DONE** **26.1 [SCHEDULING-01] 动态并发调度控制 (Dynamic Batch Size)**
    - [x] 26.1.1 在 `Settings.tsx` 中新增 `aiBatchSize` 配置，默认 3。
    - [x] 26.1.2 改造 `SchedulingContext.tsx` 动态读取此参数并应用到 `PASS 1` 的 mini-batches 中。
    - [x] 26.1.3 支持大型团队全局统筹与小型精细排期的动态权衡。

- [x] **DONE** **26.2 [JIRA-08] Jira 模糊/精确双轨智能匹配修正**
    - [x] 26.2.1 修复正则匹配过度干预问题，使得带有中括号的业务代号（如 `[TRP-123]`）能够回退走安全的 `summary ~ "key*"` 模糊检索，避免引发 Jira API 报错。
    - [x] 26.2.2 将精确 Issue Key（如纯字母数字 `PROJ-123`）增强为 `issueKey = "PROJ-123" OR summary ~ "PROJ-123*"` 双重匹配，保证 100% 覆盖率。
    - [x] 26.2.3 恢复内存级标题比对的截断逻辑 `replace(/^[\[\s]+/, '')`，完美适配含右中括号的业务标识。

## v1.0.5 排期策略 Code Review 修复任务

### 逻辑问题修复
- [x] **27.1 Task 1: `focused` 模式 JS 硬兜底**
  - 在 `applySuggestions` 中增加 `focused` 模式的硬约束检查，仅保留第一个候选人。
- [x] **27.2 Task 2: `urgent` 模式 >100% 投入兼容**
  - 修改 `findEarliestFitDate` 逻辑，允许 `urgent` 模式突破 100% 空闲检查。
- [x] **27.3 Task 3: Prompt 中 `MANDATORY LEADS` 与 `focused` 语义冲突**
  - 修改 `DEFAULT_SCHEDULING_PROMPT` 规则，消除冲突。
- [x] **27.4 Task 4: PASS 0 `runAudit` 空项目调用语义冗余**
  - 优化 PASS 0 中的资源空闲度获取方式。

### 性能优化
- [x] **27.5 Task 5: `updateResourceCalendar` 嵌套循环优化**
  - 消除 O(slots × days) 的跨周遍历。
- [x] **27.6 Task 6: `applySuggestions` 内 slot 线性搜索优化**
  - 将 `resCalendar.find` 升级为 Map O(1) 查找。
- [x] **27.7 Task 7: `getResourceCalendar` 重复 filter 优化**
  - 复用 `currentAllocs.filter`。

## 阶段二十八：v1.0.5 排期精准度与健壮性加固 (Phase 28: Precision & Robustness Hardening)

> 来源：2026-05 排期逻辑代码审查，关联架构文档：`docs/requirement.md § 3.3.13`

### P0 — 核心引擎精准度 (Core Engine Precision)

- [x] **DONE** **28.1 [DATE-01] 修复时区导致的工作日错位**
    - [x] 28.1.1 在 `utils/dateUtils.ts` 新增 `formatLocalDate(date)`，基于本地 `getFullYear/getMonth/getDate` 生成 `YYYY-MM-DD`，替代会因 UTC 偏移跨日的 `toISOString().split('T')[0]`。
    - [x] 28.1.2 `isWorkingDay`、`getWorkingDays`、`calculateEndDate` 及 `SchedulingContext` 全链路日期键统一改用 `formatLocalDate`。
- [x] **DONE** **28.2 [DATE-02] 排期前动态加载节假日配置**
    - [x] 28.2.1 新增 `loadHolidaysConfig()`，从 `db.settings` 的 `holidays`/`specialWorkdays` 读取并调用 `updateHolidaysConfig`，失败回退默认值。
    - [x] 28.2.2 `handleGenerateSchedule` 在构建 `workingDaySet` 前 `await loadHolidaysConfig()`，确保用户自定义假期参与排期计算。
- [x] **DONE** **28.3 [LOOP-01] `calculateEndDate` 死循环保护**
    - [x] 28.3.1 用带 `MAX_ITERATIONS` 上限的有界循环替换 `while(true)`，防止极端配置（如全部为节假日）导致卡死。
- [x] **DONE** **28.4 [AUDIT-01] 统一缺口计算与累计取整**
    - [x] 28.4.1 新增 `utils/audit.ts` 的 `computeProjectGaps`，作为 `SchedulingContext.runAudit` 与 `Dashboard.runAuditForUI` 共享的纯函数缺口计算器。
    - [x] 28.4.2 人天累计全程保留浮点精度，仅在最终展示/写入时统一 `Math.round`/`Math.ceil`，消除逐条取整带来的累计误差。
- [x] **DONE** **28.5 [LEAVE-01] 资源请假日期纳入排期**
    - [x] 28.5.1 `getResourceCalendar` 读取资源 `unavailableDates`，命中当日产能置 0，避免在请假日排入工作。
- [x] **DONE** **28.6 [ACCURACY-04] 越界 MD 重算顺序修正**
    - [x] 28.6.1 将 `endDate` 越界截断（`> scheduleMaxDate`）提前到 `actualWorkingDays/actualMd` 重算之前，修正越界场景人天被高估的问题。
- [x] **DONE** **28.7 [PERF-05] `sharedMatrix.clear` 移出回滚循环**
    - [x] 28.7.1 PASS 2 回滚循环内不再每次 `clear()`，改为标记 `didRollback`，循环结束后按需清理一次，消除 O(n²) 重复重建。

### P1 — 健壮性与体验 (Robustness & UX)

- [x] **DONE** **28.8 [AI-01] AI 调用超时与解析健壮性**
    - [x] 28.8.1 `services/ai.ts` 增加 `AI_TIMEOUT_MS` 与 `AbortController` 超时，区分超时（中文报错）与外部主动中断（重新抛出）。
    - [x] 28.8.2 `extractJsonArray` 区分「无数组括号（视为空）」与「JSON 解析失败」，收紧 `allocationPercentage <= 100`，并防御 `data.choices[0].message.content` 缺失。
- [x] **DONE** **28.9 [JIRA-09] 同步进度与可配置 Epic Link 字段**
    - [x] 28.9.1 `JiraSync.handleSync` 增加逐项目进度展示与每个 Epic 维度的缺失工时错误汇总。
    - [x] 28.9.2 `services/jira.ts` 支持可配置 `customfield_xxxxx` 的 Epic Link 字段 ID，`Settings.tsx` 新增「Epic Link 自定义字段 ID」配置项（默认 `10014`）。
- [x] **DONE** **28.10 [DATA-01] 导入覆盖确认与删除级联清理**
    - [x] 28.10.1 项目/人员文件导入前，若已有数据则弹出 `confirm` 覆盖确认（清空并覆盖不可撤销）。
    - [x] 28.10.2 `deleteResource`/`deleteProject` 级联删除关联 `allocations`，消除孤儿排期记录。

### P2 — 文档归档 (Docs)

- [x] **DONE** **28.11 [DOC-02] 更新 PRD、Changelog 与 Agent 指南**
    - [x] 28.11.1 新增 PRD § 3.3.13 章节，归档上述精准度与健壮性加固。
    - [x] 28.11.2 `CHANGELOG.md` 新增 v1.0.5 条目；`AGENTS.md`/`CLAUDE.md` 补充本地日期、节假日加载、导入覆盖、级联删除等避坑提示。

## 阶段二十九：排期结果导出与导入 CSV (Phase 29: Schedule Export & Import CSV)

> 目标：排期完成后支持一键导出人员×周维度的排期结果 CSV，文件可直接用于手工编辑或重新导入。

### P0 — 导出功能 (Export)

- [x] **29.1 [EXPORT-01] 工具函数：`getWeekMonday`**
    - [x] 29.1.1 在 `utils/dateUtils.ts` 新增 `getWeekMonday(date: Date): Date`，返回给定日期所在周的周一（周一作为一周起始）。
    - [x] 29.1.2 使用 `formatLocalDate` 确保日期不受时区偏移影响。

- [x] **29.2 [EXPORT-02] 核心导出函数：`exportAllocationsToCSV`**
    - [x] 29.2.1 在 `services/fileImport.ts` 新增 `exportAllocationsToCSV()` 函数。
    - [x] 29.2.2 从 IndexedDB 读取所有 `allocations`、`resources`、`projects`。
    - [x] 29.2.3 对每条 allocation，按周拆分工作日：
        - 遍历 allocation 的日期范围，按周聚合
        - 计算每周内的工作日数 × allocationPercentage / 100 = 该周人天
        - 产品运维虚拟项目（负 ID）标记 `[运维]` 前缀
    - [x] 29.2.4 CSV 列定义：`人员,角色,项目,类型,周起始日,天数`
    - [x] 29.2.5 输出带 BOM (`\uFEFF`) 的 UTF-8 CSV，触发浏览器下载。
    - [x] 29.2.6 天数保留一位小数。

- [x] **29.3 [EXPORT-03] Dashboard 导出按钮**
    - [x] 29.3.1 在 `DashboardOverview.tsx` 中，排期完成状态（`currentStep === 4 && !isScheduling`）附近增加"导出排期 CSV"按钮。
    - [x] 29.3.2 按钮点击调用 `exportAllocationsToCSV()`。
    - [x] 29.3.3 图标使用 `lucide-react` 的 `Download` 图标。

- [x] **29.4 [EXPORT-04] i18n 支持**
    - [x] 29.4.1 `locales/zh.ts` 新增 `dashboard.exportSchedule: '导出排期'`。
    - [x] 29.4.2 `locales/en.ts` 新增 `dashboard.exportSchedule: 'Export Schedule'`。

### P1 — 导入功能 (Import)

- [x] **29.5 [IMPORT-01] 核心导入函数：`importAllocationsFromFile`**
    - [x] 29.5.1 在 `services/fileImport.ts` 新增 `importAllocationsFromFile(file: File)` 函数。
    - [x] 29.5.2 解析 CSV 表头，按列名匹配（复用 `findColumnIndex`）。
    - [x] 29.5.3 按 (人员名, 项目名, 类型) 分组，同组内按周起始日排序。
    - [x] 29.5.4 合并连续周为单条 allocation 记录：
        - `startDate` = 第一周周一
        - `endDate` = 最后一周周五（或最后一个工作日）
        - `allocationPercentage` = 反算（天数 / 该周工作日数 × 100），取组内中位值并四舍五入为整数
    - [x] 29.5.5 通过人员名匹配 `resources` 表的 `id`，项目名匹配 `projects` 表的 `id`。未匹配的行跳过并汇总警告。
    - [x] 29.5.6 导入前弹出确认弹窗（destructive：`db.allocations.clear()` + `bulkAdd`）。

- [x] **29.6 [IMPORT-02] Dashboard 或独立页面入口**
    - [x] 29.6.1 在 Dashboard 的导出按钮旁增加"导入排期"按钮（`Upload` 图标）。
    - [x] 29.6.2 触发文件选择器，支持 `.csv` / `.xlsx` 格式。
    - [x] 29.6.3 导入完成后刷新排期视图。

- [x] **29.7 [IMPORT-03] i18n 支持**
    - [x] 29.7.1 `locales/zh.ts` 新增 `dashboard.importSchedule: '导入排期'`。
    - [x] 29.7.2 `locales/en.ts` 新增 `dashboard.importSchedule: 'Import Schedule'`。

### P2 — 验证与文档 (Verification & Docs)

- [x] **29.8 [BUILD-01] 构建验证**
    - [x] 29.8.1 执行 `npm run build` 确保通过 TypeScript strict 编译。
    - [x] 29.8.2 手动验证：排期 → 导出 → 手工编辑 → 导入 → 结果一致。

- [x] **29.9 [DOC-01] 文档更新**
    - [x] 29.9.1 更新 `docs/requirement.md` 新增导出/导入章节。
    - [x] 29.9.2 更新 `CHANGELOG.md`。
### 新增特性 (v1.0.8 - 高级排期编辑与锁定)
- [x] **排期矩阵在线手工编辑**
  - 在 Schedule Details 页面，用户可直接点击空白或已有排期单元格，将其转换为 `<input>` 并进行直接编辑。
  - 通过 `updateWeeklyAllocation` 实现底层的精准覆盖、边界切分以及响应式 IndexedDB 事务。
  - 按下 `Enter` 或触发 `Blur` 自动触发保存操作，全局重绘矩阵与资源利用率大盘。
- [x] **新增排期行功能**
  - 在 Schedule Details 顶部操作区新增 `+ 新增排期` 按钮。
  - 支持通过弹窗快速指定人员、项目、目标周和投入人天，从而从无到有生成全新的排期矩阵行。
- [x] **排期换人功能**
  - 在所有视图（Resource / Project / Operations）下，排期矩阵行首的人员名称均转变为互动式的 `<select>` 下拉选择框。
  - 切换人员会自动将该项目下对应旧人员的分配无损转移至新人员名下。
- [x] **排期行锁定功能**
  - 排期行首新增 `Lock/Unlock` 切换图标（支持锁定/解锁当前行的排期）。
  - AI 排期的全量大清洗（一键排期）和项目失败回滚（完整性审计回滚）逻辑中，增加对 `isLocked` 为 `true` 的数据进行免疫保护。
  - 手工换人、调整或新增产生的排期数据自动继承对应行的锁定状态。

## 阶段三十：排期引擎利用率深度优化 (Phase 30: Scheduling Engine Utilization Deep Optimization)

> 来源：2026-06-15 测试数据分析，排期后利用率仅 38.7%（237.5 / 614 MD）。  
> 核心发现：17 名工程师完全空闲，11 个有工时的项目未被排入，根因为周独占约束 + 日期解析不兼容 + 大项目回滚浪费。

### P0 — 关键修复（预期利用率 39% → 70%+）

- [x] **30.1 [EXCL-01] 移除/放宽周独占约束 (Weekly Exclusivity Relaxation)**
    - [x] 30.1.1 在 `SchedulingContext.tsx` 的 `findEarliestFitDate` 中，移除 `assignedNonOpProjects` 阻塞逻辑：当前一个人同一周只能服务一个项目，即使仅占 50% 也锁死整周，导致另外 50% 完全浪费。
    - [x] 30.1.2 在 `applySuggestions` 的日期截断逻辑中，移除基于 `assignedNonOpProjects` 的 truncation — 允许同一人同一周内并行服务多个项目。
    - [x] 30.1.3 保留 `DailySlot.available` 百分比检查作为唯一产能约束（即只要当日剩余 ≥ 所需百分比即可排入）。
    - [x] 30.1.4 移除 `DailySlot` 结构中的 `assignedNonOpProjects` 字段及相关维护代码（`updateResourceCalendar` 中的 occupiedWeeks 逻辑、`getResourceCalendar` 中的 populate 逻辑）。
    - [x] 30.1.5 执行 `npm run build` 验证通过；手动对比排期结果，确认同一人可跨项目并行且无超 100% 分配。

- [x] **30.2 [DATE-03] 项目日期模糊解析 (Fuzzy Date Parsing)**
    - [x] 30.2.1 在 `services/fileImport.ts` 新增 `normalizeDateField(value: string, selectedYear?: number): string` 函数，支持以下格式转 ISO date：
        - `"Apr"` / `"April"` → `"2026-04-01"`
        - `"Q2"` / `"Q3"` → 季度首日 `"2026-04-01"` / `"2026-07-01"`
        - `"Jun (UAT done at the end of Jun)"` → 提取首个月份 → `"2026-06-01"`
        - `"March"` → `"2026-03-01"`
        - `"May"` → `"2026-05-01"`（end 字段自动取月末 `"2026-05-31"`）
        - 已有 ISO 格式 `"2026-04-01"` → 原样保留
    - [x] 30.2.2 在 `importProjectsFromFile` 中对 `startDate` 和 `endDate` 调用 `normalizeDateField`，确保入库时为有效 ISO 日期。
    - [x] 30.2.3 对 `endDate` 字段，当仅解析到月份时取该月最后一天（如 "Jun" → `"2026-06-30"`）。
    - [x] 30.2.4 执行 `npm run build` 验证通过；用测试 CSV 导入后确认项目日期均为有效 ISO 格式。

### P1 — 重要改进（避免大项目浪费 + 释放碎片容量）

- [x] **30.3 [ROLLBACK-01] 放宽 PASS 2 回滚条件 — 允许大项目部分排期**
    - [x] 30.3.1 在 PASS 2 完整性审计中，对 `endDate > scheduleMaxDate` 的项目（即项目交付周期超出排期窗口）跳过回滚判断，允许仅排 dev 而 test 延后。
    - [x] 30.3.2 新增判定条件：仅当项目 `endDate` 在排期窗口内（即完整可排）时才执行完整性审计回滚。
    - [x] 30.3.3 在 `rejectionReason` 中新增 `'partial_window'` 状态，表示"项目跨窗口，已部分排期"。
    - [x] 30.3.4 执行 `npm run build` 验证通过。

- [x] **30.4 [OPS-01] 产品运维改为百分比分摊模式**
    - [x] 30.4.1 当前 ops 按整天占位（`allocationPercentage = 100%`），即使只需 1 MD/月也占满一整天。改为：计算 `monthlyMd / totalWorkingDays × 100` 得出每日百分比，按分摊模式排入整月。
    - [x] 30.4.2 对于 `monthlyMd ≤ 5` 的小型 ops，改为集中排入 1-2 整天（现有逻辑），避免百分比过小（<5%）导致矩阵展示为 0。
    - [x] 30.4.3 对于 `monthlyMd > 5` 的大型 ops（如 OMS 24 MD/月），按 `24/21 ≈ 115% → cap at 100%` 分摊全月，效果等于该人全月全部归属 ops。此场景需提醒用户 ops 配置过大。
    - [x] 30.4.4 执行 `npm run build` 验证通过；对比运维占用前后的可用容量差异。

### P2 — 体验与准确性

- [x] **30.5 [WINDOW-01] 排期窗口建议与自动多月扩展**
    - [x] 30.5.1 在 Dashboard 一键排期前，若项目总需求 > 排期窗口总容量的 80%，弹出提示："当前需求 X MD 远超单月容量 Y MD，建议扩展排期范围至 N 个月"。
    - [ ] 30.5.2 提供"自动最优窗口"按钮：根据项目 `startDate`~`endDate` 的范围自动推荐 `startMonth`~`endMonth`。

- [x] **30.6 [TEAM-01] Scrum Team 约束诊断报告**
    - [x] 30.6.1 排期完成后，在 Dashboard 新增"约束诊断"折叠面板，展示：被 Scrum Team 约束阻止的项目 + 对应可用但被限制的人员列表。
    - [ ] 30.6.2 提供"一键放开至 all-in"的快捷操作，允许用户手动解除约束后重排。

### P3 — 验证与文档

- [x] **30.7 [BUILD-01] 全流程验证**
    - [ ] 30.7.1 使用 `testdata/` 中的测试数据执行完整排期流程，对比优化前后利用率。
    - [x] 30.7.2 执行 `npm run build` 确保通过。

- [x] **30.8 [DOC-01] 文档更新**
    - [ ] 30.8.1 更新 `docs/intelligent-resource-planner.md` 记录周独占移除、模糊日期解析等架构变更。
    - [x] 30.8.2 更新 `CHANGELOG.md`。
    - [ ] 30.8.3 更新 `AGENTS.md` / `CLAUDE.md` 中周独占相关的避坑提示（移除或标记为已废弃）。

## 阶段三十一：排期正确性与严格优先级重构 (Phase 31: Scheduling Correctness & Strict Priority)

### 优化目标

排期引擎按照以下字典序优化，后一级目标不得破坏前一级目标：

1. 保留锁定排期，满足角色、请假、团队边界、每人每日一个任务和每周最多三个项目等硬约束。
2. 所有项目从高优先级到低优先级排期。
3. 同一优先级使用文件导入顺序（数据库 ID）作为稳定的次级顺序。
4. 先最大化高优先级项目完成度，再提升全局资源利用率。
5. 使用剩余可行容量减少空闲资源。
6. 技能分、项目负责人和最早交付时间仅在前述目标得到满足后参与优化。

标准优先级顺序：

`Must Win > P0 > Compliance > High/P1/高 > Medium/P2/中 > Low/P3/低 > 未识别`

项目 `startDate` 作为最早开始硬约束。项目 `endDate` 暂作为期望日期，用户选择的排期区间始终是硬边界。

### 第一阶段：正确性基础

| ID | 状态 | 任务 | 验收标准 |
| --- | --- | --- | --- |
| SCH-01 | 已完成 | 明确并记录排期规则 | PRD 与本任务清单中的优先级、同级顺序和日期语义一致。 |
| SCH-02 | 已完成 | 建立回归测试框架 | `npm test` 稳定验证优先级、锁定排期保留和容量换算。 |
| SCH-03 | 已完成 | 在排期矩阵中保留锁定记录 | 全量重排仅删除未锁定记录，所有锁定记录均作为已占用容量载入。 |
| SCH-04 | 已完成 | 集中化并标准化优先级 | UI 和引擎共用同一工具，正确处理空格、大小写、中文和 P0-P3。 |
| SCH-05 | 已完成 | 修正月度容量语义 | `capacity` 表示每月可排整天比例；50% 资源在 20 个有效工作日的月份最多排 10 个完整工作日，每个已排日贡献 1 MD。 |

#### 第一阶段验收记录 - 2026-07-20

- 排期基础回归测试：3 项通过，0 项失败。
- SCH-05 语义校正：资源容量按月度整天额度扣减，自动排期记录始终使用 100% 整天投入。
- 2026-07-21 复验：20 个有效工作日的月份中，50% 资源月度额度为 10 个整天，不产生 0.5 MD/天的自动排期。
- TypeScript 与 Vite 生产构建：通过。
- 新增排期工具 ESLint 检查：通过。
- 扩展发布包已更新：`extension/release/irp-v1.0.10.zip`。
- 全仓库 ESLint 历史基线仍有 105 个错误和 2 个警告，主要是存量 `any`、React Fast Refresh 和 Hooks 问题，不在本阶段范围内。

### 第二阶段：排期架构与严格优先级

| ID | 状态 | 任务 | 验收标准 |
| --- | --- | --- | --- |
| SCH-06 | 待执行 | 抽取容量日历 | 日历构建是不依赖 React 和 Dexie 的纯函数模块。 |
| SCH-07 | 待执行 | 集中化约束判定 | 角色、团队、日期、每日任务和每周项目数限制共用同一入口。 |
| SCH-08 | 待执行 | 抽取纯排期引擎 | 不可变输入快照生成 `SchedulePlan`，计算期间不写数据库。 |
| SCH-09 | 待执行 | 按优先级组重排调度流程 | 每个优先级完成严格和跨团队放宽尝试后才进入下一级，优先级倒挂数为 0。 |

### 第三阶段：资源利用率优化

| ID | 状态 | 任务 | 验收标准 |
| --- | --- | --- | --- |
| SCH-10 | 待执行 | 扫描全部空闲碎片 | 一名资源可以向同一项目贡献多个不连续的可行时间窗口。 |
| SCH-11 | 待执行 | 改进候选资源排序 | 稀缺度和碎片适配度优先于 AI 分数、Lead 匹配和最早开始日期。 |
| SCH-12 | 待执行 | 实现同优先级公平分配 | 容量不足时，同优先级项目之间的分配稳定且可解释。 |
| SCH-13 | 待执行 | 新增剩余容量收敛 | 不移动高优先级排期的前提下，使用剩余容量填补可行缺口。 |

### 第四阶段：交付安全与总体验收

| ID | 状态 | 任务 | 验收标准 |
| --- | --- | --- | --- |
| SCH-14 | 待执行 | 原子化写入排期 | 成功计划使用一个 Dexie 事务写入，取消和失败不留下部分计划。 |
| SCH-15 | 待执行 | 新增排期审计指标 | 报告包含优先级倒挂、过载、可匹配空闲 MD 和各优先级完成率。 |
| SCH-16 | 待执行 | 同步 UI 与文档 | 展示顺序、原因标签、PRD 和开发指南与引擎行为一致。 |
| SCH-17 | 待执行 | 执行性能和回归验收 | 代表性数据集结果确定、无正确性回退，并记录资源利用率变化。 |

### 总体完成标准

- 优先级倒挂数为 0。
- 资源过载数为 0。
- 锁定排期保持不变。
- 相同输入产生完全相同的排期。
- 存在项目缺口时，每个剩余空闲窗口都有可解释的原因。
- 自动化测试、生产构建和 ZIP 打包全部通过。
