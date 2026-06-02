// Static data for the craftcha NUI — loaded once at page startup before React initialises.
// To add items or recipes: edit this file AND web/public/data/items.json / recipes.json,
// then run `npm run build` and restart the resource.

var CRAFTCHA_ITEMS = {
  "diamond": {
    "label": "Diamond",
    "img": "https://minecraft.wiki/images/thumb/Diamond_JE3_BE3.png/96px-Diamond_JE3_BE3.png",
    "max": 64
  },
  "stick": {
    "label": "Stick",
    "img": "img/stick.webp",
    "max": 64
  },
  "oak_planks": {
    "label": "Oak Planks",
    "img": "img/oakplank.webp",
    "max": 64
  },
  "oak_log": {
    "label": "Oak Log",
    "img": "img/oak_log.webp",
    "max": 64
  },
  "diamond_pickaxe": {
    "label": "Diamond Pickaxe",
    "img": "https://minecraft.wiki/images/thumb/Diamond_Pickaxe_JE3_BE3.png/96px-Diamond_Pickaxe_JE3_BE3.png",
    "max": 1
  },
  "diamond_sword": {
    "label": "Diamond Sword",
    "img": "img/diamond_sword.png",
    "max": 1
  },
  "diamond_shovel": {
    "label": "Diamond Shovel",
    "img": "img/diamond_shovel.png",
    "max": 1
  },
  "crafting_table": {
    "label": "Crafting Table",
    "img": "img/crafting_table.webp",
    "max": 64
  }
};

var CRAFTCHA_RECIPES = {
  "diamond_pickaxe": {
    "label": "Diamond Pickaxe",
    "result": "diamond_pickaxe",
    "resultQty": 1,
    "shape": [
      ["diamond", "diamond", "diamond"],
      [null,      "stick",   null     ],
      [null,      "stick",   null     ]
    ]
  },
  "diamond_sword": {
    "label": "Diamond Sword",
    "result": "diamond_sword",
    "resultQty": 1,
    "shape": [
      ["diamond"],
      ["diamond"],
      ["stick"  ]
    ]
  },
  "diamond_shovel": {
    "label": "Diamond Shovel",
    "result": "diamond_shovel",
    "resultQty": 1,
    "shape": [
      ["diamond"],
      ["stick"  ],
      ["stick"  ]
    ]
  },
  "stick": {
    "label": "Stick",
    "result": "stick",
    "resultQty": 4,
    "shape": [
      ["oak_planks"],
      ["oak_planks"]
    ]
  },
  "crafting_table": {
    "label": "Crafting Table",
    "result": "crafting_table",
    "resultQty": 1,
    "shape": [
      ["oak_planks", "oak_planks"],
      ["oak_planks", "oak_planks"]
    ]
  },
  "oak_planks": {
    "label": "Oak Planks",
    "result": "oak_planks",
    "resultQty": 4,
    "shape": [
      ["oak_log"]
    ]
  }
};
