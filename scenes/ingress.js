/*
 * Scene: CIB unified ingress, from the DNS control plane to the internal network.
 *
 *   L0 DNS control plane      JPMorgan primary + Cloudflare secondary nameservers, Akamai GTM, Cloudflare LB. Ahead of the request path
 *   L1 Client                 Browser · Mobile app · API client · Delegated agent · Autonomous agent · M2M
 *   L2 Edge protection / CDN  Akamai, Cloudflare: classify callers, do not establish identity
 *   L3 Regional perimeter     PSaaS+ (on-prem) · AWS WAF (AWS): CDN traffic only
 *   L4 Enforcement tier       Tier 2, the DMZ gateway on both substrates (inside SESF on-prem; Envoy / Kong): the single enforcement point
 *   L5 IFA workload zone      application workloads on GKP and EKS, reachable only from L4 over mTLS
 *   L6 Internal network       downstream services, systems of record, session and signal managers, broker, config pipeline
 *
 *   P1 Private connectivity   VAN / private circuit / leased line to BP PSaaS, entering at L3
 *   P2 Cloud private conn.    AWS PrivateLink from a partner VPC to our endpoint service, entering at L4
 *
 * Everything you may want to correct lives in LAYERS, NAMES, FOOTPRINT, ROLES and CHECKS below.
 * Layout: layers run left to right along x; on-prem / Akamai is the back lane (z < 0), cloud / Cloudflare the front lane (z > 0).
 */
