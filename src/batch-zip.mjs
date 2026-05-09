export function formatBatchZipName(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `Twitter Download - ${year}-${month}-${day}.zip`;
}

export function uniqueZipName(name, existing) {
  const used = new Set(existing);
  if (!used.has(name)) {
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${stem} (${index})${ext}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  throw new Error("Too many duplicate file names in batch.");
}
