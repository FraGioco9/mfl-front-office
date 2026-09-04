import { readFile, writeFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const write = async (path, content) => writeFile(new URL(path, import.meta.url), content);
const replaceOnce = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before, after);
};

let indexHtml = await read("./index.html");
let footer = await read("./footer.css");
let validator = await read("./validate-footer-redesign.mjs");

const placeholder = `<svg class="siteFooterDetailsCreatorIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-4.5 6h2.2l2.3 3.5L14.3 8h2.2v8h-2v-4.8L12 14.8l-2.5-3.6V16h-2V8Z"/></svg>`;
const mflLogo = `<svg class="siteFooterDetailsCreatorIcon siteFooterDetailsCreatorMflIcon" viewBox="0 0 463.6 135" aria-hidden="true"><path d="M323.2,53.94l-12.85,40.53h-70.91l-12.85,40.53h-42.42l25.65-81.05h113.38Z"></path><path d="M37.59,40.53c-4.57,0-8.66,2.97-10.04,7.33L0,134.99h42.46l29.91-94.46h-34.79Z"></path><path d="M353.68,0l-29.91,94.46h42.46l25.56-80.75c2.16-6.77-2.93-13.71-10.04-13.71h-28.11.04Z"></path><path d="M463.6,94.46l-12.81,40.53h-71.73l-12.85-40.53h97.39Z"></path><path d="M136.52,40.53l-29.9,94.46h-42.46l29.92-94.46h-21.7S85.23,0,85.23,0h22.38c20.68,0,35.14,20.83,28.91,40.53Z"></path><path d="M200.68,40.53l-29.9,94.46h-42.46l29.92-94.46h-21.72L149.37,0h22.4c20.68,0,35.14,20.83,28.91,40.53Z"></path><path d="M214.06,40.53h113.39L340.3,0h-105.68c-4.61,0-8.66,2.97-10.04,7.33l-10.52,33.2Z"></path></svg>`;
indexHtml = replaceOnce(indexHtml, placeholder, mflLogo, "MFL creator icon");

footer = replaceOnce(
  footer,
  `.siteFooterDetailsCreatorIcon {\n  flex: 0 0 12px;\n  width: 12px;\n  height: 12px;\n  fill: currentColor;\n}`,
  `.siteFooterDetailsCreatorIcon {\n  flex: 0 0 12px;\n  width: 12px;\n  height: 12px;\n  fill: currentColor;\n}\n\n.siteFooterDetailsCreatorMflIcon {\n  flex-basis: 16px;\n  width: 16px;\n}`,
  "MFL creator icon sizing",
);

validator = replaceOnce(
  validator,
  `  'aria-label="FraGioco9 on MFL"',\n  '<span>FraGioco9</span>',`,
  `  'aria-label="FraGioco9 on MFL"',\n  'class="siteFooterDetailsCreatorIcon siteFooterDetailsCreatorMflIcon" viewBox="0 0 463.6 135"',\n  '<span>FraGioco9</span>',`,
  "MFL creator validator markup",
);
validator = replaceOnce(
  validator,
  `  '.siteFooterDetailsCreatorIcon {',\n  '.siteFooterDetailsMeta {',`,
  `  '.siteFooterDetailsCreatorIcon {',\n  '.siteFooterDetailsCreatorMflIcon {',\n  '.siteFooterDetailsMeta {',`,
  "MFL creator validator styles",
);

await Promise.all([
  write("./index.html", indexHtml),
  write("./footer.css", footer),
  write("./validate-footer-redesign.mjs", validator),
]);
