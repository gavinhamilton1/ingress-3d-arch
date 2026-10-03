# FlowKit

A small kit for 3D architecture animations, built on CSS 3D transforms with its own deterministic timeline (no dependencies).

## Files

- `flowkit.js`, `flowkit.css`: the kit
- `scenes/ingress.js`: the ingress scene (layer chapters and journeys)
- `scenes/captions.js`: every caption's title, text and on-screen time, per chapter: edit this to change the narrative and pacing
- `scenes/aws-icons.js`: official AWS Architecture Icons plus the Envoy and Kong marks used in the detail views, embedded as SVG (source files and notes in `assets/aws/` and `assets/brand/`)
- `ingress.html`: development page
- `build.py`: bundles a page into one offline HTML file
- `dist/ingress-journeys.html`: built, self-contained output

Build: `python3 build.py` (defaults to `ingress.html` → `dist/ingress-journeys.html`; pass a page and output path to bundle another scene)

Run locally: `python3 -m http.server 8765`, then open `http://localhost:8765/ingress.html`.

Deep link: `ingress.html?ch=2&t=7000` opens chapter 2 paused at 7 seconds. **Copy link** in the player does this for you.

## The architecture (scene)

| Layer | Name | Components |
|---|---|---|
| L0 | DNS control plane (ahead of the request path, left of the clients) | 4 JPMorgan primary NS (CNAME → Akamai GTM) + 3 Cloudflare secondary NS (zone transfer; Cloudflare LB via override) |
| L1 | Client | Browser · Mobile app · API client · Delegated agent · Autonomous agent · M2M |
| L2 | Edge protection / CDN | Akamai · Cloudflare, active-active from one ruleset. Classifies callers; does not establish identity |
| L3 | Regional perimeter | PSaaS+ with Akamai SiteShield (on-prem, 9 DCs) · AWS WAF (8 regions). CDN traffic only |
| L4 | Enforcement tier · SESF / Tier 2 | T2 gateway on-prem and on EKS (Envoy / Kong): session validator, token exchange, global and route policies, signal receiver. The single enforcement point; fails closed |
| L5 | IFA workload zone | Application workloads on GKP and EKS, reachable only from L4 over mTLS; identity arrives as headers |
| L6 | Internal network | Downstream services, systems of record, session manager, signal manager, message broker, config pipeline |
| P1 | Private connectivity | Institutional client over VAN / private circuit / leased line → BP PSaaS, entering at L3 |
| P2 | Cloud private connectivity | Partner service in its own AWS VPC → interface endpoint → PrivateLink → our endpoint service + NLB, entering at L4 |

Layers run left to right; L0 is a box to the left of the client column. Akamai and on-prem use the back lane, Cloudflare and AWS the front lane, and L3 to L5 are split into on-prem and AWS. The back corridor holds P1; the partner VPC sits in front of our VPC inside the AWS network. Firewalls with doors separate L2/L3, L3/L4 (SESF), L4/L5 (IFA zone) and L5/L6. All names, roles, footprints and the illustrative control checklists live in `LAYERS`, `NAMES`, `FOOTPRINT`, `ROLES` and `CHECKS` at the top of `scenes/ingress.js`; the per-client-type table (L2 defences, what is presented and resolved at L4, step-up, risk response, injected identity) lives in `CT`.

DNS (L0): jpmorgan.com is delegated to 4 JPMorgan-hosted nameservers (ns1, ns2, ns05, ns06.jpmorganchase.com, the primary) and 3 Cloudflare nameservers (ns0098, ns0134, ns0221.secondary.cloudflare.com), secondary via zone transfer. The primary hands app hostnames off by CNAME to Akamai GTM; Cloudflare answers overridden hostnames via Cloudflare LB. A quiet pink "DNS lookups" pipe links the client column to the box; in the chapters a lookup is a small white dot travelling client → pipe → NS → GTM / LB → back, before the request leaves along the floor. Lookups live in `DNSQ`.

L4 deployment views (modelled on `../jpmc/ingress-poc`): the on-prem T2 node expands into gateway-envoy's filter chain (listener → route match → ext_authz → router) over auth-service, which resolves the session (session validator, revoke cache), exchanges the token and evaluates the Rego payload policies in order: the global policy (`ingress.policy.payload.global`, blocklist) and the route policy generated from the workload's code (e.g. `route_users_register`, default deny). An evaluation panel shows the request JSON, each rule and the result (201, or 403 with the reason). A second view shows live state: the session validator against the session manager (L6), and a CAEP risk-level-change from the signal manager (L6) arriving through the message broker at the signal receiver, which turns it into step-up; the next request gets a 401. Content lives in `T2D`, `PAY`, `t2Run`, `T3D`, `t3Html`, `t3Run`, `t3Signal` and `signalStory`.

