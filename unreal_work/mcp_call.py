"""Send one sequential request to the local Unreal Editor MCP server."""
import json
import sys
import urllib.request

headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}


def rpc(method, params, request_id):
    request = urllib.request.Request(
        "http://127.0.0.1:8000/mcp",
        data=json.dumps({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}).encode(),
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        session = response.headers.get("Mcp-Session-Id")
        if session:
            headers["Mcp-Session-Id"] = session
        result = json.load(response)
    if "error" in result:
        raise RuntimeError(result["error"])
    return result["result"]


rpc("initialize", {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "codex-local", "version": "1"}}, 1)
arguments = json.loads(sys.stdin.read() or "{}")
result = rpc("tools/call", {"name": sys.argv[1], "arguments": arguments}, 2)
print(json.dumps(result, ensure_ascii=True, indent=2))
if result.get("isError"):
    sys.exit(1)
