import { existsSync } from "node:fs";
import path from "node:path";

export interface Config {
  pythonPath: string;
  ankerctlPath: string;
  slicerPath: string;
  slicerProfilesDir: string;
  openscadPath: string | null;
  workspaceDir: string;
}

const PYTHON = "C:\\Users\\sabro\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";
const ANKERCTL = "C:\\Users\\sabro\\ankermake-m5-protocol\\ankerctl.py";
const SLICER = "C:\\Users\\sabro\\AppData\\Local\\eufyMake Studio 3D\\eufymake studio-console.exe";
const PROFILES = "C:\\Users\\sabro\\AppData\\Local\\eufyMake Studio 3D\\resources\\profiles\\Anker-ini";
const WORKSPACE = "C:\\Users\\sabro\\Documents\\GitHub\\agent-printer\\workspace";

function findOpenSCAD(): string | null {
  const candidates = [
    "C:\\Program Files\\OpenSCAD\\openscad.exe",
    "C:\\Program Files (x86)\\OpenSCAD\\openscad.exe",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;

  const missing: string[] = [];
  if (!existsSync(PYTHON)) missing.push(`Python: ${PYTHON}`);
  if (!existsSync(ANKERCTL)) missing.push(`ankerctl: ${ANKERCTL}`);
  if (!existsSync(SLICER)) missing.push(`Slicer: ${SLICER}`);

  if (missing.length > 0) {
    console.error(`[config] WARNING: Missing tools:\n  ${missing.join("\n  ")}`);
  }

  _config = {
    pythonPath: PYTHON,
    ankerctlPath: ANKERCTL,
    slicerPath: SLICER,
    slicerProfilesDir: PROFILES,
    openscadPath: findOpenSCAD(),
    workspaceDir: WORKSPACE,
  };

  console.error(`[config] workspace: ${_config.workspaceDir}`);
  console.error(`[config] openscad: ${_config.openscadPath ?? "not found (design tools disabled)"}`);
  return _config;
}
