# craftcha

A FiveM minigame resource featuring a **Minecraft-style crafting captcha**. Built with React + TypeScript frontend and Lua backend.

> **Status:** Actively maintained for the crafting minigame. The Perfect Circle minigame is soft-abandoned — it works but won't receive further updates or fixes. **Use of the Perfect Circle feature is not recommended;** stick to the crafting captcha.

> **Inspiration:** Directly inspired by Neal Agarwal's [I'm Not a Robot](https://neal.fun/not-a-robot/) on [neal.fun](https://neal.fun). Credit to him for the original concept.

---

## Features

### Crafting Grid
- 3x3 crafting grid where players arrange items to match a target recipe
- 6-column inventory with click-and-drag support
- Left-click moves full stacks, right-click splits stacks
- Recipe shape matching validates ingredient placement anywhere in the grid
- Timer bar that changes color (blue → yellow → red) as time runs out
- Reset button to clear the grid and restore inventory

### Perfect Circle
- Canvas-based drawing challenge
- Real-time accuracy analysis (0–100%) using multi-factor detection (closure, radius consistency, angular coverage, direction)
- Configurable minimum accuracy threshold
- Live feedback while drawing

---

## Installation

1. Drop the `craftcha` folder into your resources directory
2. Add `ensure craftcha` to your `server.cfg`
3. Navigate to the `web` directory and build the UI:
   ```
   npm install
   npm run build
   ```
4. Restart the resource

---

## Commands (for testing)

| Command | Description |
|---|---|
| `/craft` | Opens crafting minigame (easy, random recipe) |
| `/circletest` | Opens perfect circle minigame (easy) |
| `/show-nui` | Shows the NUI frame |

---

## Exports

### `openCraftcha(recipeKey, inventory, data)`

Opens the crafting minigame. Returns a promise that resolves to `true` (success) or `false` (failed/closed/timed out).

**Parameters:**
- `recipeKey` — Recipe key (e.g. `'diamond_pickaxe'`) or difficulty preset (`'easy'`, `'medium'`, `'hard'`)
- `inventory` — Array of `{type, qty}` tables or `false` for empty slots (optional)
- `data` — Config table with `timer` (seconds, 0 = unlimited) and `invRows` (optional)

```lua
local success = exports.craftcha:openCraftcha('diamond_pickaxe', {
    {type = 'diamond', qty = 3},
    {type = 'oak_log', qty = 1},
    false, false
}, {timer = 60, invRows = 1})

if success then
    -- player crafted correctly
end
```

---

### `openPerfectCircle(data)`

Opens the circle drawing minigame. Returns a promise resolving to `true` or `false`.

**Parameters:**
- `data` — Difficulty string (`'easy'`, `'medium'`, `'hard'`) or table `{minAccuracy, timer}`

```lua
local success = exports.craftcha:openPerfectCircle('hard')

-- Or with custom settings:
local success = exports.craftcha:openPerfectCircle({
    minAccuracy = 92,
    timer = 45
})
```

---

### `craftchaActive()`

Returns `true` if a minigame is currently running, `false` otherwise.

```lua
if exports.craftcha:craftchaActive() then
    print('minigame already open')
end
```

---

## Difficulty Presets

### Crafting Grid

| Preset | Timer |
|---|---|
| Easy | 60s |
| Medium | 45s |
| Hard | 30s |

### Perfect Circle

| Preset | Min Accuracy |
|---|---|
| Easy | 80% |
| Medium | 88% |
| Hard | 93% |

---

## Default Recipes

| Recipe | Ingredients |
|---|---|
| Diamond Pickaxe | 3 diamonds + 2 sticks |
| Diamond Sword | 2 diamonds + 1 stick |
| Diamond Shovel | 1 diamond + 2 sticks |
| Crafting Table | 4 oak planks |
| Oak Planks | 1 oak log |
| Stick | 1 oak planks |

---

## Adding Items and Recipes

Items and recipes live in **two files** — both must be updated, then you rebuild.

| File | Used by |
|---|---|
| `web/public/config.js` | The React UI (loaded at browser startup) |
| `web/public/data/recipes.json` | Lua, for validating `recipeKey` arguments |

`web/public/data/items.json` is not read by Lua anymore, but keep it in sync as a reference.

---

### Step 1 — Add the item

Open `web/public/config.js` and add an entry to `CRAFTCHA_ITEMS`:

```js
var CRAFTCHA_ITEMS = {
  // ... existing items ...
  "iron_ingot": {
    "label": "Iron Ingot",
    "img": "img/iron_ingot.webp",   // place your image in web/public/img/
    "max": 64
  }
};
```

Drop your image file into `web/public/img/`. The `img` field can also be a full `https://` URL.

---

### Step 2 — Add the recipe

Still in `web/public/config.js`, add an entry to `CRAFTCHA_RECIPES`:

```js
var CRAFTCHA_RECIPES = {
  // ... existing recipes ...
  "iron_sword": {
    "label": "Iron Sword",
    "result": "iron_sword",         // must match a key in CRAFTCHA_ITEMS
    "resultQty": 1,
    "shape": [
      ["iron_ingot"],
      ["iron_ingot"],
      ["stick"     ]
    ]
  }
};
```

**Shape rules:**
- Each inner array is one row of the 3x3 grid
- Use `null` for empty cells within the bounding box
- You don't need to pad to a full 3x3 — the checker matches anywhere in the grid
- Rows must all be the same width

---

### Step 3 — Update the Lua validation file

Open `web/public/data/recipes.json` and add the same recipe so Lua can validate the key:

```json
{
  "iron_sword": {
    "label": "Iron Sword",
    "result": "iron_sword",
    "resultQty": 1,
    "shape": [
      ["iron_ingot"],
      ["iron_ingot"],
      ["stick"     ]
    ]
  }
}
```

---

### Step 4 — Rebuild and restart

```
cd web
npm run build
```

Then in-game: `/restart craftcha`

---

### Step 5 — Use it

Pass the new recipe key to the export, along with an inventory containing the required items:

```lua
local success = exports.craftcha:openCraftcha('iron_sword', {
    {type = 'iron_ingot', qty = 2},
    {type = 'stick',      qty = 1},
}, {timer = 45})
```

---

## Inventory Integration

Open `client/client.lua` and find the `craftResult` NUI callback. Replace the TODO with your inventory export:

```lua
-- ox_inventory
exports.ox_inventory:AddItem(source, data.item, 1)

-- qb-core
TriggerServerEvent('QBCore:Server:AddItem', data.item, 1)
```

---

## Debug Mode

```
setr craftcha-debugMode 1
```

---

## Compatibility

- GTA5
- RDR3

## Dependencies

None — works standalone with any inventory system.
