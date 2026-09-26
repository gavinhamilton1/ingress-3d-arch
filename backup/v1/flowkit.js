/*
 * FlowKit: a small kit for 3D architecture animations.
 * Built on anime.js v4 (timelines, tweens) and CSS 3D transforms.
 *
 * Coordinates: x right, y down (floor at y = 0, "up" is negative y), z towards the viewer.
 * Every timed helper takes (tl, pos, ...) and returns the time it finishes, so scripts can chain:
 *   let t = 0; t = packet.travel(tl, t, route, 1200); t = stage.checklist(tl, t, {...});
 */
(function (global) {
  const { animate, createTimeline, utils } = anime;
  const D2R = Math.PI / 180;

  /* ---------- DOM + geometry primitives ---------- */
  function el(tag, cls, parent, html) {
    const e = document.createElement(tag || 'div');
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function g(parent, x = 0, y = 0, z = 0, extra = '') {
    const n = el('div', 'fk-n', parent);
    n.style.transform = `translate3d(${x}px,${y}px,${z}px) ${extra}`;
    return n;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)))));
    return `rgb(${c.join(',')})`;
  }
  // Box centred at (x,y,z); "front" faces +z. faces: which faces to build (bottom rarely visible).
  function box(parent, { x = 0, y = 0, z = 0, w, h, d, c = '#1E293B', faces = 'front,back,left,right,top', cls = '', bg = {} }) {
    const b = el('div', 'fk-n ' + cls, parent);
    b.style.transform = `translate3d(${x}px,${y}px,${z}px)`;
    const defs = {
      front: [w, h, `translateZ(${d / 2}px)`, c],
      back: [w, h, `rotateY(180deg) translateZ(${d / 2}px)`, shade(c, -0.25)],
      right: [d, h, `rotateY(90deg) translateZ(${w / 2}px)`, shade(c, -0.18)],
      left: [d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, shade(c, -0.08)],
      top: [w, d, `rotateX(90deg) translateZ(${h / 2}px)`, shade(c, 0.12)],
      bottom: [w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, shade(c, -0.4)]
    };
    const out = { el: b };
    for (const k of faces.split(',')) {
      const [fw, fh, t, col] = defs[k];
      const f = el('div', 'fk-f f-' + k, b);
      f.style.cssText += `width:${fw}px;height:${fh}px;left:${-fw / 2}px;top:${-fh / 2}px;transform:${t};background:${bg[k] || col};`;
      out[k] = f;
    }
    return out;
  }
  function plane(parent, { w, h, t = '', bg = 'transparent', cls = '', two = false, html }) {
    const f = el('div', 'fk-f ' + cls + (two ? ' two' : ''), parent, html);
    f.style.cssText += `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;transform:${t};background:${bg};`;
    return f;
  }
  // Transform that stretches a z-aligned element of length L0 between points a and b
  function orient(a, b, L0 = 100) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz) || 0.001;
    const yaw = Math.atan2(dx, dz) / D2R, pitch = -Math.asin(dy / L) / D2R;
    return `translate3d(${(a[0] + b[0]) / 2}px,${(a[1] + b[1]) / 2}px,${(a[2] + b[2]) / 2}px) rotateY(${yaw}deg) rotateX(${pitch}deg) scale3d(1,1,${L / L0})`;
  }
  const lerp3 = (a, b, k) => [0, 1, 2].map(j => a[j] + (b[j] - a[j]) * k);
  const dist3 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  function pathFn(pts) {
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const len = dist3(pts[i], pts[i + 1]); segs.push({ a: pts[i], b: pts[i + 1], len, start: total }); total += len; }
    return {
      total,
      at(t) {
        const s = Math.max(0, Math.min(1, t)) * total;
        let i = segs.findIndex(q => s <= q.start + q.len); if (i < 0) i = segs.length - 1;
        const q = segs[i]; return { p: lerp3(q.a, q.b, q.len ? (s - q.start) / q.len : 0), i };
      }
    };
  }

  /* ---------- Stage: camera, render loop, overlays ---------- */
  class Stage {
    constructor(frame, { P = 1400 } = {}) {
      this.P = P;
      this.frame = frame; frame.classList.add('fk-frame');
      this.scaler = el('div', 'fk-scaler', frame);
      this.stageEl = el('div', 'fk-stage', this.scaler);
      this.world = el('div', 'fk-world', this.stageEl);
      this.ov = el('div', 'fk-ov', this.scaler);
      this.hud = el('div', 'fk-hud', this.scaler);
      this.dipEl = el('div', 'fk-dip', this.scaler);
      this.cam = { x: 0, y: 0, z: 0, rx: -20, ry: 0, d: 2000 };
      this.par = { x: 0, y: 0, tx: 0, ty: 0 };
      this.rx = this.cam.rx; this.ry = this.cam.ry;
      this.bbs = []; this.onFrame = []; this.resetters = [];
      const fit = () => { this.scaler.style.transform = `scale(${frame.clientWidth / 1280})`; };
      addEventListener('resize', fit); fit();
      frame.addEventListener('pointermove', e => { const r = frame.getBoundingClientRect(); this.par.tx = (e.clientX - r.left) / r.width - .5; this.par.ty = (e.clientY - r.top) / r.height - .5; });
      frame.addEventListener('pointerleave', () => { this.par.tx = 0; this.par.ty = 0; });
      this.caption = new Caption(this);
      this.render = this.render.bind(this);
      requestAnimationFrame(this.render);
    }
    project(p) {
      let [x, y, z] = p;
      x -= this.cam.x; y -= this.cam.y; z -= this.cam.z;
      const b = this.ry * D2R; [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
      const a = this.rx * D2R; [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
      z += this.P - this.cam.d;
      const s = this.P / (this.P - z);
      return { x: 640 + x * s, y: 360 + y * s, s, z };
    }
    // A billboard always faces the camera. screen: true draws it in the 2D overlay (crisp, never occluded).
    billboard(parent, html, { screen = false, cls = '', p = [0, 0, 0], scale = false } = {}) {
      const e = el('div', 'fk-bb ' + cls, screen ? this.ov : parent, html);
      const b = { el: e, p, screen, scale };
      this.bbs.push(b); return b;
    }
    removeBillboard(b) { b.el.remove(); const i = this.bbs.indexOf(b); if (i >= 0) this.bbs.splice(i, 1); }
    render() {
      const p = this.par; p.x += (p.tx - p.x) * .06; p.y += (p.ty - p.y) * .06;
      this.rx = this.cam.rx + p.y * 4; this.ry = this.cam.ry - p.x * 8;
      this.world.style.transform = `translateZ(${this.P - this.cam.d}px) rotateX(${this.rx}deg) rotateY(${this.ry}deg) translate3d(${-this.cam.x}px,${-this.cam.y}px,${-this.cam.z}px)`;
      for (const f of this.onFrame) f(this);
      for (const b of this.bbs) {
        const P = typeof b.p === 'function' ? b.p() : b.p;
        if (b.screen) {
          const q = this.project(P);
          if (q.z > this.P - 40) { b.el.style.visibility = 'hidden'; continue; }
          b.el.style.visibility = '';
          const s = b.scale ? Math.max(.55, Math.min(1.4, q.s)) : 1;
          b.el.style.transform = `translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px) scale(${s.toFixed(3)})`;
        } else {
          b.el.style.transform = `translate3d(${P[0]}px,${P[1]}px,${P[2]}px) rotateY(${-this.ry}deg) rotateX(${-this.rx}deg)`;
        }
      }
      requestAnimationFrame(this.render);
    }
    setCam(s) { Object.assign(this.cam, s); }
    // Camera move. from: optional shot to start from (use after a cut).
    shot(tl, pos, s, dur = 1500, ease = 'inOutCubic', from) {
      const p = {};
      for (const k in s) p[k] = from ? [from[k], s[k]] : s[k];
      tl.add(this.cam, { ...p, duration: dur, ease }, pos);
      return pos + dur;
    }
    dip(tl, pos, fn, { out = 300, hold = 60, back = 600 } = {}) {
      tl.add(this.dipEl, { opacity: [0, 1], duration: out, ease: 'inQuad' }, pos);
      tl.call(fn, pos + out + 10);
      tl.add(this.dipEl, { opacity: [1, 0], duration: back, ease: 'outQuad' }, pos + out + hold);
      return pos + out + hold + back;
    }
    // Floating panel anchored to a 3D point; items tick in one by one.
    checklist(tl, pos, { at, title, items, step = 420, hold = 1600, result, resultColor = '#34D399', dx = 30, dy = -20, code }) {
      let b = null; const rows = [];
      tl.call(() => {
        const html = `<div class="fk-panel" style="transform:translate(${dx}px,${dy}px)"><h4>${title}</h4>` +
          (code ? `<pre>${code}</pre>` : '') +
          items.map(it => `<div class="it ${it.s || 'pass'}"><b>${it.s === 'fail' ? '&#10005;' : it.s === 'warn' ? '!' : '&#10003;'}</b><span>${it.t}</span></div>`).join('') +
          (result ? `<div class="res" style="color:${resultColor}">${result}</div>` : '') + `</div>`;
        b = this.billboard(null, html, { screen: true, p: at });
        rows.push(...b.el.querySelectorAll('.it, .res'));
        animate(b.el.firstChild, { opacity: [0, 1], y: [dy + 10, dy], duration: 300, ease: 'outQuad' });
      }, pos);
      const n = items.length + (result ? 1 : 0);
      for (let i = 0; i < n; i++) tl.call(() => rows[i] && rows[i].classList.add('on'), pos + 250 + i * step);
      const end = pos + 250 + n * step + hold;
      tl.call(() => { if (b) { const bb = b; animate(bb.el.firstChild, { opacity: 0, duration: 250, onComplete: () => this.removeBillboard(bb) }); } }, end);
      this.resetters.push(() => { if (b) this.removeBillboard(b); b = null; rows.length = 0; });
      return end + 250;
    }
    onReset(fn) { this.resetters.push(fn); }
    reset() { this.resetters.forEach(f => f()); }
  }

  class Caption {
    constructor(stage) {
      this.el = el('div', 'fk-caption', stage.hud, '<div class="st"></div><div class="tx"></div>');
      this.st = this.el.querySelector('.st'); this.tx = this.el.querySelector('.tx');
    }
    set(step, text) { this.st.textContent = step; this.tx.textContent = text; }
    at(tl, pos, step, text) {
      tl.call(() => animate(this.el, { opacity: [1, 0], y: [0, 6], duration: 160, ease: 'inQuad', onComplete: () => {
        this.set(step, text); animate(this.el, { opacity: [0, 1], y: [6, 0], duration: 300, ease: 'outQuad' });
      } }), pos);
      return pos;
    }
  }

  /* ---------- Trace panel (observability) ---------- */
  class Trace {
    constructor(stage, { total = 400 } = {}) {
      this.stage = stage; this.total = total;
      this.el = el('div', 'fk-trace', stage.hud, `<h4><span>Distributed trace</span><span class="n">0 spans</span></h4><div class="tid"></div><div class="rows"></div>`);
      this.rows = this.el.querySelector('.rows'); this.count = this.el.querySelector('.n'); this.tid = this.el.querySelector('.tid');
      stage.onReset(() => this.clear());
    }
    clear() { this.rows.innerHTML = ''; this.count.textContent = '0 spans'; this.n = 0; }
    begin(tl, pos, { id, total = 400 }) { tl.call(() => { this.clear(); this.total = total; this.tid.textContent = 'traceparent 00-' + id + '-01'; }, pos); return pos; }
    add({ svc, start, dur, status = 'ok' }) {
      const W = 100 / this.total;
      const r = el('div', 'row', this.rows, `<div class="svc">${svc}</div><div class="lane"><div class="bar ${status === 'error' ? 'err' : status === 'warn' ? 'warn' : ''}" style="left:${start * W}%;width:${Math.max(1.5, dur * W)}%"></div></div><div class="ms ${status === 'error' ? 'err' : ''}">${status === 'error' ? 'ERR' : dur + 'ms'}</div>`);
      animate(r, { opacity: [0, 1], x: [12, 0], duration: 300, ease: 'outQuad' });
      this.n = (this.n || 0) + 1; this.count.textContent = this.n + ' spans';
      while (this.rows.children.length > 14) this.rows.firstChild.remove();
    }
  }

  /* ---------- Observability wall ---------- */
  class ObsWall {
    constructor(stage, parent, { x = 0, y = -700, z = -1500, w = 2600, h = 620, title = 'Observability' } = {}) {
      this.stage = stage; this.pos = [x, y, z]; this.w = w; this.h = h;
      const f = plane(parent, { w, h, t: `translate3d(${x}px,${y}px,${z}px)`, bg: 'linear-gradient(180deg, rgba(30,27,75,.85), rgba(15,23,42,.85))', two: true });
      f.style.border = '2px solid rgba(167,139,250,.55)'; f.style.borderRadius = '18px'; f.style.boxShadow = '0 0 60px rgba(139,92,246,.25)';
      f.innerHTML = `<div style="position:absolute;left:40px;top:28px;font:700 64px system-ui;color:#DDD6FE;letter-spacing:.06em">${title}</div>
        <div style="position:absolute;left:40px;top:112px;font:30px system-ui;color:#A5B4FC">traces · logs · metrics · one trace ID across every hop</div>
        <div class="kpis" style="position:absolute;left:40px;top:180px;display:flex;gap:22px"></div>
        <div class="spark" style="position:absolute;left:40px;bottom:40px;width:${w * .42}px;height:150px;display:flex;align-items:flex-end;gap:6px"></div>
        <div class="logs" style="position:absolute;right:40px;top:40px;width:${w * .5}px;bottom:40px;font:30px/1.5 ui-monospace,Menlo,monospace;color:#C7D2FE;overflow:hidden"></div>
        <div class="alert" style="position:absolute;left:40px;top:180px;right:${w * .54}px;height:220px;border-radius:14px;background:rgba(60,9,24,.97);border:2px solid #F43F5E;color:#FECDD3;font:700 44px system-ui;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 20px"></div>`;
      this.el = f; this.logs = f.querySelector('.logs'); this.alertEl = f.querySelector('.alert');
      this.kpi = {};
      for (const [k, label] of [['req', 'Requests'], ['err', 'Errors'], ['p95', 'p95 latency']]) {
        const t = el('div', '', f.querySelector('.kpis'), `<div style="font:28px system-ui;color:#A5B4FC">${label}</div><div class="v" style="font:700 72px system-ui;color:#F5F3FF">0</div>`);
        t.style.cssText = 'width:390px;height:220px;border-radius:14px;background:rgba(99,102,241,.14);border:1px solid rgba(165,180,252,.3);padding:18px 22px;box-sizing:border-box';
        this.kpi[k] = t.querySelector('.v');
      }
      const sp = f.querySelector('.spark');
      this.bars = Array.from({ length: 28 }, () => { const b = el('div', '', sp); b.style.cssText = `flex:1;background:#8B5CF6;border-radius:4px 4px 0 0;height:${20 + Math.random() * 60}%`; return b; });
      animate(this.bars, { height: () => (15 + Math.random() * 80) + '%', duration: 1400, ease: 'inOutSine', loop: true, loopDelay: 200, onLoop: a => a.refresh() });
      stage.onReset(() => this.clear());
      this.clear();
    }
    clear() { this.logs.innerHTML = ''; this.alertEl.style.display = 'none'; this.metrics = { req: 1284, err: 3, p95: 212 }; this.paint(); }
    paint() { this.kpi.req.textContent = this.metrics.req.toLocaleString(); this.kpi.err.textContent = this.metrics.err; this.kpi.p95.textContent = this.metrics.p95 + ' ms'; this.kpi.err.style.color = this.metrics.err > 3 ? '#FDA4AF' : '#F5F3FF'; }
    log(line, color = '#C7D2FE') {
      const l = el('div', '', null, line); l.style.color = color; l.style.whiteSpace = 'nowrap';
      this.logs.prepend(l); while (this.logs.children.length > 16) this.logs.lastChild.remove();
      animate(l, { opacity: [0, 1], x: [-20, 0], duration: 300 });
    }
    alert(tl, pos, text) { tl.call(() => { this.alertEl.innerHTML = text; this.alertEl.style.display = 'flex'; animate(this.alertEl, { opacity: [0, 1, .5, 1, .6, 1], duration: 1400, ease: 'linear' }); }, pos); return pos; }
    bump(k, v) { this.metrics[k] += v; this.paint(); }
  }

  /* ---------- Devices ---------- */
  class Device {
    constructor(stage, parent, o) {
      this.stage = stage; this.o = o;
      const { x = 0, z = 0, kind = 'rack', w = 120, h = 200, d = 110, color = '#1E293B', label = '', sub = '', led = '#34D399', accent = '#38BDF8' } = o;
      this.x = x; this.z = z; this.h = h;
      this.g = g(parent, x, 0, z); this.g.classList.add('fk-dev');
      this.g.style.setProperty('--led', led); this.g.style.setProperty('--accent', accent);
      this.body = el('div', 'fk-n', this.g);       // anime target (shake, drop, pulse)
      plane(this.body, { w: w * 2.2, h: d * 2.2, t: 'translateY(-1px) rotateX(90deg)', cls: 'fk-glow', bg: 'radial-gradient(closest-side, var(--led), transparent)' });
      const build = Device.kinds[kind] || Device.kinds.rack;
      const top = build.call(this, this.body, { w, h, d, color, accent, o });
      this.topY = -(top || h);
      this.labelBB = stage.billboard(null, `<div class="fk-label"><i></i><span class="nm">${label}</span><span class="sub">${sub}</span></div>`, { screen: true, p: [x, this.topY - 24, z] });
      this.labelEl = this.labelBB.el.firstChild;
      this.labelEl.style.setProperty('--led', led);
      this.led0 = led;
      stage.onReset(() => this.reset());
    }
    get top() { return [this.x, this.topY, this.z]; }
    port(dx = 0, dy = -50, dz = 0) { return [this.x + dx, dy, this.z + dz]; }
    reset() { this.setLed(this.led0); this.g.classList.remove('down'); this.labelEl.classList.remove('active', 'dim'); this.g.style.display = this.o.hidden ? 'none' : ''; this.labelBB.el.style.display = this.o.hidden ? 'none' : ''; }
    show(v) { this.g.style.display = v ? '' : 'none'; this.labelBB.el.style.display = v ? '' : 'none'; }
    setLed(c) { this.g.style.setProperty('--led', c); this.labelEl.style.setProperty('--led', c); }
    health(tl, pos, state) {
      const c = { ok: '#34D399', warn: '#FBBF24', down: '#F43F5E' }[state];
      tl.call(() => { this.setLed(c); this.g.classList.toggle('down', state === 'down'); }, pos);
      if (state === 'down') tl.add(this.body, { x: [0, -8, 8, -6, 6, 0], duration: 500, ease: 'linear' }, pos);
      return pos + 500;
    }
    // Highlight while a request is here: pulse + expanded label
    activate(tl, pos, dur = 1200) {
      tl.call(() => this.labelEl.classList.add('active'), pos);
      tl.add(this.body, { scale: [1, 1.06, 1], duration: 500, ease: 'inOutSine' }, pos);
      tl.call(() => this.labelEl.classList.remove('active'), pos + dur);
      return pos;
    }
  }
  Device.kinds = {
    rack(p, { w, h, d, color }) {
      const b = box(p, { y: -h / 2, w, h, d, c: color });
      b.front.innerHTML = `<div class="fk-slots"></div><div class="fk-ledstrip" style="left:10px;top:10px;bottom:10px"></div><div class="fk-ledstrip" style="right:10px;top:18px;bottom:10px"></div>`;
      b.top.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
      return h;
    },
    gateway(p, { w, h, d, color, o }) {
      const u = h / 3;
      for (let i = 0; i < 3; i++) {
        const b = box(p, { y: -u * (i + .5) - i * 4, w, h: u, d, c: color });
        b.front.innerHTML = `<div class="fk-ledstrip" style="left:12px;top:8px;height:${u - 16}px"></div><div style="position:absolute;right:14px;top:${u / 2 - 3}px;width:${w * .45}px;height:6px;border-radius:3px;background:var(--accent);opacity:.7"></div>`;
      }
      if (o.icon) { const ic = plane(p, { w: 70, h: 70, t: `translate3d(0,${-h - 60}px,0)`, two: true, html: o.icon }); ic.style.filter = 'drop-shadow(0 0 8px var(--accent))'; }
      return h + (o.icon ? 100 : 12);
    },
    laptop(p, { color, o }) {
      box(p, { y: -60, w: 240, h: 120, d: 170, c: '#1E293B' });
      box(p, { y: -124, z: 10, w: 170, h: 8, d: 110, c: color });
      const hinge = g(p, 0, -128, -45, 'rotateX(-12deg)');
      const lid = box(hinge, { y: -55, w: 170, h: 110, d: 6, c: color, faces: 'front,back,left,right,top' });
      lid.front.innerHTML = `<div class="scr" style="position:absolute;inset:6px;background:#F8FAFC;border-radius:3px;overflow:hidden;color:#0F172A;font:9px system-ui">${o.screen || ''}</div>`;
      this.screen = lid.front.querySelector('.scr');
      return 250;
    },
    pods(p, { color, o }) {
      const n = o.count || 3, gap = o.gap || 110;
      this.pods = [];
      for (let i = 0; i < n; i++) {
        const pg = g(p, 0, 0, (i - (n - 1) / 2) * gap), inner = el('div', 'fk-n', pg);
        const b = box(inner, { y: -45, w: 70, h: 90, d: 70, c: color });
        b.top.innerHTML = `<div style="position:absolute;inset:12px;border-radius:50%;border:3px solid var(--accent)"></div>`;
        b.front.innerHTML = `<div class="fk-ledstrip" style="left:32px;top:10px;height:70px"></div>`;
        this.pods.push({ g: inner, z: this.z + (i - (n - 1) / 2) * gap, front: b.front, top: b.top });
      }
      box(p, { y: -4, w: 110, h: 8, d: gap * (n - 1) + 110, c: '#0F172A' });
      return 120;
    },
    phone(p, { color }) {
      box(p, { y: -50, w: 120, h: 100, d: 120, c: '#1E293B' });
      const s = g(p, 0, -100, 10, 'rotateX(-10deg)');
      const b = box(s, { y: -80, w: 84, h: 160, d: 8, c: color });
      b.front.style.borderRadius = '12px';
      b.front.innerHTML = `<div class="scr" style="position:absolute;inset:5px;background:#0F172A;border-radius:9px;overflow:hidden;color:#E2E8F0;font:9px system-ui;text-align:center"></div>`;
      this.screen = b.front.querySelector('.scr');
      return 285;
    }
  };

  /* ---------- Zones, walls ---------- */
  function zone(stage, parent, { x1, x2, z1, z2, color = '#38BDF8', label = '', sub = '', alpha = .08, labelAt = 'front' }) {
    const w = x2 - x1, d = z2 - z1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const rgb = parseInt(color.slice(1), 16), rgba = a => `rgba(${rgb >> 16},${(rgb >> 8) & 255},${rgb & 255},${a})`;
    const b = box(parent, { x: cx, y: -3, z: cz, w, h: 6, d, c: color, faces: 'top,front,right,left',
      bg: { top: rgba(alpha), front: rgba(.5), right: rgba(.35), left: rgba(.35) } });
    b.top.style.border = `2px solid ${rgba(.55)}`; b.top.style.borderRadius = '6px';
    if (label) {
      const t = plane(parent, { w: 900, h: 110, t: `translate3d(${x1 + 450 + 24}px,-7px,${z2 - 70}px) rotateX(90deg)`, html: `<div class="fk-zlabel" style="color:${rgba(.85)}">${label}${sub ? `<small>${sub}</small>` : ''}</div>` });
      t.style.pointerEvents = 'none';
    }
    return b;
  }
  class Wall {
    constructor(stage, parent, { x, z1, z2, h = 260, lanes = [], gap = 170, color = '#FBBF24', label = '' }) {
      this.x = x; this.gates = {}; this.color = color;
      const rgb = parseInt(color.slice(1), 16), rgba = a => `rgba(${rgb >> 16},${(rgb >> 8) & 255},${rgb & 255},${a})`;
      this.rgba = rgba;
      const bg = `repeating-linear-gradient(90deg, ${rgba(.28)} 0 2px, transparent 2px 26px), repeating-linear-gradient(0deg, ${rgba(.28)} 0 2px, transparent 2px 26px), ${rgba(.07)}`;
      const edges = [z1, ...lanes.flatMap(l => [l - gap / 2, l + gap / 2]), z2];
      this.panels = [];
      for (let i = 0; i < edges.length; i += 2) {
        const a = edges[i], b = edges[i + 1]; if (b - a < 2) continue;
        const pl = plane(parent, { w: b - a, h, t: `translate3d(${x}px,${-h / 2}px,${(a + b) / 2}px) rotateY(90deg)`, bg, two: true });
        pl.style.borderTop = `3px solid ${rgba(.8)}`; this.panels.push(pl);
      }
      for (const l of lanes) {
        const hinge = g(parent, x, 0, l - gap / 2), door = el('div', 'fk-n', hinge);
        const pl = plane(door, { w: gap, h: h * .8, t: `translate3d(0,${-h * .4}px,${gap / 2}px) rotateY(90deg)`, bg: rgba(.22), two: true });
        pl.style.border = `2px solid ${rgba(.9)}`;
        this.gates[l] = { door, pl };
      }
      if (label) stage.billboard(null, `<div class="fk-label" style="border-color:${rgba(.6)};--led:${color}"><i></i>${label}</div>`, { screen: true, p: [x, -h - 20, z1 + 60] });
      stage.onReset(() => Object.values(this.gates).forEach(q => { q.pl.style.background = rgba(.22); }));
    }
    pass(tl, pos, lane, hold = 900) {
      const q = this.gates[lane];
      tl.call(() => { q.pl.style.background = 'rgba(52,211,153,.35)'; }, pos);
      tl.add(q.door, { rotateY: [0, -82], duration: 350, ease: 'outQuad' }, pos);
      tl.add(q.door, { rotateY: [-82, 0], duration: 450, ease: 'inOutQuad' }, pos + hold);
      tl.call(() => { q.pl.style.background = this.rgba(.22); }, pos + hold + 450);
      return pos + 350;
    }
    deny(tl, pos, lane) {
      const q = this.gates[lane];
      tl.call(() => { q.pl.style.background = 'rgba(244,63,94,.5)'; }, pos);
      tl.add(q.door, { x: [0, -6, 6, -4, 0], duration: 400, ease: 'linear' }, pos);
      tl.call(() => { q.pl.style.background = this.rgba(.22); }, pos + 1400);
      return pos + 400;
    }
  }

  /* ---------- Links (cables) ---------- */
  class Link {
    constructor(stage, parent, pts, { t = 8 } = {}) {
      this.pts = pts; this.segs = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const s = el('div', 'fk-n fk-link', parent);
        s.style.transform = orient(pts[i], pts[i + 1]);
        plane(s, { w: t, h: 100, t: 'rotateX(90deg)', two: true });
        plane(s, { w: 100, h: t, t: 'rotateY(90deg)', two: true });
        this.segs.push(s);
      }
      stage.onReset(() => this.clear());
    }
    clear() { this.segs.forEach(s => s.classList.remove('lit', 'mtls', 'ok', 'bad', 'dead')); }
    mark(cls) { this.segs.forEach(s => s.classList.add(cls)); }
  }
  // Build a route through several links; reverse for responses.
  function route(links, reverse = false) {
    let pts = [], segs = [];
    const ls = reverse ? [...links].reverse() : links;
    for (const l of ls) {
      const p = reverse ? [...l.pts].reverse() : l.pts, s = reverse ? [...l.segs].reverse() : l.segs;
      if (pts.length && dist3(pts[pts.length - 1], p[0]) < 1) { pts.push(...p.slice(1)); } else if (pts.length) { pts.push(...p); segs.push(null); } else pts.push(...p);
      segs.push(...s);
    }
    return { pts, segs };
  }

  /* ---------- Packet: 3D cube with a glowing core and a label chip ---------- */
  const LOCK = c => `<svg width="10" height="12" viewBox="0 0 10 12"><rect x="0.5" y="5" width="9" height="6.5" rx="1.2" fill="${c}"/><path d="M2.3 5V3.4a2.7 2.7 0 0 1 5.4 0V5" fill="none" stroke="${c}" stroke-width="1.4"/></svg>`;
  const UNLOCK = c => `<svg width="10" height="12" viewBox="0 0 10 12"><rect x="0.5" y="5" width="9" height="6.5" rx="1.2" fill="${c}"/><path d="M2.3 5V3.4a2.7 2.7 0 0 1 5.3-.6" fill="none" stroke="${c}" stroke-width="1.4"/></svg>`;
  const COLORS = { tls: '#38BDF8', mtls: '#A78BFA', open: '#FBBF24', ok: '#34D399', bad: '#F43F5E', attack: '#FB7185' };
  class Packet {
    constructor(stage, parent, { size = 36, text = '', sub = '' } = {}) {
      this.stage = stage; this.size = size; this.p = [0, -60, 0];
      this.g = el('div', 'fk-n', parent);
      this.spin = el('div', 'fk-n', this.g);
      this.faces = [];
      const s = size, tf = ['', 'rotateY(180deg)', 'rotateY(90deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)'];
      for (const t of tf) {
        const w = g(this.spin, 0, 0, 0, t), f = el('div', 'fk-n', w);
        const pl = plane(f, { w: s, h: s, t: `translateZ(${s / 2}px)`, two: true });
        pl.style.borderRadius = '6px';
        this.faces.push({ f, pl });
      }
      this.core = stage.billboard(this.g, '', { p: [0, 0, 0] });
      this.chip = stage.billboard(null, '', { screen: true, p: () => [this.p[0], this.p[1] - s - 6, this.p[2]] });
      this.text = text; this.sub = sub;
      this.spinAnim = animate(this.spin, { rotateY: [0, 360], rotateX: [15, 15], duration: 3600, ease: 'linear', loop: true });
      stage.onFrame.push(() => { this.g.style.transform = `translate3d(${this.p[0]}px,${this.p[1]}px,${this.p[2]}px)`; });
      stage.onReset(() => { this.hide(); this.setState('tls'); this.faces.forEach(q => { q.f.style.transform = ''; q.f.style.opacity = ''; }); });
      this.setState('tls'); this.hide();
    }
    setState(s, text, sub) {
      this.state = s; if (text != null) this.text = text; if (sub != null) this.sub = sub;
      const c = COLORS[s] || s;
      for (const q of this.faces) { q.pl.style.background = `${c}33`; q.pl.style.border = `2px solid ${c}`; q.pl.style.boxShadow = `0 0 14px ${c}88, inset 0 0 12px ${c}55`; }
      this.core.el.innerHTML = `<div style="width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,${c} 60%);box-shadow:0 0 18px 4px ${c}"></div>`;
      const locked = s === 'tls' || s === 'mtls';
      this.chip.el.innerHTML = `<div class="fk-chip" style="--pc:${c}">${locked ? LOCK(c) : UNLOCK(c)}<span>${this.text}</span>${this.sub ? `<small>${this.sub}</small>` : ''}</div>`;
    }
    state_(tl, pos, s, text, sub) { tl.call(() => this.setState(s, text, sub), pos); return pos; }
    show() { this.g.style.display = ''; this.chip.el.style.display = ''; }
    hide() { this.g.style.display = 'none'; this.chip.el.style.display = 'none'; }
    at(p) { this.p = [...p]; }
    appear(tl, pos, p, s = 'tls', text, sub) {
      tl.call(() => { this.at(p); this.setState(s, text, sub); this.faces.forEach(q => { q.f.style.transform = ''; q.f.style.opacity = ''; }); this.show(); }, pos);
      tl.add(this.spin, { scale: [0, 1], duration: 400, ease: 'outBack(1.6)' }, pos);
      return pos + 400;
    }
    vanish(tl, pos) { tl.add(this.spin, { scale: [1, 0], duration: 250, ease: 'inQuad' }, pos); tl.call(() => this.hide(), pos + 260); return pos + 260; }
    // Move along a route ({pts, segs}) lighting the link segments it passes
    travel(tl, pos, r, dur, { cls = 'lit', ease = 'inOutSine' } = {}) {
      const path = pathFn(r.pts), prog = { t: 0 };
      tl.add(prog, { t: [0, 1], duration: dur, ease, onUpdate: () => {
        const { p, i } = path.at(prog.t); this.p = p;
        if (r.segs) r.segs.forEach((s, k) => { if (s) { if (k <= i && !s.classList.contains(cls)) { s.classList.remove('lit', 'mtls', 'ok', 'bad'); s.classList.add(cls); } } });
      } }, pos);
      return pos + dur;
    }
    // TLS break: the cube opens up so the payload can be inspected
    open(tl, pos) {
      this.state_(tl, pos, 'open');
      tl.add(this.faces.map(q => q.f), { z: [0, 26], duration: 450, ease: 'outBack(1.4)' }, pos);
      return pos + 450;
    }
    seal(tl, pos, s = 'mtls', text, sub) {
      tl.add(this.faces.map(q => q.f), { z: [26, 0], duration: 400, ease: 'inBack(1.4)' }, pos);
      this.state_(tl, pos + 380, s, text, sub);
      return pos + 400;
    }
    shatter(tl, pos) {
      this.state_(tl, pos, 'bad');
      tl.add(this.faces.map(q => q.f), { z: () => 80 + Math.random() * 120, opacity: [1, 0], duration: 700, ease: 'outCubic' }, pos + 150);
      tl.call(() => { const c = this.core.el.firstChild; if (c) animate(c, { scale: [1, 2.5], opacity: [1, 0], duration: 500 }); }, pos + 150);
      tl.call(() => this.hide(), pos + 900);
      return pos + 900;
    }
  }

  /* ---------- Effects ---------- */
  function ring(stage, parent, tl, pos, p, color = '#38BDF8', size = 140) {
    let b = null;
    const kill = () => { if (b) { stage.removeBillboard(b); b = null; } };
    tl.call(() => {
      kill();
      b = stage.billboard(parent, `<div style="width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;border:3px solid ${color};box-shadow:0 0 16px ${color}"></div>`, { p });
      animate(b.el.firstChild, { scale: [.15, 1.6], opacity: [1, 0], duration: 900, ease: 'outQuad', onComplete: kill });
    }, pos);
    stage.onReset(kill);
    return pos;
  }
  // Small token flying from a to b (spans to the obs wall, cookies to an attacker...)
  function fly(stage, parent, tl, pos, a, b, { color = '#A78BFA', dur = 900, size = 10, arc = -200, html, onArrive } = {}) {
    let d = null; const o = { t: 0 };
    const kill = () => { if (d) { stage.removeBillboard(d); d = null; } };
    tl.call(() => { kill(); d = stage.billboard(parent, html || `<div style="width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;background:${color};box-shadow:0 0 10px 2px ${color}"></div>`, { p: [...a] }); }, pos);
    tl.add(o, { t: [0, 1], duration: dur, ease: 'inOutSine', onUpdate: () => {
      if (!d) return; const p = lerp3(a, b, o.t); p[1] += arc * Math.sin(Math.PI * o.t); d.p = p;
    } }, pos);
    tl.call(() => { kill(); onArrive && onArrive(); }, pos + dur);
    stage.onReset(kill);
    return pos + dur;
  }

  /* ---------- Player: chapters, controls ---------- */
  class Player {
    constructor(stage, host, chapters, { onBuild } = {}) {
      this.stage = stage; this.chapters = chapters; this.tl = null; this.idx = -1; this.all = false;
      const bar = el('div', 'fk-bar', host);
      this.btns = chapters.map((c, i) => { const b = el('button', '', bar, `${i + 1}. ${c.title}`); b.onclick = () => { this.all = false; this.play(i); }; return b; });
      el('div', 'sp', bar);
      const all = el('button', '', bar, 'Play all'); all.onclick = () => { this.all = true; this.play(0); };
      this.pp = el('button', '', bar, 'Pause'); this.pp.onclick = () => this.toggle();
      const rs = el('button', '', bar, 'Restart'); rs.onclick = () => this.play(Math.max(0, this.idx));
      this.prog = el('div', 'fk-prog', host, '<div></div>').firstChild;
      stage.onFrame.push(() => { if (this.tl) this.prog.style.width = (this.tl.progress * 100).toFixed(2) + '%'; });
    }
    play(i, { autoplay = true } = {}) {
      if (this.tl) { this.tl.pause(); this.tl.revert(); }
      this.stage.reset();
      this.idx = i; this.btns.forEach((b, k) => b.classList.toggle('on', k === i));
      const tl = createTimeline({ autoplay: false });
      this.chapters[i].build(tl);
      tl.onComplete = () => { if (this.all && this.idx < this.chapters.length - 1) setTimeout(() => this.play(this.idx + 1), 1200); };
      this.tl = tl; this.pp.textContent = 'Pause';
      if (autoplay) tl.play();
      return tl;
    }
    toggle() { if (!this.tl) return; if (this.tl.paused) { this.tl.resume(); this.pp.textContent = 'Pause'; } else { this.tl.pause(); this.pp.textContent = 'Resume'; } }
    // Debug: jump to a moment (fires callbacks in order)
    seek(ms) { this.tl.pause(); for (let t = 0; t <= ms; t += 100) this.tl.seek(t); this.tl.seek(ms); }
  }

  global.FlowKit = { el, g, box, plane, orient, pathFn, lerp3, route, shade, Stage, Trace, ObsWall, Device, Wall, Link, Packet, zone, ring, fly, Player, COLORS };
})(window);
