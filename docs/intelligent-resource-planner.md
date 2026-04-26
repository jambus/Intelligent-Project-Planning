# 智能研发资源排期系统 (Intelligent Resource Planner) - 规划文档

**⚠️ 架构与设计维护说明 (For AI Agents):**
> 任何关于本项目的功能变更、架构调整（如更换数据源、修改核心业务流程）都**必须**同步更新至本文档，确保它始终作为项目设计的 Single Source of Truth。

## 一、 产品需求文档 (PRD)

### 1.1 项目背景与目标
在软件开发过程中，项目经理和资源主管经常面临多项目并行、资源瓶颈难以识别的痛点。尤其是在季度规划时，开发、测试等研发资源的分配需要平衡项目优先级和人员技能。本项目旨在打造一款 AI 辅助的资源排期与预警系统，帮助团队合理调配资源，提前发现过载风险。

### 1.2 目标用户
*   **项目经理 (PM) / 敏捷教练 (Scrum Master)**：负责项目整体排期，监控资源使用情况。
*   **研发主管 / 测试主管 (Resource Managers)**：管理团队成员技能标签，分配具体人员到项目。

### 1.3 核心业务流程
1.  **数据导入 (Manual File Import)**：用户在插件的“项目管理”页面（Projects）通过手动上传 CSV 或 Excel (.xlsx) 文件来导入待排期项目列表。文件包含项目名称、优先级、负责人、预计开发和测试人天等核心信息。
2.  **资源图谱**：主管在插件的独立管理页（Options Page）中维护团队成员在不同产品域的开发/测试能力标签及当前可用性，数据存储在本地。
3.  **智能排期**：在季度规划期间，PM 在插件看板一键触发 AI 排期，插件直接调用大模型 API（如 OpenAI），根据优先级规则、项目工时预估、资源技能标签和当前负荷，推荐排期方案。
4.  **实时预警 (Jira 联动)**：当 PM 浏览 Jira 页面时，插件的 Content Script 实时读取本地缓存的排期数据，在页面上无侵入式注入并提示当前项目指派人的资源超载/闲置风险。

### 1.4 核心功能模块 (Core Features)
*   **全局仪表盘 (Dashboard)**：作为插件的 Options 首页，显示当前资源分配概览，并提供一键触发 AI 排期的入口。
*   **项目管理 (Project Management)**：独立页面，展示所有待排期项目的详细清单（项目名、负责人、起止日期、评估工时等），并支持按优先级从高到低自动排序。
*   **智能排期引擎 (AI Scheduler)**：纯前端组装 Prompt，支持用户配置自定义 API Base URL 和模型名称，兼容 OpenAI 协议（如 DeepSeek, Qwen, Claude 等）。
*   **资源图谱与技能管理**：本地化的人员画像管理。
*   **本地文件导入 (CSV/XLSX Import)**：支持通过手动上传 CSV 或 Excel 批量导入项目，系统会自动执行全量覆盖更新。
*   **Jira 预警机制 (Alerts)**：对资源超量分配进行红绿灯预警，并在 Jira 原生 Issue 页面中悬浮展示。

---

## 二、 系统架构图 (Local-first Chrome Extension Architecture)

本系统采用纯客户端（Local-first）架构，所有数据存储在用户的浏览器本地缓存中，无独立后端服务器。

```mermaid
graph TD
    %% 外部系统
    LocalFiles[本地文件 CSV/Excel]
    Jira[Jira Cloud UI]
    LLM[AI 大模型服务 / OpenAI API]
    
    %% Chrome 插件内部架构
    subgraph ChromeExtension [Chrome 浏览器插件环境]
        
        %% UI 视图层
        subgraph Views [视图层 (React)]
            OptionsPage[全局仪表盘 (Dashboard)]
            ProjectMgmt[项目管理 (Projects)]
            ResourcesMgmt[人员管理 (Resources)]
            SettingsPage[系统设置 (Settings)]
            Popup[快捷操作面板 (Popup)]
            ContentScript[Jira 页面 UI 注入 (Content Script)]
        end
        
        %% 后台服务层
        subgraph Background [后台进程 (Service Worker)]
            ImportEngine[本地文件导入引擎]
            AIEngine[AI 排期调度引擎]
        end
        
        %% 本地数据层
        subgraph LocalStorage [浏览器本地存储]
            IndexedDB[(IndexedDB - 大容量关系数据)]
            ChromeStorage[(Chrome.storage.local - 配置项)]
        end
        
    end
    
    %% 内部流转
    Views <--> LocalStorage
    Views <--> Background
    Background <--> LocalStorage
    
    %% 外部交互
    Views -- 触发导入 --> ImportEngine
    ImportEngine -- 读取内容 --> LocalFiles
    ContentScript -.-> Jira
    AIEngine <--> LLM
```

