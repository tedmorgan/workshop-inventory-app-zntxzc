/**
 * Unit tests for the bin merge helpers (display-only grouping).
 * These guard the core logic that combines multiple submissions of the same
 * bin (name + location) into a single displayed card, and that edits/deletes
 * still map back to the correct underlying rows.
 *
 * Created: 2026-09-04
 */

import {
  binKey,
  normalizeKeyPart,
  toolLabel,
  groupBins,
  distinctBinCount,
  binCountByLocation,
  planRowUpdates,
  type InventoryRow,
} from '@/utils/mergeBins';

const row = (over: Partial<InventoryRow>): InventoryRow => ({
  id: 'id',
  image_url: 'img',
  tools: [],
  bin_name: 'Bin',
  bin_location: 'Garage',
  ...over,
});

describe('normalizeKeyPart / binKey', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(normalizeKeyPart('  Test2 ')).toBe('test2');
    expect(binKey({ bin_name: 'Test2', bin_location: 'Garage' })).toBe(
      binKey({ bin_name: ' test2 ', bin_location: ' GARAGE ' })
    );
  });

  it('distinguishes same name in different locations', () => {
    expect(binKey({ bin_name: 'Test3', bin_location: 'Garage' })).not.toBe(
      binKey({ bin_name: 'Test3', bin_location: 'Basement' })
    );
  });
});

describe('toolLabel', () => {
  it('passes strings through', () => {
    expect(toolLabel('Hammer')).toBe('Hammer');
  });
  it('renders object tools with quantity only when > 1', () => {
    expect(toolLabel({ name: 'Drill', quantity: 1 })).toBe('Drill');
    expect(toolLabel({ name: 'Drill', quantity: 3 })).toBe('Drill (3)');
    expect(toolLabel({ name: 'Saw' })).toBe('Saw');
  });
});

describe('groupBins', () => {
  it('combines rows with same name+location (case-insensitive) into one bin', () => {
    const rows = [
      row({ id: 'a', bin_name: 'Test2', bin_location: 'Garage', image_url: 'imgA', tools: ['Hammer', 'Wrench'] }),
      row({ id: 'b', bin_name: 'test2', bin_location: 'garage', image_url: 'imgB', tools: ['Drill'] }),
      row({ id: 'c', bin_name: 'Test3', bin_location: 'Basement', image_url: 'imgC', tools: ['Saw'] }),
    ];
    const merged = groupBins(rows);
    expect(merged).toHaveLength(2);

    const test2 = merged.find((m) => m.bin_name.toLowerCase() === 'test2')!;
    expect(test2.rowIds).toEqual(['a', 'b']);
    expect(test2.toolCount).toBe(3);
    expect(test2.images.map((i) => i.url)).toEqual(['imgA', 'imgB']);
    expect(test2.tools.map((t) => t.value)).toEqual(['Hammer', 'Wrench', 'Drill']);
    // representative id is the first row seen
    expect(test2.id).toBe('a');
  });

  it('tracks provenance (rowId + indexInRow) for each tool', () => {
    const rows = [
      row({ id: 'a', tools: ['Hammer', 'Wrench'] }),
      row({ id: 'b', tools: ['Drill'] }),
    ];
    const [merged] = groupBins(rows);
    expect(merged.tools).toEqual([
      { value: 'Hammer', rowId: 'a', indexInRow: 0 },
      { value: 'Wrench', rowId: 'a', indexInRow: 1 },
      { value: 'Drill', rowId: 'b', indexInRow: 0 },
    ]);
  });

  it('skips empty image urls but keeps the row', () => {
    const rows = [row({ id: 'a', image_url: '', tools: ['Hammer'] })];
    const [merged] = groupBins(rows);
    expect(merged.images).toHaveLength(0);
    expect(merged.rowIds).toEqual(['a']);
  });
});

describe('distinctBinCount / binCountByLocation', () => {
  const rows = [
    row({ id: 'a', bin_name: 'Test2', bin_location: 'Garage' }),
    row({ id: 'b', bin_name: 'test2', bin_location: 'Garage' }),
    row({ id: 'c', bin_name: 'Test3', bin_location: 'Garage' }),
    row({ id: 'd', bin_name: 'Test3', bin_location: 'Basement' }),
  ];

  it('counts distinct bins, not rows', () => {
    expect(rows).toHaveLength(4);
    expect(distinctBinCount(rows)).toBe(3); // Test2/Garage, Test3/Garage, Test3/Basement
  });

  it('counts distinct bins per location', () => {
    const byLoc = binCountByLocation(rows);
    expect(byLoc.get('Garage')).toBe(2);
    expect(byLoc.get('Basement')).toBe(1);
  });
});

describe('planRowUpdates', () => {
  const merged = { id: 'a', rowIds: ['a', 'b'] };

  it('keeps tools with their original row and updates in place', () => {
    const plan = planRowUpdates(merged, [
      { value: 'Hammer', rowId: 'a' },
      { value: 'Drill', rowId: 'b' },
    ]);
    expect(plan.deletes).toEqual([]);
    expect(plan.updates).toEqual([
      { id: 'a', tools: ['Hammer'] },
      { id: 'b', tools: ['Drill'] },
    ]);
  });

  it('assigns newly added tools (null rowId) to the representative row', () => {
    const plan = planRowUpdates(merged, [
      { value: 'Hammer', rowId: 'a' },
      { value: 'New Tool', rowId: null },
    ]);
    const rowA = plan.updates.find((u) => u.id === 'a')!;
    expect(rowA.tools).toEqual(['Hammer', 'New Tool']);
    expect(plan.deletes).toEqual(['b']); // b lost all its tools
  });

  it('marks a row for deletion when all its tools are removed', () => {
    const plan = planRowUpdates(merged, [{ value: 'Hammer', rowId: 'a' }]);
    expect(plan.updates).toEqual([{ id: 'a', tools: ['Hammer'] }]);
    expect(plan.deletes).toEqual(['b']);
  });

  it('trims and drops blank tool values', () => {
    const plan = planRowUpdates(merged, [
      { value: '  Hammer  ', rowId: 'a' },
      { value: '   ', rowId: 'b' },
    ]);
    expect(plan.updates).toEqual([{ id: 'a', tools: ['Hammer'] }]);
    expect(plan.deletes).toEqual(['b']);
  });

  it('reassigns tools from an unknown rowId to the representative row', () => {
    const plan = planRowUpdates(merged, [{ value: 'Orphan', rowId: 'zzz' }]);
    const rowA = plan.updates.find((u) => u.id === 'a')!;
    expect(rowA.tools).toEqual(['Orphan']);
  });
});
