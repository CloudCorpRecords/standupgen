/**
 * standupgen MCP server. Tools: generate_standup.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The drafting is pure local computation over the records
 * the caller supplies: no upstream API, no authentication,
 * no configuration, and no repository is ever read.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { formatPayload, generateStandup, VERSION } from "./standupgen.js";

const TOOLS = [
  {
    name: "generate_standup",
    description:
      "Draft a factual standup from git commits and pull request activity you supply: merged work under Done, open pull requests in progress, the rest counted.",
    inputSchema: {
      type: "object" as const,
      properties: {
        commits: {
          type: "array",
          description: "Commits to report (optional)",
          items: {
            type: "object",
            properties: {
              hash: {
                type: "string",
                description: "Commit hash (rendered as its first 7 characters)",
              },
              subject: { type: "string", description: "Commit subject line" },
              author: { type: "string", description: "Commit author (optional)" },
            },
            required: ["hash", "subject"],
          },
        },
        pull_requests: {
          type: "array",
          description: "Pull request activity to report (optional)",
          items: {
            type: "object",
            properties: {
              number: {
                type: "integer",
                description: "Pull request number (unique across the set)",
              },
              title: { type: "string", description: "Pull request title" },
              state: {
                type: "string",
                enum: ["opened", "updated", "merged", "closed"],
                description:
                  "What happened to the pull request: opened, updated, merged, or closed",
              },
              author: { type: "string", description: "Pull request author (optional)" },
            },
            required: ["number", "title", "state"],
          },
        },
        author: {
          type: "string",
          description:
            "When given, only this author's commits and pull requests are included (exact match) (optional)",
        },
        date_label: {
          type: "string",
          description: "Label for the standup heading (optional, default \"Yesterday\")",
        },
      },
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "standupgen", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "generate_standup") {
      out = generateStandup(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
