export const extractBaseName = (key: string) =>
  key.replace("originals/", "").replace(/\.[^.]+$/, "");

export const markdownBaseName = (key: string) => key.replace(/\.md$/, "");
