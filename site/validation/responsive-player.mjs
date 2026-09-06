import { excludes, includes } from "./assertions.mjs";

export function validateResponsivePlayer(context) {
  const { responsive, sharedTableUi } = context;
  includes(sharedTableUi, 'if (views.matches("#playerDetail .playerAttributeViews")) return "attribute views";', "Shared arrows must expose a contextual accessible label for Player Attribute views.");
  includes(sharedTableUi, 'target.matches("#progressionPage .views, #progressionPage .quickFilters, #playerDetail .playerAttributeViews")', "Resize observation must cover table views, Quick Filters, and dynamic Player Attribute views.");
  includes(responsive, ".views,\n  .quickFilters {\n    scroll-padding-inline: 10px;\n  }", "Shared table Views and Quick Filters must retain their coarse-pointer focus inset.");
  excludes(responsive, ".views,\n  .quickFilters,\n  .playerAttributeViews {\n    scroll-padding-inline: 10px;\n  }", "Player Attribute views must end at their true native boundary without an inward focus-scroll inset.");
  includes(responsive, "overflow-y: hidden;\n  overflow-anchor: none;\n  overscroll-behavior-x: auto;", "Player Attribute views must opt out of browser scroll anchoring so rubber-band/layout handoffs cannot adjust the native horizontal endpoint.");
  excludes(responsive, ".playerAttributeViews.mflViewsOverflowing {\n  overflow-x: auto;\n  overscroll-behavior-x: none;\n  -webkit-overflow-scrolling: touch;", "Player Attribute views must not opt into the legacy WebKit momentum-scrolling path; modern iOS overflow scrolling is already accelerated natively.");
}
