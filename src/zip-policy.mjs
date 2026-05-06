export function shouldCreateZip(files, zipRequested) {
  return zipRequested === true && files.length > 1;
}
