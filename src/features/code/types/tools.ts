export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        { type: string; description: string }
      >;
      required: string[];
    };
  };
}

export const CODE_MODE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file at the given path relative to the working directory",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative file path from the working directory",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write content to a file at the given path relative to the working directory. Creates parent directories if needed.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative file path from the working directory",
          },
          content: {
            type: "string",
            description: "The file content to write",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description:
        "List files and directories at the given path relative to the working directory",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative directory path, use '.' for the root working directory",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a shell command in the working directory and return its output",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
];
