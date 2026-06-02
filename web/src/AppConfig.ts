// Types and globals loaded from web/public/config.js via <script> tag in index.html.
// Edit config.js to add items or recipes — no NUI message needed.

export interface ItemDef {
  label: string;
  img: string;
  max: number;
}

export interface RecipeDef {
  label: string;
  result: string;
  resultQty: number;
  shape: (string | null)[][];
}

declare var CRAFTCHA_ITEMS: Record<string, ItemDef>;
declare var CRAFTCHA_RECIPES: Record<string, RecipeDef>;

export const craftchaItems: Record<string, ItemDef> =
  typeof CRAFTCHA_ITEMS !== 'undefined' ? CRAFTCHA_ITEMS : {};

export const craftchaRecipes: Record<string, RecipeDef> =
  typeof CRAFTCHA_RECIPES !== 'undefined' ? CRAFTCHA_RECIPES : {};
