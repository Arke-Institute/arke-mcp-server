# Arke Institute MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that provides AI assistants with semantic search capabilities across the Arke Institute's extensive archive of NARA (National Archives and Records Administration) records and presidential libraries.

## Features

- **Semantic Search**: Natural language queries powered by OpenAI embeddings and Pinecone vector search
- **Rich Entity Types**: Search across institutions, collections, series, file units, and digitized objects
- **Extracted Text**: Access OCR'd content from scanned documents and PDFs
- **Complete Metadata**: Full NARA catalog records, access restrictions, physical locations, and hierarchical relationships
- **Fast Responses**: Sub-second search times with parallel API processing
- **Easy Integration**: Works with Claude Desktop, Cloudflare AI Playground, and any MCP client

## What is Arke Institute?

The Arke Institute provides semantic access to historical archives, starting with digitizing and indexing the complete holdings of the National Archives. The search API powers discovery across millions of historical documents, photographs, and records.

## Installation

### Deploy to Cloudflare Workers

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/arke-institute/arke-mcp)

Or via command line:

```bash
npm create cloudflare@latest -- arke-mcp-server --template=arke-institute/arke-mcp
cd arke-mcp-server
npm run deploy
```

Your MCP server will be deployed to: `arke-mcp-server.<your-account>.workers.dev/sse`

### Local Development

```bash
git clone https://github.com/arke-institute/arke-mcp.git
cd arke-mcp/arke-mcp-server
npm install
npm run dev
```

The server runs at `http://localhost:8787`

## MCP Tool Reference

### `search_arke`

Perform semantic search across Arke Institute archives.

**Parameters:**

- `query` (string, required): Natural language search query
- `topK` (number, optional): Number of results (1-100, default: 10)
- `namespaces` (array, optional): Filter by entity type(s)

**Available Namespaces:**

- `institution` - Institutional collections
- `collection` - Record collections
- `series` - Record series
- `fileUnit` - File units
- `digitalObject` - Digital objects (scanned documents, images, PDFs with extracted text)

**Returns:**

Formatted search results including:
- Similarity scores (0-1 range, higher = better match)
- Entity titles and descriptions
- NARA identifiers and persistent identifiers (PIs)
- Date ranges and record types
- Parent/child entity relationships
- Physical locations and access restrictions
- IPFS content identifiers (CIDs)
- Extracted text from digitized documents

## Usage Examples

### Example 1: General Search

```json
{
  "query": "Apollo 11 moon landing mission",
  "topK": 5
}
```

Searches all entity types for Apollo 11 content.

### Example 2: Search Digitized Documents

```json
{
  "query": "World War II photographs",
  "topK": 10,
  "namespaces": ["digitalObject"]
}
```

Searches only digitized objects (with extracted text) for WWII photos.

### Example 3: Search File Units

```json
{
  "query": "presidential speeches on climate change",
  "topK": 20,
  "namespaces": ["fileUnit", "digitalObject"]
}
```

Searches file units and digitized objects for climate-related presidential speeches.

## Connect to Claude Desktop

To use this MCP server with Claude Desktop, add it to your configuration:

1. Open Claude Desktop Settings > Developer > Edit Config
2. Add the server configuration:

```json
{
  "mcpServers": {
    "arke": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://arke-mcp-server.<your-account>.workers.dev/sse"
      ]
    }
  }
}
```

For local development:

```json
{
  "mcpServers": {
    "arke": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse"
      ]
    }
  }
}
```

3. Restart Claude Desktop
4. You should see the `search_arke` tool available

## Connect to Cloudflare AI Playground

1. Go to [https://playground.ai.cloudflare.com/](https://playground.ai.cloudflare.com/)
2. Enter your deployed MCP server URL: `arke-mcp-server.<your-account>.workers.dev/sse`
3. Start using the `search_arke` tool directly in the playground

## Example Conversations

### Finding Historical Documents

**User**: "Find documents about the Space Shuttle Discovery missions"

**Claude** (using search_arke):
```json
{
  "query": "Space Shuttle Discovery missions",
  "topK": 10
}
```

Returns relevant file units, digitized speeches, and mission records with extracted text content.

### Researching Presidential Libraries

**User**: "Show me Clinton administration documents about Japan relations in the 1990s"

**Claude** (using search_arke):
```json
{
  "query": "Clinton administration Japan relations 1990s",
  "topK": 15,
  "namespaces": ["fileUnit", "digitalObject"]
}
```

Returns presidential library materials with dates, locations, and full text content.

## Architecture

```
┌─────────────┐
│   AI Client │ (Claude Desktop, AI Playground)
└──────┬──────┘
       │ MCP Protocol (SSE/HTTP)
       ▼
┌─────────────────────────────┐
│   Arke MCP Server           │
│   (Cloudflare Worker)       │
│                             │
│   - search_arke tool        │
│   - Dynamic namespaces      │
│   - Result formatting       │
└──────┬──────────────────────┘
       │ HTTPS
       ▼
┌─────────────────────────────┐
│   Arke Search API           │
│   search.arke.institute     │
│                             │
│   - OpenAI embeddings       │
│   - Pinecone vector search  │
│   - IPFS content retrieval  │
└─────────────────────────────┘
```

## Project Structure

```
arke-mcp-server/
├── src/
│   ├── index.ts              # MCP server implementation
│   ├── types.ts              # TypeScript type definitions
│   ├── clients/
│   │   └── arke.ts          # Arke Search API client
│   └── utils/
│       └── formatters.ts    # Result formatting for AI
├── package.json
├── wrangler.jsonc           # Cloudflare Worker config
├── tsconfig.json
└── README.md
```

## API Endpoints

- `/sse` - Server-Sent Events endpoint for MCP protocol (recommended)
- `/mcp` - Standard HTTP MCP endpoint
- `/` - Server information and health check

## Development

### Type Checking

```bash
npm run type-check
```

### Code Formatting

```bash
npm run format
```

### Deploy to Production

```bash
npm run deploy
```

## Performance

- **Search latency**: ~500-900ms (including vector search, entity fetching, and formatting)
- **Namespace fetching**: Cached at server initialization
- **Concurrent searches**: Fully supported via Cloudflare Workers

## Limitations

- Maximum 100 results per query (topK parameter)
- Searches are read-only (no write operations)
- Rate limits apply per Cloudflare Workers free tier (or your plan)

## Related Projects

- **Arke Search API**: [search.arke.institute](https://search.arke.institute) - The underlying search service
- **Arke IPFS API**: [api.arke.institute](https://api.arke.institute) - Entity manifest and metadata retrieval
- **MCP Specification**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

## Contributing

Contributions welcome! Please open issues or pull requests on [GitHub](https://github.com/arke-institute/arke-mcp).

## License

MIT License - see LICENSE file for details

## Support

For questions or issues:
- Open a [GitHub issue](https://github.com/arke-institute/arke-mcp/issues)
- Contact the Arke Institute team
- Check the [MCP documentation](https://modelcontextprotocol.io/docs)

## Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Uses [Model Context Protocol](https://modelcontextprotocol.io)
- Powered by [Arke Institute](https://arke.institute) search infrastructure
- NARA data from the [National Archives](https://www.archives.gov/)
