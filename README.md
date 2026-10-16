# Appendix MCP Server

Appendix turns any AI health conversation into a physician-reviewed opinion, with a prescription if you need one.

Your agent writes a medical encounter summary, submits it through our API, and a real doctor signs off.

Use the Appendix MCP server to search medical literature, submit clinical encounters, and receive clinical guidance and prescriptions from board-certified physicians. Learn more at [appendix.com](https://appendix.com).

## Installation

### Claude Code

```bash
claude mcp add --transport http appendix https://mcp.appendix.com/mcp
```

### Claude Desktop / Claude Web Connectors

Add to your Claude Desktop config (`claude_desktop_config.json`) or Claude.ai custom-connector form:

```json
{
  "mcpServers": {
    "appendix": {
      "url": "https://mcp.appendix.com/mcp"
    }
  }
}
```

### Other clients

| Client | URL |
|---|---|
| Claude Code, Claude Desktop, Claude.ai connectors | `https://mcp.appendix.com/mcp` |
| Anthropic Messages API (`mcp_servers`) | `https://mcp.appendix.com/mcp` |

The server speaks Streamable HTTP only — the current MCP spec transport (2025-03-26).

## Available Tools

| Tool | Description |
|------|-------------|
| `search_knowledge_base` | Search medical literature and treatment guidelines |
| `submit_encounter` | Submit a clinical letter for physician review |
| `list_conditions` | List available conditions and medications |

## Development

```bash
npm install
npm run build
npm start
```

Watch mode:

```bash
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `https://api.appendix.com` | Appendix API base URL |
| `PORT` | `3001` | HTTP listener port |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health probe for the hosting platform |
| `POST` `GET` `DELETE` | `/mcp` | Streamable HTTP transport (stateless mode) |
