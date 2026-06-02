local recipes = {}
local dataLoaded = false

-- Minimum circle accuracy required per difficulty for the Perfect Circle minigame
local circlePresets = {
  easy   = {timer = 60, accuracy = 80},
  medium = {timer = 60, accuracy = 88},
  hard   = {timer = 60, accuracy = 93},
}

local presets = {
  times = {
    easy = 60,
    medium = 45,
    hard = 30,
  },
  recipes = {
    {
      recipe = 'diamond_pickaxe',
      inv = {
        { type = 'diamond',    qty = 3 },
        { type = 'oak_log',    qty = 1 },
      },
      invRows = 1,
    },
    {
      recipe = 'diamond_shovel',
      inv = {
        { type = 'diamond',    qty = 1 },
        { type = 'oak_log',    qty = 1 },
      },
      invRows = 1,
    },
    {
      recipe = 'diamond_sword',
      inv = {
        { type = 'diamond',    qty = 2 },
        { type = 'oak_log',    qty = 1 },
      },
      invRows = 1,
    },
    {
      recipe = 'stick',
      inv = {
        { type = 'oak_log',    qty = 1 },
      },
      invRows = 1,
    },
    {
      recipe = 'crafting_table',
      inv = {
        { type = 'oak_log',    qty = 1 },
      },
      invRows = 1,
    },
  },
}

local function loadData()
  -- Items are served via config.js (no Lua load needed).
  -- Recipes are loaded here only to validate recipeKey arguments at call time.
  local recipesFile = LoadResourceFile(GetCurrentResourceName(), 'web/build/data/recipes.json')
  if recipesFile then
    recipes = json.decode(recipesFile) or {}
  else
    print('[CRAFTCHA] ERROR: Could not read web/build/data/recipes.json — did you run npm run build?')
  end

  dataLoaded = true
end

AddEventHandler('onClientResourceStart', function(resourceName)
  if resourceName == GetCurrentResourceName() then loadData() end
end)

local function toggleNuiFrame(shouldShow)
  SetNuiFocus(shouldShow, shouldShow)
  SendReactMessage('setVisible', shouldShow)
end

---@type promise?
local craftchaPromise

---@param recipeKey string        Must match a key in recipes.json e.g. 'diamond_pickaxe'
---@param inventory table         Array of {type, qty} or false for empty slots
---@param data table?             Optional config: { timer = 60, invRows = 2 }
---@return boolean?               true = solved, false = failed/closed/timed out, nil = already active
function openCraftcha(recipeKey, inventory, data)
  if craftchaPromise then return end
  
  if not dataLoaded then
    print('[CRAFTCHA] ERROR: Data not loaded yet')
    return
  end
  
  
  
  data = data or {}
  
  if not inventory and recipeKey == 'easy' or recipeKey == 'medium' or recipeKey == 'hard' then
    local ran = math.random(#(presets.recipes))
    local dat = presets.recipes[ran]
    craftchaPromise = promise:new()

    local safeInventory = {}
    for i = 1, #dat.inv do
      local slot = dat.inv[i]
      if slot and slot.type then
        safeInventory[i] = { type = slot.type, qty = slot.qty or 1 }
      else
        safeInventory[i] = false
      end
    end

    SendReactMessage('openCraftcha', {
      recipeKey = dat.recipe,
      inventory = safeInventory,
      timer     = presets.times[recipeKey] or 0,
      invRows   = dat.invRows or 1,
    })

    toggleNuiFrame(true)

    return Citizen.Await(craftchaPromise)
  end

  if not recipes[recipeKey] then
    print('[CRAFTCHA] ERROR: Unknown recipeKey "' .. tostring(recipeKey) .. '" — check recipes.json')
    return
  end
  
  local safeInventory = {}
  for i = 1, #inventory do
    local slot = inventory[i]
    if slot and slot.type then
      safeInventory[i] = { type = slot.type, qty = slot.qty or 1 }
    else
      safeInventory[i] = false
    end
  end
  
  craftchaPromise = promise:new()
  
  SendReactMessage('openCraftcha', {
    recipeKey = recipeKey,
    inventory = safeInventory,
    timer     = data.timer   or 0,
    invRows   = data.invRows or 1,
  })
  
  toggleNuiFrame(true)
  
  return Citizen.Await(craftchaPromise)
end

---@return boolean
function craftchaActive()
  return craftchaPromise ~= nil
end

RegisterNUICallback('craftResult', function(data, cb)
  cb(1)
  if craftchaPromise then
    toggleNuiFrame(false)
    craftchaPromise:resolve(data.success)
    craftchaPromise = nil
  end
end)

RegisterNUICallback('hideFrame', function(_, cb)
  cb(1)
  if craftchaPromise then
    toggleNuiFrame(false)
    craftchaPromise:resolve(false)
    craftchaPromise = nil
  end
end)

-- ---------------------------------------------------------------------------
-- Test command
-- ---------------------------------------------------------------------------
RegisterCommand('craft', function()
  local success = openCraftcha("easy")

  if success then
    print('[CRAFTCHA] Player succeeded!')
    -- TODO: give item, trigger event, etc.
  else
    print('[CRAFTCHA] Player failed or closed.')
    -- TODO: handle failure
  end
end)

---@param data table?   Optional config: { minAccuracy = 90, timer = 60 }
---@return boolean?      true = passed, false = failed/closed/timed out, nil = already active
function openPerfectCircle(data)
  if craftchaPromise then return end

  data = data or {}

  if type(data) == "string" and circlePresets[data] then
    local str = data
    data = {}
    data.minAccuracy = circlePresets[str].accuracy
    data.timer = circlePresets[str].timer
  end

  craftchaPromise = promise:new()

  SendReactMessage('openPerfectCircle', {
    minAccuracy = data.minAccuracy or 85,
    timer       = data.timer or 0,
  })

  toggleNuiFrame(true)

  return Citizen.Await(craftchaPromise)
end

RegisterCommand('circletest', function()
  local success = openPerfectCircle("easy")

  if success then
    print('[CRAFTCHA] Player succeeded!')
    -- TODO: give item, trigger event, etc.
  else
    print('[CRAFTCHA] Player failed or closed.')
    -- TODO: handle failure
  end
end)

exports('openCraftcha', openCraftcha)
exports('openPerfectCircle', openPerfectCircle)
exports('craftchaActive', craftchaActive)
