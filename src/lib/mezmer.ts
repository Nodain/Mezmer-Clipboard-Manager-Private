import type { MezmerFileRecord, MezmerFolder, MezmerHealth } from "./types";

export const MEZMER_BASE = "http://127.0.0.1:47832";

export async function checkMezmerHealth(): Promise<MezmerHealth | null> {
  try {
    const res = await fetch(`${MEZMER_BASE}/api/health`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MezmerHealth;
    if (!data.ok || data.app !== "Mezmer") return null;
    return data;
  } catch {
    return null;
  }
}

export async function listMezmerFolders(): Promise<MezmerFolder[]> {
  const res = await fetch(`${MEZMER_BASE}/api/folders`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : "Failed to list folders",
    );
  }
  return res.json();
}

export interface ImportPayload {
  url?: string;
  data?: string;
  name?: string;
  folderId?: number;
  sourceUrl?: string;
}

export async function importToMezmer(
  payload: ImportPayload,
): Promise<MezmerFileRecord> {
  const res = await fetch(`${MEZMER_BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Import failed",
    );
  }
  return body as MezmerFileRecord;
}

export function flattenFolders(
  folders: MezmerFolder[],
  depth = 0,
): Array<MezmerFolder & { depth: number }> {
  const byParent = new Map<number | null, MezmerFolder[]>();
  for (const f of folders) {
    const key = f.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }

  const out: Array<MezmerFolder & { depth: number }> = [];
  const walk = (parentId: number | null, d: number) => {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ ...f, depth: d });
      walk(f.id, d + 1);
    }
  };
  walk(null, depth);
  return out;
}