(function () {
  const FK = window.FlowKit;
  const { Stage, Trace, ObsWall, Device, Wall, Link, Packet, zone, outline, ring, fly, route, arc, Player } = FK;

  /* ---------- the layers ---------- */
  // Columns along x: X[0] the clients (L1), X[1] the (narrow) internet band, X[2]..X[6] L2..L6. L0 is the DNS box left of the clients.
  const X = [-1755, -1230, -700, 0, 700, 1400, 2100];
  const IW = 175;                                        // internet band half-width
  const LAYERS = [
    { name: 'DNS control plane', alias: 'Steering', color: '#F472B6', desc: 'Resolves the hostname to an edge address before any request is made, chosen by location, latency, load and health. 4 JPMorgan primary and 3 Cloudflare secondary nameservers, with Akamai GTM and Cloudflare Load Balancing steering. No traffic flows through it; steering changes are bounded by TTL and resolver caching' },
    { name: 'Client', alias: 'Untrusted', color: '#94A3B8', desc: 'Browsers, mobile apps, API clients, delegated agents, autonomous agents and M2M callers, over the internet or private connectivity. Untrusted regardless of type; each holds a sender-constrained credential bound to a key it controls' },
    { name: 'Edge protection / CDN', alias: 'Edge', color: '#F97316', desc: 'Akamai and Cloudflare, active-active from one source ruleset. Terminates TLS, caches, absorbs volumetric attack, applies WAF, bot and agent classification, geographic policy and per-client rate limits. Classifies callers; does not establish identity' },
    { name: 'Regional perimeter', alias: 'Perimeter', color: '#FBBF24', desc: 'PSaaS+ on-prem (10 DMZ data centres) and AWS WAF in AWS (8 regions). Admits only traffic from the CDN, which is what makes origin lockdown enforceable; a second WAF pass and perimeter traffic policy' },
    { name: 'Enforcement tier', alias: 'Tier 2', color: '#22D3EE', desc: 'The DMZ gateway on both substrates, inside SESF on-prem. The single enforcement point: breaks and inspects TLS, resolves the credential to live state, exchanges tokens, runs the global and route policies, enforces scopes, mandates and lifetimes, consumes revocation and risk signals and injects verified identity. Fails closed' },
    { name: 'IFA workload zone', alias: 'Workloads', color: '#818CF8', desc: 'Isolated firewall application zone: application workloads on GKP and EKS, reachable only from L4 and only over mutual TLS. Receives verified identity as headers rather than parsing tokens' },
    { name: 'Internal network', alias: 'Trusted services', color: '#34D399', desc: 'Downstream services, systems of record, the identity platform\'s session and signal managers, the message broker, the configuration pipeline and the observability stack. Identity is propagated rather than re-asserted' }
  ].map((L, i) => { const x = i === 1 ? X[0] : X[i]; return { ...L, i, x1: x - 350, x2: x + 350, shot: { x, y: -190, z: 60, rx: -30, ry: -16, d: 3300 } }; });
  // L0 is a box to the left of the clients, ahead of the request path rather than in it
  const DNSB = { x1: -3215, x2: -2155, ns: -2915, sr: -2465, za: -530, zc: 520, nz: [-740, -600, -460, -320, 380, 520, 660] };
  const NJ = 4;   // ns1..ns4 are JPM (primary), ns5..ns7 Cloudflare (secondary)
  Object.assign(LAYERS[0], { x1: DNSB.x1, x2: DNSB.x2, shot: { x: -2605, y: -180, z: 60, rx: -34, ry: 24, d: 3500 } });
  // Private connectivity: not a numbered layer. Corridors outside the internet path:
  // P1 on-prem (back corridor), P2 the partner VPC (front)
  const PZ = { on: -1260, aws: 1265 };             // back corridor centre line; partner VPC centre line (z)
  const P = LAYERS.push({ tag: 'P', name: 'Private connectivity', alias: 'P1 · P2', color: '#2DD4BF',
    desc: 'Paths that skip part of the internet route. P1: VAN, private circuit or leased line to BP PSaaS, entering at L3. P2: AWS PrivateLink from a partner VPC to our endpoint service, entering at L4. The client is still L1 and still carries a credential',
    test: q => Math.abs(q[2]) > 1040, shot: { x: -300, y: -80, z: 0, rx: -62, ry: 0, d: 8200 } }) - 1;

  const NAMES = {
    browser: ['Browser', 'our web app'],
    mobile: ['Mobile app', 'our iOS / Android app'],
    api: ['API client', '3rd party app · for a user'],
    dagent: ['Delegated agent', 'acts for a user'],
    aagent: ['Autonomous agent', 'own mandate · no user'],
    m2m: ['M2M', 'workload identity · no user'],
    ns1: ['ns1.jpmorganchase.com', 'JPMorgan DNS · primary'],
    ns2: ['ns2.jpmorganchase.com', 'JPMorgan DNS · primary'],
    ns3: ['ns05.jpmorganchase.com', 'JPMorgan DNS · primary'],
    ns4: ['ns06.jpmorganchase.com', 'JPMorgan DNS · primary'],
    ns5: ['ns0098.secondary.cloudflare.com', 'Cloudflare DNS · secondary'],
    ns6: ['ns0134.secondary.cloudflare.com', 'Cloudflare DNS · secondary'],
    ns7: ['ns0221.secondary.cloudflare.com', 'Cloudflare DNS · secondary'],
    steerA: ['Akamai GTM', 'smart routing · DNS'],
    steerC: ['Cloudflare LB', 'smart routing · DNS'],
    cdnA: ['Akamai Edge (WAF/CDN)', 'edge protection · 4,100+ PoPs'],
    cdnC: ['Cloudflare Edge (WAF/CDN)', 'edge protection · 310+ cities'],
    psaas: ['PSaaS+', 'on-prem regional perimeter'],
    waf: ['AWS WAF', 'public cloud regional perimeter'],
    t2: ['T2 gateway · on-prem', 'Envoy / Kong · SESF'],
    t2c: ['T2 gateway · AWS', 'Envoy / Kong · EKS'],
    bpOn: ['Institutional client', 'VAN · private circuit'],
    bpAws: ['Partner service', '3rd party\'s own AWS VPC'],
    eni: ['Interface endpoint', 'ENI in the partner VPC'],
    bpp: ['BP PSaaS', 'P1 entry · L3 · on-prem'],
    pl: ['Endpoint service', 'P2 · PrivateLink + NLB'],
    wlOn: ['Workloads · GKP', 'IFA zone · on-prem'],
    wlCl: ['Workloads · EKS', 'IFA zone · AWS'],
    sess: ['Session manager', 'identity platform'],
    svc: ['Downstream services', 'internal network'],
    sig: ['Signal manager', 'identity platform · SSF'],
    broker: ['Message broker', 'signals and events'],
    sor: ['Systems of record', 'internal network'],
    cfg: ['Config pipeline', 'and register'],
    attacker: ['Attacker', 'direct-to-origin probe'],
    obs: 'Observability plane',
    w1: 'L3 perimeter · CDN origin traffic only',
    w2: 'SESF · enforcement tier',
    w3: 'IFA zone firewall · mTLS from L4 only',
    w4: 'Internal network'
  };
  const FOOTPRINT = {
    akamai: { label: '4,100+ PoPs', NA: 1600, EMEA: 1100, APAC: 750 },
    cloudflare: { label: '310+ cities', NA: 95, EMEA: 105, APAC: 85 },
    psaas: { label: '10 DCs', NA: 4, EMEA: 2, APAC: 4 },   // AMER: Aurora, Broomfield, Orangeburg, Totowa · EMEA: Farnborough, Basingstoke · APAC: Equinix HK, Cavendish HK, SG-C01, SG-C02
    waf: { label: '8 regions', NA: 3, EMEA: 3, APAC: 2 },
    t2: { label: '9 DCs', NA: 4, EMEA: 2, APAC: 3 }
  };
  const ROLES = {
    browser: 'Our web application in the user\'s browser. Presents a signed session artefact (cookie) or opaque reference, which L4 resolves to live session state.',
    mobile: 'Our native iOS and Android apps. Present a key-bound access token, resolved at L4 to live session state and device binding.',
    api: 'A customer\'s or partner\'s application acting for a user. Presents a delegated access token, DPoP or certificate bound; L4 resolves it to the user\'s grant and consented scopes. mTLS terminates at L4.',
    dagent: 'An AI agent acting for a specific user. Presents an exchanged agent-scoped token (sub = user, act = agent); L4 resolves the delegation, with the user\'s entitlements as the ceiling. Step-up goes back to the user.',
    aagent: 'An AI agent transacting in its own right under a mandate from its owner. Presents its agent credential plus a signed request; L4 resolves the registered agent and its live mandate. mTLS terminates at L4.',
    m2m: 'A system calling as itself, with no user. Presents client credentials or a signed assertion; L4 resolves workload identity and fixed scopes. mTLS terminates at L4.',
    steerA: 'Akamai Global Traffic Management. Answers DNS lookups (through the client\'s resolver) with the best healthy edge, judged by location (resolver IP or EDNS client subnet), latency, load and health. Can steer to Akamai or to Cloudflare. Never in the request path.',
    steerC: 'Cloudflare Load Balancing. Answers DNS lookups with an anycast IP (BGP carries the client to the nearest PoP), or can steer to Akamai. For proxied hostnames it also picks the origin pool at the edge. Never in the request path.',
    cdnA: 'Edge TLS termination, caching, DDoS absorption, WAF and bot management. Forwards to either regional perimeter.',
    cdnC: 'Edge TLS termination, caching, DDoS absorption, API protection and bot management. Forwards to either regional perimeter.',
    psaas: 'Entry point to the on-prem network. PSaaS+ rulesets with Akamai SiteShield source lists admit only CDN traffic into SESF (L4). No platform components of our own.',
    waf: 'Entry point to AWS, in the CTC edge account: internet gateway, internet-facing ALB with AWS WAF web ACLs admitting only CDN traffic, and an interface VPC endpoint that carries it over PrivateLink to the L4 endpoint service.',
    t2: 'The enforcement tier (Tier 2) on-prem, inside SESF: Envoy and Kong data planes with their xDS and admin control planes, the session validator sidecar, the policy engine (global and route policies), token exchange and cache, revoke and policy caches, the signal receiver and the config distributor. Fails closed.',
    t2c: 'The enforcement tier (Tier 2) in AWS, in the Ingress VPC: VPC endpoint service (PrivateLink, for L3 and P2) → NLB → internal ALB → EKS, where the Envoy gateway pods run a session-validator sidecar and the Kong gateway pods an API validator sidecar (OAS validation, token validation, tokenization). Zoom in for the detail view.',
    bpOn: 'An institutional client on a VAN, private circuit or leased line. The circuit establishes the network path; the client is still L1 and still carries a credential.',
    bpAws: 'A trusted 3rd party\'s service running in its own AWS account and VPC. It calls our API through an interface endpoint and never leaves the AWS network.',
    eni: 'Network interfaces with private IPs in the partner\'s VPC that front our endpoint service. Created and owned by the partner; its DNS name resolves to these private IPs.',
    bpp: 'P1 entry point: circuit termination and BP PSaaS configuration, with the client allow-list and route mapping. Institutional clients bypass L0 and L2 and enter here, at L3.',
    pl: 'P2 entry point: our PrivateLink endpoint service, its acceptance policy and the network load balancer in front of the enforcement tier. Never traverses the internet; enters at L4, where a credential is still required.',
    wlOn: 'Application workloads on GKP, with their sidecars, in the isolated firewall application zone. Reachable only from L4 over mTLS; the workload verifies the peer certificate on every connection.',
    wlCl: 'Application workloads on EKS, with their sidecars, in the isolated firewall application zone. Reachable only from L4 over mTLS.',
    sess: 'The identity platform\'s session manager: the source of live session state, which the L4 session validator resolves each request against (through its revoke cache).',
    svc: 'Downstream services the workloads call, with the correlation identifier and acting-for chain carried forward over mTLS.',
    sig: 'The identity platform\'s signal manager. As a Shared Signals (SSF) transmitter it publishes CAEP events, such as a risk-level change for a session, which the message broker carries to the L4 signal receiver.',
    broker: 'Message broker carrying revocation and risk signals from the internal network to the enforcement tier.',
    sor: 'Systems of record behind the workloads.',
    cfg: 'Configuration pipeline and its register. Route policies are generated from each workload\'s code and distributed to the enforcement tier by the config distributor.',
    attacker: 'Tries to reach an origin directly, bypassing the CDN.'
  };
  // Illustrative controls shown in the animation and in the info card. Replace with your real policies.
  const CHECKS = {

    steerA: { title: 'Akamai GTM', items: ['Location: resolver IP or EDNS client subnet', 'Edge liveness, latency and load', 'Multi-CDN failover'], result: 'Best edge IP, short TTL' },
    steerC: { title: 'Cloudflare LB', items: ['Anycast answers for proxied hostnames', 'Origin pool health and steering', 'Multi-CDN failover'], result: 'Best edge IP, short TTL' },
    cdnA: { title: 'Akamai Edge (WAF/CDN)', items: ['TLS 1.3 terminated at the edge', 'DDoS: absorbed at the edge', 'WAF rules: clean', 'Bot management: human', 'Cache miss: forward to origin'], result: 'Forward to origin · re-encrypted' },
    cdnC: { title: 'Cloudflare Edge (WAF/CDN)', items: ['TLS 1.3 terminated at the edge', 'DDoS: absorbed at the edge', 'API protection: schema and token present', 'Bot score: verified API client', 'Rate limit: within quota'], result: 'Forward to origin · re-encrypted' },
    psaas: { title: 'PSaaS+ · regional perimeter', items: ['Source in CDN ranges (SiteShield)', 'Second WAF pass: clean', 'Perimeter traffic policy: pass', 'Admit into SESF (L4)'], result: 'ADMIT' },
    waf: { title: 'AWS WAF · regional perimeter', items: ['Source in CDN IP set', 'Web ACL managed rules: clean', 'Rate-based rule: under limit', 'PrivateLink to the L4 endpoint service'], result: 'ALLOW' },
    t2: { title: 'T2 gateway · enforcement tier', items: ['TLS broken and inspected', 'Session resolved to live state', 'Global then route policy', 'Scopes, mandate and lifetime', 'Inject identity · mTLS to L5'], result: 'Forward to L5 · mTLS' },
    t2c: { title: 'T2 gateway · EKS', items: ['TLS broken and inspected', 'DPoP-bound token · live grant', 'Token exchange · scope accounts:read', 'Global then route policy', 'Inject user + client identity'], result: 'Forward to L5 · mTLS' },
    bpp: { title: 'BP PSaaS · P1 entry at L3', items: ['Circuit: VAN / leased line, client Acme', 'Source in the client allow-list', 'Route mapping: payments API', 'Admit into SESF (L4)'], result: 'ADMIT' },
    eni: { title: 'Interface endpoint · partner VPC', items: ['Private IP 10.20.3.14 in the partner VPC', 'Private DNS name resolves to the endpoint', 'Security group: 443 to our service only'], result: 'Carried on the AWS network' },
    pl: { title: 'Endpoint service · P2 entry at L4', items: ['Partner AWS account allow-listed', 'Connection request accepted', 'One-way: partner reaches this service only', 'NLB forwards to the L4 gateway'], result: 'Admit into our VPC' }
  };

  const frame = document.getElementById('fk');
  const stage = new Stage(frame);
  stage.setLayers(LAYERS);
  const W = stage.world;
  // Free-floating labels, tagged with the layer (and side, for P) that introduces them; the tour reveals them in step
  const SL = [], slab = (bb, layer, side) => { SL.push({ bb, layer, side }); return bb; };
  stage.onReset(() => SL.forEach(o => { o.bb.el.style.display = ''; }));
  const trace = new Trace(stage);
  // Latency budget from the client to L5: p95, warm connections, a well-placed NA user (draft split).
  // 'net' legs are network distance (depend on where the user is); 'proc' legs are JPMC processing.
  // DNS is cached per TTL and workload time is the application's own, so both sit outside it.
  const BUDGET = { target: 50, title: 'Latency budget · L1 → L5 · p95', legs: [
    { label: 'client → edge', ms: 8, color: '#94A3B8', kind: 'net' },
    { label: 'edge', ms: 3, color: '#F97316', kind: 'proc' },
    { label: 'edge → region', ms: 10, color: '#FB923C', kind: 'net' },
    { label: 'perimeter', ms: 3, color: '#FBBF24', kind: 'proc' },
    { label: 'L4 inspect + policy', ms: 10, color: '#22D3EE', kind: 'proc' },
    { label: 'L4 live state + exchange', ms: 14, color: '#0EA5E9', kind: 'proc' }] };
  const budget = new FK.Budget(stage, BUDGET);

  /* ---------- floor: one band per layer; L3 to L5 split into on-prem and AWS ---------- */
  const ZB = [-950, 1000], SPLIT = 30;
  zone(stage, W, { x1: DNSB.x1, x2: DNSB.x2, z1: ZB[0], z2: ZB[1], color: LAYERS[0].color, alpha: .04, label: 'L0', sub: 'DNS control plane · ahead of the request path' });
  zone(stage, W, { x1: X[0] - 345, x2: X[0] + 345, z1: ZB[0], z2: ZB[1], color: LAYERS[1].color, label: 'L1', sub: LAYERS[1].name });
  zone(stage, W, { x1: X[1] - IW, x2: X[1] + IW, z1: ZB[0], z2: ZB[1], color: '#64748B', alpha: .04 });
  zone(stage, W, { x1: X[2] - 345, x2: X[2] + 345, z1: ZB[0], z2: ZB[1], color: LAYERS[2].color, label: 'L2', sub: LAYERS[2].name });
  // SESF is an on-prem zone, so the AWS L4 tile is just Tier 2
  const SUB = { 3: ['Perimeter', 'Perimeter'], 4: ['SESF · Tier 2', 'Tier 2'], 5: ['IFA zone', 'IFA zone'] };
  for (const i of [3, 4, 5]) {
    const L = LAYERS[i], x1 = X[i] - 345, x2 = X[i] + 345;
    zone(stage, W, { x1, x2, z1: ZB[0], z2: -SPLIT, color: L.color, label: 'L' + i, sub: SUB[i][0] + ' · on-prem' });
    zone(stage, W, { x1, x2, z1: SPLIT, z2: ZB[1], color: L.color, label: 'L' + i, sub: SUB[i][1] + ' · AWS' });
  }
  zone(stage, W, { x1: X[6] - 345, x2: X[6] + 345, z1: ZB[0], z2: ZB[1], color: LAYERS[6].color, label: 'L6', sub: LAYERS[6].name });
  // Back corridor: P1 (institutional client to BP PSaaS)
  zone(stage, W, { x1: X[0] - 350, x2: X[3] + 180, z1: PZ.on - 150, z2: PZ.on + 150, color: '#2DD4BF', alpha: .05, label: '', sub: '' });
  outline(stage, W, { pts: [[X[0] - 330, PZ.on - 135], [X[0] + 300, PZ.on - 135], [X[0] + 300, PZ.on + 135], [X[0] - 330, PZ.on + 135]], color: '#2DD4BF', width: 5, dash: '14 10', fill: .05,
    label: 'Client network', sub: 'institutional client data centre', at: [X[0] - 220, PZ.on + 95] });
  // AWS: the AWS network holds our VPC (L3 to L5 front lane) and the partner's VPC, side by side
  const rect = (x1, z1, x2, z2) => [[x1, z1], [x2, z1], [x2, z2], [x1, z2]];
  outline(stage, W, { pts: rect(-385, 8, 1750, 1470), color: '#FF9900', label: 'AWS network', sub: 'PrivateLink traffic never leaves AWS', at: [1210, 1405] });   // right edge on the L5/L6 boundary; labels are right-aligned, ending at at.x + 450
  outline(stage, W, { pts: rect(-362, 24, 1735, 1008), color: '#FF9900', width: 5, dash: '14 10', fill: 0 });
  outline(stage, W, { pts: rect(250, 1110, 1220, 1420), color: '#FF9900', width: 5, dash: '14 10', fill: .05, label: 'Partner VPC', sub: 'trusted 3rd party AWS account', at: [700, 1360] });
  slab(stage.billboard(null, `<div class="fk-label" style="--led:#FF9900;border-color:rgba(255,153,0,.55);color:#FED7AA"><i></i>Our VPC · AWS account</div>`, { screen: true, p: [1560, -20, 1000] }), 3);
  const obs = new ObsWall(stage, W, { x: 0, y: -820, z: -1550, w: 4800, h: 640, title: NAMES.obs });
  const W1 = new Wall(stage, W, { x: -350, z1: -950, z2: 1000, lanes: [-450, 450], color: '#FBBF24', label: NAMES.w1 });
  const W2 = new Wall(stage, W, { x: 350, z1: -950, z2: 1000, lanes: [-450, 450], color: '#22D3EE', label: NAMES.w2 });
  const W3 = new Wall(stage, W, { x: 1050, z1: -950, z2: 1000, lanes: [-450, 450], color: '#818CF8', label: NAMES.w3 });
  const W4 = new Wall(stage, W, { x: 1750, z1: -950, z2: 1000, lanes: [-450, 450], color: '#34D399', label: NAMES.w4 });
  const WALLS = [W1, W2, W3, W4];
  [[W1, 3], [W2, 4], [W3, 5], [W4, 6]].forEach(([w, l]) => w.labelBB && slab(w.labelBB, l));

  /* ---------- devices ---------- */
  const ICON = {
    shield: c => `<svg viewBox="0 0 70 70" width="70" height="70"><path d="M35 4 L62 14 V34 C62 50 50 61 35 66 C20 61 8 50 8 34 V14 Z" fill="${c}30" stroke="${c}" stroke-width="3"/><path d="M24 35 L32 43 L47 27" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    web: c => `<svg viewBox="0 0 70 70" width="70" height="70"><circle cx="35" cy="35" r="27" fill="${c}22" stroke="${c}" stroke-width="3"/><path d="M8 35h54M35 8c-10 9-10 45 0 54M35 8c10 9 10 45 0 54" fill="none" stroke="${c}" stroke-width="3"/></svg>`,
    api: c => `<svg viewBox="0 0 70 70" width="70" height="70"><rect x="6" y="10" width="58" height="50" rx="10" fill="${c}22" stroke="${c}" stroke-width="3"/><path d="M27 24l-9 11 9 11M43 24l9 11-9 11" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    ns: c => `<svg viewBox="0 0 70 70" width="70" height="70"><rect x="6" y="14" width="58" height="42" rx="8" fill="${c}22" stroke="${c}" stroke-width="3"/><text x="35" y="44" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="22" fill="${c}">NS</text></svg>`,
    route: c => `<svg viewBox="0 0 70 70" width="70" height="70"><circle cx="35" cy="35" r="27" fill="${c}22" stroke="${c}" stroke-width="3"/><path d="M20 46 C 30 46 30 24 44 24 M38 18 l7 6 -7 6 M20 46 L50 46 M44 40 l7 6 -7 6" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    proxy: c => `<svg viewBox="0 0 70 70" width="70" height="70"><rect x="6" y="10" width="58" height="50" rx="10" fill="${c}22" stroke="${c}" stroke-width="3"/><path d="M16 28h32l-7-7M54 42H22l7 7" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };
  const browserUI = body => `<div style="height:12px;background:#1E293B;display:flex;gap:3px;align-items:center;padding:0 4px"><i style="width:4px;height:4px;border-radius:50%;background:#F87171"></i><i style="width:4px;height:4px;border-radius:50%;background:#FBBF24"></i><i style="width:4px;height:4px;border-radius:50%;background:#34D399"></i></div><div style="padding:8px 10px">${body}</div>`;
  const SCR = {
    home: browserUI(`<b style="font-size:10px;color:#1E3A8A">app.jpmorgan.com</b><div style="margin-top:6px;height:6px;width:70%;background:#E2E8F0;border-radius:2px"></div><div style="margin-top:4px;height:6px;width:50%;background:#E2E8F0;border-radius:2px"></div><div style="margin-top:8px;height:13px;width:60px;border-radius:3px;background:#2563EB;color:#fff;font-size:7px;display:grid;place-items:center">View accounts</div>`),
    reg: browserUI(`<b style="font-size:10px;color:#1E3A8A">Create account</b><div style="margin-top:5px;height:7px;border:1px solid #CBD5E1;border-radius:2px"></div><div style="margin-top:3px;height:7px;border:1px solid #CBD5E1;border-radius:2px"></div><div style="margin-top:6px;height:12px;width:54px;border-radius:3px;background:#2563EB;color:#fff;font-size:7px;display:grid;place-items:center">Register</div>`),
    reg201: browserUI(`<div style="text-align:center;margin-top:10px"><div style="width:20px;height:20px;border-radius:50%;background:#D1FAE5;color:#059669;margin:0 auto;display:grid;place-items:center;font-weight:700">&#10003;</div><b style="font-size:9px;color:#065F46">Welcome, Ada</b><div style="font-size:7px;color:#64748B">201 Created</div></div>`),
    reg403: browserUI(`<div style="text-align:center;margin-top:10px"><div style="width:20px;height:20px;border-radius:50%;background:#FFE4E6;color:#E11D48;margin:0 auto;display:grid;place-items:center;font-weight:700">!</div><b style="font-size:9px;color:#9F1239">Request rejected</b><div style="font-size:7px;color:#64748B">403 · payload validation failed</div></div>`),
    stepup: browserUI(`<div style="text-align:center;margin-top:8px"><b style="font-size:9px;color:#92400E">Verify it's you</b><div style="font-size:7px;color:#64748B;margin-top:3px">Unusual activity on your session</div><div style="margin:6px auto 0;width:66px;height:13px;border-radius:3px;background:#F59E0B;color:#fff;font-size:7px;display:grid;place-items:center">Continue with passkey</div></div>`),
    accounts: browserUI(`<b style="font-size:10px;color:#1E3A8A">Accounts</b><div style="margin-top:5px;font-size:7px;color:#475569">Operating ···4821 &nbsp; USD 1.2M</div><div style="font-size:7px;color:#475569">Payroll ···7710 &nbsp; USD 310K</div><div style="margin-top:6px;font-size:7px;color:#059669">200 OK · 412 ms</div>`)
  };
  const TERM = {
    idle: `<span style="color:#64748B">$</span> <span class="fk-caret">_</span>`,
    req: `<span style="color:#64748B">$</span> curl -H "Authorization: Bearer eyJ…"<br>&nbsp; https://api.jpmorgan.com/v1/accounts<br><span style="color:#64748B">…</span>`,
    ok: `<span style="color:#64748B">$</span> curl …/v1/accounts<br><span style="color:#34D399">HTTP/2 200</span> <span style="color:#64748B">318 ms</span><br>{ "accounts": [ { "id": "···4821",<br>&nbsp; "balance": 1200000 } ] }`,
    bad: `<span style="color:#64748B">$</span> curl -X POST …/v1/payments<br><span style="color:#FB7185">HTTP/2 400</span> schema_violation<br><span style="color:#64748B">"amount" must be a number</span>`
  };
  const PHONE = s => `<div style="padding-top:16px;font-weight:700;font-size:10px">Example Bank</div>` + ({
    idle: `<div style="margin-top:22px;color:#94A3B8">Balances</div><div style="margin:8px auto 0;width:50px;height:5px;border-radius:3px;background:#334155"></div>`,
    wait: `<div style="margin-top:22px;color:#94A3B8">Loading…</div><div style="width:34px;height:34px;margin:10px auto 0;border-radius:50%;border:3px solid #334155;border-top-color:#38BDF8"></div>`,
    ok: `<div style="margin-top:14px;color:#94A3B8;font-size:8px">Operating ···4821</div><div style="font-size:13px;font-weight:700;margin-top:2px">$1.2M</div><div style="margin-top:12px;color:#34D399;font-size:8px">Up to date</div>`
  })[s];

  const dev = (key, o) => new Device(stage, W, { ...o, label: NAMES[key][0], sub: NAMES[key][1], info: o.info || { role: ROLES[key], footprint: o.footprint, controls: CHECKS[key] ? CHECKS[key].items : null } });
  const C = {
    browser: dev('browser', { layer: 1, x: X[0], z: -720, kind: 'laptop', color: '#334155', screen: SCR.home }),
    mobile: dev('mobile', { layer: 1, x: X[0], z: -440, kind: 'phone', color: '#334155', screen: PHONE('idle') }),
    api: dev('api', { layer: 1, x: X[0], z: -160, kind: 'terminal', color: '#334155', screen: TERM.idle }),
    dagent: dev('dagent', { layer: 1, x: X[0], z: 120, kind: 'agent', color: '#1E1B4B', accent: '#A78BFA' }),
    aagent: dev('aagent', { layer: 1, x: X[0], z: 400, kind: 'agent', color: '#2A1A05', accent: '#F59E0B' }),
    m2m: dev('m2m', { layer: 1, x: X[0], z: 690, kind: 'rack', w: 90, h: 110, d: 90 })
  };
  const D = {
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(n => [`ns${n}`, dev(`ns${n}`, { layer: 0, x: DNSB.ns, z: DNSB.nz[n - 1], kind: 'rack', w: 150, h: 28, d: 90, nolabel: true,
      color: n <= NJ ? '#1E293B' : '#2A1A10', accent: n <= NJ ? '#94A3B8' : '#F38020', led: '#94A3B8',
      info: { role: n <= NJ ? 'JPMorgan-hosted authoritative nameserver for jpmorgan.com, the primary. The zone is authored here and transferred to Cloudflare. Resolvers may ask any of the seven NS; this one returns the CNAME that hands app hostnames to Akamai GTM.' : 'Cloudflare secondary nameserver for jpmorgan.com. It receives the zone by transfer from the JPMorgan primary and adds provider diversity for resiliency. For hostnames with a Cloudflare override it answers via Cloudflare LB; otherwise it serves the same records as the primary.' } })])),
    steerA: dev('steerA', { layer: 0, x: DNSB.sr, z: DNSB.za, kind: 'gateway', w: 140, h: 120, d: 110, accent: '#38BDF8', led: '#94A3B8', icon: ICON.route('#38BDF8'), footprint: FOOTPRINT.akamai }),
    steerC: dev('steerC', { layer: 0, x: DNSB.sr, z: DNSB.zc, kind: 'gateway', w: 140, h: 120, d: 110, accent: '#F38020', led: '#94A3B8', icon: ICON.route('#F38020'), footprint: FOOTPRINT.cloudflare }),
    cdnA: dev('cdnA', { layer: 2, x: X[2], z: -450, kind: 'edge', accent: '#38BDF8', icon: ICON.shield('#38BDF8'), footprint: FOOTPRINT.akamai }),
    cdnC: dev('cdnC', { layer: 2, x: X[2], z: 450, kind: 'edge', accent: '#F38020', icon: ICON.shield('#F38020'), footprint: FOOTPRINT.cloudflare }),
    psaas: dev('psaas', { layer: 3, x: X[3], z: -450, kind: 'gateway', w: 160, h: 150, d: 130, accent: '#FBBF24', icon: ICON.shield('#FBBF24'), footprint: FOOTPRINT.psaas }),
    waf: dev('waf', { layer: 3, x: X[3], z: 450, kind: 'gateway', w: 160, h: 150, d: 130, accent: '#FF9900', icon: ICON.shield('#FF9900'), footprint: FOOTPRINT.waf }),
    t2: dev('t2', { layer: 4, x: X[4], z: -450, kind: 'rack', h: 190, accent: '#22D3EE', icon: ICON.proxy('#22D3EE'), footprint: FOOTPRINT.t2 }),
    t2c: dev('t2c', { layer: 4, x: X[4], z: 450, kind: 'rack', h: 190, color: '#2A1A05', accent: '#FF9900', icon: ICON.proxy('#FF9900') }),
    bpOn: dev('bpOn', { layer: P, x: X[0], z: PZ.on, kind: 'rack', w: 100, h: 140, d: 90, color: '#134E4A', accent: '#2DD4BF' }),
    bpAws: dev('bpAws', { layer: P, x: 430, z: PZ.aws, kind: 'pods', color: '#3B2A10', accent: '#FF9900', count: 2, gap: 130 }),
    eni: dev('eni', { layer: P, x: 800, z: PZ.aws, kind: 'rack', w: 60, h: 80, d: 60, color: '#2A1A05', accent: '#FF9900', led: '#FF9900' }),
    bpp: dev('bpp', { layer: P, x: X[3], z: PZ.on, kind: 'gateway', w: 150, h: 130, d: 120, color: '#0F2E2B', accent: '#2DD4BF', icon: ICON.shield('#2DD4BF') }),
    pl: dev('pl', { layer: P, x: 800, z: 860, kind: 'portal', accent: '#2DD4BF', r: 60 }),
    wlOn: dev('wlOn', { layer: 5, x: X[5], z: -450, kind: 'pods', color: '#1E3A5F', count: 3, gap: 140 }),
    wlCl: dev('wlCl', { layer: 5, x: X[5], z: 450, kind: 'pods', color: '#3B2A10', accent: '#FF9900', count: 3, gap: 140 }),
    sess: dev('sess', { layer: 6, x: X[6], z: -820, kind: 'rack', w: 110, h: 130, d: 90, color: '#1E293B', accent: '#22D3EE', led: '#22D3EE' }),
    svc: dev('svc', { layer: 6, x: X[6], z: -450, kind: 'pods', color: '#14402F', accent: '#34D399', count: 2, gap: 140 }),
    sig: dev('sig', { layer: 6, x: X[6], z: -110, kind: 'rack', w: 110, h: 130, d: 90, color: '#2A1020', accent: '#F472B6', led: '#F472B6' }),
    broker: dev('broker', { layer: 6, x: X[6], z: 170, kind: 'rack', w: 110, h: 90, d: 90, color: '#1E1B4B', accent: '#A78BFA', led: '#A78BFA' }),
    sor: dev('sor', { layer: 6, x: X[6], z: 450, kind: 'rack', w: 120, h: 140, d: 100, color: '#14402F', accent: '#34D399', led: '#34D399' }),
    cfg: dev('cfg', { layer: 6, x: X[6], z: 760, kind: 'rack', w: 110, h: 100, d: 90, color: '#1E293B', accent: '#94A3B8', led: '#94A3B8' }),
    attacker: dev('attacker', { layer: 1, x: X[1] - 100, z: 880, kind: 'laptop', color: '#4C0519', led: '#F43F5E', accent: '#F43F5E', hidden: true,
      screen: `<div style="background:#0F0A14;height:100%;color:#FB7185;font:8px ui-monospace,monospace;padding:8px 9px">$ curl --resolve \\<br>&nbsp; app:443:203.0.113.10<br><span style="color:#94A3B8">bypass the CDN</span></div>` })
  };
  slab(stage.billboard(null, `<div class="fk-label" style="--led:#94A3B8;border-color:rgba(148,163,184,.4)"><i></i>Internet</div>`, { screen: true, p: [X[1], -110, 0] }), 2);
  stage.billboard(W, `<div style="width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:radial-gradient(circle,#E2E8F0,#64748B 60%,transparent 70%);box-shadow:0 0 16px #94A3B8"></div>`, { p: [X[1], -50, 0] });

  /* ---------- links: 2D points are [x, z] at cable height ---------- */
  const Y = -50;
  const lk = (layer, pts, o = {}) => new Link(stage, W, pts.map(p => p.length === 2 ? [p[0], Y, p[1]] : p), { layer, ...o });
  const L = {
    cl: Object.fromEntries(Object.entries(C).map(([k, d]) => [k, lk(2, [[X[0] + 60, d.z], [X[1], 0]])])),
    hubA: lk(2, [[X[1], 0], [X[1] + 130, -450], [-810, -450]]),
    hubC: lk(2, [[X[1], 0], [X[1] + 130, 450], [-810, 450]]),
    cAA: lk(3, [[-590, -450], [-440, -450]]), cAC: lk(3, [[-590, -450], [-440, 450]]),
    cCA: lk(3, [[-590, 450], [-440, -450]]), cCC: lk(3, [[-590, 450], [-440, 450]]),
    inA: lk(3, [[-440, -450], [-80, -450]]), inC: lk(3, [[-440, 450], [-80, 450]]),
    psT2: lk(4, [[80, -450], [640, -450]]),
    wafT2: lk(4, [[80, 450], [640, 450]]),
    pvtOn: lk(P, [[X[0] + 60, PZ.on], [-80, PZ.on]], { cls: 'pvt', t: 16 }),
    pInner: lk(P, [[470, PZ.aws], [770, PZ.aws]], { cls: 'pvt', t: 10 }),
    pvtAws: lk(P, [[800, PZ.aws - 35], [800, 860]], { cls: 'pvt', t: 16 }),
    bpT2: lk(P, [[80, PZ.on], [X[4] - 30, PZ.on], [X[4] - 30, -520]]),
    plIn: lk(P, [[800, 860], [730, 530]]),
    t2On: lk(5, [[760, -450], [1330, -450]]), t2Cl: lk(5, [[760, 450], [1330, 450]]),
    onSvc: lk(6, [[1470, -450], [2030, -450]]), clSor: lk(6, [[1470, 450], [2030, 450]]),
    atk: lk(3, [[X[1] + 20, 880], [-560, 880], [-372, 450]], { hidden: true })
  };
  for (const [pt, txt, side] of [[[-1050, -90, PZ.on], 'P1 · VAN · private circuit · leased line', 'on'], [[800, -110, 1060], 'P2 · AWS PrivateLink · VPC to VPC · no internet, no public IPs', 'aws']])
    slab(stage.billboard(null, `<div class="fk-label" style="--led:#2DD4BF;border-color:rgba(45,212,191,.5);color:#99F6E4"><i></i>${txt}</div>`, { screen: true, p: pt }), P, side);
  // L0 box: two NS groups, each wired to its smart-routing service; one quiet pipe to the client column
  const gz = (i1, i2) => (DNSB.nz[i1] + DNSB.nz[i2]) / 2, GZ = { jpm: gz(0, NJ - 1), cf: gz(NJ, 6) };
  const CNG = { jpm: lk(0, [[DNSB.ns + 80, -30, GZ.jpm], [DNSB.sr - 75, -60, DNSB.za]], { cls: 'steer', t: 7 }),
                cf: lk(0, [[DNSB.ns + 80, -30, GZ.cf], [DNSB.sr - 75, -60, DNSB.zc]], { cls: 'steer', t: 7 }) };
  const CN = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(n => [n, n <= NJ ? CNG.jpm : CNG.cf]));
  const nsBox = (i1, i2, color) => outline(stage, W, { pts: [[DNSB.ns - 170, DNSB.nz[i1] - 90], [DNSB.ns + 100, DNSB.nz[i1] - 90], [DNSB.ns + 100, DNSB.nz[i2] + 90], [DNSB.ns - 170, DNSB.nz[i2] + 90]],
    color, width: 4, dash: '12 8', fill: .03 });
  nsBox(0, NJ - 1, '#94A3B8'); nsBox(NJ, 6, '#F38020');
  const tag = (p, txt, c) => slab(stage.billboard(null, `<div class="fk-label" style="--led:rgb(${c});border-color:rgba(${c},.45);color:rgb(${c});font-size:11px"><i></i>${txt}</div>`, { screen: true, p }), 0);
  tag([DNSB.ns - 30, -60, GZ.jpm], 'JPMorgan DNS · 4 NS · primary', '148,163,184');
  tag([DNSB.ns - 30, -60, GZ.cf], 'Cloudflare DNS · 3 NS · secondary to JPMorgan', '243,128,32');
  const PIPE = { a: [-1985, -70, -150], b: [-2295, -70, -150] };
  const pipe = lk(0, [[PIPE.a[0], PIPE.a[1], PIPE.a[2]], [PIPE.b[0], PIPE.b[1], PIPE.b[2]]], { cls: 'dnspipe', t: 26 });
  tag([(PIPE.a[0] + PIPE.b[0]) / 2, -110, PIPE.a[2]], 'DNS lookups', '148,163,184');
  // Small animated flow lines: each client -> pipe; pipe -> each NS group and -> GTM / LB (the resolver asks each directly).
  // Dash size is set per segment so every line shows the same world-space pattern despite the z-stretch.
  const flow = pts => {
    const l = lk(0, pts, { cls: 'dnsflow', t: 5 });
    l.segs.forEach((sg, k) => { const L = Math.hypot(...[0, 1, 2].map(j => pts[k + 1][j] - pts[k][j])); sg.style.setProperty('--ps', (2400 / L).toFixed(2) + 'px');
      sg.querySelectorAll('.fk-f').forEach(f => { f.style.animationDelay = (-(pts[k][2] * 7 % 2600) / 1000).toFixed(2) + 's'; }); });
    return l;
  };
  const ENTRY = { jpm: [DNSB.ns + 100, -40, GZ.jpm], cf: [DNSB.ns + 100, -40, GZ.cf], gtm: [DNSB.sr + 75, -60, DNSB.za], lb: [DNSB.sr + 75, -60, DNSB.zc] };
  const FEED = new Map(Object.values(C).map(c => [c, flow([[X[0] - 110, -40, c.z], PIPE.a])]));
  const OUT = Object.fromEntries(Object.entries(ENTRY).map(([k, e]) => [k, flow([PIPE.b, e])]));
  const entryOf = d => d === D.steerA ? 'gtm' : d === D.steerC ? 'lb' : DNSB.nz.indexOf(d.z) < NJ ? 'jpm' : 'cf';
  const RT = {
    web: [L.cl.browser, L.hubA, L.cAA, L.inA, L.psT2, L.t2On, L.onSvc],
    api: [L.cl.api, L.hubC, L.cCC, L.inC, L.wafT2, L.t2Cl, L.clSor],
    bpOn: [L.pvtOn, L.bpT2, L.t2On],
    bpAws: [L.pInner, L.pvtAws, L.plIn, L.t2Cl],
    m2m: [L.cl.m2m, L.hubA, L.cAA, L.inA, L.psT2, L.t2On],
    mobile: [L.cl.mobile, L.hubC, L.cCC, L.inC, L.wafT2, L.t2Cl]
  };

  /* ---------- Detail views: zoom in on a device with the free camera to see its architecture ---------- */
  // L4 on AWS (Ingress VPC, us-east-1, AZs a and b). Traffic arrives over PrivateLink: from L3 (the CTC edge account's
  // internet gateway, internet-facing ALB with AWS WAF, and interface VPC endpoint) and from P2 partners' own interface
  // endpoints, into our VPC endpoint service, then the NLB (public subnet), then the internal ALB (private subnet), then
  // the EKS cluster: namespace ingress-gateway runs the Envoy (web) gateway pods, each with a session-validator sidecar
  // (session check, token exchange, ext_authz policies), and the Kong (API) gateway pods, each with an API validator
  // sidecar (OAS validation, token validation, tokenization);
  // namespace ingress-control runs the Kong control plane (proxy hub, analytics, config manager, backed by Aurora
  // PostgreSQL), the xDS control plane, the config distributor and the signal receiver. ElastiCache for Redis holds the
  // token, revoke and policy caches. Onward to L5 is mTLS.
  // Official AWS Architecture Icons (scenes/aws-icons.js), each on a white tile so the glyphs read on the dark scene
  const AWS = window.FK_AWS || {}, ic = (...k) => `<span class="ics">${k.map(n => AWS[n] ? `<span class="ic" title="${n}">${AWS[n]}</span>` : '').join('')}</span>`;
  new FK.Detail(stage, D.t2c, ({ box, flow, group, iconTop, tag }) => {
    // Left to right like the main diagram: endpoint service → NLB → ALB → EKS → Envoy / Kong → out to L5.
    // Wider than the L4 column (x 250..1150): while it is open it spills into the L3 and L5 space and the firewall walls
    // on either side fade, so the components have room. Group boxes carry their icon and title in the top-left corner.
    const pod = (x, z, c, side = true) => {
      box({ x, y: -22, z, w: 44, h: 44, d: 44, c });
      if (side) box({ x: x + 30, y: -13, z: z + 8, w: 18, h: 26, d: 18, c: '#166534' });   // session-validator sidecar
    };
    // the three hops into the cluster: identical boxes, logo on top, name printed on the floor beneath (as in a flat diagram)
    const hop = (x, icon, text, bg = '#fff') => { box({ x, y: -15, z: 450, w: 50, h: 30, d: 70, c: '#3B1F66' }); iconTop({ x, y: -30, z: 450, icon, size: 38, bg }); tag({ x, z: 512, text, w: 100, h: 44, size: 14 }); };
    const KONG_BG = '#001408';
    group({ x1: 250, z1: 40, x2: 1150, z2: 990, color: '#8C4FFF', icon: AWS.vpc, title: 'Ingress VPC', sub: 'us-east-1 · AZ a · b', hw: 300, width: 4, fill: .04 });
    // VPC endpoint service at the edge of the VPC: both L3 and P2 arrive here over PrivateLink
    hop(300, AWS.privatelink, 'VPC endpoint<br>service', 'transparent');
    group({ x1: 355, z1: 95, x2: 500, z2: 975, color: '#7AA116', icon: AWS.pubsubnet, title: 'Public', sub: 'subnet', hw: 108, hh: 36, width: 3, dash: '8 6' });
    hop(428, AWS.nlb, 'NLB');
    group({ x1: 515, z1: 95, x2: 1135, z2: 975, color: '#00A4A6', icon: AWS.subnet, title: 'Private subnet', hw: 180, hh: 36, width: 3, dash: '8 6' });
    hop(578, AWS.alb, 'Internal ALB');
    // data stores in the private subnet: Aurora for the Kong control plane, ElastiCache for the sidecars' caches
    box({ x: 578, y: -20, z: 760, w: 60, h: 40, d: 50, c: '#1E2A44' }); iconTop({ x: 578, y: -40, z: 760, icon: AWS.elasticache, size: 32, bg: 'transparent' });
    box({ x: 578, y: -20, z: 880, w: 60, h: 40, d: 50, c: '#1E2A44' }); iconTop({ x: 578, y: -40, z: 880, icon: AWS.aurora, size: 32, bg: 'transparent' });
    group({ x1: 650, z1: 140, x2: 1120, z2: 940, color: '#ED7100', icon: AWS.eks, title: 'Amazon EKS', sub: 'cluster ingress-l4', hw: 250 });
    // ingress-control at the back, right of its header: one pod per control service, each named on the floor beneath it
    group({ x1: 670, z1: 190, x2: 1105, z2: 350, color: '#94A3B8', title: 'ingress-control', sub: 'namespace', hw: 170, hh: 32, width: 3, dash: '6 6' });
    for (const [x, c, icon, bg, name] of [
      [860, '#1A2A05', AWS.kong, KONG_BG, 'Kong<br>control plane'],
      [930, '#3B1636', AWS.envoy, '#fff', 'Envoy<br>xDS control plane'],
      [1000, '#334155', null, null, 'config<br>distributor'],
      [1065, '#4A1530', null, null, 'signal<br>receiver']]) {
      pod(x, 280, c, false);
      if (icon) iconTop({ x, y: -44, z: 280, icon, size: 28, bg });
      tag({ x, z: 326, text: name, w: 70, h: 34, size: 10 });
    }
    // ingress-gateway: an Envoy group (web, session-validator sidecars) and a Kong group (API, API validator sidecars)
    group({ x1: 670, z1: 365, x2: 1105, z2: 925, color: '#A78BFA', title: 'ingress-gateway', sub: 'namespace', hw: 170, hh: 32, width: 3, dash: '6 6' });
    group({ x1: 690, z1: 410, x2: 1090, z2: 610, color: '#D163CE', icon: AWS.envoy, iconBg: '#fff', title: 'Envoy', sub: 'web gateway', hw: 118, hh: 40, width: 3, dash: '8 6' });
    group({ x1: 690, z1: 630, x2: 1090, z2: 905, color: '#CCFF00', icon: AWS.kong, iconBg: KONG_BG, title: 'Kong', sub: 'API gateway', hw: 118, hh: 40, width: 3, dash: '8 6' });
    [770, 880, 990].forEach((x, i) => { pod(x, 520, '#3B1636'); iconTop({ x, y: -44, z: 520, icon: AWS.envoy, size: 30 }); tag({ x: x + 8, z: 556, text: `pod ${i + 1}`, w: 60, h: 18, size: 11 }); });
    [770, 880, 990].forEach((x, i) => { pod(x, 770, '#1A2A05'); iconTop({ x, y: -44, z: 770, icon: AWS.kong, size: 30, bg: KONG_BG }); tag({ x: x + 8, z: 806, text: `pod ${i + 1}`, w: 60, h: 18, size: 11 }); });
    // flows, left to right
    flow([80, -4, 450], [273, -4, 450], '#FBBF24');             // from L3 (the edge account's interface endpoint), replacing the L3 cable
    // from P2: the partner's interface endpoint, replacing the PrivateLink cable. Right angles around the outside of the
    // VPC (down, along the bottom, up the left side, into the endpoint service) so it crosses nothing in the diagram
    for (const [a, b] of [[[800, 1230], [800, 1030]], [[800, 1030], [232, 1030]], [[232, 1030], [232, 472]], [[232, 472], [273, 472]]])
      flow([a[0], -4, a[1]], [b[0], -4, b[1]], '#2DD4BF', 4);
    flow([327, -4, 450], [401, -4, 450], '#8C4FFF');            // endpoint service -> NLB
    flow([455, -4, 450], [551, -4, 450], '#8C4FFF');            // NLB -> ALB
    flow([605, -4, 440], [690, -4, 505], '#22D3EE');            // ALB -> the Envoy group (web): any pod can take it
    flow([605, -4, 465], [690, -4, 765], '#22D3EE', 4);         // ALB -> the Kong group (API)
    flow([1090, -4, 505], [1150, -4, 470], '#22D3EE', 4);       // the gateway groups -> L5 over mTLS
    flow([1090, -4, 765], [1150, -4, 480], '#22D3EE', 4);
    flow([1150, -4, 475], [1330, -4, 450], '#22D3EE');          // on to the L5 workloads, replacing the onward cable
    flow([650, -4, 760], [610, -4, 760], '#F87171', 4);         // EKS <-> ElastiCache (the sidecars' caches)
    flow([650, -4, 880], [610, -4, 880], '#94A3B8', 4);         // EKS <-> Aurora (the Kong control plane)
    // CAEP risk signals into the signal receiver, from an L5 AWS service for now (the real source is still to be decided)
    flow([1340, -4, 300], [1088, -4, 280], '#F472B6', 4);
    // floor labels, printed next to what they name
    tag({ x: 175, z: 482, text: 'from L3', w: 100, h: 24, size: 14 });   // the L3 edge account gets its own deployment diagram later
    tag({ x: 520, z: 1056, text: 'from P2', sub: 'partner interface endpoints', w: 200, h: 40, size: 14 });
    tag({ x: 1215, z: 238, text: 'CAEP risk signals', sub: 'from an L5 AWS service (source TBC)', w: 170, h: 36, size: 12 });
    tag({ x: 880, z: 586, text: 'session-validator sidecars (green)', sub: 'session check · token exchange · ext_authz policies', w: 320, h: 34, size: 13 });
    tag({ x: 880, z: 840, text: 'API validator sidecars (green)', sub: 'OAS validation · token validation · tokenization', w: 320, h: 34, size: 13 });
    tag({ x: 578, z: 805, text: 'ElastiCache for Redis', sub: 'token · revoke · policy caches', w: 120, h: 44, size: 12 });
    tag({ x: 578, z: 925, text: 'Aurora PostgreSQL', sub: 'Kong control plane', w: 120, h: 44, size: 12 });
    tag({ x: 1195, z: 500, text: 'to L5', sub: 'mTLS', w: 80, h: 40, size: 14 });
  }, { near: 2050, far: 3150, at: [700, 0, 500], hide: [D.pl], links: [L.wafT2, L.plIn, L.t2Cl, L.pvtAws],
       tags: SL.filter(o => o.layer === P && o.side === 'aws').map(o => o.bb), walls: [W2, W3],
       card: { from: [355, 30, 1045, 1000], to: [215, 12, 1185, 1008], lift: 45, color: LAYERS[4].color },   // the L4 AWS tile lifts out and grows
       title: 'L4 · Enforcement Tier (AWS)', shot: { x: 700, y: -60, z: 665, rx: -58, ry: 0, d: 1880 } });   // aimed towards the front so the bottom of the diagram (and the P2 run below it) is in view

  // L2: one deployment diagram per CDN, each lifting its half of the L2 column (Akamai at the back, Cloudflare at the
  // front). Left to right: traffic from L1, the security stages (attacks stopped where they are caught, in red), the
  // CDN edge, then out to both L3 perimeters with origin lockdown. Vendor-hosted, so no logos or AWS icons here.
  const cdnDetail = ({ dev, zc, title, sub, sec, edge, out, attacks, hub, exits, name, shotTitle }) => new FK.Detail(stage, dev, ({ box, flow, group, tag }) => {
    const stg = (x, z, c, text, s2, w = 112) => { box({ x, y: -18, z, w: 52, h: 36, d: 52, c }); tag({ x, z: z + 46, text, sub: s2, w, h: 44, size: 12 }); };
    group({ x1: -1068, z1: zc - 465, x2: -332, z2: zc + 465, color: '#F97316', title, sub, hw: 300, width: 4, fill: .04 });
    group({ x1: -1066, z1: zc - 400, x2: -785, z2: zc + 400, color: '#F43F5E', title: sec.title, sub: sec.sub, hw: 230, hh: 36, width: 3, dash: '8 6' });
    sec.stages.forEach(([x, dz, text, s2, c]) => stg(x, zc + dz, c || '#4A1010', text, s2));
    group({ x1: -720, z1: zc - 400, x2: -515, z2: zc + 400, color: '#38BDF8', title: edge.title, sub: edge.sub, hw: 200, hh: 36, width: 3, dash: '8 6' });
    edge.stages.forEach(([x, dz, text, s2, c]) => stg(x, zc + dz, c || '#0C2A44', text, s2, 130));
    // valid traffic, group boundary to group boundary: from the internet hub in L1 to the security group, a cable across to
    // the edge group, then out to both perimeters (PSaaS+ on-prem and AWS WAF), replacing the cables into L3
    flow([X[1], -4, 0], [X[1] + 130, -4, zc], '#22C55E', 5); flow([X[1] + 130, -4, zc], [-1066, -4, zc], '#22C55E', 5);
    flow([-785, -4, zc], [-720, -4, zc], '#22C55E', 5);
    for (const zx of exits) flow([-515, -4, zc], [-82, -4, zx], '#22C55E', 4);
    tag({ x: -420, z: zc + (zc < 0 ? 60 : -60), text: out.title, sub: out.sub, w: 170, h: 40, size: 12 });
    // attacks, stopped at the stage that catches them
    // the first stops at the network layer; the second passes it and stops at the application layer
    attacks.forEach(([dz, x2, text, tz]) => { flow([-1180, -4, zc + dz], [x2, -4, zc + dz], '#F43F5E', 4); tag({ x: -1150, z: zc + tz, text: `<span style="color:#FB7185">${text}</span>`, w: 150, h: 30, size: 11 }); });
  }, { near: 1800, far: 2900, at: [-700, 0, zc], links: [hub, ...out.links, L.inA, L.inC], walls: [W1],
       card: { from: [-1045, zc < 0 ? -950 : 15, -355, zc < 0 ? -15 : 1000], to: [-1080, zc - 480, -320, zc + 480], lift: 45, color: LAYERS[2].color },
       title: name, shot: { x: -700, y: -60, z: zc + 60, rx: -58, ry: 0, d: 1600 } });
  cdnDetail({ dev: D.cdnA, zc: -450, name: 'L2 · Akamai Edge', title: 'Akamai edge', sub: 'vendor hosted · 4,100+ PoPs',
    sec: { title: 'Kona (WAF)', sub: 'inline before the ION edge servers', stages: [
      [-995, -150, 'Network layer', 'L3/4 · firewall · network DDoS'],
      [-857, -150, 'Application layer', 'L5-7 · WAF · application DDoS'],
      [-926, 170, 'Bot Manager', 'bots and agents classified', '#3B1F66']] },
    edge: { title: 'ION (CDN)', sub: 'edge servers', stages: [
      [-617, -150, 'Edge server', 'TLS terminated · cache'],
      [-617, 170, 'Edge server', 'origin shield · re-encrypt']] },
    out: { title: 'to L3 · SiteShield', sub: 'origins only accept Akamai ranges', links: [L.cAA, L.cAC, L.cCA] },   // cCA: Cloudflare's cable crosses this card
    attacks: [[-165, -1022, 'network attack · blocked', -205], [-135, -884, 'application attack · blocked', -100]],
    hub: L.hubA, exits: [-450, 450] });
  cdnDetail({ dev: D.cdnC, zc: 450, name: 'L2 · Cloudflare Edge', title: 'Cloudflare edge', sub: 'vendor hosted · 310+ cities · anycast',
    sec: { title: 'Security', sub: 'one ruleset with Akamai', stages: [
      [-995, -150, 'DDoS protection', 'L3/4 and L7'],
      [-857, -150, 'WAF', 'managed rules'],
      [-995, 170, 'Bot Management', 'bots and agents', '#3B1F66'],
      [-857, 170, 'API Shield', 'schema validation · discovery', '#3B1F66']] },
    edge: { title: 'Edge', sub: 'CDN and load balancing', stages: [
      [-617, -150, 'CDN', 'TLS terminated · cache'],
      [-617, 170, 'Origin pools', 'load balancing at the edge']] },
    out: { title: 'to L3 · origin lockdown', sub: 'Cloudflare ranges · authenticated origin pulls', links: [L.cCC, L.cCA, L.cAC] },   // cAC: Akamai's cable crosses this card
    attacks: [[-165, -1022, 'volumetric attack · absorbed', -205], [-135, -884, 'application attack · blocked', -100]],
    hub: L.hubC, exits: [450, -450] });

  // L3 on-prem: PSaaS+, the corporate internet perimeter in the DMZ data centres. HTTP and HTTPS only. Modelled on the
  // JPMM physical web infrastructure diagram: in each DC a front load balancer pair owns the PSaaS VIP (80/443) and spreads
  // CDN origin traffic across a pool of F5 WAF appliances, which forward to the tier 2 VIPs in sESF (L4). DMZ network
  // firewalls exist but are not in the source diagram, so they are only noted, not drawn.
  new FK.Detail(stage, D.psaas, ({ box, flow, group, tag }) => {
    const zc = -480, stg = (x, z, c, text, s2, w = 120) => { box({ x, y: -18, z, w: 52, h: 36, d: 52, c }); tag({ x, z: z + 46, text, sub: s2, w, h: 44, size: 12 }); };
    group({ x1: -378, z1: -945, x2: 378, z2: -35, color: '#FBBF24', title: 'PSaaS+ · DMZ data centre', sub: 'corporate internet perimeter · HTTP / HTTPS only · DMZ firewalls not drawn', hw: 420, width: 4, fill: .04 });
    group({ x1: -366, z1: zc - 330, x2: -140, z2: zc + 240, color: '#60A5FA', title: 'Front load balancers', sub: 'PSaaS VIP · 80 / 443', hw: 220, hh: 36, width: 3, dash: '8 6' });
    stg(-253, zc - 140, '#0F2A4A', 'Load balancer', 'owns the PSaaS VIP<br>CDN source ranges only');
    stg(-253, zc + 120, '#0F2A4A', 'Load balancer', 'HA pair');
    group({ x1: -105, z1: zc - 330, x2: 235, z2: zc + 240, color: '#E4002B', title: 'F5 WAF pool', sub: 'scales out behind the VIP', hw: 200, hh: 36, width: 3, dash: '8 6' });
    stg(-40, zc - 140, '#3A0D14', 'F5 WAF 1', 'OWASP protections');
    stg(100, zc - 140, '#3A0D14', 'F5 WAF 2', 'OWASP protections');
    stg(30, zc + 120, '#3A0D14', 'F5 WAF n', 'forwards to the sESF<br>tier 2 VIP');
    // traffic, group boundary to group boundary: from L2, through the load balancers to the WAF pool, out to the T2 gateway in sESF (L4)
    flow([-440, -4, -450], [-366, -4, -450], '#22C55E', 5);
    flow([-140, -4, -450], [-105, -4, -450], '#22C55E', 5);
    flow([235, -4, -450], [640, -4, -450], '#22C55E', 5);
    tag({ x: -420, z: -418, text: 'from L2', w: 80, h: 24, size: 14 });
    tag({ x: 450, z: -405, text: 'to sESF (L4)', sub: 'the backend must terminate in sESF', w: 200, h: 36, size: 13 });
    tag({ x: 0, z: -175, text: 'PSaaS+ · Third-party PSaaS+ · BP PSaaS+ (P1)', sub: 'public APIs and web apps · outsourced JPMC-branded apps · business partners', w: 560, h: 36, size: 12 });
    tag({ x: 0, z: -105, text: '', sub: 'AMER: Aurora · Broomfield · Orangeburg · Totowa &nbsp; EMEA: Farnborough · Basingstoke &nbsp; APAC: Equinix HK · Cavendish HK · SG-C01 · SG-C02', w: 700, h: 22, size: 12 });
  }, { near: 1900, far: 3000, at: [0, 0, -490], links: [L.inA, L.psT2], walls: [W1, W2],
       card: { from: [-345, -950, 345, -30], to: [-392, -958, 392, -22], lift: 45, color: LAYERS[3].color },   // the L3 on-prem tile lifts out and grows
       title: 'L3 · Regional Perimeter (on-prem PSaaS+)', shot: { x: 0, y: -60, z: -430, rx: -58, ry: 0, d: 1650 } });

  // L3 on AWS: the edge WAF account's VPC. CDN origin traffic from L2 enters through the internet gateway, reaches the
  // internet-facing ALB in the public subnets (AZ a, b, c) with AWS WAF attached to it, and leaves through an interface
  // VPC endpoint (network interfaces in the private subnets) over PrivateLink to the L4 Ingress VPC's endpoint service.
  // Simplified from the full design: one ALB stack, no per-subnet security groups or interfaces drawn.
  new FK.Detail(stage, D.waf, ({ box, flow, group, iconTop, tag }) => {
    const hop = (x, icon, text, bg = '#fff') => { box({ x, y: -15, z: 450, w: 50, h: 30, d: 70, c: '#3B1F66' }); iconTop({ x, y: -30, z: 450, icon, size: 38, bg }); tag({ x, z: 512, text, w: 110, h: 44, size: 14 }); };
    group({ x1: -375, z1: 40, x2: 375, z2: 985, color: '#8C4FFF', icon: AWS.vpc, title: 'Edge WAF account', sub: 'VPC · us-east-1', hw: 280, width: 4, fill: .04 });
    hop(-330, AWS.igw, 'Internet<br>gateway');
    group({ x1: -275, z1: 95, x2: -45, z2: 975, color: '#7AA116', icon: AWS.pubsubnet, title: 'Public subnets', sub: 'AZ a · b · c', hw: 200, hh: 36, width: 3, dash: '8 6' });
    hop(-160, AWS.alb, 'Internet-facing<br>ALB');
    // AWS WAF attached to the ALB: every request goes out for inspection and comes back
    box({ x: -160, y: -20, z: 660, w: 60, h: 40, d: 60, c: '#4A1010' }); iconTop({ x: -160, y: -40, z: 660, icon: AWS.waf, size: 36, bg: 'transparent' });
    tag({ x: -160, z: 715, text: 'AWS WAF · web ACL', sub: 'CDN sources only · managed rules · rate limits', w: 210, h: 36, size: 12 });
    flow([-172, -4, 486], [-172, -4, 628], '#F43F5E', 4);       // ALB -> WAF
    flow([-148, -4, 628], [-148, -4, 486], '#F43F5E', 4);       // WAF -> ALB (allow / block)
    group({ x1: -25, z1: 95, x2: 360, z2: 975, color: '#00A4A6', icon: AWS.subnet, title: 'Private subnets', sub: 'AZ a · b · c', hw: 200, hh: 36, width: 3, dash: '8 6' });
    hop(160, AWS.endpoint, 'Interface VPC<br>endpoint');
    tag({ x: 160, z: 552, text: '', sub: 'network interfaces in the private subnets', w: 180, h: 20, size: 12 });
    // flows, left to right
    flow([-440, -4, 450], [-357, -4, 450], '#FBBF24');          // from L2: CDN origin traffic
    flow([-303, -4, 450], [-187, -4, 450], '#FBBF24');          // internet gateway -> ALB
    flow([-133, -4, 450], [133, -4, 450], '#FBBF24');           // ALB (after WAF) -> interface endpoint
    flow([187, -4, 450], [640, -4, 450], '#2DD4BF');            // PrivateLink -> the L4 endpoint service
    tag({ x: -425, z: 482, text: 'from L2', w: 80, h: 24, size: 14 });
    tag({ x: 470, z: 485, text: 'PrivateLink', sub: 'to the L4 endpoint service', w: 200, h: 36, size: 13 });
  }, { near: 1900, far: 3000, at: [0, 0, 500], links: [L.inC, L.wafT2], walls: [W1, W2],
       card: { from: [-345, 30, 345, 1000], to: [-392, 22, 392, 1000], lift: 45, color: LAYERS[3].color },   // the L3 AWS tile lifts out and grows
       title: 'L3 · Regional Perimeter (AWS)', shot: { x: 0, y: -60, z: 640, rx: -58, ry: 0, d: 1650 } });

  const pk = new Packet(stage, W, { size: 34 });
  // L4 deployment view, modelled on ingress-poc: gateway-envoy's filter chain makes one ext_authz call to
  // auth-service, which resolves the session, exchanges the token and then evaluates the Rego payload policies in-process.
  const T2W = 1180, T2P = 18 + 4 * (148 + 20);
  const T2D = new FK.Drill(stage, {
    at: [X[4], -250, -450], dx: -280, w: T2W,
    title: 'L4 · T2 gateway · gateway-envoy', sub: 'Enforcement tier · SESF · deployment view',
    frame: 'envoy (Envoy / Kong data plane, xDS control plane)  →  ext_authz  →  auth-service · session validator, token exchange, Rego payload policies (embedded OPA)',
    lanes: [
      { label: 'gateway-envoy · HTTP filter chain', h: 96, stages: [
        { label: 'listener :443', sub: 'break and inspect TLS', items: ['TLS from L3', 'Host → virtual host'] },
        { label: 'route match', sub: 'routing', items: ['exact / {param} paths', 'route → cluster'] },
        { label: 'ext_authz', sub: 'call auth-service', items: ['request + body →', 'body ≤ 1 MB'] },
        { label: 'router', sub: 'forward to L5', items: ['mTLS → workload', 'verified identity headers'] }] },
      { box: 'auth-service · ext_authz server: live state and token exchange, then the Rego payload policies in order', h: 210, stages: [
        { label: 'session', sub: 'session validator', items: ['aud = ingress-gateway', 'signature · DPoP (cnf.jkt)', 'live state · revoke cache'] },
        { label: 'token exchange', sub: 'internal token · cached', items: ['scopes and lifetime', 'mandate (agents)', 'acting-for chain'] },
        { label: 'global policy', sub: 'payload.global · every route', items: ['SQL injection', 'XSS', 'NoSQL / template'] },
        { label: 'route policy', sub: 'generated from the workload code', items: ['required fields', 'email format', 'phone (E.164)', 'dob YYYY-MM-DD'] }] }
    ],
    panel: { full: true, x: T2P, w: T2W - 18 - T2P }
  });
  // Test payloads from ingress-poc (console TrafficFlow) for POST /api/v1/users/register, and how each policy evaluates them
  const PAY = {
    get: { req: 'GET /api/v1/accounts', badge: ['no body', '#94A3B8'] },
    valid: { req: 'POST /api/v1/users/register', badge: ['valid payload', '#4ADE80'], name: 'Ada Lovelace', email: 'ada@example.com' },
    sqli: { req: 'POST /api/v1/users/register', badge: ['attempted SQL injection', '#F39C12'], name: "Robert'); DROP TABLE users;--", email: 'ada@example.com', inj: "'); DROP TABLE users;--" },
    email: { req: 'POST /api/v1/users/register', badge: ['malformed email', '#FBBF24'], name: 'Ada Lovelace', email: 'not-an-email', flag: true }
  };
  const esc = x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const KEYS = ['full_name', 'email', 'phone', 'date_of_birth', 'country', 'marketing_opt_in'];
  const val = (k, key) => {
    const q = PAY[k];
    if (key === 'full_name') return q.inj ? `"${esc(q.name.slice(0, -q.inj.length))}<span class="inj">${esc(q.inj)}</span>"` : `"${esc(q.name)}"`;
    if (key === 'email') return q.flag ? `<span class="flag">"${q.email}"</span>` : `"${q.email}"`;
    return { phone: '"+14155552671"', date_of_birth: '"1990-01-01"', country: '"US"', marketing_opt_in: 'false' }[key];
  };
  // Global policy (ingress.policy.payload.global): every string field against the injection patterns
  const GLOBAL = k => {
    const q = PAY[k], rows = [];
    for (const key of ['full_name', 'email', 'phone', 'date_of_birth', 'country']) {
      const raw = key === 'full_name' ? q.name : key === 'email' ? q.email : { phone: '+14155552671', date_of_birth: '1990-01-01', country: 'US' }[key];
      if (q.inj && key === 'full_name') { rows.push({ hl: [key], bad: true, name: key, note: `matches (?i)(…drop\\s+table…|--)` }); break; }
      rows.push({ hl: [key], name: key, note: `"${esc(raw)}" · no pattern matched` });
    }
    return rows;
  };
  // Route policy (route_users_register): every rule must hold
  const ROUTE = k => {
    const bad = PAY[k].flag;
    return [
      { hl: [], name: 'body_ok', note: 'is_object(input.body)' },
      { hl: ['full_name', 'email', 'phone', 'date_of_birth'], name: 'all_required_present', note: 'full_name, email, phone, date_of_birth' },
      { hl: ['full_name'], name: 'full_name_valid', note: 'trim_space(full_name) != ""' },
      { hl: ['email'], name: 'email_valid', bad, note: bad ? '"not-an-email" !~ ^[A-Za-z0-9._%+-]+@…\\.[A-Za-z]{2,}$' : 'regex ^[A-Za-z0-9._%+-]+@…\\.[A-Za-z]{2,}$' },
      { hl: ['phone'], name: 'phone_valid', note: 'regex ^\\+?[1-9]\\d{7,14}$' },
      { hl: ['date_of_birth'], name: 'dob_valid', note: 'regex ^\\d{4}-\\d{2}-\\d{2}$' }
    ];
  };
  const POLICY_OUT = {
    global: { ok: 'has_injection = false  →  allow = true', no: 'has_injection = true  →  allow = false<br>deny_reason: "request body contains a potentially malicious pattern (possible injection attempt)"' },
    route: { ok: 'every rule holds  →  allow = true', no: 'email_valid = false  →  allow = false<br>deny_reason: "email is not a valid email address"' }
  };
  const RESP = { valid: ['→ 201 Created (forwarded to the workload in L5)', 'ok'], sqli: ['→ 403 {"error":"Payload validation failed","reason":["request body contains a potentially malicious pattern…"]}', 'no'],
    email: ['→ 403 {"error":"Payload validation failed","reason":["email is not a valid email address"]}', 'no'], get: ['→ allow · session live, token exchanged, no body to inspect', 'ok'] };
  // One snapshot of the evaluation panel. phase: 'pre' | 'global' | 'route'; j: row being evaluated; done: show the policy's result
  function evalHtml(k, phase, j, done, resp) {
    const q = PAY[k];
    let h = `<div class="ev"><div class="eh">${q.req}<small style="background:${q.badge[1]}22;color:${q.badge[1]}">${q.badge[0]}</small></div>`;
    if (k === 'get') return h + `<div class="js"><div>(no request body)</div></div><div class="pk">payload policies <span>· skipped: they only run on requests with a body</span></div>` + (resp ? `<div class="out ok">${RESP.get[0]}</div>` : '') + '</div>';
    const rows = phase === 'global' ? GLOBAL(k) : phase === 'route' ? ROUTE(k) : [];
    const cur = rows[j], hl = !done && cur ? cur.hl : [], hit = cur && cur.bad ? cur.hl : [];
    h += '<div class="js"><div>{</div>' + KEYS.map((key, i) => `<div class="${hit.includes(key) && (done || cur) ? 'hit' : hl.includes(key) ? 'scan' : ''}">  "${key}": ${val(k, key)}${i < KEYS.length - 1 ? ',' : ''}</div>`).join('') + '<div>}</div></div>';
    if (phase === 'route') h += `<div class="pk">global policy <span>· allow = true ✓ (evaluated first)</span></div>`;
    if (phase === 'global') h += `<div class="pk">package ingress.policy.payload.global <span>· default allow = true · scan every string field</span></div>`;
    if (phase === 'route') h += `<div class="pk route">package ingress.policy.payload.route_users_register <span>· default allow = false</span></div>`;
    h += rows.slice(0, j + 1).map((r, i) => `<div class="rl${r.bad ? ' x' : ''}${i === j && !done ? ' cur' : ''}"><i>${r.bad ? '✕' : i === j && !done ? '…' : '✓'}</i><span>${r.name}</span><em>${r.note}</em></div>`).join('');
    if (done) { const bad = rows.some(r => r.bad); h += `<div class="out ${bad ? 'no' : 'ok'}">${POLICY_OUT[phase][bad ? 'no' : 'ok']}${resp ? '<br>' + RESP[k][0] : ''}</div>`; }
    return h + '</div>';
  }
  // One request through the T2 deployment view. k: 'get' | 'valid' | 'sqli' | 'email'
  function t2Run(tl, t, k) {
    const deny = k === 'sqli' || k === 'email', STEP = 850;
    T2D.clear(tl, t); T2D.panel(tl, t, evalHtml(k, 'pre', -1, false));
    t = T2D.enter(tl, t + 200);
    t = T2D.visit(tl, t, [0, 0], { tick: 300, hold: 150 });
    t = T2D.visit(tl, t, [0, 1], { tick: 300, hold: 150 });
    t = T2D.visit(tl, t, [0, 2], { tick: 300, hold: 150, keep: true });
    t = T2D.visit(tl, t, [1, 0], { tick: 330 });
    t = T2D.visit(tl, t, [1, 1], { tick: 300 });
    let lastPhase = 'pre', lastJ = -1;
    if (k === 'get') { T2D.skip(tl, t, [1, 2], 'skipped · no body'); T2D.skip(tl, t, [1, 3], 'skipped · no body'); t += 1200; }
    else {
      // execute a policy: the token sits on the stage while the panel walks the rows
      const run = (li, phase, rows, checks) => {
        t = T2D.move(tl, t, li); T2D.stState(tl, t, li, 'active');
        rows.forEach((_, j) => { T2D.panel(tl, t, evalHtml(k, phase, j, false)); t += STEP; });
        T2D.panel(tl, t, evalHtml(k, phase, rows.length - 1, true));
        const e = T2D.st[li[0]][li[1]]; [...e.querySelectorAll('.ck')].forEach((c, n) => T2D.ckState(tl, t + n * 150, c, checks[n]));
        t += 700 + stage.readTime;
        const bad = rows.some(r => r.bad);
        T2D.stState(tl, t, li, bad ? 'fail' : 'done', bad ? (phase === 'global' ? 'injection in full_name' : 'email fails its pattern') : '');
        lastPhase = phase; lastJ = rows.length - 1;
        return bad;
      };
      const gBad = run([1, 2], 'global', GLOBAL(k), k === 'sqli' ? ['fail', 'pass', 'pass'] : ['pass', 'pass', 'pass']);
      if (gBad) { T2D.tokState(tl, t, 'bad'); T2D.skip(tl, t, [1, 3], 'never evaluated'); t += 500; }
      else if (run([1, 3], 'route', ROUTE(k), k === 'email' ? ['pass', 'fail', 'pass', 'pass'] : ['pass', 'pass', 'pass', 'pass'])) T2D.tokState(tl, t, 'bad');
    }
    t = T2D.move(tl, t + 200, [0, 2], 600);
    T2D.panel(tl, t, evalHtml(k, lastPhase, lastJ, true, true));
    T2D.stState(tl, t, [0, 2], deny ? 'fail' : 'done', deny ? '403 returned to the client' : '');
    t += 600 + stage.readTime * .6;
    if (deny) return T2D.exit(tl, t + 300, -1) + 300;
    T2D.tokState(tl, t, 'ok');
    t = T2D.visit(tl, t, [0, 3], { tick: 300, hold: 150 });
    return T2D.exit(tl, t, 1) + 300;
  }
  // L4 live-state view: the session validator sidecar resolves each request against the session manager (L6) through
  // a revoke cache; the signal receiver takes CAEP events from the signal manager (L6) via the message broker (draft, to confirm)
  const T3D = new FK.Drill(stage, {
    at: [X[4], -250, -450], dx: -280, w: T2W,
    title: 'L4 · Session & signals', sub: 'Enforcement tier · live state · deployment view',
    frame: 'envoy  →  session validator sidecar (revoke cache)  →  session manager (L6)   ·   signal manager (L6)  →  message broker  →  signal receiver  →  enforcement',
    lanes: [
      { label: 'T2 envoy · per request', h: 96, stages: [
        { label: 'listener :443', sub: 'break and inspect TLS', items: ['TLS from L3', 'credential presented'] },
        { label: 'session validator', sub: 'sidecar · live state', items: ['revoke cache checked', 'enforcement state applied'] },
        { label: 'token exchange', sub: 'internal token', items: ['scopes and lifetime', 'cached per session'] },
        { label: 'router', sub: 'forward to L5', items: ['mTLS → workload', 'identity headers'] }] },
      { box: 'Live state · the session manager and signal manager in L6, reached through the session validator and the message broker', h: 210, stages: [
        { label: 'session manager', sub: 'L6 · identity platform', items: ['session active', 'AAL2 · DPoP bound', 'risk level'] },
        { label: 'signal receiver', sub: 'Shared Signals (SSF) · via broker', items: ['SET signature valid', 'aud = ingress receiver', 'subject = live session'] },
        { label: 'enforcement', sub: 'policy · signal → action', items: ['risk high → step-up', 'session-revoked → revoke', 'credential-change → re-auth'] }] }
    ],
    panel: { full: true, x: T2P, w: T2W - 18 - T2P }
  });
  const T3P = {
    req: (h, badge, col) => `<div class="eh">${h}<small style="background:${col}22;color:${col}">${badge}</small></div>`,
    sess: (rows, out) => `<div class="pk route">session manager <span>· session sid-7f3c…e21 (user ada@client.com)</span></div>` + rows.map(([ok, n, v]) => `<div class="rl${ok ? '' : ' x'}"><i>${ok ? '✓' : '✕'}</i><span>${n}</span><em>${v}</em></div>`).join('') + (out ? `<div class="out ${out[1]}">${out[0]}</div>` : '')
  };
  const t3Html = {
    ok: done => `<div class="ev">${T3P.req('GET /accounts', 'session live', '#34D399')}<div class="js"><div>GET /accounts HTTP/2</div><div>x-session-id: sid-7f3c…e21</div><div>x-auth-sub: ada@client.com</div><div>traceparent: 00-4bf9…-01</div></div>` +
      T3P.sess([[1, 'status', 'active'], [1, 'assurance', 'AAL2 (passkey)'], [1, 'device binding', 'DPoP jkt matches'], [1, 'risk level', 'low'], [1, 'enforcement', 'none']], done ? ['allow → internal token minted → workload in L5 (mTLS)', 'ok'] : null) + '</div>',
    set: step => `<div class="ev">${T3P.req('CAEP event · Security Event Token', 'from the signal manager, via the broker', '#F472B6')}<div class="js"><div>{ "iss": "https://signals.jpmc.internal",</div><div>  "aud": "ingress-caep-receiver",</div><div>  "events": { "…/caep/event-type/risk-level-change": {</div><div class="${step >= 1 ? 'scan' : ''}">      "subject": { "format": "opaque", "id": "sid-7f3c…e21" },</div><div class="${step >= 1 ? 'hit' : ''}">      "previous_level": "low", "current_level": "high",</div><div>      "reason_admin": "impossible travel + new payee" } } }</div></div>` +
      (step >= 1 ? `<div class="pk">signal receiver <span>· verify, then match to a live session</span></div><div class="rl"><i>✓</i><span>signature</span><em>ES256 · transmitter JWKS</em></div><div class="rl"><i>✓</i><span>audience</span><em>ingress-caep-receiver</em></div><div class="rl"><i>✓</i><span>subject</span><em>sid-7f3c…e21 is live</em></div>` : '') +
      (step >= 2 ? `<div class="pk route">enforcement policy <span>· risk-level-change → action</span></div><div class="rl x"><i>!</i><span>current_level</span><em>"high" → require step-up (AAL3)</em></div><div class="out no">action: step_up · session enforcement state updated · effective on the next request</div>` : '') + '</div>',
    stepup: done => `<div class="ev">${T3P.req('POST /v1/payments', 'same session, next request', '#FBBF24')}<div class="js"><div>POST /v1/payments HTTP/2</div><div>x-session-id: sid-7f3c…e21</div><div>{ "amount": 25000.00, "payee": "···9921" }</div></div>` +
      T3P.sess([[1, 'status', 'active'], [1, 'assurance', 'AAL2 (passkey)'], [0, 'risk level', 'high (CAEP, 4 s ago)'], [0, 'enforcement', 'step-up to AAL3 required']],
        done ? ['→ 401 WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="aal3"', 'no'] : null) + '</div>'
  };
  function t3Run(tl, t, k) {
    T3D.clear(tl, t); T3D.panel(tl, t, t3Html[k](false));
    t = T3D.enter(tl, t + 200);
    t = T3D.visit(tl, t, [0, 0], { tick: 300, hold: 150 });
    t = T3D.visit(tl, t, [0, 1], { tick: 300, hold: 150, keep: true });
    const bad = k === 'stepup';
    t = T3D.visit(tl, t, [1, 0], { st: bad ? ['pass', 'pass', 'fail'] : ['pass', 'pass', 'pass'], note: bad ? 'step-up required' : '', tick: 400 });
    T3D.panel(tl, t, t3Html[k](true)); t += 700 + stage.readTime;
    t = T3D.move(tl, t, [0, 1], 500);
    if (bad) { T3D.tokState(tl, t, 'bad'); T3D.stState(tl, t, [0, 1], 'fail', '401 · step-up (AAL3)'); t += 600 + stage.readTime * .6; return T3D.exit(tl, t, -1) + 300; }
    T3D.stState(tl, t, [0, 1], 'done');
    t = T3D.visit(tl, t, [0, 2], { tick: 300, hold: 150 });
    T3D.tokState(tl, t, 'ok');
    t = T3D.visit(tl, t, [0, 3], { tick: 300, hold: 150 });
    return T3D.exit(tl, t, 1) + 300;
  }
  // A CAEP signal arrives from outside the request path and changes the session's enforcement state
  function t3Signal(tl, t) {
    T3D.clear(tl, t); T3D.panel(tl, t, t3Html.set(0));
    const rx = [T3D.W + 24, T3D.lanes[1].rowY];
    tl.add(T3D.tok, { x: [rx[0], rx[0]], y: [rx[1], rx[1]], duration: 0 }, t);
    T3D.tokState(tl, t, 'sig');
    tl.add(T3D.tok, { opacity: [0, 1], duration: 200 }, t);
    t += 900;
    T3D.panel(tl, t, t3Html.set(1));
    t = T3D.visit(tl, t, [1, 1], { tick: 450 });
    T3D.panel(tl, t, t3Html.set(2));
    t = T3D.visit(tl, t, [1, 2], { st: ['pass', 'skip', 'skip'], note: 'risk high → step-up', tick: 400 });
    t = T3D.move(tl, t, [1, 0], 600);
    T3D.stState(tl, t, [1, 0], 'active', 'enforcement: step-up required');
    [...T3D.st[1][0].querySelectorAll('.ck')].forEach((c, n) => T3D.ckState(tl, t + n * 150, c, n === 2 ? 'fail' : 'pass'));
    t += 900 + stage.readTime;
    tl.add(T3D.tok, { opacity: [1, 0], duration: 200 }, t);
    return t + 300;
  }
  const dnsDot = new FK.Dot(stage, W, { color: '#E2E8F0', size: 11 });
  const drawDots = Array.from({ length: 6 }, () => new FK.Dot(stage, W, { color: '#E2E8F0', size: 11 }));
  const pkB = new Packet(stage, W, { size: 30 }), pkC = new Packet(stage, W, { size: 30 }), pkD = new Packet(stage, W, { size: 30 }), pkE = new Packet(stage, W, { size: 30 });
  stage.tracker = pk;

  /* ---------- helpers ---------- */
  const OBS_Y = -600, OBS_Z = -1530;
  let TID = '';
  const cap = (tl, p, s, x) => stage.caption.at(tl, p, s, x);
  function base(tl, id, total) { stage.setCam(SHOT.overview); TID = id; trace.begin(tl, { id, total }); obs.begin(tl); stage.focus(tl, 0, null); }
  function span(tl, pos, from, svc, start, dur, status = 'ok', log) {
    const color = status === 'error' ? '#F43F5E' : status === 'warn' ? '#FBBF24' : '#A78BFA';
    const f = from.top ? from.top : from;
    fly(stage, W, tl, pos, [f[0], f[1] - 10, f[2]], [Math.max(-2200, Math.min(2200, f[0])), OBS_Y, OBS_Z], { color, dur: 900, arc: -120 });
    trace.add(tl, pos + 900, { svc, start, dur, status });
    obs.log(tl, pos + 900, log || `${svc.padEnd(18)} ${String(dur).padStart(3)}ms  trace=${TID.slice(0, 8)}`, status === 'error' ? '#FDA4AF' : status === 'warn' ? '#FDE68A' : '#C7D2FE', { err: status === 'error' ? 1 : 0 });
    return pos;
  }
  // Travel along links, opening every firewall gate the path crosses just before the packet arrives
  function go(tl, t, p, links, dur, o = {}) {
    const r = Array.isArray(links) ? route(links, o.reverse) : links, ez = o.ease || 'inOutSine';
    gates(tl, t, r.pts, dur, ez);
    return p.travel(tl, t, r, dur, { cls: o.cls || 'lit', ease: ez });
  }
  function gates(tl, t, pts, dur, ez) {
    const path = FK.pathFn(pts), E = FK.ease(ez), N = 240;
    for (const w of WALLS) {
      let prev = path.at(0).p;
      for (let i = 1; i <= N; i++) {
        const cur = path.at(E(i / N)).p;
        if ((prev[0] >= w.x) !== (cur[0] >= w.x) && cur[2] >= w.z1 && cur[2] <= w.z2) {   // side test: a sample exactly on the wall still counts once
          const lane = Object.keys(w.gates).map(Number).reduce((a, b) => Math.abs(b - cur[2]) < Math.abs(a - cur[2]) ? b : a);
          w.pass(tl, t + (i / N) * dur - 900, lane, 1900);   // fully open well before the packet, closes after it clears
        }
        prev = cur;
      }
    }
  }
  function visit(tl, t, d, key, o = {}) {
    const c = { ...CHECKS[key], ...(o.check || {}) };
    d.activate(tl, t, o.hold || 3000);
    return stage.checklist(tl, t, { at: d.top, title: c.title, items: c.items.map(x => typeof x === 'string' ? { t: x } : x), result: c.result, resultColor: c.color, step: o.step || 280, hold: o.linger ?? 500, dx: o.dx ?? 30, dy: o.dy ?? -20, code: o.code });
  }
  // DNS lookup, walked step by step. The client's resolver asks one of the dual authoritative nameservers,
  // follows the CNAME hand-off to GTM or Cloudflare LB, and gets the best edge IP. The request itself then goes
  // client -> internet -> edge and never touches L0.
  //   steps: [{ dev, q, ans, sub, check: {title, items, result, color}, link, to }]
  function dns(tl, t, client, steps, o = {}) {
    const a = [client.x - 60, client.topY - 20, client.z], cache = o.cache || 'miss';
    if (cache === 'hit') {
      client.activate(tl, t, 1600);
      return stage.checklist(tl, t, { at: client.top, title: 'DNS cache (resolver / OS)', items: [{ t: `app.jpmorgan.com cached · ${o.ttlLeft || 14}s of TTL left` }], result: 'No lookup · L0 not contacted', step: 280, hold: 700 });
    }
    const feed = FEED.get(client), port = feed ? feed.pts[0] : [client.x - 110, -40, client.z];
    const top = d => [d.x, d.topY + 20, d.z];
    const via = d => [a, port, PIPE.a, PIPE.b, ENTRY[entryOf(d)], top(d)];
    const lit = [pipe, ...(feed ? [feed] : [])];
    lit.forEach(l => l.mark(tl, t, 'dns'));
    dnsDot.show(tl, t, true);
    let from = null;
    steps.forEach((st, i) => {
      const b = top(st.dev);
      if (i === 0) { OUT[entryOf(st.dev)].mark(tl, t, 'dns'); lit.push(OUT[entryOf(st.dev)]); t = dnsDot.travel(tl, t, via(st.dev), 1600); }
      else t = dnsDot.travel(tl, t + 100, [from, b], 900);
      ring(stage, W, tl, t, b, '#CBD5E1', 150);
      st.dev.activate(tl, t, st.check ? 2600 : 1200);
      const c = st.check;
      if (c && o.quiet) t += 900;
      else if (c) t = stage.checklist(tl, t, { at: st.dev.top, title: c.title, items: c.items.map(x => typeof x === 'string' ? { t: x } : x), result: c.result, resultColor: c.color || '#E2E8F0', step: 300, hold: 400, dx: 40, dy: 10 });
      else t += 600;
      if (st.link) { st.link.mark(tl, t - 200, 'dns'); lit.push(st.link); }
      if (st.to) ring(stage, W, tl, t - 700, st.to.top, '#CBD5E1', 260);
      from = b;
    });
    const last = steps[steps.length - 1].dev;
    OUT[entryOf(last)].mark(tl, t, 'dns'); lit.push(OUT[entryOf(last)]);
    t = dnsDot.travel(tl, t + 100, via(last).reverse(), 1500);
    ring(stage, W, tl, t, a, '#CBD5E1', 140);
    if (o.final) { client.activate(tl, t, 1600); t += 1200; }
    dnsDot.show(tl, t, false);
    lit.forEach(l => l.clear(tl, t));
    return t + 150;
  }
  // Lookups used by the chapters (illustrative names, IPs and TTLs)
  const DNSQ = {
    tour: [
      { dev: D.ns2, q: 'A? app.jpmorgan.com', qsub: '1 · resolver asks a nameserver', ans: 'CNAME app.jpmorgan.com.akadns.net', sub: '2 · NS: ask Akamai GTM', link: CN[2],
        check: { title: '1 · JPMorgan NS · primary', items: ['Resolver picked one of the 7 NS', 'app.jpmorgan.com → CNAME …akadns.net'], result: 'Hand-off to Akamai GTM' } },
      { dev: D.steerA, q: 'A? app.jpmorgan.com.akadns.net', qsub: '3 · resolver asks Akamai GTM', ans: 'A 23.45.67.89', sub: '4 · best edge IP · TTL 20s',
        check: { title: '2 · Akamai GTM · smart routing', items: ['Client location, latency, load, health', 'Best edge: Akamai NYC-3'], result: '3 · A 23.45.67.89 back to the client' } }
    ],
    web: [
      { dev: D.ns2, q: 'A? app.jpmorgan.com', ans: 'CNAME app.jpmorgan.com.akadns.net', sub: 'hand-off to Akamai GTM · TTL 300s', link: CN[2],
        check: { title: 'ns2.jpmorganchase.com · primary', items: ['Resolver picked a JPMorgan NS this time', 'Any of the 7 NS could have answered', 'app.jpmorgan.com → CNAME …akadns.net'], result: 'CNAME → Akamai GTM' } },
      { dev: D.steerA, q: 'A? app.jpmorgan.com.akadns.net', ans: 'A 23.45.67.89', sub: 'Akamai NYC-3 · TTL 20s', to: D.cdnA,
        check: { title: 'Akamai GTM · pick the best edge', items: ['Client location (resolver / ECS): NA-East', { t: 'NYC-3 · 9 ms · load 41% · healthy' }, { t: 'IAD-1 · 14 ms · load 63%', s: 'skip' }, { t: 'ORD-2 · health checks failing', s: 'fail' }], result: 'A 23.45.67.89 (Akamai NYC-3) · TTL 20s' } }
    ],
    api: [
      { dev: D.ns6, q: 'A? api.jpmorgan.com', ans: 'A? api.jpmorgan.com', sub: 'secondary override → Cloudflare LB', link: CN[6] },
      { dev: D.steerC, q: 'A? api.jpmorgan.com', ans: 'A 104.16.132.229', sub: 'Cloudflare anycast · TTL 300s', to: D.cdnC,
        check: { title: 'Cloudflare secondary + LB', items: ['Resolver picked ns0134.secondary.cloudflare.com', 'Zone transferred from the JPMorgan primary', 'Override: api.jpmorgan.com answered by Cloudflare LB', 'Anycast: BGP routes to the nearest PoP'], result: 'A 104.16.132.229 (anycast)' } }
    ],
    failover: [
      { dev: D.ns1, q: 'A? app.jpmorgan.com', ans: 'CNAME app.jpmorgan.com.akadns.net', sub: 'hand-off to Akamai GTM', link: CN[1],
        check: { title: 'ns1.jpmorganchase.com · primary', items: ['Cached answer expired (TTL 20s)', 'app.jpmorgan.com → CNAME …akadns.net'], result: 'CNAME → Akamai GTM' } },
      { dev: D.steerA, q: 'A? app.jpmorgan.com.akadns.net', ans: 'A 104.16.132.229', sub: 'steered to Cloudflare · TTL 20s', to: D.cdnC,
        check: { title: 'Akamai GTM · multi-CDN', items: [{ t: 'Akamai edges NA-East: degraded', s: 'warn' }, 'Policy: steer to Cloudflare'], result: 'Answer: Cloudflare edge IP', color: '#FBBF24' } }
    ]
  };
  const look = (d, { dx = 0, dz = 0, rx = -26, ry = -16, dist = 2000, dy = -150 } = {}) => ({ x: d.x + dx, y: dy, z: d.z + dz, rx, ry, d: dist });
  const SHOT = {
    overview: { x: -420, y: -120, z: -60, rx: -46, ry: 0, d: 7800 },
    wide: { x: -400, y: -200, z: 60, rx: -32, ry: -6, d: 7800 },
    clients: { x: -1555, y: -220, z: 60, rx: -28, ry: 22, d: 3300 },
    steer: { x: -2605, y: -180, z: 60, rx: -34, ry: 24, d: 3500 },
    edge: { x: -900, y: -180, z: 0, rx: -28, ry: 10, d: 3000 },
    cloud: { x: 700, y: -170, z: 450, rx: -30, ry: -14, d: 2900 },
    obs: { x: 0, y: -840, z: -1550, rx: -6, ry: 0, d: 5600 },
    t2drill: { x: 1400, y: -925, z: -450, rx: -26, ry: -10, d: 2700 },   // puts the T2 node low-left, the callout opens above it
    front: { x: -950, y: -200, z: -260, rx: -34, ry: 6, d: 4600 },
    van: { x: -480, y: -40, z: -1200, rx: -60, ry: 0, d: 4600 },   // the whole P1 path: client network → BP PSaaS → up into the L4 gateway
    plink: { x: 700, y: -40, z: 1100, rx: -40, ry: -12, d: 2700 },
    l4: { x: -450, y: -200, z: 0, rx: -30, ry: 0, d: 5600 }   // clients through to L4, for the client-type walk
  };
  SHOT.t3drill = SHOT.t2drill;   // both L4 views open from the on-prem T2 gateway
  const pod = (wl, i) => [X[5], -150, wl.pods[i].z];
  function wlPulse(tl, t, wl) {
    wl.activate(tl, t, 2000);
    ring(stage, W, tl, t, [wl.x, -140, wl.z], '#34D399', 240);
    tl.add(wl.pods.map(p => p.g), { y: [0, -14, 0], duration: 600, ease: 'inOutSine', delay: (e, i) => i * 120 }, t);
  }
  function workload(tl, t, wl, pkt, lnk, cls, name, start, dur) {
    wl.activate(tl, t, 2000);
    ring(stage, W, tl, t, [X[5], -140, wl.z], '#34D399', 240);
    tl.add(wl.pods.map(p => p.g), { y: [0, -14, 0], duration: 600, ease: 'inOutSine', delay: (e, i) => i * 120 }, t);
    span(tl, t, wl, name, start, dur);
    return t;
  }

  /* ---------- Chapter 1: the layers ---------- */
  const TOUR_TITLE = ['L0 · DNS control plane', 'L1 · Client', 'L2 · Edge protection / CDN', 'L3 · Regional perimeter', 'L4 · Enforcement tier', 'L5 · IFA workload zone', 'L6 · Internal network'];
  const TOUR_LINE = [
    'Before a client sends anything, its resolver asks L0 for an edge address. L0 answers from beside the request path, never in it',
    'Browsers, mobile apps, API clients, delegated and autonomous agents and M2M callers. Every request starts here, untrusted regardless of type',
    'Akamai and Cloudflare terminate TLS close to the user, absorb attacks and classify callers, without establishing identity',
    'PSaaS+ and AWS WAF admit only CDN traffic into JPMorgan networks, which is what makes origin lockdown enforceable',
    'The single enforcement point: resolves every credential to live state, inspects the payload, enforces scopes and mandates, and injects verified identity',
    'Application workloads on GKP and EKS, reachable only from L4 over mutual TLS',
    'Downstream services, systems of record and the identity platform, with identity propagated rather than re-asserted'
  ];
  function chTour(tl) {
    base(tl, '', 400);
    const devs = [...Object.values(C), ...Object.values(D)].filter(d => !d.o.hidden);
    devs.forEach(d => d.show(tl, 0, false));
    // Cables introduced by a step are drawn in by small dots travelling from the previous layer into the new one
    const DRAW = {
      2: [[L.cl.browser, L.hubA], [L.cl.mobile, L.hubC], [L.cl.api, L.hubA], [L.cl.dagent, L.hubC], [L.cl.aagent, L.hubC], [L.cl.m2m, L.hubA]],
      3: [[L.cAA, L.inA], [L.cCC, L.inC], [L.cAC, L.inC], [L.cCA, L.inA]],
      4: [[L.psT2], [L.wafT2]],
      5: [[L.t2On], [L.t2Cl]],
      6: [[L.onSvc], [L.clSor]],
      on: [[L.pvtOn, L.bpT2]],
      aws: [[L.pInner, L.pvtAws, L.plIn]]
    };
    const drawn = new Set(Object.values(DRAW).flat(2));
    const segVis = (sg, pos, v) => tl.set(sg, 'draw', pos, v, x => { sg.style.display = x ? '' : 'none'; }, true);
    stage.links.filter(l => !l.hidden).forEach(l => drawn.has(l) ? l.segs.forEach(sg => segVis(sg, 0, false)) : l.show(tl, 0, false));
    const drawIn = (routes, t0) => {
      let end = t0;
      routes.forEach((links, j) => {
        const r = route(links), path = FK.pathFn(r.pts), E = FK.ease('inOutSine'), dot = drawDots[j % drawDots.length];
        const a = t0 + j * 280, dur = Math.max(1100, Math.min(2600, path.total * 1.3));
        dot.show(tl, a, true);
        dot.travel(tl, a, r.pts, dur, 'inOutSine');
        gates(tl, a, r.pts, dur, 'inOutSine');
        r.segs.forEach((sg, k) => { if (sg && path.segs[k]) segVis(sg, a + dur * FK.invEase(E, path.segs[k].start / path.total), true); });
        dot.show(tl, a + dur, false);
        end = Math.max(end, a + dur);
      });
      return end;
    };
    const lab = (o, pos, v) => tl.set(o.bb, 'vis', pos, v, x => { o.bb.el.style.display = x ? '' : 'none'; }, true);
    SL.forEach(o => lab(o, 0, false));
    tl.capY = 64;   // higher than the default (150) to keep the caption clear of the scene; this chapter has no deployment views
    stage.flag(tl, 0, 'fk-notrace', true);   // no distributed trace in the tour, and the caption takes its place at the top
    let t = 300;
    cap(tl, t, 'The layers', 'From the client to the internal network, with L0 steering from the side');
    t = stage.shot(tl, t, SHOT.wide, 2200) - 600;
    const tour = [
      { x: -2200, y: -190, z: 60, rx: -32, ry: 22, d: 4300 },   // L0, with the clients in view for the lookup
      { x: -1650, y: -200, z: 0, rx: -30, ry: 24, d: 4300 },
      { x: -800, y: -200, z: 0, rx: -28, ry: 10, d: 3200 },
      { x: -50, y: -180, z: 0, rx: -30, ry: -8, d: 3300 },
      { x: 650, y: -180, z: -40, rx: -36, ry: -14, d: 4300 },
      { x: 1350, y: -170, z: 0, rx: -32, ry: -16, d: 3400 },
      { x: 2000, y: -170, z: 0, rx: -32, ry: -20, d: 3400 }
    ];
    // Clients first, then L0 with the resolver lookup in the same step, then L2 onwards
    for (const i of [1, 0, 2, 3, 4, 5, 6]) {
      cap(tl, t, TOUR_TITLE[i], TOUR_LINE[i]);   // one sentence per layer; the layer chapters go into detail
      stage.focus(tl, t, i === 0 ? [0, 1] : i);   // L0: keep the clients lit, the lookup starts at one
      stage.shot(tl, t, tour[i], 1600);
      devs.filter(d => d.layer === i).forEach((d, j) => d.reveal(tl, t + 600 + j * 160));
      SL.filter(o => o.layer === i).forEach(o => lab(o, t + 800, true));
      stage.links.filter(l => l.layer === i && !l.hidden && !drawn.has(l)).forEach(l => l.show(tl, t + 600, true));
      let next = t + 4200;
      if (DRAW[i]) next = Math.max(next, drawIn(DRAW[i], t + 900) + 900);
      // L1: light each client type in turn and hold so they can be read
      if (i === 1) { CLIENTS.forEach((d, j) => d.activate(tl, t + 1300 + j * 300, 4400 - j * 300)); next = t + 6200; }
      // L0: as the DNS box appears, a client's resolver asks it for an edge address
      if (i === 0) next = dns(tl, t + 2000, C.browser, DNSQ.tour, { final: ['', ''], quiet: true }) + 800;
      t = next;
    }
    // Private connectivity: two sub-steps, each centred
    const side = d => d.z > 0 ? 'aws' : 'on';
    const pd = devs.filter(d => d.layer === P), pl = stage.links.filter(l => l.layer === P && !l.hidden);
    for (const [k, title, line, shot] of [
      ['on', 'P1 · VAN → BP PSaaS', 'Institutional clients on private circuits bypass L0 and L2 and enter at L3. They are still L1 clients and still carry a credential', SHOT.van],
      ['aws', 'P2 · AWS PrivateLink', 'Partner services in their own AWS VPC reach our endpoint service privately, entering at L4', SHOT.plink]]) {
      cap(tl, t, title, line);
      stage.focus(tl, t, [P, { on: 3, aws: 4 }[k]]);   // light the layer each path enters
      stage.shot(tl, t, shot, 1800);
      pd.filter(d => side(d) === k).forEach((d, j) => d.reveal(tl, t + 700 + j * 200));
      SL.filter(o => o.layer === P && o.side === k).forEach(o => lab(o, t + 900, true));
      pl.filter(l => !drawn.has(l) && side({ x: l.pts[0][0], z: l.pts[0][2] }) === k).forEach(l => l.show(tl, t + 700, true));
      t = Math.max(t + 4400, drawIn(DRAW[k], t + 900) + 900);
    }
    stage.focus(tl, t, null);
    cap(tl, t, 'All together', 'Web on-prem, an API call into AWS, M2M on-prem and partners over P1 and P2, all at once');
    t = stage.shot(tl, t, SHOT.overview, 2200);
    const flows = [[pk, RT.web, 'tls', 'GET /accounts'], [pkB, RT.api, 'tls', 'GET /v1/accounts'], [pkC, RT.m2m, 'tls', 'POST /v1/batch'],
      [pkD, RT.bpAws, 'priv', 'GET /v1/positions'], [pkE, RT.bpOn, 'priv', 'POST /v1/payments']];
    flows.forEach(([p, r, s, txt], i) => {
      const a = t + i * 500, first = r[0].pts[0];
      const t1 = p.appear(tl, a, first, s, txt);
      const t2 = go(tl, t1, p, r, 7000, { cls: s === 'priv' ? 'priv' : 'lit', ease: 'inOutSine' });
      p.state_(tl, t2, 'ok', '200 OK');
      const t3 = go(tl, t2 + 300, p, r, 5200, { reverse: true, cls: 'ok', ease: 'inOutSine' });
      p.vanish(tl, t3);
    });
    tl.wait(t + 2000 + 7400 + 5500, 1500);
  }

  /* ---------- Layer chapters: what each layer is, what it does, why it exists, and its latency budget ---------- */
  // say(): a caption beat, optionally lighting devices and showing a panel of points; returns when the beat is done
  function say(tl, t, h, text, { hold = 4600, devs = [], panel } = {}) {
    cap(tl, t, h, text);
    devs.forEach((d, i) => d.activate(tl, t + i * 200, Math.max(1200, hold - 400 - i * 200)));
    let end = t + hold;
    if (panel) end = Math.max(end, stage.checklist(tl, t + 400, { at: panel.at.top || panel.at, title: panel.title, items: panel.items.map(x => typeof x === 'string' ? { t: x } : x),
      result: panel.result, resultColor: panel.color, step: panel.step || 420, hold: 900, dx: panel.dx ?? 30, dy: panel.dy ?? -20 }) - 250);
    return end + 300;
  }
  const layerCh = spec => tl => {
    base(tl, '', 400);
    if (spec.legs) budget.begin(tl, 0, spec.legs);
    stage.flag(tl, 0, 'fk-notrace', true);   // no distributed trace in the layer explainers
    stage.focus(tl, 0, spec.focus);
    let t = 300;
    stage.shot(tl, t, spec.shot, 2000);
    for (const step of spec.steps) t = step(tl, t);
    stage.focus(tl, t, null);
    tl.wait(t, 1500);
  };
  const CLIENTS = Object.values(C), NS = [1, 2, 3, 4, 5, 6, 7].map(n => D['ns' + n]);
  // Per client type, from the client-type table (also used by the 'Client types' journey)
  const CT = [
    { d: C.browser, n: 'Browser', l2: 'JavaScript challenge, fingerprinting, CAPTCHA', present: 'Signed session artefact, opaque reference', resolve: 'Live session state', stepup: 'Redirect to re-authenticate', risk: 'Revoke session', inject: 'Verified user identity' },
    { d: C.mobile, n: 'Mobile app', l2: 'App attestation, certificate pinning', present: 'Access token, key-bound', resolve: 'Live session state and device binding', stepup: 'In-app biometric or one-time code', risk: 'Revoke session or device binding', inject: 'Verified user identity' },
    { d: C.api, n: 'API client', l2: 'Schema validation, per-client rate limits, API discovery', mtls: true, present: 'Delegated access token, DPoP or certificate bound', resolve: 'User grant and consented scopes', stepup: '401 insufficient_user_authentication', risk: 'Revoke the grant to that app', inject: 'User identity and client identity' },
    { d: C.dagent, n: 'Delegated agent', l2: 'Agent classification, schema validation, rate limits', present: 'Exchanged agent-scoped token, sub = user, act = agent', resolve: 'Delegation, user entitlements as ceiling', stepup: 'Back to the user, CIBA push', risk: 'Revoke delegation or user session', inject: 'User identity, agent as actor, task scope' },
    { d: C.aagent, n: 'Autonomous agent', l2: 'Agent classification, signed-request check, strict rate and transaction limits', mtls: true, present: 'Agent credential plus signed request', resolve: 'Registered agent and its live mandate', stepup: 'Out-of-band to the owner’s approver, or deny', risk: 'Suspend agent or shrink mandate', inject: 'Agent identity, mandate reference' },
    { d: C.m2m, n: 'M2M', l2: 'Rate limits, IP allow-lists', mtls: true, present: 'Client credentials or signed assertion', resolve: 'Workload identity and fixed scopes', stepup: 'Not applicable', risk: 'Revoke credentials', inject: 'Workload identity' }
  ];
  // The step-up story at L4: a signal from L6 changes the session's enforcement state, and the next request is refused
  function signalStory(tl, t) {
    cap(tl, t, 'A signal arrives', 'The signal manager in L6 raises a CAEP risk-level-change for this session; the message broker carries it to the L4 signal receiver');
    stage.shot(tl, t, { x: 1500, y: -260, z: -400, rx: -32, ry: -12, d: 3600 }, 1400);
    D.sig.activate(tl, t + 900, 2400); ring(stage, W, tl, t + 900, D.sig.top, '#F472B6', 240);
    const chip = `<div class="fk-chip" style="--pc:#F472B6;transform:translate(-50%,-50%)">CAEP · risk-level-change</div>`;
    t = fly(stage, W, tl, t + 1200, [D.sig.x, D.sig.topY - 10, D.sig.z], [D.broker.x, D.broker.topY - 10, D.broker.z], { html: chip, dur: 900, arc: -120 });
    D.broker.activate(tl, t, 1400);
    t = fly(stage, W, tl, t + 100, [D.broker.x, D.broker.topY - 10, D.broker.z], [D.t2.x, D.t2.topY - 10, D.t2.z], { html: chip, dur: 1800, arc: -260 });
    stage.shot(tl, t, SHOT.t3drill, 1000);
    stage.present(tl, t, true); t = T3D.open(tl, t + 200, 600);
    cap(tl, t, 'Receive, verify, enforce', 'The signal receiver verifies the Security Event Token and matches it to the live session; the policy decides the action: step-up to AAL3');
    t = t3Signal(tl, t + 300);
    cap(tl, t, 'The next request is stopped', 'The same session tries a payment. Its enforcement state now requires step-up, so L4 refuses it with a 401 and nothing reaches L5');
    t = t3Run(tl, t + 300, 'stepup');
    t = T3D.close(tl, t + 300, 500); stage.present(tl, t, false);
    pk.state_(tl, t, 'bad', '401 · step-up required', 'acr_values=aal3');
    pk._place(tl, t, 0, 'linear', () => [D.t2.x - 80, Y, D.t2.z]); pk._show(tl, t, true);
    tl.add(pk.sc, { scale: [1, 1], duration: 0 }, t);
    stage.shot(tl, t, SHOT.overview, 1800);
    t = go(tl, t + 300, pk, [L.cl.browser, L.hubA, L.cAA, L.inA, L.psT2], 4200, { reverse: true, cls: 'bad', ease: 'inOutQuad' });
    C.browser.html(tl, t, SCR.stepup); ring(stage, W, tl, t, C.browser.top, '#FBBF24', 260);
    return pk.vanish(tl, t + 900) + 300;
  }
  const LAYER_CH = {
    L0: layerCh({ focus: [0, 1], shot: SHOT.steer, steps: [
      (tl, t) => say(tl, t + 400, 'L0 · DNS control plane', 'It resolves the hostname to an edge address before any request is made. It sits ahead of the request path: no traffic flows through it', { devs: [...NS, D.steerA, D.steerC], hold: 5200 }),
      (tl, t) => say(tl, t, 'Two DNS providers', 'jpmorgan.com is served by 4 JPMorgan primary nameservers and 3 Cloudflare secondaries (zone transfer). Resolvers ask any of them, so either provider can fail without an outage', { hold: 6400,
        panel: { at: D.ns3, title: 'Dual DNS', items: ['4 × JPMorgan NS · primary, zone authored here', '3 × Cloudflare NS · secondary via zone transfer', 'Resolvers pick by RTT and retry the others', 'DNSSEC where in use'], dx: 40, dy: -60 } }),
      (tl, t) => { cap(tl, t, 'A lookup, step by step', 'The resolver asks a nameserver, follows the hand-off to Akamai GTM, and gets the best edge IP back'); return dns(tl, t + 600, C.browser, DNSQ.tour, { final: ['', ''] }) + 600; },
      (tl, t) => say(tl, t, 'Smart routing', 'Akamai GTM and Cloudflare Load Balancing pick the edge from the client’s location, latency, load and health, using handout policies, liveness tests, pools and monitors', { hold: 6000,
        panel: { at: D.steerA, title: 'Steering inputs', items: ['Location · resolver IP or ECS subnet', 'Edge latency and load', 'GTM liveness tests · LB monitors', 'Multi-CDN policy and failover'], dx: 40, dy: 20 } }),
      (tl, t) => say(tl, t, 'Steering is not instant', 'Changes are bounded by the TTL and resolver caching rather than taking effect immediately. Cached answers also mean DNS adds nothing to most requests, so it sits outside the 50 ms budget', { hold: 5800 })] }),
    L1: layerCh({ focus: [1], legs: [0], shot: { x: -1650, y: -200, z: 0, rx: -30, ry: 24, d: 4300 }, steps: [
      (tl, t) => say(tl, t + 400, 'L1 · Client', 'Browsers, mobile apps, API clients, delegated agents, autonomous agents and M2M callers. Every request starts here, untrusted regardless of type', { devs: CLIENTS, hold: 6000 }),
      (tl, t) => say(tl, t, 'Not security categories', 'Human, machine and agent are not security categories: any of them can hold a credential. What counts is the credential, and the key it is bound to', { hold: 6600,
        panel: { at: C.api, title: 'Sender-constrained credentials', items: CT.map(c => `${c.n} · ${c.present}`), step: 360, dx: 60, dy: -80 } }),
      (tl, t) => say(tl, t, 'Two ways in', 'Over the internet through L2 and L3, or over private connectivity: P1 enters at L3 and P2 at L4. The path changes; the check at L4 does not', { hold: 6000,
        panel: { at: C.m2m, title: 'Paths', items: ['Browser, mobile, agents · internet', 'API client, M2M · internet, or P1 / P2', 'mTLS terminates at L4: API client, autonomous agent, M2M'], dx: 60, dy: -40 } }),
      (tl, t) => say(tl, t, 'Why: assume compromise', 'Devices get malware, tokens get stolen, bots imitate people and agents overreach. So no layer trusts a request because of where it came from', { hold: 5800,
        panel: { at: C.aagent, title: 'Threats that start at L1', items: [{ t: 'Stolen session cookies or tokens', s: 'warn' }, { t: 'Credential stuffing and bots', s: 'warn' }, { t: 'Agents exceeding a delegation or mandate', s: 'warn' }, { t: 'Malicious payloads', s: 'warn' }], dx: 60, dy: -40 } }),
      (tl, t) => {
        cap(tl, t, 'Latency · client → edge: 8 ms', 'Network distance, not our processing: DNS steering or anycast picks a nearby PoP, and warm connections (TLS resumption, HTTP/2 or HTTP/3 reuse) avoid extra round trips. Mobile networks take longer');
        stage.shot(tl, t, { x: -1200, y: -200, z: -200, rx: -30, ry: 12, d: 3400 }, 1600);
        t = pk.appear(tl, t + 600, [X[0] + 60, Y, C.browser.z], 'tls', 'GET /accounts', 'TLS 1.3');
        t = go(tl, t, pk, [L.cl.browser, L.hubA], 2400);
        budget.spend(tl, t, 0, 7); ring(stage, W, tl, t, D.cdnA.top, '#38BDF8', 240);
        return pk.vanish(tl, t + 2400) + 800;
      }] }),
    L2: layerCh({ focus: [2], legs: [0, 1, 2], shot: { x: -900, y: -190, z: 0, rx: -28, ry: 10, d: 3100 }, steps: [
      (tl, t) => say(tl, t + 400, 'L2 · Edge protection / CDN', 'Akamai (4,100+ PoPs) and Cloudflare (310+ cities), active-active from one source ruleset: the first hop we control, as close to the client as possible', { devs: [D.cdnA, D.cdnC], hold: 5600 }),
      (tl, t) => {
        cap(tl, t, 'What the edge does', 'TLS ends at the PoP; the edge classifies the caller, serves from cache when it can, and otherwise forwards to the perimeter. It classifies; it does not establish identity');
        t = pk.appear(tl, t + 300, [X[0] + 60, Y, C.browser.z], 'tls', 'GET /accounts', 'to the nearest PoP');
        t = go(tl, t, pk, [L.cl.browser, L.hubA], 2200); budget.spend(tl, t, 0, 7);
        t = visit(tl, t, D.cdnA, 'cdnA', { dy: 30 }); budget.spend(tl, t - 600, 1, 2);
        return t;
      },
      (tl, t) => {
        const rnd = (a, b, s2) => a + (b - a) * ((Math.sin(s2 * 12.9898) * 43758.5453) % 1 + 1) % 1;
        for (let i = 0; i < 18; i++) { const tg = i % 2 ? D.cdnC : D.cdnA; fly(stage, W, tl, t + 300 + i * 110, [rnd(-2000, -1500, i), -60 - rnd(0, 200, i + 50), rnd(-850, 850, i + 9)], [tg.x - 60, -120, tg.z + rnd(-60, 60, i + 3)], { color: '#F43F5E', dur: 1100, arc: -140, size: 9 }); }
        return say(tl, t, 'Why at the edge', 'Volumetric attacks, bots and common web attacks are absorbed across thousands of PoPs, far away from our data centres', { hold: 5600,
          panel: { at: D.cdnC, title: 'Edge controls', items: ['DDoS absorbed across the provider network', 'WAF, bot and agent classification', 'Geographic policy · per-client rate limits', 'One ruleset rendered to both providers'], dx: 40, dy: -40 } });
      },
      (tl, t) => say(tl, t, 'Defences by client type', 'With no identity yet, the edge picks its defences by what the caller looks like', { hold: 6600,
        panel: { at: D.cdnA, title: 'L2 defences', items: CT.map(c => `${c.n} · ${c.l2}`), step: 360, dx: 40, dy: 30 } }),
      (tl, t) => {
        cap(tl, t, 'Hand-off to a region: 10 ms', 'The edge re-originates over TLS to the perimeter, from source addresses the perimeter restricts to. Each CDN can reach both regional perimeters, so a regional outage is routed around');
        stage.shot(tl, t, { x: -450, y: -190, z: 0, rx: -30, ry: 0, d: 3300 }, 1600);
        t = go(tl, t + 600, pk, [L.cAA, L.inA], 2000); budget.spend(tl, t, 2, 9);
        return pk.vanish(tl, t + 2600) + 400;
      },
      (tl, t) => say(tl, t, 'Latency · 21 ms of the 50', 'Client → edge 8 ms and edge → region 10 ms are network distance, which depends on where the user is; the edge’s own processing is about 3 ms', { hold: 5200 })] }),
    L3: layerCh({ focus: [3], legs: [3], shot: { x: -60, y: -180, z: 0, rx: -30, ry: -8, d: 3300 }, steps: [
      (tl, t) => say(tl, t + 400, 'L3 · Regional perimeter', 'The entry into JPMorgan networks: PSaaS+ in 10 on-prem DMZ data centres and AWS WAF in 8 AWS regions. No platform components of our own run here', { devs: [D.psaas, D.waf], hold: 5400 }),
      (tl, t) => {
        cap(tl, t, 'What it does', 'It admits only traffic from the CDN, then applies a second WAF pass and perimeter traffic policy before handing over to SESF');
        t = pk.appear(tl, t + 300, [-590, Y, -450], 'tls', 'GET /accounts', 'from Akamai');
        t = go(tl, t, pk, [L.cAA, L.inA], 1600);
        t = visit(tl, t, D.psaas, 'psaas'); budget.spend(tl, t - 600, 3, 2);
        return pk.vanish(tl, t);
      },
      (tl, t) => {
        cap(tl, t, 'Why: origin lockdown', 'Source addresses are restricted to CDN ranges (Akamai SiteShield on-prem) and direct-to-origin paths are closed, so the edge cannot be skipped');
        D.attacker.show(tl, t, true); L.atk.show(tl, t, true);
        tl.add(D.attacker.body, { y: [-500, 0], rotateY: [-90, 0], duration: 900, ease: 'outBack(1.2)' }, t);
        stage.shot(tl, t, { x: -700, y: -180, z: 600, rx: -28, ry: 10, d: 2900 }, 1600);
        t = pkB.appear(tl, t + 1100, [X[1] + 20, Y, 880], 'attack', 'POST /login', 'direct to origin');
        t = pkB.travel(tl, t, route([L.atk]), 2200);
        W1.deny(tl, t - 100, 450); ring(stage, W, tl, t, [-350, -120, 450], '#F43F5E', 240);
        t = stage.checklist(tl, t, { at: [-350, -240, 450], title: 'Perimeter', items: [{ t: 'Source not in CDN ranges', s: 'fail' }, { t: 'Direct-to-origin path closed', s: 'fail' }], result: 'DROP', resultColor: '#FB7185', step: 380, hold: 600 });
        return pkB.shatter(tl, t - 400) + 400;
      },
      (tl, t) => say(tl, t, 'Why a second control point', 'An independent regional layer with its own WAF pass and traffic policy, and a clean boundary before anything reaches the enforcement tier', { hold: 5800,
        panel: { at: D.waf, title: 'Perimeter controls', items: ['CDN source allow-list · Akamai SiteShield', 'PSaaS+ rulesets · second WAF pass', 'AWS WAF web ACLs on the load balancers', 'P1 enters here too, through BP PSaaS'], dx: 40, dy: -20 } }),
      (tl, t) => say(tl, t, 'Latency · 3 ms', 'Network policy and a second WAF pass only; identity and payload policy happen at L4', { hold: 4600 })] }),
    L4: layerCh({ focus: [4], legs: [4, 5], shot: look(D.t2, { dx: -150, dz: 400, dist: 2600 }), steps: [
      (tl, t) => say(tl, t + 400, 'L4 · Enforcement tier', 'Tier 2, the DMZ gateway on both substrates (inside SESF on-prem): Envoy and Kong data planes on-prem and on EKS. The single enforcement point, and it fails closed', { devs: [D.t2, D.t2c], hold: 6000 }),
      (tl, t) => {
        cap(tl, t, 'Inspect and apply policy', 'Envoy breaks and inspects TLS and calls auth-service, which resolves the session, exchanges the token, then runs the global malicious-content policy and the route policy generated from the workload’s code');
        t = pk.appear(tl, t + 300, [80, Y, -450], 'tls', 'POST /api/v1/users/register', 'valid payload');
        t = go(tl, t, pk, [L.psT2], 1300);
        stage.shot(tl, t, SHOT.t2drill, 1400); t = pk.open(tl, t);
        stage.present(tl, t, true); t = T2D.open(tl, t + 200, 700);
        t = t2Run(tl, t + 300, 'valid');
        t = T2D.close(tl, t + 400, 500); stage.present(tl, t, false);
        budget.spend(tl, t, 4, 9);
        return t + 300;
      },
      (tl, t) => {
        cap(tl, t, 'Live state, not just a valid token', 'The session validator sidecar resolves the session against the session manager in L6, through a revoke cache, then mints the internal token');
        stage.present(tl, t, true); t = T3D.open(tl, t + 200, 600);
        t = t3Run(tl, t + 300, 'ok'); budget.spend(tl, t, 5, 12);
        t = T3D.close(tl, t + 300, 500); stage.present(tl, t, false);
        return pk.vanish(tl, t) + 200;
      },
      (tl, t) => signalStory(tl, t),
      (tl, t) => { stage.shot(tl, t, look(D.t2, { dx: -150, dz: 400, dist: 2600 }), 1600); return say(tl, t, 'What L4 resolves, per client type', 'Every client type presents something different, and L4 resolves each one to live state before anything goes further', { hold: 6800,
        panel: { at: D.t2, title: 'Presented → resolved to', items: CT.map(c => `${c.n} · ${c.resolve}`), step: 360, dx: 40, dy: 30 } }); },
      (tl, t) => say(tl, t, 'Why one enforcement point', 'Internet and partner paths all converge here, so identity, payload policy and signals are enforced once, consistently. Onward to L5 is mutual TLS, and the workload verifies the client certificate', { hold: 6600,
        panel: { at: D.t2c, title: 'L4 guarantees', items: ['Credential resolved to live state', 'Global then route payload policy', 'Scopes, mandates and lifetimes enforced', 'Revocation and risk signals consumed', 'Verified identity injected · fails closed'], dx: 40, dy: -60 } }),
      (tl, t) => say(tl, t, 'Latency · 24 ms', 'The largest slice: break and inspect, ext_authz and two Rego evaluations (about 10 ms), then live state, token exchange and mTLS to L5 (about 14 ms). Signals arrive asynchronously, and enforcement state is cached locally', { hold: 5200 })] }),
    L5: layerCh({ focus: [5], shot: { x: 1350, y: -170, z: 0, rx: -32, ry: -16, d: 3400 }, steps: [
      (tl, t) => say(tl, t + 400, 'L5 · IFA workload zone', 'The isolated firewall application zone: application workloads on GKP and EKS with their sidecars, bounded by firewall rules on the internal network', { devs: [D.wlOn, D.wlCl], hold: 5400 }),
      (tl, t) => {
        cap(tl, t, 'What arrives here', 'Only traffic from L4, over mutual TLS. The workload verifies the peer certificate on every connection and receives verified identity as headers, rather than parsing tokens');
        t = pk.appear(tl, t + 300, [760, Y, -450], 'mtls', 'GET /accounts', 'from L4');
        t = go(tl, t, pk, [L.t2On], 1600, { cls: 'mtls' });
        wlPulse(tl, t, D.wlOn);
        t = stage.checklist(tl, t, { at: D.wlOn.top, title: 'Arrives with identity', items: [{ t: 'mTLS · peer certificate: L4 gateway' }, { t: 'x-auth-sub: ada@client.com' }, { t: 'x-auth-client: web' }, { t: 'traceparent: 00-4bf9…-01' }], result: 'No token to parse', step: 380, hold: 700, dx: -320, dy: 20 });
        return pk.vanish(tl, t) + 300;
      },
      (tl, t) => say(tl, t, 'Injected identity, per client type', 'What the workload receives depends on who is calling, and for agents on whose behalf', { hold: 6600,
        panel: { at: D.wlCl, title: 'Injected to L5', items: CT.map(c => `${c.n} · ${c.inject}`), step: 360, dx: -360, dy: -80 } }),
      (tl, t) => say(tl, t, 'What workloads can rely on', 'Authentication, live state, payload hygiene and risk are handled once, consistently, at L4', { hold: 5600,
        panel: { at: D.wlOn, title: 'Guaranteed on arrival', items: ['Caller resolved to live state at L4', 'Payload validated by policy', 'Verified identity as headers', 'mTLS from L4 only'], dx: -320, dy: -60 } }),
      (tl, t) => say(tl, t, 'Latency · outside the 50 ms', 'The ingress budget ends on arrival at L5; what happens here is the application’s own time', { hold: 4600 })] }),
    L6: layerCh({ focus: [6], shot: { x: 1950, y: -190, z: 0, rx: -30, ry: -22, d: 3600 }, steps: [
      (tl, t) => say(tl, t + 400, 'L6 · Internal network', 'Trusted services on the internal network: downstream services and systems of record, the identity platform’s session and signal managers, the message broker and the configuration pipeline', { devs: [D.sess, D.svc, D.sig, D.broker, D.sor, D.cfg], hold: 6000 }),
      (tl, t) => {
        cap(tl, t, 'Identity carried forward', 'When a workload calls a downstream service, the correlation identifier and the acting-for chain go with it, over mutual TLS. Identity is propagated, not re-asserted');
        t = pk.appear(tl, t + 300, [1470, Y, -450], 'mtls', 'GET /accounts/4821', 'from the workload');
        t = go(tl, t, pk, [L.onSvc], 1500, { cls: 'mtls' });
        wlPulse(tl, t, D.svc);
        t = stage.checklist(tl, t, { at: D.svc.top, title: 'Propagated', items: [{ t: 'mTLS between services' }, { t: 'traceparent: 00-4bf9…-01' }, { t: 'acting-for: ada@client.com' }, { t: 'No new login, no token parsing' }], result: 'Same identity, end to end', step: 380, hold: 700, dx: -340, dy: -60 });
        return pk.vanish(tl, t) + 300;
      },
      (tl, t) => {
        cap(tl, t, 'It also feeds L4', 'The session manager supplies live state, the signal manager raises risk signals that the broker carries, and the configuration pipeline distributes route policy to the enforcement tier');
        stage.shot(tl, t, { x: 1400, y: -260, z: -100, rx: -34, ry: -10, d: 4600 }, 1600);
        const chips = [[D.sess, 'live state', '#22D3EE'], [D.broker, 'signals', '#F472B6'], [D.cfg, 'route policy', '#94A3B8']];
        chips.forEach(([d, txt, c], i) => {
          d.activate(tl, t + 900 + i * 500, 2600);
          for (const tgt of [D.t2, D.t2c]) fly(stage, W, tl, t + 1000 + i * 500, [d.x, d.topY - 10, d.z], [tgt.x, tgt.topY - 10, tgt.z],
            { html: `<div class="fk-chip" style="--pc:${c};transform:translate(-50%,-50%)">${txt}</div>`, dur: 2000, arc: -260 });
        });
        return t + 1000 + 1000 + 2000 + 1600;
      },
      (tl, t) => say(tl, t, 'Observability', 'Every layer reports to the observability stack, with the same trace ID from L1 to L6', { hold: 4600 })] }),
    P: layerCh({ focus: [P, 3, 4, 5], shot: LAYERS[P].shot, steps: [
      (tl, t) => say(tl, t + 400, 'P · Private connectivity', 'Two paths that skip part of the internet route. On both, the client is still L1 and still carries a credential', { devs: [D.bpOn, D.bpp, D.bpAws, D.pl], hold: 5600 }),
      (tl, t) => {
        cap(tl, t, 'P1 · VAN → BP PSaaS', 'An institutional client on a VAN, private circuit or leased line bypasses L0 and L2 and enters at L3, through BP PSaaS. The circuit is only the network path');
        stage.shot(tl, t, SHOT.van, 1600);
        t = pkE.appear(tl, t + 600, [X[0] + 60, Y, PZ.on], 'priv', 'POST /v1/payments', 'client: acme · VAN');
        t = go(tl, t, pkE, [L.pvtOn], 2600, { cls: 'priv' });
        t = visit(tl, t, D.bpp, 'bpp', { dx: -330 });
        t = go(tl, t, pkE, [L.bpT2], 1600, { cls: 'priv' });
        D.t2.activate(tl, t, 1400);
        return pkE.vanish(tl, t + 600) + 300;
      },
      (tl, t) => {
        cap(tl, t, 'P2 · AWS PrivateLink', 'A partner service in its own AWS VPC never touches the internet: it bypasses L0, L2 and L3 and enters at L4, through our endpoint service and its load balancer');
        stage.shot(tl, t, SHOT.plink, 1800);
        t = pkD.appear(tl, t + 1200, [470, Y, PZ.aws], 'priv', 'GET /v1/positions', 'partner: globex');
        t = go(tl, t, pkD, [L.pInner], 900, { cls: 'priv' });
        t = go(tl, t + 200, pkD, [L.pvtAws], 1600, { cls: 'priv' });
        t = visit(tl, t, D.pl, 'pl', { dy: 50 });
        t = go(tl, t, pkD, [L.plIn], 900, { cls: 'priv' });
        D.t2c.activate(tl, t, 1400);
        return pkD.vanish(tl, t + 600) + 300;
      },
      (tl, t) => { stage.shot(tl, t, LAYERS[P].shot, 1600); return say(tl, t + 1000, 'Why they still converge on L4', 'Each path secures its own hop, but neither replaces the credential check: both are enforced at L4 like internet traffic', { hold: 6200,
        panel: { at: D.t2, title: 'Securing the hop in', items: ['P1 · dedicated circuit, source restriction at L3', 'P2 · endpoint service policy, credential at L4'], dx: 40, dy: 20 } }); },
      (tl, t) => say(tl, t, 'Latency', 'Set by the circuit, the AWS network or the internal network rather than the internet; the L4 budget is the same as for internet traffic', { hold: 4600 })] })
  };

  /* ---------- Chapter 2: web journey, on-prem ---------- */
  function chWeb(tl) {
    base(tl, '4bf92f3577b34da6a3ce929d0e0e4736', 420);
    budget.begin(tl, 0);
    let t = 300;
    cap(tl, t, 'Web journey · on-prem', 'A customer opens the web app in a browser');
    t = stage.shot(tl, t, look(C.browser, { dist: 1800, ry: 24, dx: 250, dz: 100 }), 2000);
    cap(tl, t, 'L0 · DNS', 'Before the request: the resolver asks one of the seven nameservers. A JPMorgan primary returns a CNAME to Akamai GTM, and GTM picks the best edge');
    stage.shot(tl, t, SHOT.steer, 1800);
    t = dns(tl, t + 300, C.browser, DNSQ.web);
    span(tl, t - 1200, D.steerA, 'dns.akamai', 0, 18);
    cap(tl, t, 'L2 · CDN / edge protection', 'The browser connects straight to the edge IP it was given. Akamai terminates TLS, absorbs attacks, applies WAF and bot management, then forwards to origin');
    stage.shot(tl, t, look(D.cdnA, { dx: -250, dz: 150, ry: 14, dist: 2300 }), 2000);
    t = pk.appear(tl, t, [X[0] + 60, Y, C.browser.z], 'tls', 'GET /accounts', '→ 23.45.67.89');
    span(tl, t, C.browser, 'browser', 20, 400);
    t = go(tl, t, pk, [L.cl.browser, L.hubA], 2200);
    budget.spend(tl, t, 0, 7);
    t = visit(tl, t, D.cdnA, 'cdnA', { dy: 30 });
    budget.spend(tl, t - 600, 1, 2);
    span(tl, t - 900, D.cdnA, 'akamai.cdn', 32, 380);
    cap(tl, t, 'L3 · Regional perimeter', 'Only CDN traffic may enter the on-prem network; PSaaS+ admits it into SESF');
    stage.shot(tl, t, look(D.psaas, { dx: -150, dz: 100 }), 1800);
    t = go(tl, t + 100, pk, [L.cAA, L.inA], 1400);
    budget.spend(tl, t, 2, 9);
    t = visit(tl, t, D.psaas, 'psaas');
    budget.spend(tl, t - 600, 3, 2);
    span(tl, t - 900, D.psaas, 'psaas+', 46, 360);
    cap(tl, t, 'L4 · Enforcement tier', 'The request reaches the T2 gateway in SESF, the single enforcement point');
    stage.shot(tl, t, look(D.t2, { dx: -150, dz: 100 }), 1800);
    t = go(tl, t + 100, pk, [L.psT2], 1200);
    const t2Start = t;
    D.t2.activate(tl, t, 1200);
    cap(tl, t, 'Inside L4 · gateway-envoy', 'The T2 node expands: Envoy calls auth-service (ext_authz) to resolve the session, exchange the token and run the payload policies');
    stage.shot(tl, t, SHOT.t2drill, 1400);
    t = pk.open(tl, t);
    stage.present(tl, t, true);
    t = T2D.open(tl, t + 200, 800);
    cap(tl, t, 'Route, then resolve the session', 'Envoy matches the route; the session validator checks the session (for ingress-gateway, signed, DPoP-bound) against live state, and the token is exchanged for an internal one');
    t = t2Run(tl, t + 200, 'get');
    cap(tl, t - 1800, 'No body, no payload policies', 'This GET has no body, so the global and route payload policies are skipped; the Payload policies journey shows them at work');
    t = T2D.close(tl, t + 300, 600);
    stage.present(tl, t, false);
    span(tl, t2Start, D.t2, 'envoy.t2', 60, 340);
    budget.spend(tl, t, 4, 9); budget.spend(tl, t + 300, 5, 12);
    stage.shot(tl, t, look(D.t2, { dx: -150, dz: 100 }), 1200);
    t = pk.seal(tl, t, 'mtls');
    cap(tl, t, 'L5 · IFA workload zone', 'Over mutual TLS, the accounts workload on GKP receives the verified identity as headers');
    stage.shot(tl, t, look(D.wlOn, { dx: -250, dz: 100, dist: 2000 }), 1800);
    t = go(tl, t + 100, pk, [L.t2On], 1600, { cls: 'mtls' });
    workload(tl, t, D.wlOn, pk, null, 'mtls', 'accounts-svc', 92, 280);
    t += 1400;
    cap(tl, t, 'L6 · Internal network', 'The workload reads the system of record downstream, with the trace ID and the acting-for chain carried forward');
    stage.shot(tl, t, look(D.svc, { dx: -250, dz: 100, dist: 1900 }), 1600);
    t = go(tl, t + 100, pk, [L.onSvc], 1300, { cls: 'mtls' });
    wlPulse(tl, t, D.svc); span(tl, t, D.svc, 'accounts-sor', 150, 160);
    t += 1600;
    cap(tl, t, 'Response', '200 OK returns along the same path, with one trace ID across every layer');
    pk.state_(tl, t, 'ok', '200 OK', 'trace 4bf9…4736');
    stage.shot(tl, t, SHOT.overview, 3000, 'inOutSine');
    t = go(tl, t + 200, pk, RT.web, 4400, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    C.browser.html(tl, t, SCR.accounts);
    ring(stage, W, tl, t, C.browser.top, '#34D399', 260);
    t = pk.vanish(tl, t);
    cap(tl, t, 'Next click · caches', 'The DNS answer is still cached, so L0 is not contacted, and the edge serves the static asset from its cache');
    t = stage.shot(tl, t, { x: -1250, y: -220, z: -250, rx: -26, ry: 16, d: 2700 }, 2000);
    t = dns(tl, t, C.browser, DNSQ.web, { cache: 'hit', q: 'A? app.jpmorgan.com' });
    t = pk.appear(tl, t, [X[0] + 60, Y, C.browser.z], 'tls', 'GET /static/app.js', '→ 23.45.67.89');
    t = go(tl, t, pk, [L.cl.browser, L.hubA], 1800);
    D.cdnA.activate(tl, t, 1800);
    t = stage.checklist(tl, t, { at: D.cdnA.top, title: 'Akamai · edge cache', items: [{ t: 'Cache HIT · age 42 s' }, { t: 'No origin request: L3 to L6 untouched' }], result: 'Served from the edge', step: 300, hold: 400 });
    pk.state_(tl, t - 500, 'ok', '200 OK', 'from edge cache');
    t = go(tl, t - 300, pk, [L.cl.browser, L.hubA], 1600, { reverse: true, cls: 'ok' });
    t = pk.vanish(tl, t);
    cap(tl, t, 'Observability', 'Every layer emitted a span, log and metric tagged with the same trace ID');
    t = stage.shot(tl, t, SHOT.obs, 2200);
    tl.wait(t, 3000);
  }

  /* ---------- Chapter: payload policies at T2 (ingress-poc test payloads) ---------- */
  function chPayload(tl) {
    base(tl, '3f2a9c1e7b5d4e8fa0c6b2d9e1f47a53', 300);
    const IN = [L.cl.browser, L.hubA, L.cAA, L.inA, L.psT2], ONWARD = [L.t2On];
    const runs = [
      ['valid', '1 · Valid payload', 'Session resolved and token exchanged; the global policy finds no injection patterns; the route policy confirms required fields and formats: allowed, 201 Created',
        'auth-service      allow  global ✓ route_users_register ✓', '#C7D2FE', 0],
      ['sqli', '2 · SQL injection', 'The global policy (a blocklist, default allow) matches an injection pattern in full_name and denies: 403. The route policy never runs',
        'auth-service      403  payload.global  injection pattern in full_name', '#FDA4AF', 1],
      ['email', '3 · Malformed email', 'The global policy passes; the route policy (default deny) rejects the email format: 403',
        'auth-service      403  route_users_register  email is not a valid email address', '#FDA4AF', 1]
    ];
    let t = 300;
    cap(tl, t, 'Payload policies · L4', 'Three requests to POST /api/v1/users/register show the two Rego policies that protect every route');
    t = stage.shot(tl, t, SHOT.front, 1800);
    runs.forEach(([k, st, tx, log, col, err], n) => {
      // client -> T2
      [...IN, ...ONWARD].forEach(l => l.clear(tl, t));
      C.browser.html(tl, t, SCR.reg);
      cap(tl, t, st, 'The browser submits the registration form; the request crosses the edge and perimeter to L4');
      stage.shot(tl, t, SHOT.front, 1400);
      t = pk.appear(tl, t + 300, [X[0] + 60, Y, C.browser.z], 'tls', 'POST /api/v1/users/register', PAY[k].badge[0]);
      t = go(tl, t, pk, IN, 3000);
      // into the deployment view
      D.t2.activate(tl, t, 1200);
      stage.shot(tl, t, SHOT.t2drill, 1400);
      t = pk.open(tl, t);
      stage.present(tl, t, true);
      t = T2D.open(tl, t + 200, 700);
      cap(tl, t, st + ' · policies', tx);
      t = t2Run(tl, t + 300, k);
      obs.log(tl, t - 300, log, col, { err });
      span(tl, t - 1200, D.t2, 'auth-service (' + k + ')', 0, k === 'valid' ? 38 : 9, err ? 'error' : 'ok', log);
      t = T2D.close(tl, t + 600, 500);
      stage.present(tl, t, false);
      if (err) {
        // policy violation: the 403 travels all the way back to the client
        cap(tl, t, st + ' · 403', 'The 403 goes straight back to the client; nothing reaches L5');
        pk.state_(tl, t, 'bad', '403 Forbidden', 'payload validation failed');
        t = pk.seal(tl, t, 'bad');
        stage.shot(tl, t, SHOT.front, 1400);
        t = go(tl, t + 200, pk, IN, 3200, { reverse: true, cls: 'bad', ease: 'inOutQuad' });
        C.browser.html(tl, t, SCR.reg403);
        ring(stage, W, tl, t, C.browser.top, '#F43F5E', 260);
      } else {
        // allowed: on to the workload in L5, then 201 back to the client
        cap(tl, t, st + ' · 201', 'Allowed: the request continues over mTLS to the workload in L5, and 201 Created returns to the client');
        t = pk.seal(tl, t, 'mtls');
        stage.shot(tl, t, SHOT.overview, 2200, 'inOutSine');
        t = go(tl, t, pk, ONWARD, 2200, { cls: 'mtls' });
        wlPulse(tl, t, D.wlOn);
        pk.state_(tl, t + 600, 'ok', '201 Created', 'user id assigned');
        t = go(tl, t + 800, pk, [...IN, ...ONWARD], 3800, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
        C.browser.html(tl, t, SCR.reg201);
        ring(stage, W, tl, t, C.browser.top, '#34D399', 260);
      }
      t = pk.vanish(tl, t + 700) + 600;
    });
    cap(tl, t, 'One lever for every route', 'The global policy patches every route at once against new attack patterns; each route policy is generated from its workload\u2019s code and knows only its own fields');
    t = stage.shot(tl, t, SHOT.obs, 2200);
    tl.wait(t, 3000);
  }

  /* ---------- Chapter 3: API journey into AWS ---------- */
  function chApi(tl) {
    base(tl, '0af7651916cd43dd8448eb211c80319c', 340);
    budget.begin(tl, 0);
    let t = 300;
    cap(tl, t, 'API journey · AWS', 'An API client calls the accounts API');
    t = stage.shot(tl, t, look(C.api, { dist: 1700, ry: 24, dx: 250, dz: 100 }), 2000);
    C.api.html(tl, t - 800, TERM.req);
    cap(tl, t, 'L0 · DNS', 'This resolver happened to ask a Cloudflare secondary. The zone came from the JPMorgan primary, but this hostname is overridden to Cloudflare LB, which answers with an anycast IP');
    stage.shot(tl, t, SHOT.steer, 1800);
    t = dns(tl, t + 300, C.api, DNSQ.api);
    span(tl, t - 1200, D.steerC, 'dns.cloudflare', 0, 12);
    cap(tl, t, 'L2 · CDN / edge protection', 'Cloudflare terminates TLS, checks the API request and the client, then forwards to origin');
    stage.shot(tl, t, look(D.cdnC, { dx: -250, dz: 150, ry: 14, dist: 2300 }), 2000);
    t = pk.appear(tl, t, [X[0] + 60, Y, C.api.z], 'tls', 'GET /v1/accounts', 'trace 0af7…319c');
    span(tl, t, C.api, 'api-client', 14, 318);
    t = go(tl, t, pk, [L.cl.api, L.hubC], 2200);
    budget.spend(tl, t, 0, 6);
    t = visit(tl, t, D.cdnC, 'cdnC');
    budget.spend(tl, t - 600, 1, 2);
    span(tl, t - 900, D.cdnC, 'cloudflare.cdn', 24, 300);
    cap(tl, t, 'L3 · Regional perimeter', 'AWS WAF admits only CDN traffic into AWS');
    stage.shot(tl, t, look(D.waf, { dx: -150, dz: 150 }), 1800);
    t = go(tl, t + 100, pk, [L.cCC, L.inC], 1400);
    budget.spend(tl, t, 2, 8);
    t = visit(tl, t, D.waf, 'waf');
    budget.spend(tl, t - 600, 3, 2);
    span(tl, t - 900, D.waf, 'aws.waf', 36, 286);
    cap(tl, t, 'L4 · Enforcement tier · AWS', 'The T2 gateway on EKS terminates mTLS, resolves the key-bound token to the user\u2019s grant, exchanges it, and runs the global and route policies');
    stage.shot(tl, t, look(D.t2c, { dx: -250, dz: 150, dist: 2200 }), 2000);
    t = go(tl, t + 100, pk, [L.wafT2], 1400);
    D.t2c.activate(tl, t, 3600);
    t = pk.open(tl, t);
    t = visit(tl, t, D.t2c, 't2c', { hold: 3200 });
    budget.spend(tl, t - 900, 4, 8); budget.spend(tl, t - 600, 5, 11);
    span(tl, t - 900, D.t2c, 'envoy.t2-aws', 48, 262);
    t = pk.seal(tl, t - 200, 'mtls');
    cap(tl, t, 'L5 · IFA workload zone', 'The accounts workload on EKS answers, with the user and client identity in headers');
    stage.shot(tl, t, look(D.wlCl, { dx: -250, dz: 150, dist: 2000 }), 1600);
    t = go(tl, t + 100, pk, [L.t2Cl], 1400, { cls: 'mtls' });
    workload(tl, t, D.wlCl, pk, null, 'mtls', 'accounts-svc', 70, 210);
    t += 1600;
    cap(tl, t, 'Response', '200 OK and a JSON body return to the client');
    pk.state_(tl, t, 'ok', '200 OK', 'application/json');
    stage.shot(tl, t, SHOT.overview, 3000, 'inOutSine');
    t = go(tl, t + 200, pk, RT.api.slice(0, -1), 4200, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    C.api.html(tl, t, TERM.ok);
    ring(stage, W, tl, t, C.api.top, '#34D399', 240);
    t = pk.vanish(tl, t);
    t = stage.shot(tl, t, look(C.api, { dist: 1500, ry: 24, dx: 200, dz: 80 }), 1800);
    tl.wait(t, 2500);
  }

  /* ---------- Chapter 4: private connectivity, P1 and P2 ---------- */
  function chPrivate(tl) {
    base(tl, '5b8aa5a2d2c872e8321cf37308d69df2', 300);
    const track = (pos, v) => tl.set(stage, 'tracker', pos, v, x => { stage.tracker = x; }, pk);
    let t = 300;
    cap(tl, t, 'Private connectivity', 'Institutional clients and partner services can skip part of the internet route');
    stage.focus(tl, t, [P]);
    t = stage.shot(tl, t, LAYERS[P].shot, 2400);
    cap(tl, t, 'Distinct routes, one enforcement point', 'No DNS steering or CDN: each path lands on its own entry point, and every one converges on L4');
    t += 3200;
    // P1: institutional client -> VAN -> BP PSaaS (L3) -> T2 (L4) -> workload (L5)
    cap(tl, t, 'P1 · Private circuit', 'Institutional client Acme sends a payment over its VAN / leased line');
    stage.focus(tl, t, [P, 3, 4, 5]);
    stage.shot(tl, t, SHOT.van, 2000);
    D.bpOn.activate(tl, t + 800, 1600);
    t = pkE.appear(tl, t + 1200, [X[0] + 60, Y, PZ.on], 'priv', 'POST /v1/payments', 'client: acme · VAN');
    track(t - 400, pkE);
    span(tl, t, D.bpOn, 'client.acme', 0, 296);
    t = go(tl, t, pkE, [L.pvtOn], 3000, { cls: 'priv' });
    cap(tl, t, 'P1 · BP PSaaS, entering at L3', 'BP PSaaS terminates the circuit, checks the client allow-list and maps the route. The circuit is only the network path');
    stage.shot(tl, t - 1200, look(D.bpp, { dx: -150, dz: 250, ry: -12, rx: -32, dist: 2000 }), 1600);
    t = visit(tl, t, D.bpp, 'bpp');
    span(tl, t - 900, D.bpp, 'bp-psaas', 10, 280);
    cap(tl, t, 'L4 · Enforcement tier', 'The client is still L1 and still carries a credential: the T2 gateway resolves it and applies the same policies as for internet traffic');
    stage.shot(tl, t, look(D.t2, { dx: -250, dz: -300, ry: -10, rx: -36, dist: 2400 }), 1800);
    t = go(tl, t + 100, pkE, [L.bpT2], 1800, { cls: 'priv' });
    D.t2.activate(tl, t, 2600);
    t = pkE.open(tl, t);
    t = visit(tl, t, D.t2, 't2', { step: 240, check: { items: ['mTLS terminated · client certificate: Acme', 'Client credentials → workload identity', 'Scope: payments:create', 'Route policy: payments contract', 'Inject identity · mTLS to L5'] } });
    span(tl, t - 900, D.t2, 'envoy.t2', 24, 260);
    t = pkE.seal(tl, t - 200, 'mtls');
    cap(tl, t, 'L5 · IFA workload zone', 'The payments workload on GKP accepts the instruction');
    stage.shot(tl, t, look(D.wlOn, { dx: -250, dz: 100, dist: 2000 }), 1600);
    t = go(tl, t + 100, pkE, [L.t2On], 1400, { cls: 'mtls' });
    workload(tl, t, D.wlOn, pkE, null, 'mtls', 'payments-svc', 60, 200);
    t += 1400;
    pkE.state_(tl, t, 'ok', '201 Created', 'over the private circuit');
    cap(tl, t, 'Response', '201 Created returns over the same private circuit');
    stage.shot(tl, t, { ...SHOT.van, x: -400, z: -900, d: 4600 }, 2600, 'inOutSine');
    t = go(tl, t + 200, pkE, RT.bpOn, 3800, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    ring(stage, W, tl, t, D.bpOn.top, '#34D399', 240);
    t = pkE.vanish(tl, t);
    // P2: partner service (its own account) -> interface endpoint -> AWS network -> endpoint service -> T2 on EKS (L4) -> workload (L5)
    cap(tl, t, 'P2 · Partner VPC', 'A trusted 3rd party runs its service in its own AWS account and VPC, alongside ours on the AWS network');
    stage.focus(tl, t, [P, 4, 5]);
    stage.shot(tl, t, SHOT.plink, 2200);
    wlPulse(tl, t + 900, D.bpAws);
    t = pkD.appear(tl, t + 1400, [470, Y, PZ.aws], 'priv', 'GET /v1/positions', 'partner: globex');
    track(t - 400, pkD);
    cap(tl, t, 'P2 · Interface endpoint', 'It calls a private IP inside its own VPC: an interface endpoint for our service');
    t = go(tl, t, pkD, [L.pInner], 900, { cls: 'priv' });
    t = visit(tl, t, D.eni, 'eni', { step: 280 });
    obs.log(tl, t - 900, 'vpce              partner=globex  10.20.3.14:443', '#99F6E4');
    cap(tl, t, 'P2 · VPC to VPC', 'PrivateLink carries it from the partner VPC straight into our VPC: no internet gateway, NAT or public IP, and no L0, L2 or L3');
    stage.shot(tl, t, { x: 800, y: -60, z: 960, rx: -44, ry: -18, d: 2500 }, 1800);
    t = go(tl, t + 300, pkD, [L.pvtAws], 2000, { cls: 'priv' });
    cap(tl, t, 'P2 · Endpoint service, entering at L4', 'Only allow-listed partner accounts can connect, only to this one service, and only in that direction. Its load balancer fronts the enforcement tier');
    stage.shot(tl, t - 600, look(D.pl, { dx: 200, dz: -50, ry: -18, rx: -32, dist: 2200 }), 1400);
    t = visit(tl, t, D.pl, 'pl');
    obs.log(tl, t - 900, 'privatelink       accept account=1111-2222-3333', '#99F6E4');
    cap(tl, t, 'L4 · Enforcement tier · AWS', 'A credential is still required: the T2 gateway on EKS terminates mTLS and resolves the partner’s signed assertion to workload identity');
    stage.shot(tl, t, look(D.t2c, { dx: -200, dz: 350, dist: 2300 }), 1800);
    t = go(tl, t + 100, pkD, [L.plIn], 1200, { cls: 'priv' });
    t = visit(tl, t, D.t2c, 't2c', { step: 240, dy: 30, check: { items: ['mTLS client certificate: partner CA', 'Signed assertion → workload identity', 'Scope: positions:read', 'Inject identity · mTLS to L5'] } });
    obs.log(tl, t - 900, 'envoy.t2-aws      200 partner=globex', '#C7D2FE');
    stage.shot(tl, t, look(D.wlCl, { dx: -250, dz: 150, dist: 2000 }), 1600);
    t = go(tl, t + 100, pkD, [L.t2Cl], 1300, { cls: 'mtls' });
    wlPulse(tl, t, D.wlCl);
    t += 1400;
    pkD.state_(tl, t, 'ok', '200 OK', 'back over PrivateLink');
    stage.shot(tl, t, { x: 900, y: -100, z: 750, rx: -42, ry: -10, d: 4000 }, 2400, 'inOutSine');
    t = go(tl, t + 200, pkD, RT.bpAws, 3400, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    ring(stage, W, tl, t, D.bpAws.top, '#34D399', 240);
    t = pkD.vanish(tl, t);
    stage.focus(tl, t, null);
    cap(tl, t, 'Two private paths, one enforcement point', 'Internet traffic comes through L2 and L3. P1 enters at L3 and P2 at L4, and all of it meets the same L4 enforcement');
    t = stage.shot(tl, t, SHOT.overview, 2400);
    tl.wait(t, 3500);
  }

  /* ---------- Chapter: the six client types at L4 ---------- */
  function chClients(tl) {
    base(tl, '', 300);
    stage.flag(tl, 0, 'fk-notrace', true);
    let t = 300;
    cap(tl, t, 'Client types', 'Six client types, one enforcement point: what each presents at L4, what L4 resolves it to, and what reaches the workload');
    stage.focus(tl, t, [1, 2, 3, 4]);
    t = stage.shot(tl, t, SHOT.l4, 2200) + 600;
    const on = [L.hubA, L.cAA, L.inA, L.psT2], aws = [L.hubC, L.cCC, L.inC, L.wafT2];
    const path = { browser: on, mobile: aws, api: aws, dagent: aws, aagent: on, m2m: on };
    CT.forEach((c, i) => {
      const key = Object.keys(C).find(k => C[k] === c.d), r = [L.cl[key], ...path[key]], gw = path[key] === on ? D.t2 : D.t2c;
      cap(tl, t, c.n, `At L2: ${c.l2.charAt(0).toLowerCase() + c.l2.slice(1)}. At L4 it presents: ${c.present.charAt(0).toLowerCase() + c.present.slice(1)}`);
      c.d.activate(tl, t, 3000);
      const p = [pk, pkB][i % 2];
      t = p.appear(tl, t + 400, r[0].pts[0], 'tls', c.n, c.mtls ? 'mTLS to L4' : 'TLS');
      t = go(tl, t, p, r, 3000);
      t = stage.checklist(tl, t, { at: gw.top, title: c.n + ' at L4', items: [
        { t: 'Presents · ' + c.present }, { t: 'Resolves to · ' + c.resolve }, { t: 'Step-up · ' + c.stepup, s: c.stepup === 'Not applicable' ? 'skip' : undefined },
        { t: 'On risk signal · ' + c.risk, s: 'warn' }, { t: 'Injects to L5 · ' + c.inject }], result: 'Forward to L5 · mTLS', step: 520, hold: 1200, dx: 40, dy: -60 });
      t = p.vanish(tl, t) + 300;
    });
    cap(tl, t, 'One table, one place', 'Human, machine and agent are not security categories: the credential and its key decide what L4 resolves, and L4 is the only place that decides it');
    stage.focus(tl, t, null);
    t = stage.shot(tl, t, SHOT.overview, 2200);
    tl.wait(t, 3500);
  }

  /* ---------- Chapter 5: failover across the cross-connected layers ---------- */
  function chFailover(tl) {
    base(tl, 'c07d5e21f98a4b0e93a6d1f2e8b74c55', 520);
    let t = 300;
    cap(tl, t, 'Failover', 'A mobile user on a bad day: an edge network is degraded and an on-prem region is down');
    t = stage.shot(tl, t, SHOT.wide, 2000);
    t = D.cdnA.health(tl, t, 'warn');
    ring(stage, W, tl, t, D.cdnA.top, '#FBBF24', 260);
    cap(tl, t, 'Incident 1 · L2', 'The Akamai edge serving this region is degraded');
    t += 1200;
    t = D.psaas.health(tl, t, 'down');
    ring(stage, W, tl, t, D.psaas.top, '#F43F5E', 260);
    L.cAA.mark(tl, t, 'dead'); L.cCA.mark(tl, t, 'dead'); L.inA.mark(tl, t, 'dead');
    obs.alert(tl, t, 'PSaaS+ region down<br><span style="font-size:28px;font-weight:500">health probes failing · origin pools updated</span>');
    cap(tl, t, 'Incident 2 · L3', 'The on-prem PSaaS+ region is down');
    t += 1500;
    cap(tl, t, 'L1 · Steering failover', 'The cached answer expires (20 s TTL). A JPM NS hands off to GTM; GTM sees its edge is degraded and answers with a Cloudflare edge IP. Failover speed is bounded by the TTL');
    stage.shot(tl, t, SHOT.steer, 1800);
    C.mobile.html(tl, t, PHONE('wait'));
    t = dns(tl, t + 300, C.mobile, DNSQ.failover, { cache: 'expired' });
    span(tl, t - 1200, D.steerA, 'dns.akamai', 0, 22, 'warn', 'dns.akamai        steer→cloudflare  trace=c07d5e21');
    cap(tl, t, 'L2 · Edge', 'The app connects to Cloudflare; the user sees no error');
    stage.shot(tl, t, look(D.cdnC, { dx: -250, dz: 150, ry: 14, dist: 2300 }), 2000);
    t = pk.appear(tl, t, [X[0] + 60, Y, C.mobile.z], 'tls', 'GET /balances', 'trace c07d…4c55');
    span(tl, t, C.mobile, 'mobile-app', 24, 490);
    t = go(tl, t, pk, [L.cl.mobile, L.hubC], 2200);
    cap(tl, t, 'L2 · Origin failover', 'On-prem origin health checks fail, so Cloudflare sends the request to the AWS origin');
    t = visit(tl, t, D.cdnC, 'cdnC', { check: { items: ['TLS 1.3 terminated at the edge', 'Bot score: mobile app attested', { t: 'Origin PSaaS+: 3 probes failed', s: 'fail' }, 'Failover origin: AWS WAF'], result: 'Forward to AWS origin', color: '#FBBF24' }, step: 360 });
    span(tl, t - 900, D.cdnC, 'cloudflare.cdn', 34, 470, 'warn', 'cloudflare.cdn    origin failover→aws  trace=c07d5e21');
    cap(tl, t, 'L3 · Regional perimeter', 'AWS WAF admits the request into AWS');
    stage.shot(tl, t, look(D.waf, { dx: -150, dz: 150 }), 1800);
    t = go(tl, t + 100, pk, [L.cCC, L.inC], 1400);
    t = visit(tl, t, D.waf, 'waf', { step: 220 });
    span(tl, t - 900, D.waf, 'aws.waf', 48, 452);
    cap(tl, t, 'L4 · T2 gateway · AWS', 'The same enforcement on EKS: the session resolves to live state, then Envoy routes to the workload with outlier detection and retries');
    stage.shot(tl, t, look(D.t2c, { dx: -300, dz: 200, dist: 2300 }), 2000);
    t = go(tl, t + 100, pk, [L.wafT2], 1600);
    t = visit(tl, t, D.t2c, 't2c', { step: 220, check: { items: ['Session → live state', 'Outlier detection: pod health', 'Retry budget available', 'Inject identity · mTLS to L5'] } });
    span(tl, t - 900, D.t2c, 'envoy.t2-aws', 60, 436);
    pk.seal(tl, t - 400, 'mtls');
    stage.shot(tl, t, look(D.wlCl, { dx: -250, dz: 100, dist: 1900 }), 1600);
    t = go(tl, t + 100, pk, [L.t2Cl], 1300, { cls: 'mtls' });
    const W6 = D.wlCl;
    t = pk.travel(tl, t, { pts: [[1330, Y, 450], pod(W6, 0)] }, 400);
    tl.set(W6.pods[0].g, 'err', t, true, v => W6.pods[0].g.classList.toggle('err', v), false);
    tl.add(W6.pods[0].g, { x: [0, -6, 6, -4, 0], duration: 400, ease: 'linear' }, t);
    ring(stage, W, tl, t, pod(W6, 0), '#F43F5E', 200);
    cap(tl, t, 'L5 · Upstream error', 'The first pod returns 503');
    span(tl, t, [X[5], -200, W6.pods[0].z], 'balances (pod 1)', 76, 40, 'error', 'balances-svc      503 upstream  trace=c07d5e21');
    t = pk.state_(tl, t, 'bad', 'GET /balances', '503 from pod 1');
    t = pk.travel(tl, t + 500, { pts: [pod(W6, 0), [1200, -150, 450]] }, 600);
    cap(tl, t, 'Retry', 'The gateway retries the idempotent request on a healthy pod');
    pk.state_(tl, t, 'mtls', 'GET /balances', 'retry 1');
    t = pk.travel(tl, t + 200, { pts: [[1200, -150, 450], pod(W6, 2)] }, 700);
    ring(stage, W, tl, t, pod(W6, 2), '#34D399', 200);
    tl.add(W6.pods[2].g, { y: [0, -14, 0], duration: 600, ease: 'inOutSine' }, t);
    span(tl, t, [X[5], -200, W6.pods[2].z], 'balances (pod 3)', 124, 180, 'ok', 'balances-svc      200 retry=1  trace=c07d5e21');
    t += 900;
    cap(tl, t, 'Response', '200 OK returns through AWS and Cloudflare; two failovers, zero errors for the user');
    pk.state_(tl, t, 'ok', '200 OK', 'retry 1 · 2 failovers');
    stage.shot(tl, t, SHOT.overview, 3000, 'inOutSine');
    t = pk.travel(tl, t + 200, { pts: [pod(W6, 2), [1330, Y, 450]] }, 300);
    t = go(tl, t, pk, RT.mobile, 4200, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    C.mobile.html(tl, t, PHONE('ok'));
    ring(stage, W, tl, t, C.mobile.top, '#34D399', 240);
    t = pk.vanish(tl, t);
    obs.alert(tl, t, 'Degraded, still serving<br><span style="font-size:28px;font-weight:500">edge failover to Cloudflare · origin failover to AWS · 0 user errors</span>', '#FBBF24', 'rgba(60,40,5,.97)', '#FDE68A');
    t = stage.shot(tl, t, SHOT.obs, 2200);
    tl.wait(t, 3000);
  }

  /* ---------- Chapter 6: defence in depth ---------- */
  function chDefense(tl) {
    base(tl, '7c1e0f4a2d9b4c63a8e5f10b3d2c9e77', 120);
    let t = 300;
    cap(tl, t, 'Defense in depth', 'Hostile traffic is stopped at the earliest layer that can recognise it');
    t = stage.shot(tl, t, SHOT.edge, 2000);
    // 1. volumetric flood at the edge
    cap(tl, t, 'L2 · Flood absorbed', 'A botnet floods the edge; it is absorbed across the CDN networks and never reaches a region');
    const rnd = (a, b, s) => a + (b - a) * ((Math.sin(s * 12.9898) * 43758.5453) % 1 + 1) % 1;
    for (let i = 0; i < 26; i++) {
      const tgt = i % 2 ? D.cdnC : D.cdnA, a = [rnd(-2055, -1555, i), -60 - rnd(0, 200, i + 50), rnd(-850, 850, i + 99)];
      fly(stage, W, tl, t + i * 110, a, [tgt.x - 60, -120, tgt.z + rnd(-60, 60, i + 7)], { color: '#F43F5E', dur: 1100, arc: -140, size: 9 });
      if (i % 4 === 0) obs.log(tl, t + i * 110 + 1100, `edge.ddos         drop  src=${Math.floor(rnd(11, 223, i))}.${i}.${i * 7 % 255}.9`, '#FDA4AF', { req: 40, err: 40 });
    }
    ring(stage, W, tl, t + 1200, D.cdnA.top, '#F43F5E', 260); ring(stage, W, tl, t + 1600, D.cdnC.top, '#F43F5E', 260);
    D.cdnA.activate(tl, t + 1100, 2600);
    t = visit(tl, t + 1100, D.cdnC, 'cdnC', { check: { items: ['L3/L4 flood absorbed at the edge', 'L7 rate limit: 429 to offenders', 'Origins shielded'], result: 'Absorbed at L2', color: '#FB7185' }, step: 360, linger: 700 });
    // 2. abusive AI agent
    cap(tl, t, 'L2 · Agent classification', 'An unregistered agent scrapes pages it has no delegation or mandate for; agent classification blocks it at the edge');
    stage.shot(tl, t, look(D.cdnC, { dx: -700, dz: 100, ry: 16, dist: 2900 }), 1800);
    t = pk.appear(tl, t + 400, [X[0] + 60, Y, C.aagent.z], 'attack', 'GET /statements/*', 'agent: unknown');
    t = go(tl, t, pk, [L.cl.aagent, L.hubC], 2000);
    t = visit(tl, t, D.cdnC, 'cdnC', { check: { items: ['TLS 1.3 valid', { t: 'Agent signature: not a registered agent', s: 'fail' }, { t: 'No delegation or mandate presented', s: 'warn' }, { t: 'Request rate: 60/s', s: 'fail' }], result: 'BLOCK · 403 at the edge', color: '#FB7185' }, step: 360 });
    span(tl, t - 900, D.cdnC, 'cloudflare.cdn', 0, 6, 'error', 'cloudflare.bot    403 agent  trace=7c1e0f4a');
    t = pk.shatter(tl, t - 300);
    // 3. direct to origin
    cap(tl, t, 'L3 · Direct to origin', 'An attacker skips the CDN and targets the regional perimeter directly');
    D.attacker.show(tl, t, true);
    L.atk.show(tl, t, true);
    tl.add(D.attacker.body, { y: [-500, 0], rotateY: [-90, 0], duration: 1000, ease: 'outBack(1.2)' }, t);
    stage.shot(tl, t, { x: -950, y: -180, z: 650, rx: -26, ry: 12, d: 2800 }, 1800);
    t = pk.appear(tl, t + 1200, [X[1] + 20, Y, 880], 'attack', 'POST /login', 'src 203.0.113.66');
    t = pk.travel(tl, t, route([L.atk]), 2400);
    W1.deny(tl, t - 100, 450);
    ring(stage, W, tl, t, [-350, -120, 450], '#F43F5E', 240);
    t = stage.checklist(tl, t, { at: [-350, -240, 450], title: 'L3 perimeter', items: [{ t: 'Source 203.0.113.66 not in CDN ranges', s: 'fail' }, { t: 'Perimeter admits CDN origin traffic only', s: 'fail' }], result: 'DROP at the perimeter', resultColor: '#FB7185', step: 380, hold: 500 });
    span(tl, t - 900, [-350, -200, 450], 'perimeter', 30, 2, 'error', 'perimeter         drop non-cdn src=203.0.113.66');
    t = pk.shatter(tl, t - 400);
    L.atk.mark(tl, t - 900, 'bad');
    // 4. malformed payload that looks clean at the edge
    cap(tl, t, 'L4 · Contract violation', 'A syntactically clean request passes the edge and WAF, but breaks the route policy generated from the API contract');
    C.api.html(tl, t, TERM.req.replace('/v1/accounts', '/v1/payments'));
    stage.shot(tl, t, SHOT.wide, 2000);
    t = pkB.appear(tl, t + 300, [X[0] + 60, Y, C.api.z], 'tls', 'POST /v1/payments', 'trace 7c1e…9e77');
    tl.set(stage, 'tracker', 0, pk, v => { stage.tracker = v; }, pk); tl.set(stage, 'tracker', t, pkB);
    t = go(tl, t, pkB, [L.cl.api, L.hubC, L.cCC, L.inC], 3600);
    D.cdnC.activate(tl, t - 1800, 1000); D.waf.activate(tl, t, 1000);
    span(tl, t - 1800, D.cdnC, 'cloudflare.cdn', 40, 70); span(tl, t, D.waf, 'aws.waf', 52, 56);
    stage.shot(tl, t, look(D.t2c, { dx: -150, dz: 150, dist: 1800 }), 2000);
    t = go(tl, t + 100, pkB, [L.wafT2], 1400);
    D.t2c.activate(tl, t, 4000);
    t = pkB.open(tl, t);
    const bad = `POST /v1/payments
{
  <span class="bad">"amount": "2500.00",</span>
  "currency": "USD",
  <span class="bad">"beneficiaryOverride": "···4471"</span>
}`;
    t = stage.checklist(tl, t, { at: D.t2c.top, title: 'L4 · route policy', code: bad, dy: 30, items: [{ t: 'Token resolved to a live grant' }, { t: 'amount must be a number', s: 'fail' }, { t: 'Unknown field beneficiaryOverride', s: 'fail' }], result: 'REJECT · 400 Bad Request', resultColor: '#FB7185', step: 480, hold: 700, dx: 40 });
    span(tl, t - 900, D.t2c, 'envoy.t2-aws', 60, 8, 'error', 'envoy.t2-aws      400 schema_violation  trace=7c1e0f4a');
    pkB.state_(tl, t - 400, 'bad', '400 Bad Request', 'schema_violation');
    t = pkB.seal(tl, t - 400, 'bad');
    stage.shot(tl, t, SHOT.wide, 1800);
    t = go(tl, t + 200, pkB, [L.cl.api, L.hubC, L.cCC, L.inC, L.wafT2], 4200, { reverse: true, cls: 'bad', ease: 'inOutQuad' });
    ring(stage, W, tl, t, C.api.top, '#F43F5E', 240);
    C.api.html(tl, t, TERM.bad);
    t = pkB.vanish(tl, t + 500);
    obs.alert(tl, t, 'Attacks stopped at L2, L3 and L4<br><span style="font-size:28px;font-weight:500">flood absorbed · agent blocked · origin bypass dropped · contract enforced</span>');
    t = stage.shot(tl, t, SHOT.obs, 2200);
    tl.wait(t, 3500);
  }

  const chapters = [
    { group: 'Layers', title: 'The layers', build: chTour },
    { group: 'Layers', title: 'L0 · DNS Control Plane', build: LAYER_CH.L0 },
    { group: 'Layers', title: 'L1 · Client', build: LAYER_CH.L1 },
    { group: 'Layers', title: 'L2 · Edge Protection / CDN', build: LAYER_CH.L2 },
    { group: 'Layers', title: 'L3 · Regional Perimeter', build: LAYER_CH.L3 },
    { group: 'Layers', title: 'L4 · Enforcement Tier', build: LAYER_CH.L4 },
    { group: 'Layers', title: 'L5 · IFA Workload Zone', build: LAYER_CH.L5 },
    { group: 'Layers', title: 'L6 · Internal Network', build: LAYER_CH.L6 },
    { group: 'Layers', title: 'P · Private Connectivity', build: LAYER_CH.P },
    { group: 'Journeys', title: 'Web · on-prem', build: chWeb },
    { group: 'Journeys', title: 'Client types · L4', build: chClients },
    { group: 'Journeys', title: 'Payload policies · L4', build: chPayload },
    { group: 'Journeys', title: 'API · AWS', build: chApi },
    { group: 'Journeys', title: 'Private connectivity', build: chPrivate },
    { group: 'Journeys', title: 'Failover', build: chFailover },
    { group: 'Journeys', title: 'Defense in depth', build: chDefense }
  ];
  stage.onReset(() => { stage.tracker = pk; [D.wlCl, D.wlOn].forEach(w => w.pods.forEach(p => p.g.classList.remove('err'))); });
  const player = new Player(stage, document.getElementById('controls'), chapters);
  window.FK_PLAYER = player;
  const q = new URLSearchParams(location.search);
  const ch = Math.max(1, Math.min(chapters.length, +q.get('ch') || 1));
  player.load(ch - 1);
  if (q.has('t')) player.seek(+q.get('t')); else player.play();
})();
