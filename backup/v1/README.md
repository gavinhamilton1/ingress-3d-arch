# FlowKit

A small kit for 3D architecture animations, built on anime.js v4 and CSS 3D transforms.

## Files

- `flowkit.js`, `flowkit.css`: the kit
- `scenes/ingress.js`: the Unified Ingress scene (four chapters)
- `ingress.html`: development page (loads anime.js from cdnjs)
- `build.py`: bundles a page into one offline HTML file
- `vendor/anime.umd.min.js`: anime.js 4.5.0 (MIT)
- `dist/ingress-journeys.html`: built, self-contained output

Build: `python3 build.py ingress.html dist/ingress-journeys.html`

Debug a frame: open `ingress.html?ch=2&t=7000` to pause chapter 2 at 7 seconds.

## Coordinates

x right, y down (floor at y = 0, so "up" is negative y), z towards the viewer.

## Building blocks

| Piece | Use |
|---|---|
| `new Stage(frameEl)` | Camera, render loop, overlays, pointer parallax |
| `new Device(stage, world, {x, z, kind, label, sub, ...})` | `kind`: `rack`, `gateway`, `laptop`, `pods`, `phone`. Has `health()`, `activate()`, `show()` |
| `zone(stage, world, {x1, x2, z1, z2, color, label, sub})` | Network zone platform with floor lettering |
| `new Wall(stage, world, {x, z1, z2, lanes, color, label})` | Firewall with gates; `pass()` opens a gate, `deny()` flashes red |
| `new Link(stage, world, points)` | Cable through any 3D points; lights up as packets pass |
| `route([links], reverse)` | Joins links into one path for a packet |
| `new Packet(stage, world)` | Spinning 3D packet with a label chip: `appear`, `travel`, `open` (TLS break), `seal`, `shatter`, `vanish` |
| `new Trace(stage)` | Distributed trace waterfall (HUD) |
| `new ObsWall(stage, world, {...})` | Observability wall: logs, KPIs, alerts |
| `stage.checklist(tl, pos, {...})` | Floating panel of checks that tick pass, warn or fail |
| `stage.caption.at(tl, pos, step, text)` | Caption bar |
| `stage.shot(tl, pos, shot, dur)` | Camera move; a shot is `{x, y, z, rx, ry, d}` |
| `fly(...)`, `ring(...)` | Tokens flying between points, pulse rings |
| `new Player(stage, host, chapters)` | Chapter buttons, play all, pause, restart |

Every timed helper takes `(tl, pos, ...)` and returns the time it finishes, so scripts chain:

```js
let t = 0;
t = packet.travel(tl, t, route([L.a, L.b]), 1200);
t = stage.checklist(tl, t, { at: gw.top, title: 'Gateway', items: [{ t: 'TLS terminated' }] });
```

## Naming

All labels in the ingress scene live in `NAMES` at the top of `scenes/ingress.js`.

## Limits

- CSS 3D has no real lighting. Faces are shaded by hand.
- Keep a scene under roughly 1,500 elements. Past that, Chrome's depth sorting gets unreliable, so labels, chips and panels are drawn in a 2D overlay positioned from projected 3D points.
- For heavy particle work or realistic lighting, move to anime.js driving Three.js.
