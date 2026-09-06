import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message);
};

const [indexHtml, footer, responsive] = await Promise.all([
  read("./index.html"),
  read("./footer.css"),
  read("./responsive.css"),
]);

for (const token of [
  'class="siteFooterDetailsCreatorLink" href="https://app.playmfl.com/users/0x9e5b126e993a771a"',
  'class="siteFooterDetailsCreatorLink siteFooterDetailsCreatorDiscord"',
  'class="siteFooterDetailsCreatorLink" href="https://x.com/FraGioco9"',
  'class="siteFooterDetailsCreatorIcon siteFooterDetailsCreatorMflIcon"',
  '<span>FraGioco9</span>',
  '<span>#FraGioco9</span>',
  '<span>@FraGioco9</span>',
]) {
  includes(indexHtml, token, `Creator footer markup contract is missing: ${token}`);
}

const creatorStart = footer.indexOf(".siteFooterDetailsCreatorLink {");
const creatorEnd = footer.indexOf("\n}", creatorStart);
const creatorBlock = creatorStart >= 0 && creatorEnd > creatorStart
  ? footer.slice(creatorStart, creatorEnd)
  : "";
for (const token of [
  "display: grid;",
  "grid-template-columns: 16px auto;",
  "align-items: center;",
  "justify-items: start;",
  "column-gap: 5px;",
]) {
  includes(creatorBlock, token, `Creator rows must share one icon/value alignment grid: ${token}`);
}

const iconStart = footer.indexOf(".siteFooterDetailsCreatorIcon {");
const iconEnd = footer.indexOf("\n}", iconStart);
const iconBlock = iconStart >= 0 && iconEnd > iconStart ? footer.slice(iconStart, iconEnd) : "";
for (const token of [
  "justify-self: center;",
  "align-self: center;",
  "width: 12px;",
  "height: 12px;",
]) {
  includes(iconBlock, token, `Creator icons must center inside the shared 16px track: ${token}`);
}

const mflStart = footer.indexOf(".siteFooterDetailsCreatorMflIcon {");
const mflEnd = footer.indexOf("\n}", mflStart);
const mflBlock = mflStart >= 0 && mflEnd > mflStart ? footer.slice(mflStart, mflEnd) : "";
includes(mflBlock, "width: 16px;", "The wider MFL icon must preserve its existing 16px width.");
excludes(mflBlock, "flex-basis:", "Creator alignment must not rely on per-icon flex widths.");

includes(
  footer,
  ".siteFooterDetailsCreatorLink > span {\n  align-self: center;\n}",
  "Creator values must center in the same row as their icons.",
);
excludes(creatorBlock, "inline-flex", "Creator rows must use the shared icon/value grid rather than variable-width flex items.");
excludes(footer, "transform: translate", "Creator footer alignment must not use positional transform nudges.");
excludes(footer, "!important", "Creator footer alignment must not introduce !important overrides.");

for (const breakpoint of ["@media (max-width: 900px)", "@media (max-width: 520px)", "@media (max-width: 380px)"]) {
  includes(responsive, breakpoint, `Responsive footer contract is missing: ${breakpoint}`);
}
excludes(responsive, ".siteFooterDetailsCreatorLink {", "Responsive CSS must not duplicate the canonical Creator row alignment owner.");
excludes(responsive, ".siteFooterDetailsCreatorIcon {", "Responsive CSS must not duplicate the canonical Creator icon alignment owner.");

console.log("Footer Creator values and icons share one centered 16px icon track across desktop and mobile.");
