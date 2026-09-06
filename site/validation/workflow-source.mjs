import { readValidationText } from "../validation-text.mjs";

// Follow the script actually wired to each step so existing behavior assertions
// keep testing the same implementation after it moves out of YAML.
export async function readWorkflowSource(url) {
  const source = await readValidationText(url);
  const pattern = /^( +)run: bash "\$GITHUB_WORKSPACE\/(?:builder\/)?(scripts\/workflows\/[a-z0-9-]+\.sh)"$/gm;
  let result = "", cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const body = await readValidationText(new URL(`../../${match[2]}`, import.meta.url));
    result += source.slice(cursor, match.index) + `${match[1]}run: |\n` + body.replace(/^#![^\n]+\n/, "").trimEnd().split("\n").map((line) => `${match[1]}  ${line}`).join("\n");
    cursor = match.index + match[0].length;
  }
  return result + source.slice(cursor);
}
