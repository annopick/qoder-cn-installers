# MCP 配置格式从纯 JSON 改为 Markdown + YAML Frontmatter

当前 MCP 资源使用纯 JSON 格式（`mcp.json`），无法描述动态参数（如 API Key、Token、自定义 Header 等）。这些参数的值是用户级别的，不能硬编码在资源仓库中。

改为 Markdown + YAML Frontmatter + JSON 正文的格式，在 YAML 中声明变量定义，在 JSON 正文中使用占位符引用变量。变量值由 QoderCN Desktop 在运行时替换，QCI 安装器只负责解析和传递。

原因：与其他资源类型（Skill、Agent、Command）的格式对齐；声明式变量定义便于 QoderCN Desktop 做 UI 渲染和运行时替换；安装和配置解耦，支持非交互式安装场景。

**Considered Options**:

- 保持纯 JSON，通过外部 `.env` 文件管理变量——配置分散，用户需要同时维护多个文件，体验差
- 安装时 CLI 交互式提示输入值——安装器不应管理用户凭证，且不支持 CI/CD 等非交互式场景
- **Markdown + YAML Frontmatter + JSON 正文（已选择）**——声明式、可扩展、与其他资源类型一致
