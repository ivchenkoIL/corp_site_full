# Модули старой игры (сгенерировано)

Собирается командой `npm run split` из `games/montazh-city-3d/index.html`. Не править руками.

| Модуль | Роль | Разделы монолита | Строк | На верхнем уровне | В `__init` | Импортирует из |
| --- | --- | --- | --- | --- | --- | --- |
| `core/quality.js` | основа | 410–869 | 479 | 3 | 1 | — |
| `core/util.js` | основа | 870–959 | 99 | 23 | 0 | `core/quality` |
| `render/gl.js` | рендер | 960–2147 | 1207 | 23 | 5 | `core/quality`, `core/util` |
| `render/mesh.js` | рендер | 2148–2675 | 538 | 3 | 0 | `core/util`, `world/district` |
| `render/textures.js` | рендер | 2676–3705 | 1044 | 43 | 0 | `core/quality`, `core/util`, `render/gl`, `render/static`, `render/renderer`, `game/loop` |
| `world/district.js` | данные | 3706–3885 | 197 | 12 | 2 | `core/util` |
| `game/collision.js` | логика | 3886–3969 | 95 | 6 | 0 | `core/util`, `world/district`, `render/vegetation` |
| `render/static.js` | рендер | 3970–3976 | 15 | 3 | 0 | — |
| `render/street.js` | рендер | 3977–4460 | 496 | 16 | 0 | `core/util`, `render/mesh`, `world/district`, `render/static` |
| `render/vegetation.js` | рендер | 4461–5345 | 908 | 24 | 3 | `core/quality`, `core/util`, `render/mesh`, `world/district`, `render/static`, `render/street` |
| `render/renderer.js` | рендер | 5346–6369 | 1050 | 27 | 1 | `core/quality`, `core/util`, `render/gl`, `render/textures`, `render/static`, `game/state`, `game/effects`, `render/frame`, `save/savegame`, `game/loop` |
| `render/characters.js` | рендер | 6370–6929 | 585 | 14 | 2 | `core/util`, `render/gl`, `render/mesh`, `render/textures`, `render/renderer`, `game/state` |
| `render/vehicles.js` | рендер | 6930–7272 | 358 | 6 | 0 | `core/quality`, `core/util`, `render/gl`, `render/mesh`, `render/textures`, `render/renderer`, `render/characters` |
| `audio/audio.js` | звук | 7273–7417 | 152 | 1 | 0 | — |
| `save/storage.js` | сохранение | 7418–7462 | 61 | 2 | 3 | — |
| `ui/dialog.js` | интерфейс | 7463–7551 | 103 | 2 | 0 | `core/util`, `render/gl`, `audio/audio`, `game/phone`, `game/input` |
| `game/phone.js` | логика | 7552–7956 | 432 | 14 | 1 | `core/util`, `world/district`, `audio/audio`, `ui/dialog`, `game/state`, `game/effects`, `game/npcs`, `game/missions`, `game/crew`, `ui/screens`, `save/savegame` |
| `ui/minigames.js` | интерфейс | 7957–8062 | 119 | 2 | 0 | `core/util`, `audio/audio`, `game/input`, `game/state` |
| `ui/minigame-door.js` | интерфейс | 8063–8814 | 767 | 8 | 0 | `core/util`, `audio/audio`, `ui/dialog`, `ui/minigames`, `ui/radio`, `game/input`, `game/state`, `game/effects` |
| `ui/radio.js` | интерфейс | 8815–8935 | 132 | 7 | 0 | `core/util`, `audio/audio`, `ui/minigames` |
| `game/input.js` | логика | 8936–9003 | 90 | 3 | 1 | `core/util`, `audio/audio`, `ui/dialog`, `game/state` |
| `game/state.js` | логика | 9004–9058 | 64 | 12 | 0 | `core/util` |
| `game/effects.js` | логика | 9059–9131 | 86 | 13 | 0 | `core/quality`, `core/util`, `audio/audio`, `game/state`, `ui/screens` |
| `game/movement.js` | логика | 9132–9329 | 215 | 7 | 0 | `core/util`, `world/district`, `game/collision`, `render/characters`, `audio/audio`, `game/input`, `game/state`, `game/effects`, `game/npcs` |
| `game/camera.js` | логика | 9330–9386 | 68 | 1 | 0 | `core/util`, `game/collision`, `game/input`, `game/state` |
| `ui/overlay2d.js` | интерфейс | 9387–9452 | 79 | 7 | 0 | `core/util`, `render/gl`, `render/renderer`, `ui/minigames` |
| `game/npcs.js` | логика | 9453–10014 | 590 | 28 | 1 | `core/util`, `world/district`, `game/collision`, `render/characters`, `render/vehicles`, `audio/audio`, `ui/dialog`, `game/phone`, `game/state`, `game/effects`, `game/movement`, `ui/hud` |
| `game/missions.js` | логика | 10015–10265 | 264 | 10 | 0 | `core/util`, `world/district`, `ui/dialog` |
| `game/crew.js` | логика | 10266–10723 | 479 | 25 | 0 | `core/util`, `world/district`, `render/characters`, `audio/audio`, `ui/dialog`, `ui/minigame-door`, `game/input`, `game/state`, `game/effects`, `game/npcs`, `game/missions`, `ui/hud`, `ui/screens`, `save/savegame` |
| `game/interaction.js` | логика | 10724–10784 | 81 | 3 | 0 | `core/util`, `world/district`, `audio/audio`, `game/phone`, `ui/minigame-door`, `game/state`, `game/effects`, `game/movement`, `game/npcs`, `game/crew`, `ui/hud`, `ui/screens` |
| `render/frame.js` | рендер | 10785–11781 | 1026 | 15 | 2 | `core/quality`, `core/util`, `render/gl`, `render/textures`, `world/district`, `render/static`, `render/renderer`, `render/characters`, `render/vehicles`, `ui/dialog`, `game/phone`, `game/state`, `ui/overlay2d`, `game/npcs` |
| `ui/hud.js` | интерфейс | 11782–11877 | 117 | 5 | 0 | `core/util`, `world/district`, `audio/audio`, `ui/radio`, `game/state`, `game/effects`, `game/crew`, `save/savegame` |
| `ui/screens.js` | интерфейс | 11878–12268 | 417 | 19 | 0 | `core/quality`, `core/util`, `world/district`, `render/renderer`, `audio/audio`, `save/storage`, `ui/dialog`, `game/phone`, `ui/minigames`, `ui/radio`, `game/input`, `game/state`, `game/effects`, `game/missions`, `game/crew`, `ui/hud`, `save/savegame`, `game/loop` |
| `save/savegame.js` | сохранение | 12269–12364 | 114 | 7 | 0 | `core/quality`, `core/util`, `world/district`, `audio/audio`, `save/storage`, `game/input`, `game/state`, `game/effects`, `ui/hud`, `game/loop` |
| `game/loop.js` | цикл | 12365–12649 | 329 | 16 | 1 | `core/quality`, `core/util`, `render/gl`, `render/textures`, `world/district`, `game/collision`, `render/vegetation`, `render/renderer`, `render/characters`, `render/vehicles`, `audio/audio`, `ui/dialog`, `game/phone`, `ui/minigames`, `ui/radio`, `game/input`, `game/state`, `game/effects`, `game/movement`, `game/camera`, `ui/overlay2d`, `game/npcs`, `game/missions`, `game/crew`, `game/interaction`, `render/frame`, `ui/hud`, `ui/screens`, `save/savegame` |

## Где логика и интерфейс знают о рендере

Это список мест, которые при переезде на новый движок должны пойти через мост рендера (`src/engine/bridge.js`), а не напрямую.

| Откуда | Куда | Имена |
| --- | --- | --- |
| `game/collision.js` | `render/vegetation.js` | `TREE_SP`, `treeSpecies` |
| `game/crew.js` | `render/characters.js` | `GAITS` |
| `game/movement.js` | `render/characters.js` | `GAITS` |
| `game/npcs.js` | `render/characters.js` | `GAIT`, `GAITS`, `IDLES` |
| `game/npcs.js` | `render/vehicles.js` | `CAR_SPEC` |
| `ui/dialog.js` | `render/gl.js` | `GL` |
| `ui/overlay2d.js` | `render/gl.js` | `GL` |
| `ui/overlay2d.js` | `render/renderer.js` | `R3` |
| `ui/screens.js` | `render/renderer.js` | `Perf`, `setQuality` |

## Запись в чужие переменные

- `Q` (живёт в `core/quality.js`) — пишется снаружи через `__set_Q()`
- `hudToolSig` (живёт в `ui/hud.js`) — пишется снаружи через `__set_hudToolSig()`

