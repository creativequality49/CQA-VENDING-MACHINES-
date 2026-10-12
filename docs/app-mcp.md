# Vending app MCP endpoint

The application now exposes `/api/mcp`, a stateless, read-only Streamable HTTP endpoint. It supports initialization, ping, tool discovery and tool calls using MCP versions 2025-11-25, 2025-06-18 and 2025-03-26. GET and DELETE return 405 because no SSE stream or server session is maintained.

Available tools: `get_workspace`, `list_offers` (maximum 100), and `list_automation_runs` (latest 25). Each accepts an optional owned `businessId`; omission selects the owner's oldest business. Tools do not return customer contact details, protected asset URLs, secrets, automation output, or payment records. No tool writes data or executes arbitrary SQL.

Use an MCP client that can send a current Supabase owner access token as `Authorization: Bearer <access_token>`. Every request verifies the token with Supabase Auth and verifies business ownership. Reads use the user's RLS client plus an explicit business filter. Do not use a Supabase service-role key or publishable key as an access token. Tokens expire and should be refreshed through the app's existing owner sign-in flow; never save one in a committed configuration file.

POST requests require `Content-Type: application/json`, `Accept: application/json, text/event-stream`, and the negotiated `MCP-Protocol-Version` after initialization. Browser requests must use the same Origin as the endpoint. Responses disable caching. The endpoint accepts at most 16 KiB of request data.

This initial endpoint does **not** implement OAuth authorization-server discovery or the MCP OAuth flow. Clients that require automatic OAuth login cannot connect yet. It is intended for clients with explicit bearer-header support; broader hosted connector support requires a separately reviewed OAuth integration.

Verification: `npm run test:mcp` tests authentication, Origin checks, protocol discovery, notification responses, input rejection and business scoping with an injected test database. Live Supabase reads still require an authenticated owner and the existing database schema/RLS migrations.

Protocol references: [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle). Authentication reference: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser).

