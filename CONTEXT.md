# QCI Installer

一个基于 TypeScript 的 CLI 安装器，从 Git 仓库或本地路径安装 Skill、Agent、MCP、指令 资源到 QoderCN Desktop 用户级目录。

## Language

**Skill**:
Anthropic 标准格式的技能，由包含 `SKILL.md` frontmatter 的目录定义，可附带 references、scripts 等子目录。
_Avoid_: 技能包、skill包

**Agent**:
Qoder 定义的自定义智能体，由 `.md` 文件定义，YAML frontmatter 含 name、description、tools、skills、mcpServers 字段，文件正文为系统提示词。
_Avoid_: 智能体、subagent、自定义代理

**MCP**:
Model Context Protocol 服务器配置，由 `MCP.md` 文件定义。YAML frontmatter 含 `name`、`description`、`variables` 字段，正文为 `mcpServers` 结构的 JSON 配置，支持使用 `{{VAR_NAME}}` 占位符引用 frontmatter 中定义的变量。安装后 JSON 配置合并到 `mcp.json`，原始 `MCP.md` 保留在 `~/.qoder-cn/mcp/` 供 QoderCN Desktop 运行时读取变量定义。
_Avoid_: mcp服务、mcp配置

**指令**:
Qoder 自定义指令（Custom Command），由 `.md` 文件定义，文件名即指令名，正文为指令 prompt 内容。可选包含 YAML frontmatter 的 `description` 字段用于描述。安装到 `~/.qoder-cn/commands/`，在 Qoder 对话框中以 `/指令名` 调用。
_Avoid_: command、命令、自定义命令

**资源仓库**:
存放 Skill、Agent、MCP、指令 资源的 Git 仓库，遵循固定目录结构：`skills/`、`agents/`、`mcp/`、`commands/`。
_Avoid_: 源仓库、资源包

**来源追踪文件**:
`~/.qoder-cn/.qci.source.json`，按 `skills`、`agents`、`mcp`、`commands` 四个 key 分组记录每个已安装资源的来源信息。
_Avoid_: 锁文件、lock file

**QoderCN 用户目录**:
`~/.qoder-cn/`，包含 `skills/`、`agents/`、`mcp/`、`commands/` 子目录和 `.qci.source.json` 来源追踪文件。
_Avoid_: 用户目录、home目录
