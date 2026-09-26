/*
 * Scene: CIB unified ingress, seven layers from the internet to a trusted workload.
 *
 *   L0 Internet client        Browser · Mobile · API client · M2M · AI agent
 *   L1 Global steering        Akamai, Cloudflare (DNS)
 *   L2 CDN / edge protection  Akamai, Cloudflare
 *   L3 Regional perimeter     PSaaS+ (on-prem) · AWS WAF (public cloud)
 *   L4 Internal DMZ           SESF / Tier 2: T2 gateway proxy (Envoy GCR on GVSI)
 *   L5 Cross-firewall zone    ESF / Tier 3: T3 IFA web + API gateways (Envoy / Kong on GKP), cloud web + API gateways (Envoy / Kong on EKS)
 *   L6 Trusted workloads      on-prem and cloud application workloads
 *
 *   P  Private connectivity   VAN / private circuits / leased lines, outside the internet path, landing on
 *                             BP PSaaS (on-prem); and AWS PrivateLink, where a trusted partner's AWS service
 *                             reaches our endpoint service without leaving the AWS network
 *
 * Everything you may want to correct lives in LAYERS, NAMES, FOOTPRINT, ROLES and CHECKS below.
 * Layout: layers run left to right along x; on-prem / Akamai is the back lane (z < 0), cloud / Cloudflare the front lane (z > 0).
 */
