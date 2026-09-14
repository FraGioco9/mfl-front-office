import { assembleFragments, writeGeneratedFragmentFile } from "./build-fragments.mjs";

export const htmlSourceDirectory = new URL("./html-sources/", import.meta.url);
export const assembleHtml = () => assembleFragments(htmlSourceDirectory, ".html");
await writeGeneratedFragmentFile(new URL("./index.html", import.meta.url), await assembleHtml());