---

## 三、 技术设计文档 (Technical Design)

### 3.1 技术栈选择 (Tech Stack)
*   **核心框架**：React 19 + Vite 4 + CRXjs (现代 Chrome 插件构建工具)。
*   **UI 组件库**：Tailwind CSS v3 (轻量级样式), Lucide React (图标)。
*   **数据解析**: `xlsx` 库，用于在浏览器端解析 CSV 和 Excel 文件。
*   **本地数据库**：Dexie.js (对 IndexedDB 的极简封装，支持类似于关系型数据库的查询操作)，用于存储结构化的项目和资源数据。
*   **状态与配置管理**：`chrome.storage.local` 用于安全存储用户配置、OpenAI API Key 等。
*   **AI 接口**：直接使用 Fetch API 调用 OpenAI 或其他兼容的 LLM REST API (如 DeepSeek, Qwen 等)，支持自定义 Base URL 和模型名称。

### 3.2 核心数据模型 (IndexedDB Schema - Dexie.js v2)
数据结构在前端的 IndexedDB 中定义。
*   `Settings`: 存储配置（也可以直接放 `chrome.storage.local`）。
*   `Resources`: 研发人员表（包含姓名、角色、可用工时、能力标签 JSON）。
*   `Projects` (v2): 项目表，对齐导入文件的列（`name`, `businessOwner`, `priority`, `status`, `digitalResponsible`, `startDate`, `endDate`, `comments`, `devTotalMd`, `testTotalMd`）。
*   **导入样例 (Import Sample)**:
    | Project | Business Owner | Priority Proposal | Status | Digital Responsible | Start In | End In | Estimated Go-live time | Comments | Jira Epic Key | Total Dev MD | Total Test MD |
    | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
    | 618 Campaign digital capabilities optimization | Digital | Must Win | Design | Zac CAI | Apr | Jun | Jun | | COMMON | 10 | 5 |
    | Ingress Nginx Migration | Digital | Compliance | Development | Justin XU | | | May | | Ingress | 10 | 5 |
*   `Allocations`: 资源分配表（关联 Resource ID, Project ID，分配的开始-结束日期，投入工时比例）。

### 3.3 关键技术方案 (Key Technical Solutions)
#### 3.3.1 本地文件导入与项目管理
*   **覆盖策略**：用户在“项目管理”页面通过 `FileReader` 和 `xlsx` 库解析文件。为了保证排期的一致性，系统在每次导入时会执行 `db.projects.clear()`，实现数据的全量覆盖。
*   **优先级排序**：项目管理页面实现了智能排序逻辑，支持将 'High/Medium/Low' 或 'P0-P3' 等权重标签映射为数值，实现从高优先级到低优先级的自动列表呈现。

#### 3.3.2 安全的 AI 调用与精准排期
*   **API Key 存储**：引导用户输入其私有的 OpenAI API Key，并安全地存储在 `chrome.storage.local` 中（该存储空间不与网页共享，相对安全）。
*   **排期算法依赖**：前端组装 Prompt 时将导入的评估工时（`devTotalMd`, `testTotalMd`）直接喂给大模型，使得模型能够输出更合理的周期和投入占比（`allocationPercentage`）。

#### 3.3.3 Content Script 预警注入
*   插件的 Content Script 会监听页面 DOM 变化（特别是 Jira 的 `[data-testid="issue.views.field.user.assignee"]` 元素）。
*   当识别到具体的处理人姓名时，异步查询 IndexedDB 计算其当前所有进行中项目分配累加的负荷百分比。
*   将负荷情况以不侵入原有 DOM 结构的方式，在页面右下角以红/黄/绿悬浮卡片展示预警。
