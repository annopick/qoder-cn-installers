# QCI — QoderCN Resource Installer

一个基于 TypeScript 的 CLI 安装器，从 Git 仓库或本地路径安装 Skill、Agent、MCP 资源到 QoderCN Desktop。

## 安装

```bash
# 无需安装，直接使用
npx qci add <source>

# 或全局安装
npm install -g qci
qci add <source>
```

## 快速开始

```bash
# 从 Git 仓库安装所有资源
npx qci add https://github.com/your-org/your-skills-repo

# 从本地路径安装
npx qci add /path/to/your-skills-repo

# 使用 SSH 克隆
npx qci add git@github.com:your-org/your-skills-repo.git

# 只查看仓库中有哪些可用资源
npx qci add https://github.com/your-org/your-skills-repo --list
```

## 命令

### `add` — 安装资源

```bash
qci add <source> [options]
```

| 选项 | 说明 |
|------|------|
| `--all` | 安装所有发现的资源 |
| `--skill <name...>` | 只安装指定的 Skill |
| `--agent <name...>` | 只安装指定的 Agent |
| `--mcp <name...>` | 只安装指定的 MCP 服务 |
| `--path <subpath>` | 指定仓库内的子目录（仅 Git 来源） |
| `--list` | 列出可用资源，不安装 |
| `-y, --yes` | 跳过确认提示 |

```bash
# 只安装指定的 Skill 和 MCP
qci add https://github.com/org/repo --skill code-review --mcp github

# 从大型仓库中指定子目录
qci add https://github.com/org/repo --path skills/team-a
```

### `list` — 列出已安装资源

```bash
qci list [options]
```

| 选项 | 说明 |
|------|------|
| `--skill` | 只列出 Skill |
| `--agent` | 只列出 Agent |
| `--mcp` | 只列出 MCP 服务 |
| `--json` | JSON 格式输出 |

### `remove` — 移除已安装资源

```bash
qci remove [options]
```

| 选项 | 说明 |
|------|------|
| `--skill <name...>` | 移除指定 Skill |
| `--agent <name...>` | 移除指定 Agent |
| `--mcp <name...>` | 移除指定 MCP 服务 |
| `--all` | 移除所有资源 |

### `update` — 更新已安装资源

```bash
qci update [options]
```

| 选项 | 说明 |
|------|------|
| `--skill <name...>` | 只更新指定 Skill |
| `--agent <name...>` | 只更新指定 Agent |
| `--mcp <name...>` | 只更新指定 MCP 服务 |

更新时从原始来源重新拉取，自动检测变更。MCP 服务更新时同名配置会被覆盖。

## 资源仓库目录结构

资源仓库需遵循以下目录结构：

```
repo/
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md          # 必须含 name 和 description 的 YAML frontmatter
│       └── (references/, scripts/ 等子目录)
├── agents/
│   └── <agent-name>.md       # 必须含 name 和 description 的 YAML frontmatter
└── mcp/
    └── <mcp-name>/
        └── mcp.json           # 标准 mcpServers JSON 结构
```

每种资源类型都是可选的——仓库可以只包含 Skill、只包含 Agent，或任意组合。

### Skill（技能）

标准 Anthropic skill 格式，由 `SKILL.md` 定义：

```markdown
---
name: code-review
description: 代码审查技能
---

技能内容...
```

### Agent（自定义智能体）

Qoder 自定义智能体，由 `.md` 文件定义：

```markdown
---
name: security-audit
description: 安全审计专家
tools: Read, Grep, Bash
---

你是一位安全审计专家...
```

### MCP（Model Context Protocol）

标准 `mcpServers` JSON 结构：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "..." }
    }
  }
}
```

## 安装位置

| 资源类型 | 路径 |
|---------|------|
| Skill | `~/.qoder-cn/skills/<name>/` |
| Agent | `~/.qoder-cn/agents/<name>.md` |
| MCP（macOS） | `~/Library/Application Support/QoderCN/SharedClientCache/mcp.json` |
| MCP（Windows） | `%APPDATA%\QoderCN\SharedClientCache\mcp.json` |

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/Annopick/qoder-cn-installers.git
cd qoder-cn-installers

# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm test

# 本地链接为全局命令
npm link
qci --help
```

## 技术栈

- TypeScript + ESM
- [tsup](https://tsup.egoist.dev/) 构建
- [@clack/prompts](https://github.com/nicekid1/clack) CLI 交互
- [yaml](https://github.com/eemeli/yaml) frontmatter 解析
- Node.js >= 18

## License

[MIT](./LICENSE)
