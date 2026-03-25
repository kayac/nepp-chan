export const EDIT_THRESHOLD_MS = 5000;

export const extractBaseName = (key: string) =>
  key.replace("originals/", "").replace(/\.[^.]+$/, "");

export const buildOriginalsMap = (objects: R2Object[]) => {
  const map = new Map<string, Date>();
  for (const obj of objects) {
    if (obj.key.startsWith("originals/")) {
      map.set(extractBaseName(obj.key), obj.uploaded);
    }
  }
  return map;
};
