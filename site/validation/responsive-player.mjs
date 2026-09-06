import { includes } from "./assertions.mjs";

export function validateResponsivePlayer(context) {
  const { sharedTableUi } = context;
  includes(sharedTableUi, 'if (views.matches("#playerDetail .playerAttributeViews")) return "attribute views";', "Shared arrows must expose a contextual accessible label for Player Attribute views.");
  includes(sharedTableUi, 'target.matches("#progressionPage .views, #progressionPage .quickFilters, #playerDetail .playerAttributeViews")', "Resize observation must cover table views, Quick Filters, and dynamic Player Attribute views.");
}
