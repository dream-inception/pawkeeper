# Pawkeeper Pet MCP

Pawkeeper runs a local pet-control server when `Enable MCP control` is on in the Cat settings panel. MCP control is opt-in for new installs.

## What It Exposes

- MCP Streamable HTTP endpoint: `http://127.0.0.1:8765/mcp` by default.
- Simple HTTP state endpoint: `http://127.0.0.1:8765/state`.
- Health endpoint: `http://127.0.0.1:8765/health`.
- If port `8765` is busy, Pawkeeper falls back to a random local port. The settings panel shows the actual URL.
- Optional LAN/mDNS mode publishes `Pawkeeper Pet` as `_mcp._tcp` and exposes the same endpoints on your local network.

All control endpoints bind to `127.0.0.1`. By default they do not require a token, which keeps local testing simple.
If you generate a token in settings, `/mcp` and `/state` require that bearer token. `/health` is always public.

## Cursor Setup

Create or edit one of these files:

- Global: `~/.cursor/mcp.json`
- Project: `.cursor/mcp.json`

Paste the config shown in Pawkeeper settings. By default it has this shape:

```json
{
  "mcpServers": {
    "pawkeeper-pet": {
      "url": "http://127.0.0.1:8765/mcp"
    }
  }
}
```

If you generate a token, the copied config includes an `Authorization: Bearer ...` header.

Restart Cursor after saving. Cursor will expose these tools:

- `pet_get_state`
- `pet_list_states`
- `pet_set_state`
- `pet_clear_state`
- `pet_set_interaction`

Example prompts for Cursor:

- `Use pawkeeper-pet to make the pet wave for five seconds.`
- `Set my desktop pet to review mode while you inspect this code.`
- `Clear MCP control for Pawkeeper pet.`

If Cursor cannot connect, open Cursor's Output panel and check `MCP Logs`.

The settings panel provides copy buttons for the Cursor config and optional bearer token. Generating a token enables authentication and old token-bearing configs must be updated after regeneration.

## Other MCP Clients

Any AI agent that supports Streamable HTTP MCP can use the same `url`. Add the `Authorization` header only if you generated a token.

If the client only supports stdio MCP, use the simple HTTP endpoint from a small wrapper script or hook instead.

For ESP32 and other microcontrollers, use the simple `/state` HTTP endpoint instead of implementing a full MCP client. See [ESP32 pet control protocol](esp32-pet-mcp.md).

## LAN And mDNS

Turn on `Allow LAN access via mDNS` in the Cat settings panel when you want another device on the same local network to control the pet.

Pawkeeper then:

- Listens on all local network interfaces.
- Advertises an mDNS service named `Pawkeeper Pet`.
- Uses service type `_mcp._tcp`.
- Recommends a stable local domain like `http://YOUR-COMPUTER.local:8765/mcp`.
- Publishes TXT metadata with `mcpPath=/mcp`, `statePath=/state`, and `auth=none` by default, or `auth=bearer` after you generate a token.
- Shows the `.local` domain URL in the settings panel. IP URLs are also shown as fallback values, and are often the most reliable choice on Windows LANs.

By default other devices can call the state endpoint without a token:

```bash
curl -X POST http://YOUR-COMPUTER.local:8765/state \
  -H "Content-Type: application/json" \
  --data '{"state":"waving","playCount":3,"message":"Hello from LAN"}'
```

If you generated a token, add `-H "Authorization: Bearer YOUR_TOKEN"`.

If `.local` name resolution is unavailable on a client, use the IP fallback shown in settings.

### Custom local domain

You can set the local domain in Cat settings. For example, enter:

```text
neko.local
```

Pawkeeper will use `http://neko.local:8765/mcp` and `http://neko.local:8765/state` in LAN mode.
Entering a custom local domain automatically enables LAN/mDNS access when settings are saved.

Notes:

- The domain must end in `.local`; Pawkeeper normalizes it for you.
- Use simple ASCII names such as `neko.local` for best device compatibility.
- If another device cannot resolve the custom name, try the IP fallback shown in settings.

Security notes:

- Leave LAN/mDNS off unless you need another device to control the pet.
- macOS may ask for local network permission or firewall permission.
- Windows may show a Defender Firewall prompt the first time LAN mode binds to the network. Allow private-network access if you want other devices to connect.
- Without a token, anyone with network reachability can control the pet state. Keep LAN/mDNS off unless you need it, or generate a token before enabling LAN access.

## Troubleshooting LAN

- `.local` does not resolve: confirm LAN/mDNS is enabled, then try the IP fallback shown in settings.
- `curl` connects by IP but not domain: Bonjour/mDNS name resolution is blocked or unsupported on that client.
- Other devices cannot connect on macOS: allow Pawkeeper/Electron through the firewall and grant Local Network permission if prompted.
- Other devices cannot connect on Windows: allow Pawkeeper/Electron through Windows Defender Firewall for private networks, then retry the IP URL shown in settings.
- Windows `.local` lookup is unreliable on some networks unless Bonjour/mDNS support is available. Prefer the IP URL for Windows-to-LAN testing.
- Cursor cannot connect: use the local `127.0.0.1` config for same-machine Cursor. Use the `.local` config only for another device.
- Token rejected: copy the current token from settings. If you regenerated it, old configs must be updated. If no token is shown, remove stale `Authorization` headers from the client config.

## Simple HTTP Control

This is useful for hooks in Codex CLI, Claude Code, OpenCode, or shell scripts.

Set a state:

```bash
curl -X POST http://127.0.0.1:8765/state \
  -H "Content-Type: application/json" \
  --data '{"state":"waving","playCount":3,"message":"Hi"}'
```

Read current state:

```bash
curl http://127.0.0.1:8765/state
```

Clear MCP control:

```bash
curl -X DELETE http://127.0.0.1:8765/state
```

If you generated a token, add `-H "Authorization: Bearer YOUR_TOKEN"` to these requests.

## State Names

Supported Codex states:

- `idle`
- `running-right` or `runningRight`
- `running-left` or `runningLeft`
- `waving`
- `jumping`
- `failed`
- `waiting`
- `running`
- `review`

## Recommended Agent Hooks

For coding agents, map lifecycle events to pet states:

- Tool starts: `running`
- Code review or reading files: `review`
- Task/session done: `waving`
- Error or failed command: `failed`
- Idle/waiting for user: `waiting`

Keep state updates temporary by setting `durationMs`, usually `3000` to `10000`.
Use `playCount` when you want the pet to play an animation a specific number of loops. If `playCount` is provided and `durationMs` is omitted, Pawkeeper estimates the duration from the Codex animation timing and clears the state after the requested loops.

Examples:

```bash
# Wave exactly three loops and show a speech bubble.
curl -X POST http://127.0.0.1:8765/state \
  -H "Content-Type: application/json" \
  --data '{"state":"waving","playCount":3,"message":"Done!"}'

# Show an error reaction once.
curl -X POST http://127.0.0.1:8765/state \
  -H "Content-Type: application/json" \
  --data '{"state":"failed","playCount":1,"message":"Command failed"}'
```