(function () {
  const FK = window.FlowKit;
  const { Stage, Trace, ObsWall, Device, Wall, Link, Packet, zone, outline, ring, fly, route, arc, Player } = FK;

  /* ---------- the seven layers ---------- */
  const X = [-1755, -1230, -700, 0, 700, 1400, 2100];   // X[1]: centre of the (narrow) internet band
  const IW = 175;                                        // internet band half-width
  const LAYERS = [
    { name: 'Internet client', alias: 'Internet', color: '#94A3B8', desc: 'Browsers, mobile apps, API clients, machine-to-machine callers and AI agents on the public internet' },
    { name: 'Global steering', alias: 'DNS control plane', color: '#F472B6', desc: 'DNS control plane beside the clients. jpmorgan.com is served by 4 JPMorgan primary and 3 Cloudflare secondary nameservers; resolvers ask any of them. The primary hands app hostnames to Akamai GTM; Cloudflare can answer overridden hostnames via Cloudflare LB. Requests never pass through it' },
    { name: 'CDN / edge protection', alias: 'Edge', color: '#F97316', desc: 'TLS, caching, DDoS absorption, WAF and bot management at thousands of edge PoPs' },
    { name: 'Regional perimeter', alias: 'Perimeter', color: '#FBBF24', desc: 'Entry to the on-prem network (PSaaS+) or to AWS (AWS WAF); only CDN origin traffic is admitted' },
    { name: 'Internal DMZ', alias: 'SESF · Tier 2', color: '#22D3EE', desc: 'On-prem internal DMZ with the T2 gateway proxy. AWS has no separate Tier 2 hop' },
    { name: 'Cross-firewall zone', alias: 'ESF · Tier 3', color: '#818CF8', desc: 'T3 web and API gateways broker every call across the firewall into the trusted network' },
    { name: 'Trusted workloads', alias: 'Services', color: '#34D399', desc: 'Application workloads on-prem and in the cloud' }
  ].map((L, i) => ({ ...L, i, x1: X[i] - 350, x2: X[i] + 350, shot: { x: X[i], y: -190, z: 60, rx: -30, ry: -16, d: 3300 } }));
  // L1 is a box to the left of the clients, not a column in the request path
  const DNSB = { x1: -3215, x2: -2155, ns: -2915, sr: -2465, za: -530, zc: 520, nz: [-740, -600, -460, -320, 380, 520, 660] };
  const NJ = 4;   // ns1..ns4 are JPM (primary), ns5..ns7 Cloudflare (secondary)
  Object.assign(LAYERS[1], { x1: DNSB.x1, x2: DNSB.x2, shot: { x: -2605, y: -180, z: 60, rx: -34, ry: 24, d: 3500 } });
  // Private connectivity: not a numbered layer. Two corridors outside the internet path, one per network.
  const PZ = { on: -1260, aws: 1265 };             // on-prem corridor centre line; partner VPC centre line (z)
  const P = LAYERS.push({ tag: 'P', name: 'Private connectivity', alias: 'VAN · leased line', color: '#2DD4BF',
    desc: 'Outside the internet path. On-prem: business partners on VAN / leased lines land on BP PSaaS. AWS: a trusted partner\'s AWS service reaches our endpoint service over PrivateLink without leaving the AWS network',
    test: q => Math.abs(q[2]) > 1040, shot: { x: -900, y: -80, z: 0, rx: -62, ry: 0, d: 7600 } }) - 1;

  const NAMES = {
    browser: ['Client Browser', 'web app'],
    mobile: ['Client Mobile App', 'iOS / Android'],
    api: ['API client', 'REST / JSON'],
    m2m: ['M2M', 'service to service'],
    agent: ['AI agent', 'LLM tool calls'],
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
    t2: ['T2 Gateway Proxy', 'Envoy GCR on GVSI'],
    bpOn: ['Business partner', 'partner network · private circuit'],
    bpAws: ['Partner service', '3rd party\'s own AWS account'],
    eni: ['Interface endpoint', 'ENI in the partner VPC'],
    bpp: ['BP PSaaS', 'business partner entry · on-prem'],
    pl: ['Private Link', 'endpoint service · our VPC'],
    t3web: ['T3 IFA Web Gateway', 'Envoy on GKP'],
    t3api: ['T3 IFA API Gateway', 'Kong on GKP'],
    cweb: ['Cloud Web Gateway', 'Envoy on EKS'],
    capi: ['Cloud API Gateway', 'Kong on EKS'],
    wlOn: ['On-prem workloads', 'application services'],
    wlCl: ['Cloud workloads', 'application services'],
    attacker: ['Attacker', 'direct-to-origin probe'],
    obs: 'Observability plane',
    w1: 'L3 perimeter · CDN origin traffic only',
    w2: 'SESF firewall · Tier 2',
    w3: 'ESF firewall · Tier 3',
    w4: 'Trusted network boundary'
  };
  const FOOTPRINT = {
    akamai: { label: '4,100+ PoPs', NA: 1600, EMEA: 1100, APAC: 750 },
    cloudflare: { label: '310+ cities', NA: 95, EMEA: 105, APAC: 85 },
    psaas: { label: '9 DCs', NA: 3, EMEA: 2, APAC: 4 },
    waf: { label: '8 regions', NA: 3, EMEA: 3, APAC: 2 },
    t2: { label: '9 DCs', NA: 4, EMEA: 2, APAC: 3 }
  };
  const ROLES = {
    browser: 'Customers using the web applications.', mobile: 'Native mobile apps calling web and API endpoints.',
    api: 'Clients integrating over public APIs.', m2m: 'Unattended machine-to-machine integrations.', agent: 'AI agents acting for users or crawling content; subject to bot and agent policy at the edge.',
    steerA: 'Akamai Global Traffic Management. Answers DNS lookups (through the client\'s resolver) with the best healthy edge, judged by location (resolver IP or EDNS client subnet), latency, load and health. Can steer to Akamai or to Cloudflare. Never in the request path.',
    steerC: 'Cloudflare Load Balancing. Answers DNS lookups with an anycast IP (BGP carries the client to the nearest PoP), or can steer to Akamai. For proxied hostnames it also picks the origin pool at the edge. Never in the request path.',
    cdnA: 'Edge TLS termination, caching, DDoS absorption, WAF and bot management. Forwards to either regional perimeter.',
    cdnC: 'Edge TLS termination, caching, DDoS absorption, API protection and bot management. Forwards to either regional perimeter.',
    psaas: 'Entry point to the on-prem network. Admits only CDN origin traffic into the internal DMZ (SESF / Tier 2).',
    waf: 'Entry point to AWS. Admits only CDN origin traffic and hands off directly to the EKS gateways.',
    t2: 'Gateway proxy in the internal DMZ (SESF / Tier 2). Breaks and inspects TLS, then re-encrypts with mTLS to Tier 3.',
    bpOn: 'A business partner connected over VAN, a private circuit or a leased line into the on-prem network.',
    bpAws: 'A trusted 3rd party\'s service running in its own AWS account and VPC. It calls our API through an interface endpoint and never leaves the AWS network.',
    eni: 'Network interfaces with private IPs in the partner\'s VPC that front our endpoint service. Created and owned by the partner; its DNS name resolves to these private IPs.',
    bpp: 'Dedicated entry point for business partner private connectivity into the on-prem network. Admits partner traffic into SESF (Tier 2). Never on the internet path.',
    pl: 'Our PrivateLink endpoint service, behind a Network Load Balancer. Only allow-listed AWS accounts can connect, only to this service, and only partner-to-us. No internet gateway, NAT or public IPs on either side.',
    t3web: 'Web gateway in the cross-firewall zone (ESF / Tier 3). Brokers web traffic into the trusted on-prem network.',
    t3api: 'API gateway in the cross-firewall zone (ESF / Tier 3). Authorises and validates API calls into the trusted on-prem network.',
    cweb: 'Web gateway for cloud workloads, running on EKS.', capi: 'API gateway for cloud workloads, running on EKS. Also serves business partners arriving over Private Link.',
    wlOn: 'Trusted on-prem application services.', wlCl: 'Trusted cloud application services.', attacker: 'Tries to reach an origin directly, bypassing the CDN.'
  };
  // Illustrative controls shown in the animation and in the info card. Replace with your real policies.
  const CHECKS = {

    steerA: { title: 'Akamai GTM', items: ['Location: resolver IP or EDNS client subnet', 'Edge liveness, latency and load', 'Multi-CDN failover'], result: 'Best edge IP, short TTL' },
    steerC: { title: 'Cloudflare LB', items: ['Anycast answers for proxied hostnames', 'Origin pool health and steering', 'Multi-CDN failover'], result: 'Best edge IP, short TTL' },
    cdnA: { title: 'Akamai Edge (WAF/CDN)', items: ['TLS 1.3 terminated at the edge', 'DDoS: absorbed at the edge', 'WAF rules: clean', 'Bot management: human', 'Cache miss: forward to origin'], result: 'Forward to origin · re-encrypted' },
    cdnC: { title: 'Cloudflare Edge (WAF/CDN)', items: ['TLS 1.3 terminated at the edge', 'DDoS: absorbed at the edge', 'API protection: schema and token present', 'Bot score: verified API client', 'Rate limit: within quota'], result: 'Forward to origin · re-encrypted' },
    psaas: { title: 'PSaaS+ · regional perimeter', items: ['Source in CDN origin ranges', 'Regional DDoS scrubbing', 'Perimeter policy: pass', 'Admit into SESF (Tier 2)'], result: 'ADMIT' },
    waf: { title: 'AWS WAF · regional perimeter', items: ['Source in CDN IP set', 'Managed rule groups: clean', 'Rate-based rule: under limit', 'Forward to EKS gateways'], result: 'ALLOW' },
    t2: { title: 'T2 gateway proxy · Envoy GCR', items: ['TLS terminated and inspected', 'Route by host: app.jpmorgan.com', 'Header and size limits', 'Re-encrypt with mTLS to Tier 3'], result: 'Forward to Tier 3 · mTLS' },
    t3web: { title: 'T3 IFA web gateway · Envoy', items: ['mTLS from Tier 2 verified', 'Session and identity check', 'Route to web service', 'Cross into the trusted zone'], result: 'Forward · mTLS' },
    t3api: { title: 'T3 IFA API gateway · Kong', items: ['OAuth2 access token valid', 'Scope check', 'OpenAPI schema validation', 'Rate limit: within quota'], result: 'Forward · mTLS' },
    cweb: { title: 'Cloud web gateway · Envoy on EKS', items: ['Host routing', 'Outlier detection: pod health', 'Retry budget available', 'mTLS into the service mesh'], result: 'Forward · mTLS' },
    capi: { title: 'Cloud API gateway · Kong on EKS', items: ['OAuth2 token valid', 'Scope: accounts:read', 'OpenAPI schema validation', 'Consumer rate limit: ok'], result: 'Forward · mTLS' },
    bpp: { title: 'BP PSaaS · partner entry', items: ['Circuit: VAN / leased line, partner Acme', 'Source in allow-listed partner range', 'mTLS: partner certificate', 'Admit into SESF (Tier 2)'], result: 'ADMIT' },
    eni: { title: 'Interface endpoint · partner VPC', items: ['Private IP 10.20.3.14 in the partner VPC', 'Private DNS name resolves to the endpoint', 'Security group: 443 to our service only'], result: 'Carried on the AWS network' },
    pl: { title: 'Private Link · our endpoint service', items: ['Partner AWS account allow-listed', 'Connection request accepted', 'One-way: partner reaches this service only', 'NLB forwards to the Cloud API gateway'], result: 'Admit into our VPC' }
  };

  const frame = document.getElementById('fk');
  const stage = new Stage(frame);
  stage.setLayers(LAYERS);
  const W = stage.world;
  // Free-floating labels, tagged with the layer (and side, for P) that introduces them; the tour reveals them in step
  const SL = [], slab = (bb, layer, side) => { SL.push({ bb, layer, side }); return bb; };
  stage.onReset(() => SL.forEach(o => { o.bb.el.style.display = ''; }));
  const trace = new Trace(stage);

  /* ---------- floor: one band per layer; L3 to L6 split into on-prem and AWS ---------- */
  const ZB = [-950, 1000], SPLIT = 30;
  LAYERS.slice(0, 7).forEach((L, i) => {
    const x1 = X[i] - 345, x2 = X[i] + 345;
    if (i === 0) {
      zone(stage, W, { x1, x2, z1: ZB[0], z2: ZB[1], color: L.color, label: 'L0', sub: L.name });
      zone(stage, W, { x1: DNSB.x1, x2: DNSB.x2, z1: ZB[0], z2: ZB[1], color: LAYERS[1].color, alpha: .04, label: 'L1', sub: 'DNS control plane · not in the request path' });
    } else if (i === 1) zone(stage, W, { x1: X[1] - IW, x2: X[1] + IW, z1: ZB[0], z2: ZB[1], color: '#64748B', alpha: .04 });
    else if (i < 3) zone(stage, W, { x1, x2, z1: ZB[0], z2: ZB[1], color: L.color, label: 'L' + i, sub: L.name });
    else {
      zone(stage, W, { x1, x2, z1: ZB[0], z2: -SPLIT, color: L.color, label: 'L' + i, sub: L.alias + ' · on-prem' });
      zone(stage, W, { x1, x2, z1: SPLIT, z2: ZB[1], color: L.color, label: 'L' + i, sub: (i === 4 ? 'PrivateLink endpoint' : L.alias) + ' · AWS' });
    }
  });
  for (const [k, zc] of [['on', PZ.on]])
    zone(stage, W, { x1: X[0] - 350, x2: X[3] + 180, z1: zc - 150, z2: zc + 150, color: '#2DD4BF', alpha: .05, label: '', sub: '' });
  outline(stage, W, { pts: [[X[0] - 330, PZ.on - 135], [X[0] + 230, PZ.on - 135], [X[0] + 230, PZ.on + 135], [X[0] - 330, PZ.on + 135]], color: '#2DD4BF', width: 5, dash: '14 10', fill: .05,
    label: 'Partner network', sub: 'business partner data centre', at: [X[0] - 220, PZ.on + 95] });
  // AWS: the AWS network holds our VPC (L3 to L6 front lane) and the partner's VPC, side by side
  const rect = (x1, z1, x2, z2) => [[x1, z1], [x2, z1], [x2, z2], [x1, z2]];
  outline(stage, W, { pts: rect(-385, 8, 2485, 1470), color: '#FF9900', label: 'AWS network', sub: 'PrivateLink traffic never leaves AWS', at: [2010, 1405] });
  outline(stage, W, { pts: rect(-362, 24, 2462, 1008), color: '#FF9900', width: 5, dash: '14 10', fill: 0 });
  outline(stage, W, { pts: rect(250, 1110, 1150, 1420), color: '#FF9900', width: 5, dash: '14 10', fill: .05, label: 'Partner VPC', sub: 'trusted 3rd party AWS account', at: [700, 1360] });
  slab(stage.billboard(null, `<div class="fk-label" style="--led:#FF9900;border-color:rgba(255,153,0,.55);color:#FED7AA"><i></i>Our VPC · AWS account</div>`, { screen: true, p: [2330, -20, 1000] }), 3);
  const obs = new ObsWall(stage, W, { x: 0, y: -820, z: -1550, w: 4800, h: 640, title: NAMES.obs });
  const W1 = new Wall(stage, W, { x: -350, z1: -950, z2: 1000, lanes: [-450, 450], color: '#FBBF24', label: NAMES.w1 });
  const W2 = new Wall(stage, W, { x: 350, z1: -950, z2: -30, lanes: [-450], color: '#22D3EE', label: NAMES.w2 });
  const W3 = new Wall(stage, W, { x: 1050, z1: -950, z2: 1000, lanes: [-650, -250, 250, 650], color: '#818CF8', label: NAMES.w3 });
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
    browser: dev('browser', { layer: 0, x: X[0], z: -620, kind: 'laptop', color: '#334155', screen: SCR.home }),
    mobile: dev('mobile', { layer: 0, x: X[0], z: -300, kind: 'phone', color: '#334155', screen: PHONE('idle') }),
    api: dev('api', { layer: 0, x: X[0], z: 10, kind: 'terminal', color: '#334155', screen: TERM.idle }),
    m2m: dev('m2m', { layer: 0, x: X[0], z: 310, kind: 'rack', w: 90, h: 110, d: 90 }),
    agent: dev('agent', { layer: 0, x: X[0], z: 610, kind: 'agent', color: '#1E1B4B', accent: '#A78BFA' })
  };
  const D = {
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(n => [`ns${n}`, dev(`ns${n}`, { layer: 1, x: DNSB.ns, z: DNSB.nz[n - 1], kind: 'rack', w: 150, h: 28, d: 90, nolabel: true,
      color: n <= NJ ? '#1E293B' : '#2A1A10', accent: n <= NJ ? '#94A3B8' : '#F38020', led: '#94A3B8',
      info: { role: n <= NJ ? 'JPMorgan-hosted authoritative nameserver for jpmorgan.com, the primary. The zone is authored here and transferred to Cloudflare. Resolvers may ask any of the seven NS; this one returns the CNAME that hands app hostnames to Akamai GTM.' : 'Cloudflare secondary nameserver for jpmorgan.com. It receives the zone by transfer from the JPMorgan primary and adds provider diversity for resiliency. For hostnames with a Cloudflare override it answers via Cloudflare LB; otherwise it serves the same records as the primary.' } })])),
    steerA: dev('steerA', { layer: 1, x: DNSB.sr, z: DNSB.za, kind: 'gateway', w: 140, h: 120, d: 110, accent: '#38BDF8', led: '#94A3B8', icon: ICON.route('#38BDF8'), footprint: FOOTPRINT.akamai }),
    steerC: dev('steerC', { layer: 1, x: DNSB.sr, z: DNSB.zc, kind: 'gateway', w: 140, h: 120, d: 110, accent: '#F38020', led: '#94A3B8', icon: ICON.route('#F38020'), footprint: FOOTPRINT.cloudflare }),
    cdnA: dev('cdnA', { layer: 2, x: X[2], z: -450, kind: 'edge', accent: '#38BDF8', icon: ICON.shield('#38BDF8'), footprint: FOOTPRINT.akamai }),
    cdnC: dev('cdnC', { layer: 2, x: X[2], z: 450, kind: 'edge', accent: '#F38020', icon: ICON.shield('#F38020'), footprint: FOOTPRINT.cloudflare }),
    psaas: dev('psaas', { layer: 3, x: X[3], z: -450, kind: 'gateway', w: 160, h: 150, d: 130, accent: '#FBBF24', icon: ICON.shield('#FBBF24'), footprint: FOOTPRINT.psaas }),
    waf: dev('waf', { layer: 3, x: X[3], z: 450, kind: 'gateway', w: 160, h: 150, d: 130, accent: '#FF9900', icon: ICON.shield('#FF9900'), footprint: FOOTPRINT.waf }),
    t2: dev('t2', { layer: 4, x: X[4], z: -450, kind: 'rack', h: 190, accent: '#22D3EE', icon: ICON.proxy('#22D3EE'), footprint: FOOTPRINT.t2 }),
    bpOn: dev('bpOn', { layer: P, x: X[0], z: PZ.on, kind: 'rack', w: 100, h: 140, d: 90, color: '#134E4A', accent: '#2DD4BF' }),
    bpAws: dev('bpAws', { layer: P, x: 430, z: PZ.aws, kind: 'pods', color: '#3B2A10', accent: '#FF9900', count: 2, gap: 130 }),
    eni: dev('eni', { layer: P, x: 800, z: PZ.aws, kind: 'rack', w: 60, h: 80, d: 60, color: '#2A1A05', accent: '#FF9900', led: '#FF9900' }),
    bpp: dev('bpp', { layer: P, x: X[3], z: PZ.on, kind: 'gateway', w: 150, h: 130, d: 120, color: '#0F2E2B', accent: '#2DD4BF', icon: ICON.shield('#2DD4BF') }),
    pl: dev('pl', { layer: P, x: 800, z: 860, kind: 'portal', accent: '#2DD4BF' }),
    t3web: dev('t3web', { layer: 5, x: X[5], z: -650, kind: 'gateway', w: 140, h: 130, d: 110, accent: '#818CF8', icon: ICON.web('#818CF8') }),
    t3api: dev('t3api', { layer: 5, x: X[5], z: -250, kind: 'gateway', w: 140, h: 130, d: 110, accent: '#818CF8', icon: ICON.api('#818CF8') }),
    cweb: dev('cweb', { layer: 5, x: X[5], z: 250, kind: 'gateway', w: 140, h: 130, d: 110, accent: '#FF9900', icon: ICON.web('#FF9900') }),
    capi: dev('capi', { layer: 5, x: X[5], z: 650, kind: 'gateway', w: 140, h: 130, d: 110, accent: '#FF9900', icon: ICON.api('#FF9900') }),
    wlOn: dev('wlOn', { layer: 6, x: X[6], z: -450, kind: 'pods', color: '#1E3A5F', count: 3, gap: 140 }),
    wlCl: dev('wlCl', { layer: 6, x: X[6], z: 450, kind: 'pods', color: '#3B2A10', accent: '#FF9900', count: 3, gap: 140 }),
    attacker: dev('attacker', { layer: 0, x: X[1] - 100, z: 880, kind: 'laptop', color: '#4C0519', led: '#F43F5E', accent: '#F43F5E', hidden: true,
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
    pvtOn: lk(P, [[X[0] + 60, PZ.on], [-80, PZ.on]], { cls: 'pvt', t: 16 }),
    pInner: lk(P, [[470, PZ.aws], [770, PZ.aws]], { cls: 'pvt', t: 10 }),
    pvtAws: lk(P, [[800, PZ.aws - 35], [800, 860]], { cls: 'pvt', t: 16 }),
    bpT2: lk(4, [[80, PZ.on], [X[4], PZ.on], [X[4], -510]]),
    plIn: lk(5, [[800, 860], [900, 650]]),
    t2W: lk(5, [[760, -450], [900, -650], [1330, -650]]), t2A: lk(5, [[760, -450], [900, -250], [1330, -250]]),
    wafW: lk(5, [[80, 450], [250, 250], [900, 250]]), wafA: lk(5, [[80, 450], [250, 650], [900, 650]]),
    tW: lk(5, [[900, 250], [1330, 250]]), tA: lk(5, [[900, 650], [1330, 650]]),
    oW: lk(6, [[1470, -650], [1620, -450]]), oA: lk(6, [[1470, -250], [1620, -450]]), onT: lk(6, [[1620, -450], [2030, -450]]),
    cWo: lk(6, [[1470, 250], [1620, 450]]), cAo: lk(6, [[1470, 650], [1620, 450]]), clT: lk(6, [[1620, 450], [2030, 450]]),
    atk: lk(3, [[X[1] + 20, 880], [-560, 880], [-372, 450]], { hidden: true })
  };
  for (const [pt, txt, side] of [[[-1050, -90, PZ.on], 'VAN · private circuit · leased line', 'on'], [[800, -110, 1060], 'AWS PrivateLink · VPC to VPC · no internet, no public IPs', 'aws']])
    slab(stage.billboard(null, `<div class="fk-label" style="--led:#2DD4BF;border-color:rgba(45,212,191,.5);color:#99F6E4"><i></i>${txt}</div>`, { screen: true, p: pt }), P, side);
  // L1 box: two NS groups, each wired to its smart-routing service; one quiet pipe to the client column
  const gz = (i1, i2) => (DNSB.nz[i1] + DNSB.nz[i2]) / 2, GZ = { jpm: gz(0, NJ - 1), cf: gz(NJ, 6) };
  const CNG = { jpm: lk(1, [[DNSB.ns + 80, -30, GZ.jpm], [DNSB.sr - 75, -60, DNSB.za]], { cls: 'steer', t: 7 }),
                cf: lk(1, [[DNSB.ns + 80, -30, GZ.cf], [DNSB.sr - 75, -60, DNSB.zc]], { cls: 'steer', t: 7 }) };
  const CN = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(n => [n, n <= NJ ? CNG.jpm : CNG.cf]));
  const nsBox = (i1, i2, color) => outline(stage, W, { pts: [[DNSB.ns - 170, DNSB.nz[i1] - 90], [DNSB.ns + 100, DNSB.nz[i1] - 90], [DNSB.ns + 100, DNSB.nz[i2] + 90], [DNSB.ns - 170, DNSB.nz[i2] + 90]],
    color, width: 4, dash: '12 8', fill: .03 });
  nsBox(0, NJ - 1, '#94A3B8'); nsBox(NJ, 6, '#F38020');
  const tag = (p, txt, c) => slab(stage.billboard(null, `<div class="fk-label" style="--led:rgb(${c});border-color:rgba(${c},.45);color:rgb(${c});font-size:11px"><i></i>${txt}</div>`, { screen: true, p }), 1);
  tag([DNSB.ns - 30, -60, GZ.jpm], 'JPMorgan DNS · 4 NS · primary', '148,163,184');
  tag([DNSB.ns - 30, -60, GZ.cf], 'Cloudflare DNS · 3 NS · secondary to JPMorgan', '243,128,32');
  const PIPE = { a: [-1985, -70, -150], b: [-2295, -70, -150] };
  const pipe = lk(1, [[PIPE.a[0], PIPE.a[1], PIPE.a[2]], [PIPE.b[0], PIPE.b[1], PIPE.b[2]]], { cls: 'dnspipe', t: 26 });
  tag([(PIPE.a[0] + PIPE.b[0]) / 2, -110, PIPE.a[2]], 'DNS lookups', '148,163,184');
  // Small animated flow lines: each client -> pipe; pipe -> each NS group and -> GTM / LB (the resolver asks each directly).
  // Dash size is set per segment so every line shows the same world-space pattern despite the z-stretch.
  const flow = pts => {
    const l = lk(1, pts, { cls: 'dnsflow', t: 5 });
    l.segs.forEach((sg, k) => { const L = Math.hypot(...[0, 1, 2].map(j => pts[k + 1][j] - pts[k][j])); sg.style.setProperty('--ps', (2400 / L).toFixed(2) + 'px');
      sg.querySelectorAll('.fk-f').forEach(f => { f.style.animationDelay = (-(pts[k][2] * 7 % 2600) / 1000).toFixed(2) + 's'; }); });
    return l;
  };
  const ENTRY = { jpm: [DNSB.ns + 100, -40, GZ.jpm], cf: [DNSB.ns + 100, -40, GZ.cf], gtm: [DNSB.sr + 75, -60, DNSB.za], lb: [DNSB.sr + 75, -60, DNSB.zc] };
  const FEED = new Map(Object.values(C).map(c => [c, flow([[X[0] - 110, -40, c.z], PIPE.a])]));
  const OUT = Object.fromEntries(Object.entries(ENTRY).map(([k, e]) => [k, flow([PIPE.b, e])]));
  const entryOf = d => d === D.steerA ? 'gtm' : d === D.steerC ? 'lb' : DNSB.nz.indexOf(d.z) < NJ ? 'jpm' : 'cf';
  const RT = {
    web: [L.cl.browser, L.hubA, L.cAA, L.inA, L.psT2, L.t2W, L.oW, L.onT],
    api: [L.cl.api, L.hubC, L.cCC, L.inC, L.wafA, L.tA, L.cAo, L.clT],
    bpOn: [L.pvtOn, L.bpT2, L.t2A, L.oA, L.onT],
    bpAws: [L.pInner, L.pvtAws, L.plIn, L.tA, L.cAo, L.clT],
    m2m: [L.cl.m2m, L.hubA, L.cAA, L.inA, L.psT2, L.t2A, L.oA, L.onT],
    mobile: [L.cl.mobile, L.hubC, L.cCC, L.inC, L.wafW, L.tW, L.cWo, L.clT]
  };

  const pk = new Packet(stage, W, { size: 34 });
  // T2 deployment view, modelled on ingress-poc: gateway-envoy's filter chain makes one ext_authz call to
  // auth-service, which checks the session JWT and then evaluates the Rego payload policies in-process.
  const T2W = 1180, T2P = 18 + 4 * (148 + 20);
  const T2D = new FK.Drill(stage, {
    at: [X[4], -250, -450], dx: -280, w: T2W,
    title: 'T2 Gateway · gateway-envoy', sub: 'SESF / Tier 2 · deployment view',
    frame: 'GVSI host · envoy (image from GCR)  →  ext_authz  →  auth-service · Rego payload policies (embedded OPA)',
    lanes: [
      { label: 'gateway-envoy · HTTP filter chain', h: 96, stages: [
        { label: 'listener :443', sub: 'TLS termination', items: ['TLS from PSaaS+', 'Host → virtual host'] },
        { label: 'route match', sub: 'routing', items: ['exact / {param} paths', 'route → cluster'] },
        { label: 'ext_authz', sub: 'call auth-service', items: ['request + body →', 'body ≤ 1 MB'] },
        { label: 'router', sub: 'forward upstream', items: ['mTLS → Tier 3', 'timeouts · retries'] }] },
      { box: 'auth-service · ext_authz server: session check, then Rego payload policies in order', h: 210, stages: [
        { label: 'session JWT', sub: 'coarse-grained', items: ['iss = session mgr', 'aud = ingress-gateway', 'ES256 sig · JWKS', 'DPoP (cnf.jkt)'] },
        { label: 'global policy', sub: 'payload.global · every route', items: ['SQL injection', 'XSS', 'NoSQL / template'] },
        { label: 'route policy', sub: 'payload_policy_ref · this route', items: ['required fields', 'email format', 'phone (E.164)', 'dob YYYY-MM-DD'] }] }
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
  const RESP = { valid: ['→ 201 Created (forwarded to the backend)', 'ok'], sqli: ['→ 403 {"error":"Payload validation failed","reason":["request body contains a potentially malicious pattern…"]}', 'no'],
    email: ['→ 403 {"error":"Payload validation failed","reason":["email is not a valid email address"]}', 'no'], get: ['→ allow · session valid, no body to inspect', 'ok'] };
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
    let lastPhase = 'pre', lastJ = -1;
    if (k === 'get') { T2D.skip(tl, t, [1, 1], 'skipped · no body'); T2D.skip(tl, t, [1, 2], 'skipped · no body'); t += 1200; }
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
      const gBad = run([1, 1], 'global', GLOBAL(k), k === 'sqli' ? ['fail', 'pass', 'pass'] : ['pass', 'pass', 'pass']);
      if (gBad) { T2D.tokState(tl, t, 'bad'); T2D.skip(tl, t, [1, 2], 'never evaluated'); t += 500; }
      else if (run([1, 2], 'route', ROUTE(k), k === 'email' ? ['pass', 'fail', 'pass', 'pass'] : ['pass', 'pass', 'pass', 'pass'])) T2D.tokState(tl, t, 'bad');
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
    const path = FK.pathFn(r.pts), E = FK.ease(ez), N = 240;
    for (const w of WALLS) {
      let prev = path.at(0).p;
      for (let i = 1; i <= N; i++) {
        const cur = path.at(E(i / N)).p;
        if ((prev[0] - w.x) * (cur[0] - w.x) < 0 && cur[2] >= w.z1 && cur[2] <= w.z2) {
          const lane = Object.keys(w.gates).map(Number).reduce((a, b) => Math.abs(b - cur[2]) < Math.abs(a - cur[2]) ? b : a);
          w.pass(tl, t + (i / N) * dur - 330, lane);
        }
        prev = cur;
      }
    }
    return p.travel(tl, t, r, dur, { cls: o.cls || 'lit', ease: ez });
  }
  function visit(tl, t, d, key, o = {}) {
    const c = { ...CHECKS[key], ...(o.check || {}) };
    d.activate(tl, t, o.hold || 3000);
    return stage.checklist(tl, t, { at: d.top, title: c.title, items: c.items.map(x => typeof x === 'string' ? { t: x } : x), result: c.result, resultColor: c.color, step: o.step || 280, hold: o.linger ?? 500, dx: o.dx ?? 30, dy: o.dy ?? -20, code: o.code });
  }
  // DNS lookup, walked step by step. The client's resolver asks one of the dual authoritative nameservers,
  // follows the CNAME hand-off to GTM or Cloudflare LB, and gets the best edge IP. The request itself then goes
  // client -> internet -> edge and never touches L1.
  //   steps: [{ dev, q, ans, sub, check: {title, items, result, color}, link, to }]
  function dns(tl, t, client, steps, o = {}) {
    const a = [client.x - 60, client.topY - 20, client.z], cache = o.cache || 'miss';
    if (cache === 'hit') {
      client.activate(tl, t, 1600);
      return stage.checklist(tl, t, { at: client.top, title: 'DNS cache (resolver / OS)', items: [{ t: `app.jpmorgan.com cached · ${o.ttlLeft || 14}s of TTL left` }], result: 'No lookup · L1 not contacted', step: 280, hold: 700 });
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
      if (c) t = stage.checklist(tl, t, { at: st.dev.top, title: c.title, items: c.items.map(x => typeof x === 'string' ? { t: x } : x), result: c.result, resultColor: c.color || '#E2E8F0', step: 300, hold: 400, dx: 40, dy: -40 });
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
    van: { x: -1100, y: -40, z: -1300, rx: -64, ry: 0, d: 3400 },
    plink: { x: 700, y: -40, z: 1100, rx: -40, ry: -12, d: 2700 }
  };
  const pod = (wl, i) => [X[6], -150, wl.pods[i].z];
  function wlPulse(tl, t, wl) {
    wl.activate(tl, t, 2000);
    ring(stage, W, tl, t, [wl.x, -140, wl.z], '#34D399', 240);
    tl.add(wl.pods.map(p => p.g), { y: [0, -14, 0], duration: 600, ease: 'inOutSine', delay: (e, i) => i * 120 }, t);
  }
  function workload(tl, t, wl, pkt, lnk, cls, name, start, dur) {
    wl.activate(tl, t, 2000);
    ring(stage, W, tl, t, [X[6], -140, wl.z], '#34D399', 240);
    tl.add(wl.pods.map(p => p.g), { y: [0, -14, 0], duration: 600, ease: 'inOutSine', delay: (e, i) => i * 120 }, t);
    span(tl, t, wl, name, start, dur);
    return t;
  }

  /* ---------- Chapter 1: the seven layers ---------- */
  function chTour(tl) {
    base(tl, '', 400);
    const devs = [...Object.values(C), ...Object.values(D)].filter(d => !d.o.hidden);
    devs.forEach(d => d.show(tl, 0, false));
    // Cables introduced by a step are drawn in by small dots travelling from the previous layer into the new one
    const DRAW = {
      2: [[L.cl.browser, L.hubA], [L.cl.mobile, L.hubC], [L.cl.api, L.hubA], [L.cl.m2m, L.hubC], [L.cl.agent, L.hubC]],
      3: [[L.cAA, L.inA], [L.cCC, L.inC], [L.cAC, L.inC], [L.cCA, L.inA]],
      4: [[L.psT2]],
      5: [[L.t2W], [L.t2A], [L.wafW, L.tW], [L.wafA, L.tA]],
      6: [[L.oW, L.onT], [L.cWo, L.clT], [L.oA, L.onT], [L.cAo, L.clT]],
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
        r.segs.forEach((sg, k) => { if (sg && path.segs[k]) segVis(sg, a + dur * FK.invEase(E, path.segs[k].start / path.total), true); });
        dot.show(tl, a + dur, false);
        end = Math.max(end, a + dur);
      });
      return end;
    };
    const lab = (o, pos, v) => tl.set(o.bb, 'vis', pos, v, x => { o.bb.el.style.display = x ? '' : 'none'; }, true);
    SL.forEach(o => lab(o, 0, false));
    let t = 300;
    cap(tl, t, 'Seven layers', 'Every request crosses up to seven layers between the internet and a trusted workload');
    t = stage.shot(tl, t, SHOT.wide, 2200) + 400;
    const tour = [
      { x: -1605, y: -200, z: 60, rx: -26, ry: 24, d: 3400 },
      { x: -2605, y: -180, z: 60, rx: -34, ry: 24, d: 3500 },
      { x: -800, y: -200, z: 0, rx: -28, ry: 10, d: 3200 },
      { x: -50, y: -180, z: 0, rx: -30, ry: -8, d: 3300 },
      { x: 650, y: -180, z: 250, rx: -30, ry: -14, d: 3500 },
      { x: 1350, y: -170, z: 0, rx: -32, ry: -16, d: 3400 },
      { x: 2000, y: -170, z: 0, rx: -32, ry: -20, d: 3200 },
      LAYERS[P].shot
    ];
    for (let i = 0; i < LAYERS.length; i++) {
      const Ly = LAYERS[i];
      if (i === P) {   // two sub-steps, each centred: VAN to BP PSaaS (back edge), then AWS PrivateLink (front)
        const pd = devs.filter(d => d.layer === P), pl = stage.links.filter(l => l.layer === P && !l.hidden);
        const onSide = z => z < 0;
        stage.focus(tl, t, P);
        tl.mark(t, 'P · VAN → BP PSaaS', 'A business partner network connects over VAN / private circuit / leased line straight to BP PSaaS, then into Tier 2');
        stage.shot(tl, t, SHOT.van, 1800);
        pd.filter(d => onSide(d.z)).forEach((d, j) => d.reveal(tl, t + 700 + j * 200));
        SL.filter(o => o.layer === P && o.side === 'on').forEach(o => lab(o, t + 900, true));
        pl.filter(l => onSide(l.pts[0][2]) && !drawn.has(l)).forEach(l => l.show(tl, t + 700, true));
        t = Math.max(t + 4400, drawIn(DRAW.on, t + 900) + 900);
        tl.mark(t, 'P · AWS PrivateLink', 'A partner service in its own AWS VPC reaches our VPC over PrivateLink, never leaving AWS');
        stage.shot(tl, t, SHOT.plink, 1800);
        pd.filter(d => !onSide(d.z)).forEach((d, j) => d.reveal(tl, t + 700 + j * 200));
        SL.filter(o => o.layer === P && o.side === 'aws').forEach(o => lab(o, t + 900, true));
        pl.filter(l => !onSide(l.pts[0][2]) && !drawn.has(l)).forEach(l => l.show(tl, t + 700, true));
        t = Math.max(t + 4400, drawIn(DRAW.aws, t + 900) + 900);
        continue;
      }
      // No caption box while introducing each layer: the legend highlights it; the scrubber still gets a named step
      tl.mark(t, `${Ly.tag || 'L' + i} · ${Ly.name}`, Ly.desc);
      if (i === 0) stage.caption.hide(tl, t);
      stage.focus(tl, t, i === 1 ? [0, 1] : i);   // L1: keep the clients lit, the lookup starts there
      stage.shot(tl, t, tour[i], 1600);
      devs.filter(d => d.layer === i).forEach((d, j) => d.reveal(tl, t + 600 + j * 160));
      if (i === 0) devs.filter(d => d.layer === 0).forEach((d, j) => d.activate(tl, t + 1300 + j * 350, 4100 - j * 350));
      SL.filter(o => o.layer === i).forEach(o => lab(o, t + 800, true));
      stage.links.filter(l => l.layer === i && !l.hidden && !drawn.has(l)).forEach(l => l.show(tl, t + 600, true));
      let next = t + 4200;
      if (DRAW[i]) next = Math.max(next, drawIn(DRAW[i], t + 900) + 900);
      if (i === 0) next = t + 5900;   // hold on the lit client types so they can be read
      if (i === 1) next = Math.max(next, dns(tl, t + 2000, C.browser, DNSQ.tour, { final: ['A 23.45.67.89', '5 · client connects to that edge (L2)'] }) + 800);
      t = next;
    }
    stage.focus(tl, t, null);
    cap(tl, t, 'All together', 'Web on-prem, API into AWS, M2M on-prem and business partners over private connectivity, all at once');
    t = stage.shot(tl, t, SHOT.overview, 2200);
    const flows = [[pk, RT.web, 'tls', 'GET /accounts'], [pkB, RT.api, 'tls', 'GET /v1/accounts'], [pkC, RT.m2m, 'tls', 'POST /v1/batch'], [pkD, RT.bpAws, 'priv', 'GET /v1/positions'], [pkE, RT.bpOn, 'priv', 'POST /v1/payments']];
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

  /* ---------- Chapter 2: web journey, on-prem ---------- */
  function chWeb(tl) {
    base(tl, '4bf92f3577b34da6a3ce929d0e0e4736', 420);
    let t = 300;
    cap(tl, t, 'Web journey · on-prem', 'A customer opens the web app in a browser');
    t = stage.shot(tl, t, look(C.browser, { dist: 1800, ry: 24, dx: 250, dz: 100 }), 2000);
    cap(tl, t, 'L1 · Steering (DNS)', 'Outside the request: the resolver asks one of the seven nameservers. A JPMorgan primary returns a CNAME to Akamai GTM, and GTM picks the best edge');
    stage.shot(tl, t, SHOT.steer, 1800);
    t = dns(tl, t + 300, C.browser, DNSQ.web);
    span(tl, t - 1200, D.steerA, 'dns.akamai', 0, 18);
    cap(tl, t, 'L2 · CDN / edge protection', 'The browser connects straight to the edge IP it was given. Akamai terminates TLS, absorbs attacks, applies WAF and bot management, then forwards to origin');
    stage.shot(tl, t, look(D.cdnA, { dx: -250, dz: 150, ry: 14, dist: 2300 }), 2000);
    t = pk.appear(tl, t, [X[0] + 60, Y, C.browser.z], 'tls', 'GET /accounts', '→ 23.45.67.89');
    span(tl, t, C.browser, 'browser', 20, 400);
    t = go(tl, t, pk, [L.cl.browser, L.hubA], 2200);
    t = visit(tl, t, D.cdnA, 'cdnA');
    span(tl, t - 900, D.cdnA, 'akamai.cdn', 32, 380);
    cap(tl, t, 'L3 · Regional perimeter', 'Only CDN origin traffic may enter the on-prem network; PSaaS+ admits it into the internal DMZ');
    stage.shot(tl, t, look(D.psaas, { dx: -150, dz: 100 }), 1800);
    t = go(tl, t + 100, pk, [L.cAA, L.inA], 1400);
    t = visit(tl, t, D.psaas, 'psaas');
    span(tl, t - 900, D.psaas, 'psaas+', 46, 360);
    cap(tl, t, 'L4 · SESF / Tier 2', 'The request reaches the T2 gateway proxy in the internal DMZ');
    stage.shot(tl, t, look(D.t2, { dx: -150, dz: 100 }), 1800);
    t = go(tl, t + 100, pk, [L.psT2], 1200);
    const t2Start = t;
    D.t2.activate(tl, t, 1200);
    cap(tl, t, 'Inside T2 · gateway-envoy', 'The T2 node expands: Envoy on a GVSI host calls auth-service (ext_authz) for the session check and the payload policies');
    stage.shot(tl, t, SHOT.t2drill, 1400);
    t = pk.open(tl, t);
    stage.present(tl, t, true);
    t = T2D.open(tl, t + 200, 800);
    cap(tl, t, 'Route, then check the session', 'Envoy matches the route and calls auth-service, which verifies the session JWT: issued by the session manager, for ingress-gateway, signed, DPoP-bound');
    t = t2Run(tl, t + 200, 'get');
    cap(tl, t - 1800, 'No body, no payload policies', 'This GET has no body, so the global and route payload policies are skipped; chapter 3 shows them at work');
    t = T2D.close(tl, t + 300, 600);
    stage.present(tl, t, false);
    span(tl, t2Start, D.t2, 'envoy.t2', 60, 340);
    stage.shot(tl, t, look(D.t2, { dx: -150, dz: 100 }), 1200);
    t = pk.seal(tl, t, 'mtls');
    cap(tl, t, 'L5 · ESF / Tier 3', 'The T3 IFA web gateway brokers the call across the firewall into the trusted network');
    stage.shot(tl, t, look(D.t3web, { dx: -150, dz: 150 }), 1800);
    t = go(tl, t + 100, pk, [L.t2W], 1400, { cls: 'mtls' });
    t = visit(tl, t, D.t3web, 't3web');
    span(tl, t - 900, D.t3web, 't3.web.envoy', 74, 318);
    cap(tl, t, 'L6 · Trusted workloads', 'The application service in the trusted zone answers the request');
    stage.shot(tl, t, look(D.wlOn, { dx: -200, dz: 100, dist: 1900 }), 1600);
    t = go(tl, t + 100, pk, [L.oW, L.onT], 1400, { cls: 'mtls' });
    workload(tl, t, D.wlOn, pk, null, 'mtls', 'accounts-svc', 92, 280);
    t += 1600;
    cap(tl, t, 'Response', '200 OK returns along the same path, with one trace ID across every layer');
    pk.state_(tl, t, 'ok', '200 OK', 'trace 4bf9…4736');
    stage.shot(tl, t, SHOT.overview, 3000, 'inOutSine');
    t = go(tl, t + 200, pk, RT.web, 4400, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    C.browser.html(tl, t, SCR.accounts);
    ring(stage, W, tl, t, C.browser.top, '#34D399', 260);
    t = pk.vanish(tl, t);
    cap(tl, t, 'Next click · caches', 'The DNS answer is still cached, so L1 is not contacted, and the edge serves the static asset from its cache');
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
    const IN = [L.cl.browser, L.hubA, L.cAA, L.inA, L.psT2], ONWARD = [L.t2W, L.oW, L.onT];
    const runs = [
      ['valid', '1 · Valid payload', 'Session JWT checked; the global policy finds no injection patterns; the route policy confirms required fields and formats: allowed, 201 Created',
        'auth-service      allow  global ✓ route_users_register ✓', '#C7D2FE', 0],
      ['sqli', '2 · SQL injection', 'The global policy (a blocklist, default allow) matches an injection pattern in full_name and denies: 403. The route policy never runs',
        'auth-service      403  payload.global  injection pattern in full_name', '#FDA4AF', 1],
      ['email', '3 · Malformed email', 'The global policy passes; the route policy (default deny) rejects the email format: 403',
        'auth-service      403  route_users_register  email is not a valid email address', '#FDA4AF', 1]
    ];
    let t = 300;
    cap(tl, t, 'Payload policies · T2', 'Three requests to POST /api/v1/users/register show the two Rego policies that protect every route');
    t = stage.shot(tl, t, SHOT.front, 1800);
    runs.forEach(([k, st, tx, log, col, err], n) => {
      // client -> T2
      [...IN, ...ONWARD].forEach(l => l.clear(tl, t));
      C.browser.html(tl, t, SCR.reg);
      cap(tl, t, st, 'The browser submits the registration form; the request crosses the edge and perimeter to T2');
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
        cap(tl, t, st + ' · 403', 'The 403 goes straight back to the client; nothing reaches Tier 3 or the backend');
        pk.state_(tl, t, 'bad', '403 Forbidden', 'payload validation failed');
        t = pk.seal(tl, t, 'bad');
        stage.shot(tl, t, SHOT.front, 1400);
        t = go(tl, t + 200, pk, IN, 3200, { reverse: true, cls: 'bad', ease: 'inOutQuad' });
        C.browser.html(tl, t, SCR.reg403);
        ring(stage, W, tl, t, C.browser.top, '#F43F5E', 260);
      } else {
        // allowed: on to Tier 3 and the backend, then 201 back to the client
        cap(tl, t, st + ' · 201', 'Allowed: the request continues over mTLS through Tier 3 to the backend, and 201 Created returns to the client');
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
    cap(tl, t, 'One lever for every route', 'The global policy patches every route at once against new attack patterns; each route policy only knows its own fields');
    t = stage.shot(tl, t, SHOT.obs, 2200);
    tl.wait(t, 3000);
  }

  /* ---------- Chapter 3: API journey into AWS ---------- */
  function chApi(tl) {
    base(tl, '0af7651916cd43dd8448eb211c80319c', 340);
    let t = 300;
    cap(tl, t, 'API journey · AWS', 'An API client calls the accounts API');
    t = stage.shot(tl, t, look(C.api, { dist: 1700, ry: 24, dx: 250, dz: 100 }), 2000);
    C.api.html(tl, t - 800, TERM.req);
    cap(tl, t, 'L1 · Steering (DNS)', 'This resolver happened to ask a Cloudflare secondary. The zone came from the JPMorgan primary, but this hostname is overridden to Cloudflare LB, which answers with an anycast IP');
    stage.shot(tl, t, SHOT.steer, 1800);
    t = dns(tl, t + 300, C.api, DNSQ.api);
    span(tl, t - 1200, D.steerC, 'dns.cloudflare', 0, 12);
    cap(tl, t, 'L2 · CDN / edge protection', 'Cloudflare terminates TLS, checks the API request and the client, then forwards to origin');
    stage.shot(tl, t, look(D.cdnC, { dx: -250, dz: 150, ry: 14, dist: 2300 }), 2000);
    t = pk.appear(tl, t, [X[0] + 60, Y, C.api.z], 'tls', 'GET /v1/accounts', 'trace 0af7…319c');
    span(tl, t, C.api, 'api-client', 14, 318);
    t = go(tl, t, pk, [L.cl.api, L.hubC], 2200);
    t = visit(tl, t, D.cdnC, 'cdnC');
    span(tl, t - 900, D.cdnC, 'cloudflare.cdn', 24, 300);
    cap(tl, t, 'L3 · Regional perimeter', 'AWS WAF admits only CDN traffic into AWS');
    stage.shot(tl, t, look(D.waf, { dx: -150, dz: 150 }), 1800);
    t = go(tl, t + 100, pk, [L.cCC, L.inC], 1400);
    t = visit(tl, t, D.waf, 'waf');
    span(tl, t - 900, D.waf, 'aws.waf', 36, 286);
    cap(tl, t, 'L4 · no Tier 2 hop in AWS', 'In AWS the WAF hands off directly to the EKS gateways in the cross-firewall zone');
    stage.shot(tl, t, look(D.capi, { dx: -450, dz: 150, dist: 2400 }), 2200);
    t = go(tl, t + 100, pk, [L.wafA, L.tA], 2400);
    cap(tl, t, 'L5 · Cloud API gateway', 'Kong on EKS validates the token, the scope and the payload against the OpenAPI contract');
    D.capi.activate(tl, t, 3600);
    t = pk.open(tl, t);
    t = visit(tl, t, D.capi, 'capi', { hold: 3200 });
    span(tl, t - 900, D.capi, 'kong.cloud-api', 48, 262);
    t = pk.seal(tl, t - 200, 'mtls');
    cap(tl, t, 'L6 · Trusted workloads', 'The cloud accounts service answers');
    stage.shot(tl, t, look(D.wlCl, { dx: -200, dz: 150, dist: 1900 }), 1600);
    t = go(tl, t + 100, pk, [L.cAo, L.clT], 1300, { cls: 'mtls' });
    workload(tl, t, D.wlCl, pk, null, 'mtls', 'accounts-svc', 70, 210);
    t += 1600;
    cap(tl, t, 'Response', '200 OK and a JSON body return to the client');
    pk.state_(tl, t, 'ok', '200 OK', 'application/json');
    stage.shot(tl, t, SHOT.overview, 3000, 'inOutSine');
    t = go(tl, t + 200, pk, RT.api, 4200, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    C.api.html(tl, t, TERM.ok);
    ring(stage, W, tl, t, C.api.top, '#34D399', 240);
    t = pk.vanish(tl, t);
    t = stage.shot(tl, t, look(C.api, { dist: 1500, ry: 24, dx: 200, dz: 80 }), 1800);
    tl.wait(t, 2500);
  }

  /* ---------- Chapter 4: business partners over private connectivity ---------- */
  function chPrivate(tl) {
    base(tl, '5b8aa5a2d2c872e8321cf37308d69df2', 300);
    const track = (pos, v) => tl.set(stage, 'tracker', pos, v, x => { stage.tracker = x; }, pk);
    let t = 300;
    cap(tl, t, 'Private connectivity', 'Business partners on VAN, private circuits or leased lines use their own route, outside the internet path');
    stage.focus(tl, t, [P]);
    t = stage.shot(tl, t, LAYERS[P].shot, 2400);
    cap(tl, t, 'A distinct route', 'No DNS steering, no CDN, no internet perimeter (L1 to L3): each partner lands on a dedicated entry point');
    t += 3200;
    // on-prem: partner -> VAN -> BP PSaaS -> T2 -> T3 API -> workloads
    cap(tl, t, 'P · Private circuit to on-prem', 'Partner Acme sends a payment over its VAN / leased line');
    stage.focus(tl, t, [P, 4, 5, 6]);
    stage.shot(tl, t, SHOT.van, 2000);
    D.bpOn.activate(tl, t + 800, 1600);
    t = pkE.appear(tl, t + 1200, [X[0] + 60, Y, PZ.on], 'priv', 'POST /v1/payments', 'partner: acme · VAN');
    track(t - 400, pkE);
    span(tl, t, D.bpOn, 'partner.acme', 0, 296);
    t = go(tl, t, pkE, [L.pvtOn], 3000, { cls: 'priv' });
    cap(tl, t, 'P · BP PSaaS entry point', 'The dedicated business partner entry point admits the circuit into the on-prem network');
    stage.shot(tl, t - 1200, look(D.bpp, { dx: -150, dz: 250, ry: -12, rx: -32, dist: 2000 }), 1600);
    t = visit(tl, t, D.bpp, 'bpp');
    span(tl, t - 900, D.bpp, 'bp-psaas', 10, 280);
    cap(tl, t, 'L4 · SESF / Tier 2', 'From here it joins the internal path: the T2 gateway proxy inspects and re-encrypts with mTLS');
    stage.shot(tl, t, look(D.t2, { dx: -250, dz: -300, ry: -10, rx: -36, dist: 2400 }), 1800);
    t = go(tl, t + 100, pkE, [L.bpT2], 1800, { cls: 'priv' });
    D.t2.activate(tl, t, 2600);
    t = pkE.open(tl, t);
    t = visit(tl, t, D.t2, 't2', { step: 220, check: { items: ['TLS terminated and inspected', 'Route: partner payments API', 'Re-encrypt with mTLS to Tier 3'] } });
    span(tl, t - 900, D.t2, 'envoy.t2', 24, 260);
    t = pkE.seal(tl, t - 200, 'mtls');
    cap(tl, t, 'L5 · T3 IFA API gateway', 'Kong on GKP authenticates the partner and enforces its plan and the API contract');
    stage.shot(tl, t, look(D.t3api, { dx: -200, dz: 100 }), 1800);
    t = go(tl, t + 100, pkE, [L.t2A], 1400, { cls: 'mtls' });
    t = visit(tl, t, D.t3api, 't3api', { step: 240, check: { items: ['OAuth2 client credentials: partner Acme', 'Scope: payments:create', 'Partner plan quota: ok', 'OpenAPI schema validation'] } });
    span(tl, t - 900, D.t3api, 't3.api.kong', 40, 236);
    cap(tl, t, 'L6 · Trusted workloads', 'The on-prem payments service accepts the instruction');
    stage.shot(tl, t, look(D.wlOn, { dx: -200, dz: 100, dist: 1900 }), 1600);
    t = go(tl, t + 100, pkE, [L.oA, L.onT], 1300, { cls: 'mtls' });
    workload(tl, t, D.wlOn, pkE, null, 'mtls', 'payments-svc', 60, 200);
    t += 1400;
    pkE.state_(tl, t, 'ok', '201 Created', 'over the private circuit');
    cap(tl, t, 'Response', '201 Created returns over the same private circuit');
    stage.shot(tl, t, { ...LAYERS[P].shot, z: -300 }, 2600, 'inOutSine');
    t = go(tl, t + 200, pkE, RT.bpOn, 3800, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    ring(stage, W, tl, t, D.bpOn.top, '#34D399', 240);
    t = pkE.vanish(tl, t);
    // AWS: partner service (its own account) -> interface endpoint -> AWS network -> our endpoint service -> Cloud API -> workloads
    cap(tl, t, 'P · Partner VPC', 'A trusted 3rd party runs its service in its own AWS account and VPC, alongside ours on the AWS network');
    stage.focus(tl, t, [P, 5, 6]);
    stage.shot(tl, t, { x: 700, y: -40, z: 1100, rx: -40, ry: -12, d: 2700 }, 2200);
    wlPulse(tl, t + 900, D.bpAws);
    t = pkD.appear(tl, t + 1400, [470, Y, PZ.aws], 'priv', 'GET /v1/positions', 'partner: globex');
    track(t - 400, pkD);
    cap(tl, t, 'P · Interface endpoint', 'It calls a private IP inside its own VPC: an interface endpoint for our service');
    t = go(tl, t, pkD, [L.pInner], 900, { cls: 'priv' });
    t = visit(tl, t, D.eni, 'eni', { step: 280 });
    obs.log(tl, t - 900, 'vpce              partner=globex  10.20.3.14:443', '#99F6E4');
    cap(tl, t, 'P · VPC to VPC', 'PrivateLink carries it from the partner VPC straight into our VPC: no internet gateway, NAT or public IP, and no L1 to L3');
    stage.shot(tl, t, { x: 800, y: -60, z: 960, rx: -44, ry: -18, d: 2500 }, 1800);
    t = go(tl, t + 300, pkD, [L.pvtAws], 2000, { cls: 'priv' });
    cap(tl, t, 'P · Our endpoint service', 'Only allow-listed partner accounts can connect, only to this one service, and only in that direction');
    stage.shot(tl, t - 600, look(D.pl, { dx: 200, dz: -50, ry: -18, rx: -32, dist: 2200 }), 1400);
    t = visit(tl, t, D.pl, 'pl');
    obs.log(tl, t - 900, 'privatelink       accept account=1111-2222-3333', '#99F6E4');
    cap(tl, t, 'L5 · Cloud API gateway', 'Kong on EKS authenticates the partner with mTLS and OAuth client credentials');
    stage.shot(tl, t, look(D.capi, { dx: -300, dz: 350, dist: 2300 }), 1800);
    t = go(tl, t + 100, pkD, [L.plIn, L.tA], 2200, { cls: 'priv' });
    t = visit(tl, t, D.capi, 'capi', { step: 240, check: { items: ['mTLS client certificate: partner CA', 'OAuth2 client credentials', 'Scope: positions:read', 'Partner plan quota: ok'] } });
    obs.log(tl, t - 900, 'kong.cloud-api    200 partner=globex', '#C7D2FE');
    stage.shot(tl, t, look(D.wlCl, { dx: -200, dz: 150, dist: 1900 }), 1600);
    t = go(tl, t + 100, pkD, [L.cAo, L.clT], 1300, { cls: 'mtls' });
    wlPulse(tl, t, D.wlCl);
    t += 1400;
    pkD.state_(tl, t, 'ok', '200 OK', 'back over PrivateLink');
    stage.shot(tl, t, { x: 1100, y: -100, z: 750, rx: -42, ry: -10, d: 4200 }, 2400, 'inOutSine');
    t = go(tl, t + 200, pkD, RT.bpAws, 3400, { reverse: true, cls: 'ok', ease: 'inOutQuad' });
    ring(stage, W, tl, t, D.bpAws.top, '#34D399', 240);
    t = pkD.vanish(tl, t);
    stage.focus(tl, t, null);
    cap(tl, t, 'Two worlds, one platform', 'Internet traffic climbs through L1 to L3. Partners enter at BP PSaaS over private circuits, or over PrivateLink from inside AWS, and join the internal path');
    t = stage.shot(tl, t, SHOT.overview, 2400);
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
    cap(tl, t, 'L5 · Cloud web gateway', 'Envoy on EKS routes to the web service with outlier detection and retries');
    stage.shot(tl, t, look(D.cweb, { dx: -350, dz: 200, dist: 2300 }), 2000);
    t = go(tl, t + 100, pk, [L.wafW, L.tW], 2200);
    t = visit(tl, t, D.cweb, 'cweb', { step: 220 });
    span(tl, t - 900, D.cweb, 'envoy.cloud-web', 60, 436);
    pk.seal(tl, t - 400, 'mtls');
    stage.shot(tl, t, look(D.wlCl, { dx: -250, dz: 100, dist: 1900 }), 1600);
    t = go(tl, t + 100, pk, [L.cWo, L.clT], 1100, { cls: 'mtls' });
    const W6 = D.wlCl;
    t = pk.travel(tl, t, { pts: [[2030, Y, 450], pod(W6, 0)] }, 400);
    tl.set(W6.pods[0].g, 'err', t, true, v => W6.pods[0].g.classList.toggle('err', v), false);
    tl.add(W6.pods[0].g, { x: [0, -6, 6, -4, 0], duration: 400, ease: 'linear' }, t);
    ring(stage, W, tl, t, pod(W6, 0), '#F43F5E', 200);
    cap(tl, t, 'L6 · Upstream error', 'The first pod returns 503');
    span(tl, t, [X[6], -200, W6.pods[0].z], 'balances (pod 1)', 76, 40, 'error', 'balances-svc      503 upstream  trace=c07d5e21');
    t = pk.state_(tl, t, 'bad', 'GET /balances', '503 from pod 1');
    t = pk.travel(tl, t + 500, { pts: [pod(W6, 0), [1900, -150, 450]] }, 600);
    cap(tl, t, 'Retry', 'The gateway retries the idempotent request on a healthy pod');
    pk.state_(tl, t, 'mtls', 'GET /balances', 'retry 1');
    t = pk.travel(tl, t + 200, { pts: [[1900, -150, 450], pod(W6, 2)] }, 700);
    ring(stage, W, tl, t, pod(W6, 2), '#34D399', 200);
    tl.add(W6.pods[2].g, { y: [0, -14, 0], duration: 600, ease: 'inOutSine' }, t);
    span(tl, t, [X[6], -200, W6.pods[2].z], 'balances (pod 3)', 124, 180, 'ok', 'balances-svc      200 retry=1  trace=c07d5e21');
    t += 900;
    cap(tl, t, 'Response', '200 OK returns through AWS and Cloudflare; two failovers, zero errors for the user');
    pk.state_(tl, t, 'ok', '200 OK', 'retry 1 · 2 failovers');
    stage.shot(tl, t, SHOT.overview, 3000, 'inOutSine');
    t = pk.travel(tl, t + 200, { pts: [pod(W6, 2), [2030, Y, 450]] }, 300);
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
    cap(tl, t, 'L2 · Bot and agent policy', 'An AI agent scrapes pages it is not allowed to; bot management blocks it at the edge');
    stage.shot(tl, t, look(D.cdnC, { dx: -700, dz: 100, ry: 16, dist: 2900 }), 1800);
    t = pk.appear(tl, t + 400, [X[0] + 60, Y, C.agent.z], 'attack', 'GET /statements/*', 'agent: unknown');
    t = go(tl, t, pk, [L.cl.agent, L.hubC], 2000);
    t = visit(tl, t, D.cdnC, 'cdnC', { check: { items: ['TLS 1.3 valid', { t: 'Declared AI crawler: signature verified', s: 'warn' }, { t: 'Not on the AI access allow-list', s: 'fail' }, { t: 'Request rate: 60/s', s: 'fail' }], result: 'BLOCK · 403 at the edge', color: '#FB7185' }, step: 360 });
    span(tl, t - 900, D.cdnC, 'cloudflare.cdn', 0, 6, 'error', 'cloudflare.bot    403 ai-agent  trace=7c1e0f4a');
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
    cap(tl, t, 'L5 · Contract violation', 'A syntactically clean request passes the edge and WAF, but breaks the API contract');
    C.api.html(tl, t, TERM.req.replace('/v1/accounts', '/v1/payments'));
    stage.shot(tl, t, SHOT.wide, 2000);
    t = pkB.appear(tl, t + 300, [X[0] + 60, Y, C.api.z], 'tls', 'POST /v1/payments', 'trace 7c1e…9e77');
    tl.set(stage, 'tracker', 0, pk, v => { stage.tracker = v; }, pk); tl.set(stage, 'tracker', t, pkB);
    t = go(tl, t, pkB, [L.cl.api, L.hubC, L.cCC, L.inC], 3600);
    D.cdnC.activate(tl, t - 1800, 1000); D.waf.activate(tl, t, 1000);
    span(tl, t - 1800, D.cdnC, 'cloudflare.cdn', 40, 70); span(tl, t, D.waf, 'aws.waf', 52, 56);
    stage.shot(tl, t, look(D.capi, { dx: -150, dz: 150, dist: 1800 }), 2000);
    t = go(tl, t + 100, pkB, [L.wafA, L.tA], 2000);
    D.capi.activate(tl, t, 4000);
    t = pkB.open(tl, t);
    const bad = `POST /v1/payments
{
  <span class="bad">"amount": "2500.00",</span>
  "currency": "USD",
  <span class="bad">"beneficiaryOverride": "···4471"</span>
}`;
    t = stage.checklist(tl, t, { at: D.capi.top, title: 'Kong · OpenAPI validation', code: bad, items: [{ t: 'OAuth2 token valid' }, { t: 'amount must be a number', s: 'fail' }, { t: 'Unknown field beneficiaryOverride', s: 'fail' }], result: 'REJECT · 400 Bad Request', resultColor: '#FB7185', step: 480, hold: 700, dx: 40, dy: -40 });
    span(tl, t - 900, D.capi, 'kong.cloud-api', 60, 8, 'error', 'kong.cloud-api    400 schema_violation  trace=7c1e0f4a');
    pkB.state_(tl, t - 400, 'bad', '400 Bad Request', 'schema_violation');
    t = pkB.seal(tl, t - 400, 'bad');
    stage.shot(tl, t, SHOT.wide, 1800);
    t = go(tl, t + 200, pkB, [L.cl.api, L.hubC, L.cCC, L.inC, L.wafA, L.tA], 4200, { reverse: true, cls: 'bad', ease: 'inOutQuad' });
    ring(stage, W, tl, t, C.api.top, '#F43F5E', 240);
    C.api.html(tl, t, TERM.bad);
    t = pkB.vanish(tl, t + 500);
    obs.alert(tl, t, 'Attacks stopped at L2, L3 and L5<br><span style="font-size:28px;font-weight:500">flood absorbed · AI agent blocked · origin bypass dropped · contract enforced</span>');
    t = stage.shot(tl, t, SHOT.obs, 2200);
    tl.wait(t, 3500);
  }

  const chapters = [
    { title: 'The seven layers', build: chTour },
    { title: 'Web · on-prem', build: chWeb },
    { title: 'Payload policies · T2', build: chPayload },
    { title: 'API · AWS', build: chApi },
    { title: 'Private connectivity', build: chPrivate },
    { title: 'Failover', build: chFailover },
    { title: 'Defense in depth', build: chDefense }
  ];
  stage.onReset(() => { stage.tracker = pk; [D.wlCl, D.wlOn].forEach(w => w.pods.forEach(p => p.g.classList.remove('err'))); });
  const player = new Player(stage, document.getElementById('controls'), chapters);
  window.FK_PLAYER = player;
  const q = new URLSearchParams(location.search);
  const ch = Math.max(1, Math.min(chapters.length, +q.get('ch') || 1));
  player.load(ch - 1);
  if (q.has('t')) player.seek(+q.get('t')); else player.play();
})();
