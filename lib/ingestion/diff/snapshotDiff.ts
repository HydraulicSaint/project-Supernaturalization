export type DiffResult<T extends { sourceRecordKey: string; recordHash: string }> = {
  added: T[];
  changed: Array<{ previous: T; current: T }>;
  missing: T[];
  unchanged: T[];
};

export function diffSnapshots<T extends { sourceRecordKey: string; recordHash: string }>(
  previousRecords: T[],
  currentRecords: T[]
): DiffResult<T> {
  const previousByKey = new Map(previousRecords.map((record) => [record.sourceRecordKey, record]));
  const currentByKey = new Map(currentRecords.map((record) => [record.sourceRecordKey, record]));

  const added: T[] = [];
  const changed: Array<{ previous: T; current: T }> = [];
  const unchanged: T[] = [];

  for (const current of currentRecords) {
    const prev = previousByKey.get(current.sourceRecordKey);
    if (!prev) {
      added.push(current);
      continue;
    }

    if (prev.recordHash === current.recordHash) {
      unchanged.push(current);
    } else {
      changed.push({ previous: prev, current });
    }
  }

  const missing = previousRecords.filter((prev) => !currentByKey.has(prev.sourceRecordKey));
  return { added, changed, missing, unchanged };
}
