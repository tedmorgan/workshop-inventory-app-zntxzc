/**
 * Bin merge helpers.
 *
 * The database stores one row per photo submission. Users can add several
 * submissions to the same bin (same name + location), which historically
 * showed up as several separate cards. These helpers group those rows into a
 * single logical bin FOR DISPLAY while preserving the source rows so edits,
 * deletes and check-outs can still operate on the correct underlying row.
 *
 * This is a pure module (no React / no Supabase) so it can be unit tested.
 *
 * Created: 2026-09-04
 */

export type ToolValue = string | { name?: string; quantity?: number; [k: string]: any };

export interface InventoryRow {
  id: string;
  image_url: string;
  tools: ToolValue[];
  bin_name: string;
  bin_location: string;
  created_at?: string;
  device_id?: string;
  [k: string]: any;
}

export interface MergedTool {
  /** The original tool value (string or object) as stored. */
  value: ToolValue;
  /** The id of the source row this tool belongs to. */
  rowId: string;
  /** Index of this tool within its source row's tools array (needed to remove the exact instance). */
  indexInRow: number;
}

export interface MergedBinImage {
  url: string;
  rowId: string;
}

export interface MergedBin {
  /** Representative row id (the newest row in the group). Used for filter matching. */
  id: string;
  bin_name: string;
  bin_location: string;
  images: MergedBinImage[];
  tools: MergedTool[];
  rowIds: string[];
  sourceRows: InventoryRow[];
  /** Total number of tools across all source rows. */
  toolCount: number;
}

/** Normalize a bin name/location for case- and whitespace-insensitive matching. */
export function normalizeKeyPart(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

/** Grouping key for a row: normalized "name|location". */
export function binKey(row: Pick<InventoryRow, 'bin_name' | 'bin_location'>): string {
  return `${normalizeKeyPart(row.bin_name)}|${normalizeKeyPart(row.bin_location)}`;
}

/** Human-readable label for a tool value (handles both strings and {name,quantity}). */
export function toolLabel(tool: ToolValue): string {
  if (typeof tool === 'string') return tool;
  if (tool && typeof tool === 'object') {
    const name = tool.name ?? '';
    const qty = typeof tool.quantity === 'number' ? tool.quantity : 1;
    return qty > 1 ? `${name} (${qty})` : `${name}`;
  }
  return String(tool);
}

/**
 * Group inventory rows into merged bins.
 *
 * Rows are grouped by normalized bin name + location. The first row seen for a
 * key becomes the representative (callers should pass rows newest-first if they
 * want the newest row's casing/image to lead). Order of rows within the group
 * is preserved, so tools and images keep a stable order.
 */
export function groupBins(rows: InventoryRow[]): MergedBin[] {
  const groups = new Map<string, MergedBin>();
  const order: string[] = [];

  for (const row of rows) {
    const key = binKey(row);
    let group = groups.get(key);
    if (!group) {
      group = {
        id: row.id,
        bin_name: row.bin_name,
        bin_location: row.bin_location,
        images: [],
        tools: [],
        rowIds: [],
        sourceRows: [],
        toolCount: 0,
      };
      groups.set(key, group);
      order.push(key);
    }
    group.rowIds.push(row.id);
    group.sourceRows.push(row);
    if (row.image_url) {
      group.images.push({ url: row.image_url, rowId: row.id });
    }
    const rowTools = Array.isArray(row.tools) ? row.tools : [];
    rowTools.forEach((t, i) => {
      group.tools.push({ value: t, rowId: row.id, indexInRow: i });
    });
    group.toolCount += rowTools.length;
  }

  return order.map((k) => groups.get(k)!);
}

/** Count of distinct bins (name + location) among rows. */
export function distinctBinCount(rows: InventoryRow[]): number {
  const keys = new Set<string>();
  for (const row of rows) keys.add(binKey(row));
  return keys.size;
}

/** Count distinct bins per location. Returns a map location -> bin count. */
export function binCountByLocation(rows: InventoryRow[]): Map<string, number> {
  const perLocation = new Map<string, Set<string>>();
  for (const row of rows) {
    const location = row.bin_location || 'Unspecified';
    if (!perLocation.has(location)) perLocation.set(location, new Set());
    perLocation.get(location)!.add(binKey(row));
  }
  const result = new Map<string, number>();
  for (const [loc, set] of perLocation.entries()) result.set(loc, set.size);
  return result;
}

export interface EditedTool {
  value: string;
  /** Source row id, or null for a newly added tool. */
  rowId: string | null;
}

export interface RowUpdatePlan {
  /** Rows to update with their new (string) tool arrays + new name/location. */
  updates: { id: string; tools: string[] }[];
  /** Row ids whose tools were all removed and should be deleted. */
  deletes: string[];
}

/**
 * Given a merged bin's source rows and the edited (flat) tool list, compute how
 * to write the changes back to the individual rows:
 *  - tools keep their original row assignment,
 *  - newly added tools (rowId null) go to the representative row,
 *  - rows left with zero tools are marked for deletion.
 */
export function planRowUpdates(
  merged: Pick<MergedBin, 'id' | 'rowIds'>,
  editedTools: EditedTool[]
): RowUpdatePlan {
  const primaryRowId = merged.id;
  const byRow = new Map<string, string[]>();
  // Seed every source row so rows that lose all tools are represented.
  for (const rowId of merged.rowIds) byRow.set(rowId, []);

  for (const t of editedTools) {
    const value = (t.value || '').trim();
    if (!value) continue;
    const targetRowId =
      t.rowId && merged.rowIds.includes(t.rowId) ? t.rowId : primaryRowId;
    if (!byRow.has(targetRowId)) byRow.set(targetRowId, []);
    byRow.get(targetRowId)!.push(value);
  }

  const updates: { id: string; tools: string[] }[] = [];
  const deletes: string[] = [];
  for (const [rowId, tools] of byRow.entries()) {
    if (tools.length === 0) {
      deletes.push(rowId);
    } else {
      updates.push({ id: rowId, tools });
    }
  }
  return { updates, deletes };
}
