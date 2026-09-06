import { includes } from "./assertions.mjs";

export function validateResponsiveStatic(context) {
  const { indexHtml, responsive, stylesBase } = context;
  includes(stylesBase, ".advancedSettingValue {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;", "Advanced Settings value boxes must vertically center their content while preserving right alignment.");
  includes(stylesBase, ".advancedSettingChevron {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  align-self: center;\n  line-height: 1;", "Advanced Settings chevrons must be vertically centered in their header boxes.");
  includes(indexHtml, 'id="settingsIconGlyph" viewBox="0 0 24 24"', "Settings must expose one canonical shared SVG symbol.");
  includes(indexHtml, 'class="navEmoji navSettingsIcon settingsIcon"', "Settings navigation must use the shared Settings icon.");
  includes(indexHtml, 'class="settingsIcon advancedSettingsIcon"', "Advanced Settings must use the same shared Settings icon.");
  includes(indexHtml, 'M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5', "Settings must keep the redesigned symmetric gear geometry.");
  includes(responsive, '[data-initial-page="settings"] #sidebar .navButton[data-page="settings"] {\n    border-color: var(--primary);\n    background: var(--primary);\n    color: #ffffff;\n    box-shadow: none;\n  }', "Mobile first paint must use the same filled primary selected navigation state as hydrated navigation.");
  includes(responsive, "body > #appShell > main {\n    --mfl-footer-page-floor: max(560px, calc(100dvh - var(--mobile-nav-overlay-clearance)));\n    padding: 4px 12px calc(var(--mobile-nav-height) + 18px);", "Mobile page content must use the shared scaled footer floor and compact top padding.");
  includes(responsive, "#advancedSettingsModal .advancedSettingsFooter {\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 6px;\n    padding: 6px 8px;", "Advanced Settings must keep Reset, Discard, and Apply on one compact phone footer row.");
}
