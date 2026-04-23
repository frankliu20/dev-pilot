[English](README.md) | [中文](README.zh-CN.md)

# Dev Pilot

> ⚠️ **状态：实验性** — 本项目处于早期 alpha 阶段。API、命令和配置格式可能随时变更。

**你的私人 AI 工程师团队。** 给它一个 GitHub Issue — 它自动分析、编码、测试，然后提交 PR。你只需审查和合并。

Dev Pilot 将 Claude Code 打造成全自主开发流水线。你不再需要亲自写代码，而是管理一支 AI 智能体团队，由它们完成从理解需求到交付 PR 的全部流程。

## 为什么选择 Dev Pilot？

大多数 AI 编码工具只能帮你更快地写代码。Dev Pilot 更进一步 — 它**替代整个开发内循环**：

- 🎯 **Issue 进，PR 出** — 给它一个 GitHub Issue URL，返回一个经过测试和审查的 Pull Request。
- 🔄 **天然并行** — 每个 Issue 运行在独立的 git worktree 中。同时分配多个 Issue，全部并行执行。
- 🤖 **自动修复 CI** — PR 监视器监控 CI 失败，读取日志，自动推送修复。
- 🎛️ **掌控全局** — 实施前审批计划，选择测试策略，合并前审查。AI 绝不会在没有你确认的情况下合并。
- 📊 **实时仪表盘** — 在一个界面查看所有 Issue、PR、任务和待决策项。AI 需要你的输入时即时通知。

## 快速开始

```bash
git clone https://github.com/frankliu20/dev-pilot.git && cd dev-pilot
node init.js                    # 引导设置工作区路径 + GitHub 仓库 (owner/repo)
```

`init.js` 会创建 `~/.claude/pilot.yaml` 配置文件并安装命令/智能体。你可以随时查看和调整 — 详见[配置指南](docs/configuration.md)。

```bash
# 可选：启动仪表盘
cd dashboard && npm install && npm run dev
```

然后在 Claude Code 中：

```
/pilot-dev-issue https://github.com/your-org/your-repo/issues/123
```

就这样。坐下来看它工作，或者去忙别的事情。

### 批量模式

```bash
# 一键启动 — 多个 Issue 并行执行，全程无人值守
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/123" &
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/456" &
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/789" &
```

## 核心组件

| 组件 | 功能 |
|------|------|
| `/pilot-dev-issue` | 核心流水线：分析 → 探索 → 计划 → 编码 → 测试 → PR |
| `/pilot-watch-pr` | 监控已开 PR，自动修复 CI 失败，收到 Review 时通知 |
| `pilot-code-explorer` | 并行代码库分析智能体（每个 Issue 2-3 个） |
| `pilot-pr-creator` | 处理 Git 操作：暂存、提交、推送、创建 PR |
| `pilot-pr-reviewer` | 结构化代码审查，支持交互式讨论 |
| **Dashboard** | 位于 localhost:3000 的 Web 界面 — 一览 Issue、PR、任务和决策 |

## 工作原理

```
你
 │
 ├── /pilot-dev-issue #123
 │     ├── 分析 Issue
 │     ├── 探索代码库（并行智能体）
 │     ├── 呈现计划 → 你审批
 │     ├── 实施 + 测试 + 自动修复
 │     └── 创建 PR
 │
 ├── /pilot-watch-pr
 │     ├── 每 5 分钟轮询 PR
 │     ├── 自动修复 CI 失败
 │     └── 可合并时通知你
 │
 └── Dashboard (localhost:3000)
       └── 以上所有功能的可视化指挥中心
```

## 环境要求

- [Git](https://git-scm.com/) 和 GitHub 账号
- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [GitHub CLI (`gh`)](https://cli.github.com/) — 安装后运行 `gh auth login`

## 文档

| 文档 | 说明 |
|------|------|
| [配置指南](docs/configuration.md) | 设置 `pilot.yaml`、权限、构建/测试命令 |
| [架构说明](docs/architecture.md) | 项目结构和数据流 |
| [开发者指南](docs/dev-guide.md) | 构建、测试和贡献 |
| [贡献指南](CONTRIBUTING.md) | 如何为 Dev Pilot 做贡献 |

## 开源协议

MIT — 详见 [LICENSE](./LICENSE)。
