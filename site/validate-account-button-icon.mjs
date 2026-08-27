import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [markup, dropdownStyles] = await Promise.all([
  read("./index.html"),
  read("./dropdowns.css"),
]);

invariant(
  !markup.includes("&#128100;") && !markup.includes("👤"),
  "The legacy account emoji icon must be removed completely.",
);
invariant(
  markup.includes('<button id="accountButton" class="compactButton" type="button" aria-haspopup="true" aria-expanded="false">'),
  "Account button must preserve its dropdown accessibility contract.",
);
invariant(
  markup.includes('<svg class="accountButtonIcon" viewBox="0 0 24 24" aria-hidden="true">')
    && markup.includes('<circle cx="12" cy="8" r="3.5"></circle>')
    && markup.includes('<path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"></path>')
    && markup.includes("<span>Account</span>"),
  "Account button must use the canonical outlined SVG icon and label markup.",
);
invariant(
  dropdownStyles.includes(".accountButtonIcon {")
    && dropdownStyles.includes("stroke: currentColor;")
    && dropdownStyles.includes("stroke-width: 2.1;")
    && dropdownStyles.includes("stroke-linecap: round;")
    && dropdownStyles.includes("stroke-linejoin: round;"),
  "Account icon must inherit button color and use the site's rounded outline stroke treatment.",
);
invariant(
  dropdownStyles.includes("#accountButton {")
    && dropdownStyles.includes("display: inline-flex;")
    && dropdownStyles.includes("align-items: center;")
    && dropdownStyles.includes("justify-content: center;")
    && dropdownStyles.includes("gap: 7px;"),
  "Account button must keep the icon and label centered with canonical inline-flex spacing.",
);

console.log("Account button icon validation passed.");
