# FlowKit

A small kit for 3D architecture animations, built on CSS 3D transforms with its own deterministic timeline (no dependencies).

## Files

- `flowkit.js`, `flowkit.css`: the kit
- `scenes/ingress.js`: the seven-layer ingress scene (six chapters)
- `ingress.html`: development page
- `build.py`: bundles a page into one offline HTML file
- `dist/ingress-journeys.html`: built, self-contained output

Build: `python3 build.py ingress.html dist/ingress-journeys.html`

Run locally: `python3 -m http.server 8765`, then open `http://localhost:8765/ingress.html`.

Deep link: `ingress.html?ch=2&t=7000` opens chapter 2 paused at 7 seconds. **Copy link** in the player does this for you.

## The architecture (scene)

| Layer | Name | Components |
|---|---|---|
| L0 | Internet client | Browser · Mobile · API client · M2M · AI agent |
| L1 | Global steering (DNS control plane, beside the clients) | 4 JPMorgan primary NS (CNAME → Akamai GTM) + 3 Cloudflare secondary NS (zone transfer; Cloudflare LB via override) |
| L2 | CDN / edge protection | Akamai · Cloudflare |
| L3 | Regional perimeter | PSaaS+ (on-prem, 9 DCs) · AWS WAF (8 regions) |
| L4 | Internal DMZ · SESF / Tier 2 | T2 gateway proxy (Envoy GCR on GVSI); no Tier 2 hop in AWS |
| L5 | Cross-firewall zone · ESF / Tier 3 | T3 IFA web (Envoy on GKP) · T3 IFA API (Kong on GKP) · Cloud web (Envoy on EKS) · Cloud API (Kong on EKS) |
| L6 | Trusted workloads | On-prem and cloud application workloads |
| P | Private connectivity (outside the layers) | On-prem: a business partner network (dashed teal boundary) connects over VAN / private circuit / leased line directly to BP PSaaS → T2 → T3 API. AWS: a trusted partner's service in its own AWS account and VPC (drawn in front of L3–L5) → interface endpoint → VPC-to-VPC over PrivateLink → our endpoint service at the L4 column of our VPC → Cloud API gateway. Orange dashed outlines mark the AWS network, our VPC and the partner VPC |

L1 is a DNS control plane box to the left of the clients, outside the request path. jpmorgan.com is delegated to 4 JPMorgan-hosted nameservers (ns1, ns2, ns05, ns06.jpmorganchase.com, the primary) and 3 Cloudflare nameservers (ns0098, ns0134, ns0221.secondary.cloudflare.com), which are secondary to the JPMorgan primary via zone transfer. Resolvers may ask any of the seven. The primary hands app hostnames off by CNAME to Akamai GTM. Cloudflare serves the transferred zone and, for hostnames with a secondary override, answers via Cloudflare LB. A softly flowing pink "DNS lookups" pipe links the client column to the box, fed by a small animated line from each client. From the pipe, animated lines fan out to each NS group and to GTM and Cloudflare LB, pulsing out and back (query and answer): the resolver asks each of them directly, and the NS → GTM / LB lines are dashed pointers (CNAME, override), not flows. All of this happens outside the HTTPS request flow. The box is kept deliberately quiet: two NS groups (unlabelled tags, click for details), one group line each to GTM and Cloudflare LB, and a zone-transfer link. In the chapters a lookup is shown as a small white dot with a fading tail: client → feeder → pipe → NS → GTM / LB → back to the client, each component lighting as it is reached, before the request leaves along the floor. Lookups live in `DNSQ` in `scenes/ingress.js`. Layers run left to right. Akamai and on-prem use the back lane, Cloudflare and AWS the front lane. L1 and L2 are cross-connected (either steering can send clients to either CDN), and so are L2 and L3 (either CDN can reach either perimeter). All names, footprints, roles and the illustrative control checklists live in `LAYERS`, `NAMES`, `FOOTPRINT`, `ROLES` and `CHECKS` at the top of `scenes/ingress.js`.

Deployment views (modelled on `../jpmc/ingress-poc`): the T2 node expands into its deployment. Top row: gateway-envoy's filter chain (listener → route match → ext_authz → router). Bottom row: auth-service, the ext_authz server, which checks the session JWT (iss = session manager, aud = ingress-gateway, ES256 via JWKS, DPoP cnf.jkt) and then evaluates the Rego payload policies in order: the global policy (`ingress.policy.payload.global`, blocklist, every route with a body) and the route policy (e.g. `route_users_register`, default deny). An evaluation panel shows the policies executing: the request JSON with the field under evaluation highlighted, the global policy scanning each string field, then each route-policy rule (body_ok, all_required_present, full_name_valid, email_valid, phone_valid, dob_valid) with its regex, the resulting allow / deny_reason, and the response (201, or 403 with the reason). Chapter 2 runs a GET (payload policies skipped, no body); chapter 3 runs the three TrafficFlow test payloads (valid → 201, SQL injection → 403 from the global policy, malformed email → 403 from the route policy). Content lives in `T2D`, `PAY` and `t2Run` in `scenes/ingress.js`.

Chapters are in two rows. **Layers** (keys 1–9): The seven layers, L0 Client, L1 DNS Control Plane, L2 Edge Protection / CDN, L3 Regional Perimeter, L4 SESF / Tier 2 Proxy, L5 ESF / Tier 3 Session & Signals, L6 Workloads, P Private Connectivity. Each explains what the layer is, what it does, why it exists and its latency budget (draft text in `LAYER_CH`). **Journeys** (Shift+1–6): Web on-prem, Payload policies at T2, API into AWS, Private connectivity, Failover, Defense in depth.

Latency budget: 50 ms from L0 to L5, split client → edge 12, edge 5, edge → region 15, perimeter 3, T2 proxy 8, T3 session 7 (draft, in `BUDGET`). DNS is cached per TTL and workload time is the application's own, so both sit outside it. The bar at the bottom right fills as a request spends time in each leg.

L5 Session & Signals (draft): the T3 deployment view shows Envoy → session manager, and a CAEP receiver (OpenID Shared Signals) that verifies Security Event Tokens from transmitters such as fraud detection; an enforcement policy turns them into step-up, revoke or re-auth. Content lives in `T3D`, `t3Html`, `t3Run` and `t3Signal`.

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

Camera: drag to orbit, right-drag or Shift-drag to pan, wheel to zoom, double-click or R to reset, F to follow the script again. Click a device (or its label) for an info card with its layer, role, regional footprint and controls. Hover a layer in the legend to isolate it; click a layer to fly there. T, N and Y toggle the trace, labels and legend.

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
| `stage.caption.at(tl, pos, step, text)` | Caption bar and scrubber step |
| `stage.shot(tl, pos, shot, dur)` | Camera move; a shot is `{x, y, z, rx, ry, d}` |
| `new Drill(stage, {at, title, sub, frame, stages, side})` | Deployment view that slides out of a node: `open`, `enter`, `visit(i)`, `sideVisit`, `exit`, `close`. A token walks the internal stages; each stage ticks its checks |
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
