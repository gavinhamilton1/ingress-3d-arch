/*
 * Scene: CIB Unified Ingress request journeys.
 * Names and labels live in NAMES so they can be corrected in one place.
 */
(function () {
  const FK = window.FlowKit;
  const { Stage, Trace, ObsWall, Device, Wall, Link, Packet, zone, ring, fly, route, Player } = FK;

  const NAMES = {
    client: ['Client browser', 'JWS session cookie'],
    attacker: ['Attacker device', 'replaying a stolen cookie'],
    stronghold: ['Stronghold', 'AAL3 step-up'],
    popA: ['Akamai edge PoP 1', 'TLS · WAF · Bot Manager'],
    popB: ['Akamai edge PoP 2', 'TLS · WAF · Bot Manager'],
    perimeter: 'Perimeter firewall · Akamai origin IPs only',
    t1t2: 'T1 → T2 firewall · mTLS only',
    uig: ['Unified Ingress', 'Web / API Ingress · TLS inspect · WAF · OAS'],
    sme: ['Session Manager SM-E', 'JWS cookie · DPoP binding'],
    smc: ['Session Manager SM-C', 'session → token (stays in T2)'],
    pdp: ['Entitlements PDP', 'policy decision point'],
    wl: ['payments-api', 'workload'],
    obs: 'Observability plane'
  };

  const frame = document.getElementById('fk');
  const stage = new Stage(frame);
  const W = stage.world;
  const trace = new Trace(stage);

  /* ---------- layout ---------- */
  const LANE = { A: -450, B: 450 };
  zone(stage, W, { x1: -2350, x2: -1500, z1: -700, z2: 1100, color: '#94A3B8', label: 'Internet' });
  zone(stage, W, { x1: -1350, x2: -640, z1: -650, z2: 650, color: '#F97316', label: 'Edge', sub: 'Akamai' });
  for (const [r, L] of Object.entries(LANE)) {
    zone(stage, W, { x1: -300, x2: 640, z1: L - 350, z2: L + 330, color: '#FBBF24', label: 'T1 · DMZ', sub: 'Region ' + r });
    zone(stage, W, { x1: 880, x2: 2150, z1: L - 350, z2: L + 330, color: '#38BDF8', label: 'T2 · Internal', sub: 'Region ' + r });
  }
  const obs = new ObsWall(stage, W, { x: 0, y: -760, z: -1500, w: 3600, h: 640, title: NAMES.obs });
  const perimeter = new Wall(stage, W, { x: -440, z1: -950, z2: 950, lanes: [LANE.A, LANE.B], color: '#F97316', label: NAMES.perimeter });
  const fw2 = new Wall(stage, W, { x: 760, z1: -950, z2: 950, lanes: [LANE.A, LANE.B], color: '#FBBF24', label: NAMES.t1t2 });

  const SHIELD = `<svg viewBox="0 0 70 70" width="70" height="70"><path d="M35 4 L62 14 V34 C62 50 50 61 35 66 C20 61 8 50 8 34 V14 Z" fill="rgba(56,189,248,.18)" stroke="#38BDF8" stroke-width="3"/><path d="M24 35 L32 43 L47 27" fill="none" stroke="#38BDF8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const dev = (o, n) => new Device(stage, W, { ...o, label: n[0], sub: n[1] });
  const browserUI = (body) => `<div style="height:12px;background:#1E293B;display:flex;gap:3px;align-items:center;padding:0 4px"><i style="width:4px;height:4px;border-radius:50%;background:#F87171"></i><i style="width:4px;height:4px;border-radius:50%;background:#FBBF24"></i><i style="width:4px;height:4px;border-radius:50%;background:#34D399"></i></div><div style="padding:8px 10px">${body}</div>`;
  const SCR = {
    pay: browserUI(`<b style="font-size:10px;color:#1E3A8A">Pay supplier</b><div style="margin-top:6px;height:10px;border:1px solid #CBD5E1;border-radius:2px;padding:0 3px;font-size:7px">Acme Ltd · USD 2,500.00</div><div style="margin-top:8px;height:13px;border-radius:3px;background:#2563EB;color:#fff;font-size:7px;display:grid;place-items:center">Submit payment</div>`),
    done: browserUI(`<div style="text-align:center;margin-top:10px"><div style="width:22px;height:22px;border-radius:50%;background:#D1FAE5;color:#059669;margin:0 auto;display:grid;place-items:center;font-weight:700">&#10003;</div><b style="font-size:9px;color:#065F46">Payment submitted</b><div style="font-size:7px;color:#64748B">201 Created · 348 ms</div></div>`),
    session: browserUI(`<b style="font-size:10px;color:#1E3A8A">Accounts</b><div style="margin-top:5px;font-size:7px;color:#475569">Operating ···4821 &nbsp; USD 1.2M</div><div style="font-size:7px;color:#475569">Payroll ···7710 &nbsp; USD 310K</div><div style="margin-top:6px;font-size:7px;color:#64748B">Signed in · session active</div>`),
    stepup: browserUI(`<div style="text-align:center;margin-top:6px"><b style="font-size:9px;color:#92400E">Verify it's you</b><div style="font-size:7px;color:#64748B;margin-top:3px">Approve on your Stronghold device</div><div style="margin:6px auto 0;width:60px;height:4px;border-radius:2px;background:#FDE68A"></div></div>`),
    secured: browserUI(`<div style="text-align:center;margin-top:8px"><div style="width:22px;height:22px;border-radius:50%;background:#D1FAE5;color:#059669;margin:0 auto;display:grid;place-items:center;font-weight:700">&#10003;</div><b style="font-size:9px;color:#065F46">Session secured</b><div style="font-size:7px;color:#64748B">New device-bound session · AAL3</div></div>`),
    attacker: `<div style="background:#0F0A14;height:100%;color:#FB7185;font:8px ui-monospace,monospace;padding:8px 9px">$ curl -b "sid=eyJhbGciOiJFUzI1NiJ9..." \\<br>&nbsp; https://…/v1/accounts<br><span style="color:#94A3B8">replaying stolen cookie</span></div>`
  };

  const PHONE = ok => `<div style="padding-top:18px;font-weight:700;font-size:10px">Stronghold</div><div style="margin-top:4px;color:#94A3B8">${ok ? 'Approved' : 'Approve sign-in?'}</div><div style="width:40px;height:40px;margin:16px auto 0;border-radius:50%;border:3px solid ${ok ? '#34D399' : '#FBBF24'};display:grid;place-items:center;color:${ok ? '#34D399' : '#FBBF24'};font-size:18px">${ok ? '&#10003;' : '&#9678;'}</div><div style="margin-top:12px;color:#64748B;font-size:8px">AAL3 · biometric</div>`;
  const client = dev({ x: -1950, z: 0, kind: 'laptop', color: '#334155', screen: SCR.pay }, NAMES.client);
  const attacker = dev({ x: -1950, z: 760, kind: 'laptop', color: '#4C0519', led: '#F43F5E', accent: '#F43F5E', screen: SCR.attacker, hidden: true }, NAMES.attacker);
  const phone = dev({ x: -1680, z: 300, kind: 'phone', color: '#334155', led: '#FBBF24', hidden: true }, NAMES.stronghold);
  const popA = dev({ x: -1000, z: -250, h: 220, color: '#1E293B', accent: '#F97316' }, NAMES.popA);
  const popB = dev({ x: -1000, z: 250, h: 220, color: '#1E293B', accent: '#F97316' }, NAMES.popB);
  const R = {};
  for (const [r, L] of Object.entries(LANE)) {
    R[r] = {
      L,
      uig: dev({ x: -50, z: L, kind: 'gateway', w: 160, h: 150, d: 130, icon: SHIELD }, NAMES.uig),
      sme: dev({ x: 380, z: L, h: 190, accent: '#FBBF24' }, NAMES.sme),
      smc: dev({ x: 1080, z: L, h: 190, accent: '#A78BFA' }, NAMES.smc),
      pdp: dev({ x: 1080, z: L - 250, h: 150, accent: '#34D399' }, NAMES.pdp),
      wl: dev({ x: 1800, z: L, kind: 'pods', color: '#1E3A5F', count: 3, gap: 120 }, NAMES.wl)
    };
  }

  /* ---------- links ---------- */
  const Y = -50;
  const link = pts => new Link(stage, W, pts);
  const L = {
    cA: link([[-1830, Y, 0], [-1060, Y, -250]]),
    cB: link([[-1830, Y, 0], [-1060, Y, 250]]),
    xA: link([[-1830, Y, 760], [-1060, Y, -250]]),
    aGA: link([[-940, Y, -250], [-440, Y, LANE.A]]),
    aGB: link([[-940, Y, -250], [-440, Y, LANE.B]]),
    bGA: link([[-940, Y + 16, 250], [-440, Y + 16, LANE.A]]),
    bGB: link([[-940, Y, 250], [-440, Y, LANE.B]])
  };
  for (const [r, Lz] of Object.entries(LANE)) {
    Object.assign(R[r], {
      gU: link([[-440, Y, Lz], [-130, Y, Lz]]),
      uS: link([[30, Y, Lz], [320, Y, Lz]]),
      sC: link([[440, Y, Lz], [760, Y, Lz], [1020, Y, Lz]]),
      cP: link([[1080, Y, Lz - 55], [1080, Y, Lz - 195]]),
      cW: link([[1140, Y, Lz], [1745, Y, Lz]])
    });
  }

  const pk = new Packet(stage, W, { size: 36 });
  const pk2 = new Packet(stage, W, { size: 36 });

  /* ---------- helpers ---------- */
  const OBS_Y = -560, OBS_Z = -1480;
  let TID = '';
  function span(tl, pos, d, svc, start, dur, status = 'ok', log) {
    const color = status === 'error' ? '#F43F5E' : status === 'warn' ? '#FBBF24' : '#A78BFA';
    const from = d.top ? d.top : d;
    fly(stage, W, tl, pos, [from[0], from[1] - 10, from[2]], [Math.max(-1700, Math.min(1700, from[0])), OBS_Y, OBS_Z], {
      color, dur: 900, arc: -120,
      onArrive: () => {
        trace.add({ svc, start, dur, status });
        obs.log(log || `${svc.padEnd(18, ' ')} ${String(dur).padStart(3)}ms  trace=${TID.slice(0, 8)}`, status === 'error' ? '#FDA4AF' : status === 'warn' ? '#FDE68A' : '#C7D2FE');
        obs.bump('req', 1); if (status === 'error') obs.bump('err', 1);
      }
    });
    return pos;
  }
  const focus = (d, { dist = 1500, rx = -22, ry = -18, dy = -120, dx = 0, dz = 0 } = {}) => ({ x: (d.x ?? d[0]) + dx, y: dy, z: (d.z ?? d[2]) + dz, rx, ry, d: dist });
  const SHOT = {
    overview: { x: -100, y: -380, z: -200, rx: -36, ry: 0, d: 5900 },
    edge:     { x: -1450, y: -160, z: 60, rx: -26, ry: 12, d: 2300 },
    entry:    { x: -500, y: -150, z: -300, rx: -24, ry: -16, d: 2100 },
    t1A:      { x: 150, y: -160, z: -470, rx: -30, ry: -12, d: 1900 },
    t2A:      { x: 1400, y: -160, z: -560, rx: -32, ry: -16, d: 2200 },
    obs:      { x: 0, y: -800, z: -1500, rx: -6, ry: 0, d: 4300 },
    t1B:      { x: 150, y: -160, z: 420, rx: -28, ry: -12, d: 1900 },
    t2B:      { x: 1400, y: -160, z: 380, rx: -30, ry: -16, d: 2200 },
    attack:   { x: -1500, y: -150, z: 300, rx: -24, ry: 18, d: 2400 }
  };
  function base(tl, id, total) { stage.setCam(SHOT.overview); TID = id; trace.begin(tl, 0, { id, total }); }

  /* ---------- Chapter 1: happy path ---------- */
  function ch1(tl) {
    const A = R.A; base(tl, '4bf92f3577b34da6a3ce929d0e0e4736', 380);
    const cap = (p, s, x) => stage.caption.at(tl, p, s, x);
    let t = 300;
    cap(t, 'Happy path', 'A client submits a payment from the browser');
    t = stage.shot(tl, t, focus(client, { dist: 1500, rx: -20, ry: 18, dx: 150 }), 2200);
    tl.add(client.screen.querySelector('div:last-child > div:last-child') || client.screen, { scale: [1, .9, 1], duration: 300 }, t);
    t = pk.appear(tl, t + 200, [-1880, -170, 0], 'tls', 'POST /v1/payments', 'trace 4bf9…4736');
    span(tl, t, client, 'browser fetch', 0, 348);
    cap(t, 'Edge', 'Akamai terminates TLS, runs WAF and Bot Manager, then re-encrypts to origin');
    stage.shot(tl, t, SHOT.edge, 1800);
    t = pk.travel(tl, t + 200, route([L.cA]), 1400);
    popA.activate(tl, t, 2600);
    t = stage.checklist(tl, t, { at: popA.top, title: 'Akamai edge', items: [{ t: 'TLS 1.3 terminated at the edge' }, { t: 'WAF rules: clean' }, { t: 'Bot Manager: human (score 4)' }, { t: 'Re-encrypt to origin' }], step: 300, hold: 700 });
    span(tl, t - 900, popA, 'akamai.edge', 8, 338);
    cap(t, 'Entering the network', 'The perimeter only admits Akamai origin traffic into Region A');
    stage.shot(tl, t, SHOT.entry, 1800);
    t = pk.travel(tl, t + 100, route([L.aGA]), 1000);
    perimeter.pass(tl, t - 250, LANE.A);
    t = pk.travel(tl, t, route([A.gU]), 700);
    // TLS break and inspect
    cap(t, 'T1 · TLS break and inspect', 'Unified Ingress decrypts, inspects and validates the payload');
    stage.shot(tl, t - 600, SHOT.t1A, 1400);
    A.uig.activate(tl, t, 3800);
    t = pk.open(tl, t);
    t = stage.checklist(tl, t, { at: A.uig.top, title: 'Unified Ingress', items: [{ t: 'Break: TLS terminated' }, { t: 'Inspect: WAF / IPS clean' }, { t: 'Validate: OAS payments.create' }, { t: 'Policy: size, content type, no unknown fields' }], result: 'PASS · re-encrypt with mTLS', step: 330, hold: 500 });
    span(tl, t - 800, A.uig, 'unified-ingress', 20, 318);
    t = pk.seal(tl, t - 200, 'mtls');
    t = pk.travel(tl, t, route([A.uS]), 700, { cls: 'mtls' });
    A.sme.activate(tl, t, 2400);
    t = stage.checklist(tl, t, { at: A.sme.top, title: 'SM-E', items: [{ t: 'JWS cookie (ES256) valid' }, { t: 'DPoP proof matches session key' }, { t: 'Opaque session ID resolved' }], step: 300, hold: 500 });
    span(tl, t - 700, A.sme, 'session-manager.e', 28, 296);
    cap(t, 'T1 → T2', 'A second firewall: only mTLS from T1 services reaches the internal tier');
    stage.shot(tl, t, SHOT.t2A, 1800);
    t = pk.travel(tl, t + 100, route([A.sC]), 1300, { cls: 'mtls' });
    fw2.pass(tl, t - 700, LANE.A);
    A.smc.activate(tl, t, 3200);
    t = stage.checklist(tl, t, { at: A.smc.top, title: 'SM-C', items: [{ t: 'Session record found' }, { t: 'Access token attached (never leaves T2)' }], step: 300, hold: 300 });
    pk.state_(tl, t - 400, 'mtls', 'POST /v1/payments', '+ bearer token');
    span(tl, t - 500, A.smc, 'session-manager.c', 36, 280);
    // Entitlements
    fly(stage, W, tl, t, [1080, -120, A.L - 60], [1080, -170, A.L - 250], { color: '#34D399', dur: 500, arc: -60 });
    A.pdp.activate(tl, t + 500, 1800);
    t = stage.checklist(tl, t + 500, { at: A.pdp.top, title: 'Entitlements PDP', items: [{ t: 'subject: client user' }, { t: 'action: payments:create' }, { t: 'resource: account ···4821' }], result: 'PERMIT', step: 260, hold: 400, dx: -290 });
    fly(stage, W, tl, t - 300, [1080, -170, A.L - 250], [1080, -120, A.L - 60], { color: '#34D399', dur: 500, arc: -60 });
    span(tl, t - 600, A.pdp, 'entitlements.pdp', 44, 9);
    cap(t, 'Workload', 'payments-api processes the request');
    t = pk.travel(tl, t, route([A.cW]), 1100, { cls: 'mtls' });
    A.wl.activate(tl, t, 2000);
    ring(stage, W, tl, t, [1800, -140, A.L], '#34D399', 220);
    tl.add(A.wl.pods.map(p => p.g), { y: [0, -14, 0], duration: 600, ease: 'inOutSine', delay: (el, i) => i * 120 }, t);
    span(tl, t, A.wl, 'payments-api', 58, 204);
    span(tl, t + 300, [1800, -200, A.L], 'ledger.write', 120, 64);
    t += 1600;
    // Response
    cap(t, 'Response', '201 Created travels back along the same path, one trace ID throughout');
    t = pk.state_(tl, t, 'ok', '201 Created', 'trace 4bf9…4736');
    stage.shot(tl, t, SHOT.overview, 3200, 'inOutSine');
    t = pk.travel(tl, t + 200, route([L.cA, L.aGA, A.gU, A.uS, A.sC, A.cW], true), 3600, { cls: 'ok', ease: 'inOutQuad' });
    tl.call(() => { client.screen.innerHTML = SCR.done; }, t);
    ring(stage, W, tl, t, [-1950, -200, 0], '#34D399', 260);
    t = pk.vanish(tl, t);
    cap(t, 'Observability', 'Every hop emitted a span, log and metric tagged with the same trace ID');
    t = stage.shot(tl, t, SHOT.obs, 2200);
    tl.add({}, { duration: 3000 }, t);
  }

  /* ---------- Chapter 2: TLS break, inspect, payload policy ---------- */
  function ch2(tl) {
    const A = R.A; base(tl, '9a1c33e0b6f24f7d8e21c4a0f5d3b812', 360);
    const cap = (p, s, x) => stage.caption.at(tl, p, s, x);
    const close = { x: -160, y: -170, z: A.L, rx: -20, ry: 22, d: 1300 };
    let t = 200;
    t = stage.shot(tl, t, close, 2200);
    cap(300, 'TLS break and inspect', 'Encrypted traffic arrives at Unified Ingress in T1');
    t = pk.appear(tl, t - 600, [-440, Y, A.L], 'tls', 'POST /v1/payments', 'TLS 1.3');
    t = pk.travel(tl, t, route([A.gU]), 900);
    A.uig.activate(tl, t, 5200);
    cap(t, 'Break', 'The TLS session terminates here so the payload can be inspected');
    t = pk.open(tl, t);
    const good = `POST /v1/payments
{
  <span class="hl">"amount": 2500.00,</span>
  "currency": "USD",
  "creditor": { "account": "···9130" },
  "reference": "INV-2231"
}`;
    cap(t, 'Inspect and validate', 'WAF and IPS signatures, then the OpenAPI schema and payload policy');
    t = stage.checklist(tl, t, { at: [-50, -150, A.L], title: 'Payload inspection', code: good, items: [{ t: 'Decrypt: TLS 1.3 terminated' }, { t: 'WAF / IPS: no signatures matched' }, { t: 'Schema: payments.create v3' }, { t: 'Policy: 1.2 KB, application/json, no unknown fields' }], result: 'PASS · re-encrypt (mTLS) to SM-E', step: 520, hold: 900, dx: 40, dy: -260 });
    span(tl, t - 900, A.uig, 'unified-ingress', 0, 22);
    cap(t, 'Re-encrypt', 'The request is re-wrapped in mTLS for the next hop');
    t = pk.seal(tl, t - 200, 'mtls');
    t = pk.travel(tl, t, route([A.uS]), 900, { cls: 'mtls' });
    t = pk.vanish(tl, t);
    // Bad payload
    cap(t, 'A malformed request', 'Same path, but the payload breaks the contract');
    tl.call(() => { A.uS.clear(); A.gU.clear(); }, t);
    t = pk2.appear(tl, t + 300, [-440, Y, A.L], 'tls', 'POST /v1/payments', 'TLS 1.3');
    t = pk2.travel(tl, t, route([A.gU]), 900);
    A.uig.activate(tl, t, 4800);
    t = pk2.open(tl, t);
    const bad = `POST /v1/payments
{
  <span class="bad">"amount": "2500.00",</span>
  "currency": "USD",
  "creditor": { "account": "···9130" },
  <span class="bad">"beneficiaryOverride": "···4471"</span>
}`;
    t = stage.checklist(tl, t, { at: [-50, -150, A.L], title: 'Payload inspection', code: bad, items: [{ t: 'Decrypt: TLS 1.3 terminated' }, { t: 'WAF / IPS: no signatures matched' }, { t: 'Schema: amount must be a number', s: 'fail' }, { t: 'Policy: unknown field beneficiaryOverride', s: 'fail' }], result: 'REJECT · 400 Bad Request', resultColor: '#FB7185', step: 520, hold: 700, dx: 40, dy: -260 });
    span(tl, t - 700, A.uig, 'unified-ingress', 30, 14, 'error', 'unified-ingress  400 schema_violation  trace=9a1c33e0');
    cap(t - 400, 'Rejected at the edge of T1', 'The request never reaches the session tier or the workload; the reject is logged with its trace ID');
    t = pk2.shatter(tl, t - 400);
    tl.call(() => A.gU.mark('bad'), t - 700);
    t = stage.shot(tl, t + 300, SHOT.obs, 2000);
    tl.add({}, { duration: 2500 }, t);
  }

  /* ---------- Chapter 3: failure and failover ---------- */
  function ch3(tl) {
    const B = R.B, A = R.A; base(tl, 'c07d5e21f98a4b0e93a6d1f2e8b74c55', 520);
    const cap = (p, s, x) => stage.caption.at(tl, p, s, x);
    let t = 300;
    cap(t, 'Failure and failover', 'Same request, but things are going wrong along the way');
    t = stage.shot(tl, t, SHOT.edge, 1800);
    t = pk.appear(tl, t, [-1880, -170, 0], 'tls', 'POST /v1/payments', 'trace c07d…4c55');
    span(tl, t, client, 'browser fetch', 0, 512);
    // Edge PoP failure
    t = popA.health(tl, t + 200, 'down');
    tl.call(() => L.cA.mark('dead'), t - 300);
    cap(t, 'Edge PoP failure', 'PoP 1 fails its health checks; Akamai steers the client to PoP 2');
    ring(stage, W, tl, t, popA.top, '#F43F5E', 240);
    t = pk.travel(tl, t + 300, route([L.cB]), 1400);
    popB.activate(tl, t, 1800);
    span(tl, t, popB, 'akamai.edge', 10, 492, 'warn', 'akamai.edge     reroute pop1→pop2  trace=c07d5e21');
    // Regional failover
    stage.shot(tl, t, SHOT.overview, 1800);
    t = A.uig.health(tl, t + 400, 'warn');
    t = A.uig.health(tl, t + 500, 'down');
    tl.call(() => { L.bGA.mark('dead'); A.gU.mark('dead'); }, t);
    ring(stage, W, tl, t, A.uig.top, '#F43F5E', 260);
    cap(t, 'Regional failover', 'Region A ingress is unhealthy; traffic fails over to the Region B cell');
    t = pk.travel(tl, t + 500, route([L.bGB, B.gU]), 1900);
    perimeter.pass(tl, t - 900, LANE.B);
    stage.shot(tl, t - 1200, SHOT.t1B, 1500);
    B.uig.activate(tl, t, 1400);
    t = pk.open(tl, t);
    span(tl, t, B.uig, 'unified-ingress', 24, 470);
    t = pk.seal(tl, t + 500, 'mtls');
    t = pk.travel(tl, t, route([B.uS]), 700, { cls: 'mtls' });
    B.sme.activate(tl, t, 1000);
    span(tl, t, B.sme, 'session-manager.e', 30, 460);
    stage.shot(tl, t, SHOT.t2B, 1600);
    t = pk.travel(tl, t + 300, route([B.sC]), 1200, { cls: 'mtls' });
    fw2.pass(tl, t - 650, LANE.B);
    B.smc.activate(tl, t, 1000);
    span(tl, t, B.smc, 'session-manager.c', 38, 452);
    // Workload error + retry
    const pod = i => [1800, -150, B.wl.pods[i].z];
    t = pk.travel(tl, t + 300, route([B.cW]), 1000, { cls: 'mtls' });
    t = pk.travel(tl, t, { pts: [[1745, Y, B.L], pod(0)] }, 400);
    tl.call(() => B.wl.pods[0].g.classList.add('err'), t);
    tl.add(B.wl.pods[0].g, { x: [0, -6, 6, -4, 0], duration: 400, ease: 'linear' }, t);
    ring(stage, W, tl, t, pod(0), '#F43F5E', 200);
    cap(t, 'Upstream error', 'The first payments-api pod returns 503');
    span(tl, t, [1800, -200, B.wl.pods[0].z], 'payments-api (pod 1)', 60, 40, 'error', 'payments-api     503 upstream  trace=c07d5e21');
    t = pk.state_(tl, t, 'bad', 'POST /v1/payments', '503 from pod 1');
    t = pk.travel(tl, t + 500, { pts: [pod(0), [1560, -150, B.L]] }, 600);
    cap(t, 'Resilient Routing and Retry', 'Ingress retries the idempotent request against a healthy pod');
    t = pk.state_(tl, t, 'mtls', 'POST /v1/payments', 'retry 1 · Idempotency-Key');
    t = pk.travel(tl, t + 200, { pts: [[1560, -150, B.L], pod(2)] }, 700);
    ring(stage, W, tl, t, pod(2), '#34D399', 200);
    tl.add(B.wl.pods[2].g, { y: [0, -14, 0], duration: 600, ease: 'inOutSine' }, t);
    span(tl, t, [1800, -200, B.wl.pods[2].z], 'payments-api (pod 3)', 110, 196, 'ok', 'payments-api     201 retry=1  trace=c07d5e21');
    t += 900;
    cap(t, 'Response', '201 Created returns through Region B and PoP 2; the client never saw an error');
    t = pk.state_(tl, t, 'ok', '201 Created', 'retry 1 · failover');
    stage.shot(tl, t, SHOT.overview, 3000, 'inOutSine');
    t = pk.travel(tl, t + 200, { pts: [pod(2), [1745, Y, B.L]] }, 300, { cls: 'ok' });
    t = pk.travel(tl, t, route([L.cB, L.bGB, B.gU, B.uS, B.sC, B.cW], true), 3400, { cls: 'ok', ease: 'inOutQuad' });
    tl.call(() => { client.screen.innerHTML = SCR.done; }, t);
    ring(stage, W, tl, t, [-1950, -200, 0], '#34D399', 260);
    t = pk.vanish(tl, t);
    t = stage.shot(tl, t, SHOT.obs, 2000);
    tl.add({}, { duration: 2500 }, t);
  }

  /* ---------- Chapter 4: session hijack (ATO) ---------- */
  function ch4(tl) {
    const A = R.A; base(tl, '7c1e0f4a2d9b4c63a8e5f10b3d2c9e77', 120);
    const cap = (p, s, x) => stage.caption.at(tl, p, s, x);
    tl.call(() => { client.screen.innerHTML = SCR.session; }, 0);
    let t = 300;
    cap(t, 'Account takeover attempt', 'A client user is signed in with a valid session');
    t = stage.shot(tl, t, SHOT.attack, 2000);
    tl.call(() => attacker.show(true), t - 800);
    tl.add(attacker.body, { y: [-500, 0], rotateY: [-90, 0], duration: 1000, ease: 'outBack(1.2)' }, t - 800);
    cap(t, 'Cookie theft', 'Infostealer malware on the client copies the session cookie to an attacker');
    const cookie = `<div class="fk-chip" style="--pc:#FB7185;transform:translate(-50%,-50%)">sid cookie</div>`;
    t = fly(stage, W, tl, t + 300, [-1950, -300, 0], [-1950, -300, 760], { html: cookie, dur: 1600, arc: -160 });
    ring(stage, W, tl, t, attacker.top, '#F43F5E', 220);
    cap(t, 'Replay', 'The attacker replays the stolen cookie from their own device');
    t = pk.appear(tl, t + 300, [-1880, -170, 760], 'attack', 'GET /v1/accounts', 'stolen cookie');
    t = pk.travel(tl, t, route([L.xA]), 1700);
    popA.activate(tl, t, 3000);
    t = stage.checklist(tl, t, { at: popA.top, title: 'Akamai edge · risk signals', items: [{ t: 'TLS 1.3: valid' }, { t: 'Device fingerprint: never seen', s: 'warn' }, { t: 'ASN: residential proxy network', s: 'warn' }, { t: 'Geo velocity: NJ to overseas in 4 min', s: 'warn' }], result: 'Risk 87 · forward with risk header', resultColor: '#FBBF24', step: 380, hold: 600 });
    span(tl, t - 900, popA, 'akamai.edge', 0, 11, 'warn', 'akamai.edge      risk=87 new-device  trace=7c1e0f4a');
    stage.shot(tl, t, SHOT.t1A, 2200);
    t = pk.travel(tl, t + 100, route([L.aGA, A.gU]), 1700);
    perimeter.pass(tl, t - 900, LANE.A);
    A.uig.activate(tl, t, 1400);
    span(tl, t, A.uig, 'unified-ingress', 12, 6);
    t = pk.travel(tl, t + 500, route([A.uS]), 700);
    A.sme.activate(tl, t, 3500);
    cap(t, 'Session binding', 'The cookie is genuine, but it is bound to a key the attacker does not have');
    t = stage.checklist(tl, t, { at: A.sme.top, title: 'SM-E', items: [{ t: 'JWS cookie signature (ES256) valid' }, { t: 'Session not expired' }, { t: 'DPoP proof: missing, key does not match', s: 'fail' }, { t: 'Edge risk 87 above threshold', s: 'fail' }], result: 'REJECT 401 · revoke session', resultColor: '#FB7185', step: 480, hold: 500 });
    span(tl, t - 700, A.sme, 'session-manager.e', 20, 4, 'error', 'session-manager.e 401 binding_mismatch  trace=7c1e0f4a');
    t = pk.shatter(tl, t - 300);
    tl.call(() => A.uS.mark('bad'), t - 600);
    // Revoke in SM-C
    stage.shot(tl, t - 400, SHOT.t2A, 1600);
    t = fly(stage, W, tl, t, [380, -220, A.L], [1080, -230, A.L], { color: '#F43F5E', dur: 900, arc: -120 });
    A.smc.activate(tl, t, 2000);
    tl.add(A.smc.body, { x: [0, -5, 5, 0], duration: 300 }, t);
    t = stage.checklist(tl, t, { at: A.smc.top, title: 'SM-C', items: [{ t: 'Session revoked', s: 'fail' }, { t: 'Tokens held in T2 invalidated', s: 'fail' }, { t: 'Security event raised with trace ID' }], step: 360, hold: 400 });
    span(tl, t - 600, A.smc, 'session-manager.c', 26, 3, 'error', 'session-manager.c revoke sid  reason=ato  trace=7c1e0f4a');
    t = stage.shot(tl, t, SHOT.obs, 1800);
    obs.alert(tl, t - 600, 'ATO attempt blocked<br><span style="font-size:30px;font-weight:500">session replay from a new device · session revoked · SOC notified</span>');
    tl.call(() => obs.log('SECURITY  ato.session_replay  sid revoked  trace=7c1e0f4a', '#FDA4AF'), t - 400);
    t += 2200;
    // Legitimate user steps up
    cap(t, 'Recovery', 'On the client’s next action, Sentry requires an AAL3 step-up with Stronghold');
    tl.call(() => { client.screen.innerHTML = SCR.stepup; phone.show(true); }, t);
    tl.add(phone.body, { y: [-300, 0], duration: 900, ease: 'outBack(1.3)' }, t);
    t = stage.shot(tl, t, focus(client, { dist: 1700, rx: -22, ry: 22, dx: 150, dz: -200 }), 2000);
    t = phone.health(tl, t, 'ok');
    ring(stage, W, tl, t, phone.top, '#34D399', 200);
    tl.call(() => { phone.screen.innerHTML = PHONE(true); }, t);
    t = fly(stage, W, tl, t + 200, [-1680, -200, 300], [-1950, -300, 0], { color: '#34D399', dur: 900, arc: -80 });
    tl.call(() => { client.screen.innerHTML = SCR.secured; }, t);
    ring(stage, W, tl, t, [-1950, -200, 0], '#34D399', 260);
    cap(t, 'Contained', 'Fresh device-bound session at AAL3; the stolen cookie is now worthless');
    tl.add({}, { duration: 3500 }, t);
  }

  const chapters = [
    { title: 'Happy path', build: ch1 },
    { title: 'TLS break and inspect', build: ch2 },
    { title: 'Failure and failover', build: ch3 },
    { title: 'Session hijack (ATO)', build: ch4 }
  ];
  stage.onReset(() => { client.screen.innerHTML = SCR.pay; R.A.wl.pods.concat(R.B.wl.pods).forEach(p => p.g.classList.remove('err')); phone.screen.innerHTML = PHONE(false); });
  stage.reset();
  const player = new Player(stage, document.getElementById('controls'), chapters);
  window.FK_PLAYER = player;
  const q = new URLSearchParams(location.search);
  if (q.has('ch')) { player.play(+q.get('ch') - 1, { autoplay: !q.has('t') }); if (q.has('t')) player.seek(+q.get('t')); }
  else player.play(0);
})();
