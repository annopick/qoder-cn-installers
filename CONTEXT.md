# QCI Installer

一个基于 TypeScript 的 CLI 安装器，从 Git 仓库或本地路径安装 Skill、Agent、MCP 资源到 QoderCN Desktop 用户级目录。

## Language

**Skill**:
Anthropic 标准格式的技能，由包含 `SKILL.md` frontmatter 的目录定义，可附带 references、scripts 等子目录。
_Avoid_: 技能包、skill包

**Agent**:
Qoder 定义的自定义智能体，由 `.md` 文件定义，YAML frontmatter 含 name、description、tools、skills、mcpServers 字段，文件正文为系统提示词。
_Avoid_: 智能体、subagent、自定义代理

**MCP**:
Model Context Protocol 服务器配置，以 `mcpServers` 为顶层 key 的 JSON 结构，每个 key 对应一个 MCP 服务。
_Avoid_: mcp服务、mcp配置

**资源仓库**:
存放 Skill、Agent、MCP 资源的 Git 仓库，遵循固定目录结构：`skills/`、`agents/`、`mcp/`。
_Avoid_: 源仓库、资源包

**来源追踪文件**:
`~/.qoder-cn/.qci.source.json`，按资源类型分组记录每个已安装资源的来源信息。
_Avoid_: 锁文件、lock file

**QoderCN 用户目录**:
`~/.qoder-cn/`，包含 `skills/`、`agents/` 子目录和 `.qci.source.json` 来源追踪文件。
_Avoid_: 用户目录、home目录
