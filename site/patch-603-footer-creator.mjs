import { readFile, writeFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const write = async (path, content) => writeFile(new URL(path, import.meta.url), content);
const replaceOnce = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before, after);
};

let indexHtml = await read("./index.html");
let responsive = await read("./responsive.css");

const oldFooterContent = `            <div class="siteFooterDetailsIdentity">
              <strong id="siteFooterDetailsTitle" class="siteFooterDetailsTitle">MFL Front Office</strong>
              <p>Management, scouting, progression, and evaluation tools for MFL.</p>
            </div>

            <nav class="siteFooterDetailsNavigation" aria-label="Footer information">
              <div class="siteFooterDetailsGroup">
                <span>Resources</span>
                <a href="/changelog" data-page="changelog">MFL Front Office v1.127.8</a>
                <a href="https://github.com/FraGioco9/mfl-front-office" target="_blank" rel="noreferrer">Source code</a>
              </div>
              <div class="siteFooterDetailsGroup">
                <span>Support</span>
                <a href="https://github.com/FraGioco9/mfl-front-office/issues/new" target="_blank" rel="noreferrer">Report a bug</a>
              </div>
              <div class="siteFooterDetailsGroup">
                <span>Creator</span>
                <a href="https://github.com/FraGioco9" target="_blank" rel="noreferrer">FraGioco9</a>
              </div>
            </nav>`;

const newFooterContent = `            <div class="siteFooterDetailsIdentity">
              <strong id="siteFooterDetailsTitle" class="siteFooterDetailsTitle">MFL Front Office</strong>
              <p>Management, scouting, progression, and evaluation tools for MFL.</p>
              <a href="/changelog" data-page="changelog">MFL Front Office v1.127.8</a>
            </div>

            <nav class="siteFooterDetailsNavigation" aria-label="Footer information">
              <div class="siteFooterDetailsGroup">
                <span>Support</span>
                <a href="https://github.com/FraGioco9/mfl-front-office/issues/new" target="_blank" rel="noreferrer">Report a bug</a>
              </div>
              <div class="siteFooterDetailsGroup siteFooterDetailsCreator">
                <span>Creator</span>
                <strong class="siteFooterDetailsCreatorName">Francesco Giocoli</strong>
                <div class="siteFooterDetailsCreatorLinks">
                  <a href="https://app.playmfl.com/users/0x9e5b126e993a771a" target="_blank" rel="noreferrer">MFL</a>
                  <span class="siteFooterDetailsDiscord" title="Discord username: FraGioco9">Discord: FraGioco9</span>
                  <a href="https://x.com/FraGioco9" target="_blank" rel="noreferrer">Twitter</a>
                </div>
              </div>
            </nav>`;

indexHtml = replaceOnce(indexHtml, oldFooterContent, newFooterContent, "footer content");
responsive = replaceOnce(
  responsive,
  `  .siteFooterDetailsNavigation {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 10px;\n  }`,
  `  .siteFooterDetailsNavigation {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 10px;\n  }`,
  "mobile footer columns",
);
responsive = responsive.replaceAll(
  `.siteFooterDetailsIdentity p,\n  .siteFooterDetailsGroup a {`,
  `.siteFooterDetailsIdentity p,\n  .siteFooterDetailsCreatorName,\n  .siteFooterDetailsDiscord,\n  .siteFooterDetailsGroup a {`,
);

await Promise.all([
  write("./index.html", indexHtml),
  write("./responsive.css", responsive),
]);
