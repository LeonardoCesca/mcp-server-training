#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/package.json" ]]; then
  ROOT_DIR="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../package.json" ]]; then
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  echo "Could not find package.json in '$SCRIPT_DIR' or its parent directory." >&2
  echo "Run this script from inside the mcp-server project." >&2
  exit 1
fi

MCP_DIR="$ROOT_DIR/.vscode"
MCP_FILE="$MCP_DIR/mcp.json"

IS_WSL=false
if [[ -r /proc/version ]] && grep -qi microsoft /proc/version; then
  IS_WSL=true
fi

cd "$ROOT_DIR"

echo "==> Installing npm dependencies..."
if [[ "$IS_WSL" == true ]] && command -v cmd.exe >/dev/null 2>&1; then
  ROOT_DIR_WIN="$(wslpath -w "$ROOT_DIR")"
  cmd.exe /c "cd /d $ROOT_DIR_WIN && npm install"
else
  npm install
fi

echo "==> Writing VS Code MCP workspace config..."
mkdir -p "$MCP_DIR"

cat > "$MCP_FILE" <<'JSON'
{
  "servers": {
    "servidorSaudacao": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
JSON

echo
echo "VS Code MCP config created at: .vscode/mcp.json"
echo
echo "Next steps:"
echo "1. Open this folder in VS Code."
echo "2. Run 'MCP: List Servers' from the Command Palette."
echo "3. Start the 'servidorSaudacao' server."
echo "4. In chat/agent mode, call the tool 'tool_a_componentes'."
echo
echo "To run the MCP server manually:"
echo "  npm start"
echo
echo "To inspect/debug it:"
echo "  npm run inspect"
