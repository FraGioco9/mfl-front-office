import { assembleFragments, writeGeneratedFragmentFile } from "./build-fragments.mjs";

export const responsiveSourceDirectory = new URL("./responsive-sources/", import.meta.url);
export const assembleResponsive = () => assembleFragments(responsiveSourceDirectory, ".css.inc");
await writeGeneratedFragmentFile(new URL("./responsive.css", import.meta.url), await assembleResponsive());
