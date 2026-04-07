# agent-printer

MCP server for AI-driven 3D printing on AnkerMake M5.

## Build & Run

```bash
npm run build    # Compile TypeScript
npm start        # Run compiled server
npm run dev      # Run with tsx (dev mode)
```

## Tools

| Tool | Purpose |
|------|---------|
| `search_models` | Search Printables.com for 3D models |
| `download_model` | Download STL files to workspace |
| `slice_model` | Slice STL → GCode with M5 profiles |
| `analyze_gcode` | Parse GCode for time/filament estimates |
| `send_print` | Upload GCode and start print |
| `printer_status` | Get printer temp/progress via MQTT |
| `printer_gcode` | Send raw GCode commands |
| `pause_print` | Pause active print |
| `resume_print` | Resume paused print |
| `cancel_print` | Cancel print |
| `capture_snapshot` | Camera video capture |
| `generate_scad` | OpenSCAD parametric design (if installed) |

## Constraints

- Never use `console.log` — it breaks stdio MCP transport. Use `console.error`.
- All file paths must be absolute (Windows).
- Printer must be on same LAN for ankerctl commands.
- Auth tokens expire ~30 days; re-extract from eufyMake Studio LevelDB if needed.

## Key Paths

- ankerctl: `C:\Users\sabro\ankermake-m5-protocol\ankerctl.py`
- Slicer: `C:\Users\sabro\AppData\Local\eufyMake Studio 3D\eufymake studio-console.exe`
- Workspace: `./workspace/` (gitignored)
