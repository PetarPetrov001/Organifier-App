export interface TranslatableContent {
  digest?: string | null;
  key: string;
  locale: string;
  value?: string | null;
}

export interface TranslatableResource {
  resourceId: string;
  translatableContent: TranslatableContent[];
}

export interface ProgressEntry {
  resourceId: string;
  locale: string;
  key: string;
  digest: string;
  valueHash: string;
  translatedAt: string;
  status: "success" | "failed";
  error?: string;
}

export interface ProgressFile {
  version: 1;
  entries: ProgressEntry[];
}