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
let responsive = await read("./responsive.css");
let validator = await read("./validate-footer-redesign.mjs");

const oldCreator = `              <div class="siteFooterDetailsGroup siteFooterDetailsCreator">
                <span>Creator</span>
                <strong class="siteFooterDetailsCreatorName">Francesco Giocoli</strong>
                <div class="siteFooterDetailsCreatorLinks">
                  <a href="https://app.playmfl.com/users/0x9e5b126e993a771a" target="_blank" rel="noreferrer">MFL</a>
                  <span class="siteFooterDetailsDiscord" title="Discord username: FraGioco9">Discord: FraGioco9</span>
                  <a href="https://x.com/FraGioco9" target="_blank" rel="noreferrer">Twitter</a>
                </div>
              </div>`;

const newCreator = `              <div class="siteFooterDetailsGroup siteFooterDetailsCreator">
                <span>Creator</span>
                <div class="siteFooterDetailsCreatorLinks">
                  <a class="siteFooterDetailsCreatorLink" href="https://app.playmfl.com/users/0x9e5b126e993a771a" target="_blank" rel="noreferrer" aria-label="FraGioco9 on MFL">
                    <svg class="siteFooterDetailsCreatorIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-4.5 6h2.2l2.3 3.5L14.3 8h2.2v8h-2v-4.8L12 14.8l-2.5-3.6V16h-2V8Z"/></svg>
                    <span>FraGioco9</span>
                  </a>
                  <span class="siteFooterDetailsCreatorLink siteFooterDetailsCreatorDiscord" aria-label="Discord #FraGioco9">
                    <svg class="siteFooterDetailsCreatorIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 6.3A14 14 0 0 0 14.2 5l-.4.9a11.6 11.6 0 0 0-3.6 0L9.8 5a14 14 0 0 0-3.5 1.3C4.1 9.5 3.5 12.6 3.8 15.7A14 14 0 0 0 8 17.8l1-1.4c-.6-.2-1.2-.5-1.7-.8l.4-.3c3.3 1.5 6.9 1.5 10.2 0l.5.3c-.6.3-1.2.6-1.8.8l1 1.4a14 14 0 0 0 4.2-2.1c.4-3.6-.7-6.7-4.1-9.4ZM9.3 14.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm5.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>
                    <span>#FraGioco9</span>
                  </span>
                  <a class="siteFooterDetailsCreatorLink" href="https://x.com/FraGioco9" target="_blank" rel="noreferrer" aria-label="FraGioco9 on Twitter">
                    <svg class="siteFooterDetailsCreatorIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 3H22l-6.8 7.8L23.2 21h-6.3L12 14.6 6.4 21H3.2l7.3-8.4L2.8 3h6.4l4.4 5.8L18.9 3Zm-1.1 16.2h1.7L8.3 4.7H6.5l11.3 14.5Z"/></svg>
                    <span>@FraGioco9</span>
                  </a>
                </div>
              </div>`;
indexHtml = replaceOnce(indexHtml, oldCreator, newCreator, "creator markup");

const oldCreatorCss = `.siteFooterDetailsCreatorName {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.15;
}

.siteFooterDetailsCreatorLinks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  min-width: 0;
}

.siteFooterDetailsCreatorLinks > * {
  margin: 0;
}

.siteFooterDetailsDiscord {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.15;
  white-space: nowrap;
}`;
const newCreatorCss = `.siteFooterDetailsCreatorLinks {
  display: grid;
  align-content: start;
  gap: 5px;
  min-width: 0;
}

.siteFooterDetailsCreatorLink {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  margin: 0;
  gap: 5px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.15;
  white-space: nowrap;
}

.siteFooterDetailsCreatorIcon {
  flex: 0 0 12px;
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.siteFooterDetailsCreatorDiscord {
  cursor: default;
}`;
footer = replaceOnce(footer, oldCreatorCss, newCreatorCss, "creator styling");

responsive = responsive.replaceAll(
  `.siteFooterDetailsCreatorName,\n  .siteFooterDetailsDiscord,\n  .siteFooterDetailsGroup a {`,
  `.siteFooterDetailsCreatorDiscord,\n  .siteFooterDetailsGroup a {`,
);

validator = validator
  .replace(`  '<strong class="siteFooterDetailsCreatorName">Francesco Giocoli</strong>',\n`, "")
  .replace(`  '>MFL</a>',\n`, `  'aria-label="FraGioco9 on MFL"',\n  '<span>FraGioco9</span>',\n`)
  .replace(`  '<span class="siteFooterDetailsDiscord" title="Discord username: FraGioco9">Discord: FraGioco9</span>',\n`, `  'aria-label="Discord #FraGioco9"',\n  '<span>#FraGioco9</span>',\n`)
  .replace(`  '>Twitter</a>',\n`, `  'aria-label="FraGioco9 on Twitter"',\n  '<span>@FraGioco9</span>',\n`)
  .replace(`  '.siteFooterDetailsCreatorName {',\n`, `  '.siteFooterDetailsCreatorLinks {',\n  '.siteFooterDetailsCreatorLink {',\n  '.siteFooterDetailsCreatorIcon {',\n`)
  .replace(`  '.siteFooterDetailsCreatorLinks {',\n  '.siteFooterDetailsCreatorLinks > * {',\n  '.siteFooterDetailsDiscord {',\n`, "")
  .replace(`  '.siteFooterDetailsCreatorName,',\n  '.siteFooterDetailsDiscord,',\n`, `  '.siteFooterDetailsCreatorDiscord,',\n`);

for (const [name, content] of [["index.html", indexHtml], ["footer.css", footer], ["responsive.css", responsive], ["validate-footer-redesign.mjs", validator]]) {
  await write(`./${name}`, content);
}
