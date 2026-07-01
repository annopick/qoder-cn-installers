import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface McpVariable {
  name: string;
  description: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  default?: unknown;
  sensitive: boolean;
}

export interface McpService {
  name: string;
  config: { mcpServers: Record<string, unknown> };
  sourcePath: string;
  variables: McpVariable[];
}

interface McpFrontmatter {
  name?: string;
  description?: string;
  variables?: unknown[];
}

export async function discoverMcpServices(basePath: string): Promise<McpService[]> {
  const mcpDir = path.join(basePath, "mcp");

  try {
    await fs.access(mcpDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(mcpDir, { withFileTypes: true });
  const services: McpService[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const serviceDir = path.join(mcpDir, entry.name);
    const mcpMdPath = path.join(serviceDir, "MCP.md");
    const mcpJsonPath = path.join(serviceDir, "mcp.json");

    let service: McpService | undefined;

    const mcpMdExists = await fs.access(mcpMdPath).then(() => true).catch(() => false);
    if (mcpMdExists) {
      service = await parseMcpMd(mcpMdPath, entry.name);
    } else {
      try {
        await fs.access(mcpJsonPath);
        service = await parseLegacyMcpJson(mcpJsonPath, entry.name);
      } catch {
        // Neither format found — skip
      }
    }

    if (service) {
      services.push(service);
    }
  }

  return services;
}

async function parseMcpMd(filePath: string, directoryName: string): Promise<McpService> {
  const content = await fs.readFile(filePath, "utf-8");
  const { frontmatter, jsonBody } = extractMcpMdContent(content);

  const config = JSON.parse(jsonBody);
  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    throw new Error("Invalid MCP.md: missing mcpServers");
  }

  const frontmatterName = frontmatter.name;
  if (frontmatterName && frontmatterName !== directoryName) {
    throw new Error(
      `MCP.md name mismatch: frontmatter.name "${frontmatterName}" does not match directory "${directoryName}"`,
    );
  }

  const mcpServerKeys = Object.keys(config.mcpServers);
  if (mcpServerKeys.length !== 1) {
    throw new Error(`MCP.md must contain exactly one mcpServers entry, found ${mcpServerKeys.length}`);
  }

  const serverName = mcpServerKeys[0];
  if (frontmatterName && frontmatterName !== serverName) {
    throw new Error(
      `MCP.md name mismatch: frontmatter.name "${frontmatterName}" does not match mcpServers key "${serverName}"`,
    );
  }

  const variables = parseVariables(frontmatter.variables);

  return {
    name: directoryName,
    config,
    sourcePath: filePath,
    variables,
  };
}

async function parseLegacyMcpJson(filePath: string, directoryName: string): Promise<McpService> {
  const content = await fs.readFile(filePath, "utf-8");
  const config = JSON.parse(content);
  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    throw new Error("Invalid mcp.json: missing mcpServers");
  }

  return {
    name: directoryName,
    config,
    sourcePath: filePath,
    variables: [],
  };
}

function extractMcpMdContent(content: string): { frontmatter: McpFrontmatter; jsonBody: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter: McpFrontmatter = {};
  let body = content;

  if (frontmatterMatch) {
    frontmatter = (parseYaml(frontmatterMatch[1]) ?? {}) as McpFrontmatter;
    body = content.slice(frontmatterMatch[0].length).trim();
  }

  const codeBlockMatch = body.match(/```(?:json)?\n([\s\S]*?)\n```/);
  let jsonBody: string;

  if (codeBlockMatch) {
    jsonBody = codeBlockMatch[1].trim();
  } else {
    jsonBody = body.trim();
  }

  return { frontmatter, jsonBody };
}

function parseVariables(rawVariables: unknown[] | undefined): McpVariable[] {
  if (!rawVariables || !Array.isArray(rawVariables)) {
    return [];
  }

  return rawVariables.map((v: unknown) => {
    const rv = v as Record<string, unknown>;
    return {
      name: String(rv.name ?? ""),
      description: String(rv.description ?? ""),
      type: (rv.type === "number" || rv.type === "boolean" ? rv.type : "string") as McpVariable["type"],
      required: rv.required !== false,
      default: rv.default,
      sensitive: rv.sensitive !== false,
    };
  });
}