Chapters are in two rows. **Layers** (keys 1–9): The layers, L0 DNS Control Plane, L1 Client, L2 Edge Protection / CDN, L3 Regional Perimeter, L4 Enforcement Tier, L5 IFA Workload Zone, L6 Internal Network, P Private Connectivity. Each explains what the layer is, what it does, why it exists and its latency budget (`LAYER_CH`). **Journeys** (Shift+1–7): Web on-prem, Client types at L4, Payload policies at L4, API into AWS, Private connectivity (P1, P2), Failover, Defense in depth.

Detail views (listed under **Deployment diagrams** in the player; select one to fly in, Reset view to come back): zoom in with the mouse wheel over the AWS T2 gateway (L4) and the tower gives way to the L4 architecture on AWS, left to right like the main diagram: traffic from L3 (the CTC edge account's internet gateway, internet-facing ALB with AWS WAF and interface VPC endpoint) and from P2 partners' interface endpoints arrives over PrivateLink at the Spoke VPC's endpoint service, then the NLB (public subnet), then the internal ALB (private subnet), then EKS cluster `ingress-l4`: namespace `ingress-gateway` runs the Envoy (web) and Kong (API) gateway pods, each with a session-validator sidecar that also does the session check, token exchange and ext_authz policies; namespace `ingress-control` runs the Kong control plane (backed by Aurora PostgreSQL), the xDS control plane, the config distributor and the signal receiver. ElastiCache for Redis holds the caches; onward to L5 is mTLS. Group boxes carry their icon and title in the top-left corner, as in AWS deployment diagrams, using the official AWS Architecture Icons and the Envoy and Kong marks. Defined in `scenes/ingress.js` under "Detail views".

Latency budget: 50 ms p95 from L1 to L5, warm connections, a well-placed NA user (draft, in `BUDGET`). Network legs (striped; they depend on where the user is): client → edge 8, edge → region 10. JPMC processing: edge 3, perimeter 3, L4 inspect + policy 10, L4 live state + exchange 14. DNS is cached per TTL and workload time is the application's own, so both sit outside it.

## Player controls

| Action | Mouse | Keys |
|---|---|---|
| Play / pause | ▶ | Space |
| Reverse play | ◀ | J (again = faster) |
| Forward shuttle | | L (again = faster), K pauses |
| One frame | ‹ › | , . or ← → |
| 100 ms / 1 s | | Alt+← → / Shift+← → |
| Previous / next step | ⏪ ⏩, or click a step | [ ] |
| Scrub | drag the timeline; hold Shift for 10× finer | wheel over the timeline = frame steps |
| Speed | 0.1× to 4× | |
| Loop, play all | buttons | |
| Chapters | buttons | 1 to 9 |

Camera: drag to orbit, right-drag or Shift-drag to pan, wheel to zoom (towards the cursor), double-click or R to reset, F to follow the script again. Click a device (or its label) for an info card with its layer, role, regional footprint and controls. Hover a layer in the legend to isolate it; click a layer to fly there. Hide overlays (H) hides the layer key, caption, latency card, trace and labels.

## Time model

Everything is a pure function of time, so any frame can be reached by jumping, scrubbing backwards or playing in reverse, and it always looks the same.

| Call | Use |
|---|---|
| `tl.add(target, {prop: to \| [from, to] \| [k0, k1, ...], duration, ease, delay}, pos)` | Continuous tween on an object or element (`x y z rotateX rotateY rotateZ scale opacity`) |
| `tl.set(target, key, pos, value, apply, init)` | Step value: holds `value` from `pos` until the next set; `init` before the first |
| `tl.fn(target, key, pos, dur, ease, k => value, apply)` | Custom continuous track (packet positions) |
| `tl.mark(pos, step, text)` | Scrubber step marker (captions add these automatically) |
| `tl.wait(pos, dur)` | Extend the timeline |
| `tl.own(fn)` | Cleanup when the chapter is unloaded |
| `tl.onFreeze(fn)` | Run once the chapter is fully built (may add segments; used to lay out captions) |
| `tl.dilate(b, extra)` | Insert time at b: everything at or after b moves later. Captions use it to guarantee reading time (`caption.readBase`, `caption.readPerChar`) |
| `tl.call(fn, pos)` | Escape hatch; replayed from a reset on rewind. Prefer `set` |

Do not start real-time animations or change the DOM from a chapter's build function; describe changes as tracks instead.

## Building blocks

| Piece | Use |
|---|---|
| `new Stage(frameEl)` | Camera, render loop, overlays, orbit / pan / zoom, picking, info card |
| `stage.setLayers(layers)` | Layer legend; `stage.focus(tl, pos, i \| [i, j] \| null)` dims other layers |
| `new Device(stage, world, {x, z, kind, layer, label, sub, info, ...})` | `kind`: `rack`, `gateway`, `edge`, `signpost` (with `choose()`), `globe`, `laptop`, `phone`, `terminal`, `agent`, `portal`, `pods`. Has `health()`, `activate()`, `reveal()`, `show()`, `html()` |
| `zone(stage, world, {x1, x2, z1, z2, color, label, sub})` | Network zone platform with floor lettering |
| `new Wall(stage, world, {x, z1, z2, lanes, color, label})` | Firewall with gates; `pass()` opens a gate, `deny()` flashes red |
| `new Link(stage, world, points, {layer, cls, hidden})` | Cable through any 3D points; lights up as packets pass. `mark()`, `clear()`, `show()` |
| `route([links], reverse)` | Joins links into one path for a packet |
| `new Packet(stage, world)` | Spinning 3D packet with a label chip: `appear`, `travel`, `open` (TLS break), `seal`, `shatter`, `vanish`, `state_` |
| `new Trace(stage)` | Distributed trace waterfall (HUD): `begin`, `add` |
| `new ObsWall(stage, world, {...})` | Observability wall: `begin`, `log`, `alert` |
| `stage.checklist(tl, pos, {...})` | Floating panel of checks that tick pass, warn or fail |
| `stage.caption.at(tl, pos, step, text)` | Caption card and scrubber step: crossfades in near the top of the stage and stays until the next step; moves up into a compact banner while a deployment view is open |
| `stage.shot(tl, pos, shot, dur)` | Camera move; a shot is `{x, y, z, rx, ry, d}` |
| `new Drill(stage, {at, title, sub, frame, stages, side})` | Deployment view that slides out of a node: `open`, `enter`, `visit(i)`, `sideVisit`, `exit`, `close`. A token walks the internal stages; each stage ticks its checks |
| `new Detail(stage, device, build, {near, far, at, hide, links, title, shot})` | Level of detail: when you take the camera and close in on a device, it sinks away and a detailed sub-scene grows in its place (`build` gets `box`, `outline`, `label`, `flow`). Camera-driven only, so scripted playback is unchanged |
| `new Budget(stage, {target, legs, title})` | Latency budget HUD: `begin(tl, pos, focusLegs)`, `spend(tl, pos, leg, ms)` |
| `stage.flag(tl, pos, cls, on)` | Toggle a frame class for a timeline (e.g. `fk-notrace`) |
| `stage.present(tl, pos, on)` | Presentation mode: hides the trace and legend panels (used while a deployment view is open) |
| `new Dot(stage, world)` | Small glowing token with a fading tail: `show`, `travel` (subtle flows such as DNS lookups) |
| `fly(...)`, `ring(...)`, `arc(a, b, h)` | Tokens flying between points, pulse rings, arc paths |
| `new Player(stage, host, chapters)` | Chapters, transport, speed, loop, scrubber with steps |

Every timed helper takes `(tl, pos, ...)` and returns the time it finishes, so scripts chain. The scene's `go()` helper also opens every firewall gate a path crosses:

```js
let t = 0;
t = go(tl, t, pk, [L.cAA, L.inA], 1400);
t = visit(tl, t, D.psaas, 'psaas');
```

## Coordinates

x right, y down (floor at y = 0, so "up" is negative y), z towards the viewer.

## Limits

- CSS 3D has no real lighting. Faces are shaded by hand.
- Keep a scene under roughly 1,500 elements (this one is about 500 faces). Labels, chips and panels are drawn in a 2D overlay positioned from projected 3D points.
- Avoid `opacity` on 3D groups; it flattens them. Tween `scale` or toggle `display` instead.
