export const EDIT_THRESHOLD_MS = 5000;

export const extractBaseName = (key: string) =>
  key.replace("originals/", "").replace(/\.[^.]+$/, "");

export const markdownBaseName = (key: string) => key.replace(/\.md$/, "");

export const isEditedAfterOriginal = (
  markdownUploaded: Date,
  originalUploaded: Date | undefined,
) =>
  originalUploaded !== undefined &&
  markdownUploaded.getTime() - originalUploaded.getTime() > EDIT_THRESHOLD_MS;

export const buildOriginalsMap = (objects: R2Object[]) => {
  const map = new Map<string, Date>();
  for (const obj of objects) {
    if (obj.key.startsWith("originals/")) {
      map.set(extractBaseName(obj.key), obj.uploaded);
    }
  }
  return map;
};
