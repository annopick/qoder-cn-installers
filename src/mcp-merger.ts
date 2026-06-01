export interface McpConfig {
  mcpServers: Record<string, unknown>;
}

export function mergeMcpConfig(target: McpConfig | undefined, source: McpConfig): McpConfig {
  const result: McpConfig = {
    mcpServers: { ...(target?.mcpServers ?? {}) },
  };

  for (const [name, config] of Object.entries(source.mcpServers)) {
    if (!(name in result.mcpServers)) {
      result.mcpServers[name] = config;
    }
  }

  return result;
}
