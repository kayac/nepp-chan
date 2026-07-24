// web/public の画像アセット（mascot / logo）を縮小 webp の data URI に変換し、
// img[src="…"] { content: url(…) } の CSS シムを生成する。
// Claude Design 上ではルート絶対パスの画像が 404 になるため、
// styles.css の @import closure 経由でレンダーされたデザインにも画像を届ける。
// 前提: cwebp (brew install webp)
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outCss = join(root, ".design-sync/.cache/asset-shim.css");
const tmpDir = join(root, ".design-sync/.cache/webp");
mkdirSync(tmpDir, { recursive: true });

const targets = [
  ...readdirSync(join(root, "web/public/mascot"))
    .filter((f) => f.endsWith(".png"))
    .map((f) => ({ src: `/mascot/${f}`, file: join(root, "web/public/mascot", f) })),
  { src: "/logo-neppu.png", file: join(root, "web/public/logo-neppu.png") },
];

const rules = targets.map(({ src, file }) => {
  const out = join(tmpDir, src.replaceAll("/", "_") + ".webp");
  execFileSync("cwebp", ["-resize", "320", "0", "-q", "80", "-quiet", file, "-o", out]);
  const b64 = readFileSync(out).toString("base64");
  return `img[src="${src}"] { content: url("data:image/webp;base64,${b64}"); }`;
});

// AmbientBG は inline style の background-image で /bg-winter.png を参照する。
// img[src] シムでは届かないため、style 属性セレクタ + !important で上書きする
const bgOut = join(tmpDir, "_bg-winter.webp");
execFileSync("cwebp", ["-resize", "1280", "0", "-q", "80", "-quiet", join(root, "web/public/bg-winter.png"), "-o", bgOut]);
rules.push(
  `div[style*="/bg-winter.png"] { background-image: url("data:image/webp;base64,${readFileSync(bgOut).toString("base64")}") !important; }`,
);

writeFileSync(outCss, `${rules.join("\n")}\n`);
console.log(`asset-shim.css: ${targets.length + 1} images, ${Math.round(rules.join("\n").length / 1024)} KB`);
