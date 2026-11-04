import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DiscordService } from "./discord-service.js";
import * as fs from "fs";
import * as path from "path";

export function createMcpServer(discordService: DiscordService): Server {
  const server = new Server(
    {
      name: "discord-ai-control",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const tools: Tool[] = [
    {
      name: "get_server_info",
      description: "Get general information, member count, and metrics for the configured Discord server.",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "list_server_structure",
      description: "List the complete server hierarchy including categories, text/voice channels, and existing roles.",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "create_category",
      description: "Create a new channel category in the Discord server.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the category to create." }
        },
        required: ["name"]
      }
    },
    {
      name: "create_text_channel",
      description: "Create a new text channel in the server, optionally inside a category.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the text channel." },
          categoryId: { type: "string", description: "Optional category ID where the channel will be placed." },
          topic: { type: "string", description: "Optional topic or description for the channel." }
        },
        required: ["name"]
      }
    },
    {
      name: "create_voice_channel",
      description: "Create a new voice channel in the server, optionally inside a category.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the voice channel." },
          categoryId: { type: "string", description: "Optional category ID where the channel will be placed." },
          userLimit: { type: "number", description: "Optional maximum user capacity (0 for unlimited)." }
        },
        required: ["name"]
      }
    },
    {
      name: "create_role",
      description: "Create a new role with specific color, hoist, and permissions. (Administrator permission is restricted for security).",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the role." },
          color: { type: "string", description: "Hex color code (e.g. #3498db)." },
          hoist: { type: "boolean", description: "Display role members separately in the member list." },
          mentionable: { type: "boolean", description: "Allow anyone to @mention this role." },
          permissions: {
            type: "array",
            items: { type: "string" },
            description: "Array of Discord permission flag names (e.g., ['ViewChannel', 'SendMessages', 'ManageMessages'])."
          }
        },
        required: ["name"]
      }
    },
    {
      name: "set_channel_permissions",
      description: "Configure role or member permissions for a channel or category.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "ID of the channel or category." },
          targetId: { type: "string", description: "Role ID, Member ID, or 'everyone'." },
          allow: {
            type: "array",
            items: { type: "string" },
            description: "Permissions to grant (e.g., ['ViewChannel', 'SendMessages'])."
          },
          deny: {
            type: "array",
            items: { type: "string" },
            description: "Permissions to restrict (e.g., ['SendMessages', 'AddReactions'])."
          }
        },
        required: ["channelId", "targetId"]
      }
    },
    {
      name: "send_message",
      description: "Send an announcement, notification, or message to a designated text channel.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "Target text channel ID." },
          content: { type: "string", description: "Message body (supports standard Discord markdown)." }
        },
        required: ["channelId", "content"]
      }
    },
    {
      name: "rename_channel",
      description: "Rename an existing channel or category.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "ID of the channel to rename." },
          newName: { type: "string", description: "New name for the channel." }
        },
        required: ["channelId", "newName"]
      }
    },
    {
      name: "delete_channel",
      description: "Permanently delete a channel or category. Requires explicit confirmation: true.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "ID of the channel to delete." },
          confirmation: { type: "boolean", description: "Must be explicitly true to confirm deletion." }
        },
        required: ["channelId", "confirmation"]
      }
    },
    {
      name: "delete_role",
      description: "Permanently delete a role from the server. Requires explicit confirmation: true.",
      inputSchema: {
        type: "object",
        properties: {
          roleId: { type: "string", description: "ID of the role to delete." },
          confirmation: { type: "boolean", description: "Must be explicitly true to confirm deletion." }
        },
        required: ["roleId", "confirmation"]
      }
    },
    {
      name: "apply_server_template",
      description: "Apply a complete server template JSON (or path to template) to build channels, roles, and permissions.",
      inputSchema: {
        type: "object",
        properties: {
          templateJson: { type: "string", description: "Raw JSON template string or file path to JSON template." },
          previewOnly: { type: "boolean", description: "If true, simulates planned creations without modifying the server." }
        },
        required: ["templateJson"]
      }
    }
  ];

  // Tool validation schemas with Zod
  const schemas = {
    get_server_info: z.object({}),
    list_server_structure: z.object({}),
    create_category: z.object({ name: z.string().min(1) }),
    create_text_channel: z.object({
      name: z.string().min(1),
      categoryId: z.string().optional(),
      topic: z.string().optional()
    }),
    create_voice_channel: z.object({
      name: z.string().min(1),
      categoryId: z.string().optional(),
      userLimit: z.number().int().min(0).max(99).optional()
    }),
    create_role: z.object({
      name: z.string().min(1),
      color: z.string().optional(),
      hoist: z.boolean().optional(),
      mentionable: z.boolean().optional(),
      permissions: z.array(z.string()).optional()
    }),
    set_channel_permissions: z.object({
      channelId: z.string().min(1),
      targetId: z.string().min(1),
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional()
    }),
    send_message: z.object({
      channelId: z.string().min(1),
      content: z.string().min(1)
    }),
    rename_channel: z.object({
      channelId: z.string().min(1),
      newName: z.string().min(1)
    }),
    delete_channel: z.object({
      channelId: z.string().min(1),
      confirmation: z.boolean()
    }),
    delete_role: z.object({
      roleId: z.string().min(1),
      confirmation: z.boolean()
    }),
    apply_server_template: z.object({
      templateJson: z.string().min(1),
      previewOnly: z.boolean().optional()
    })
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let resultData: any;

      switch (name) {
        case "get_server_info": {
          schemas.get_server_info.parse(args || {});
          resultData = await discordService.getServerInfo();
          break;
        }

        case "list_server_structure": {
          schemas.list_server_structure.parse(args || {});
          resultData = await discordService.listServerStructure();
          break;
        }

        case "create_category": {
          const validated = schemas.create_category.parse(args);
          resultData = await discordService.createCategory(validated.name);
          break;
        }

        case "create_text_channel": {
          const validated = schemas.create_text_channel.parse(args);
          resultData = await discordService.createTextChannel(
            validated.name,
            validated.categoryId,
            validated.topic
          );
          break;
        }

        case "create_voice_channel": {
          const validated = schemas.create_voice_channel.parse(args);
          resultData = await discordService.createVoiceChannel(
            validated.name,
            validated.categoryId,
            validated.userLimit
          );
          break;
        }

        case "create_role": {
          const validated = schemas.create_role.parse(args);
          resultData = await discordService.createRole(validated);
          break;
        }

        case "set_channel_permissions": {
          const validated = schemas.set_channel_permissions.parse(args);
          resultData = await discordService.setChannelPermissions(validated);
          break;
        }

        case "send_message": {
          const validated = schemas.send_message.parse(args);
          resultData = await discordService.sendMessage(validated.channelId, validated.content);
          break;
        }

        case "rename_channel": {
          const validated = schemas.rename_channel.parse(args);
          resultData = await discordService.renameChannel(validated.channelId, validated.newName);
          break;
        }

        case "delete_channel": {
          const validated = schemas.delete_channel.parse(args);
          resultData = await discordService.deleteChannel(validated.channelId, validated.confirmation);
          break;
        }

        case "delete_role": {
          const validated = schemas.delete_role.parse(args);
          resultData = await discordService.deleteRole(validated.roleId, validated.confirmation);
          break;
        }

        case "apply_server_template": {
          const validated = schemas.apply_server_template.parse(args);
          let parsedTemplate: any;

          // Check if string is a file path
          let content = validated.templateJson;
          if (fs.existsSync(content)) {
            content = fs.readFileSync(content, "utf-8");
          } else if (fs.existsSync(path.resolve(process.cwd(), content))) {
            content = fs.readFileSync(path.resolve(process.cwd(), content), "utf-8");
          }

          try {
            parsedTemplate = JSON.parse(content);
          } catch (jsonErr: any) {
            throw new Error(`Failed to parse template JSON: ${jsonErr.message}`);
          }

          resultData = await discordService.applyServerTemplate(parsedTemplate, validated.previewOnly);
          break;
        }

        default:
          throw new Error(`Unknown tool requested: ${name}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resultData, null, 2)
          }
        ]
      };
    } catch (err: any) {
      // Secure error handling - never leak tokens or private keys
      let safeErrorMessage = err.message || "An unexpected error occurred.";
      safeErrorMessage = safeErrorMessage.replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{27,}/g, "[REDACTED_TOKEN]");

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error executing ${name}: ${safeErrorMessage}`
          }
        ]
      };
    }
  });

  return server;
}

