# MCP 变量在 QCI 安装时替换（替代 Desktop 运行时替换）

ADR 0002 规定 MCP.md 中的 `{{VAR}}` 占位符由 QoderCN Desktop 在运行时替换，QCI 安装器只负责解析和传递。但在 AI agent 沙盒和 CI/CD 等非交互环境中，Desktop 无法交互式获取变量值，导致安装后的 `mcp.json` 里占位符未被替换、MCP 服务无法直接使用。

改为：QCI 在 `add` 安装时完成变量替换。变量值来源优先级：

1. `--env KEY=VALUE` CLI 参数（可多次，类似 docker `-e`）——最高优先级
2. `process.env`（跨平台大小写容错，兼容 Windows）
3. 以上均缺失时：`required: true`（默认）报错中止；`required: false` 用 `default`，无 default 则保留占位符

替换在 install 层（`cli-add.ts`）完成，discovery 层（`mcp-discovery.ts`）仍返回原始占位符不变。原始 `MCP.md` 仍原样拷贝保留，供 Desktop 读取变量定义。

**Supersedes**: ADR 0002 中「变量值由 QoderCN Desktop 在运行时替换，QCI 安装器只负责解析和传递」的决策。MCP.md 格式本身（YAML frontmatter + JSON 正文）不变。

**Considered Options**:

- **安装时通过 `--env`/环境变量替换（已选择）**——非交互友好，契合沙盒/CI 场景；`--env` 是显式注入而非安装器管理凭据，不违背 0002「安装器不应管理用户凭证」的初衷
- 安装时交互式提示输入值——不支持 CI/CD 等非交互场景，且安装器收集凭据安全性差（0002 已拒绝）
- 保持 Desktop 运行时替换——沙盒/CI 环境无法工作，是本次问题的根因
