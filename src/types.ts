export interface SearchResult {
  id: string;
  name: string;
  author: string;
  thumbnailUrl: string | null;
  downloadCount: number;
  source: "printables" | "thingiverse";
  url: string;
}

export interface ModelFile {
  id: string;
  name: string;
  sizeBytes: number;
  downloadUrl?: string;
}

export interface SliceResult {
  gcodePath: string;
  estimatedTime: string;
  estimatedFilamentM: number;
}

export interface GcodeAnalysis {
  layers: number;
  estimatedTime: string;
  filamentUsedMm: number;
  filamentUsedG: number;
}

export interface PrinterStatus {
  state: string;
  progressPct?: number;
  hotendTemp?: number;
  bedTemp?: number;
  fileName?: string;
  message?: string;
}
