// Membuat varian fragmen dari build satu-file: tanpa <!doctype>/<html>/<head>/<body>,
// untuk host yang membungkus halaman dengan kerangka dokumennya sendiri (mis. Claude Artifact).
import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync(new URL("../dist-single/index.html", import.meta.url), "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1].replace(/<meta charset[^>]*>/i, "").replace(/<meta name="viewport"[^>]*>/i, "");
const body = html.match(/<body>([\s\S]*?)<\/body>/i)[1];
const out = head.trim() + "\n" + body.trim() + "\n";
writeFileSync(new URL("../dist-single/air-in-motion.html", import.meta.url), out);
console.log(`fragment: ${(out.length / 1e6).toFixed(2)} MB`);
