/*
 * FlowKit: a small kit for 3D architecture animations (CSS 3D transforms, no dependencies).
 *
 * Coordinates: x right, y down (floor at y = 0, "up" is negative y), z towards the viewer.
 *
 * Time model: a Timeline is a set of tracks. Every track is a pure function of time, so the
 * scene can be scrubbed forwards and backwards, played in reverse or in slow motion and always
 * shows exactly the same frame for the same time. Nothing is fire-and-forget.
 *   tl.add(target, {prop: to | [from, to] | [k0, k1, k2...], duration, ease, delay}, pos)  continuous tween
 *   tl.set(target, key, pos, value, apply, init)                                             step value
 *   tl.mark(pos, step, text)                                                                 scrubber marker
 * Every timed helper takes (tl, pos, ...) and returns the time it finishes, so scripts chain:
 *   let t = 0; t = packet.travel(tl, t, route, 1200); t = stage.checklist(tl, t, {...});
 */
(function (global) {
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- easing ---------- */
  const EASES = {
    linear: k => k,
    inQuad: k => k * k,
    outQuad: k => 1 - (1 - k) * (1 - k),
    inOutQuad: k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
    inCubic: k => k * k * k,
    outCubic: k => 1 - Math.pow(1 - k, 3),
    inOutCubic: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
    outSine: k => Math.sin(k * Math.PI / 2)
  };
  const easeCache = {};
  function ease(name = 'outQuad') {
    if (typeof name === 'function') return name;
    if (EASES[name]) return EASES[name];
    if (easeCache[name]) return easeCache[name];
    const m = /^(in|out|inOut)Back(?:\(([\d.]+)\))?$/.exec(name);
    if (m) {
      const c1 = m[2] ? +m[2] : 1.70158, c3 = c1 + 1, c2 = c1 * 1.525;
      const f = m[1] === 'in' ? k => c3 * k * k * k - c1 * k * k
        : m[1] === 'out' ? k => 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)
          : k => k < .5 ? (Math.pow(2 * k, 2) * ((c2 + 1) * 2 * k - c2)) / 2 : (Math.pow(2 * k - 2, 2) * ((c2 + 1) * (k * 2 - 2) + c2) + 2) / 2;
      return (easeCache[name] = f);
    }
    return EASES.outQuad;
  }
  // Time fraction at which an ease first reaches y (for monotonic eases)
  function invEase(f, y) {
    if (y <= 0) return 0; if (y >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (f(m) < y) lo = m; else hi = m; }
    return hi;
  }

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
  const rgbaOf = hex => { const n = parseInt(hex.slice(1), 16); return a => `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  // Box centred at (x,y,z); "front" faces +z.
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
      total, segs,
      at(t) {
        const s = Math.max(0, Math.min(1, t)) * total;
        let i = segs.findIndex(q => s <= q.start + q.len); if (i < 0) i = segs.length - 1;
        const q = segs[i]; return { p: lerp3(q.a, q.b, q.len ? (s - q.start) / q.len : 0), i };
      }
    };
  }
  // Points along a raised arc from a to b (DNS lookups, tokens)
  function arc(a, b, h = -200, n = 18) {
    return Array.from({ length: n + 1 }, (_, i) => { const k = i / n, p = lerp3(a, b, k); p[1] += h * Math.sin(Math.PI * k); return p; });
  }

  /* ---------- element transform state (for tweens on DOM elements) ---------- */
  const TS = new WeakMap();
  const TDEF = { x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, opacity: 1 };
  const tstate = e => { let s = TS.get(e); if (!s) TS.set(e, s = { ...TDEF }); return s; };
  function writeProp(e, p, v) {
    const s = tstate(e); s[p] = v;
    if (p === 'opacity') { e.style.opacity = v; return; }
    e.style.transform = `translate3d(${s.x}px,${s.y}px,${s.z}px) rotateX(${s.rotateX}deg) rotateY(${s.rotateY}deg) rotateZ(${s.rotateZ}deg) scale3d(${s.scale},${s.scale},${s.scale})`;
  }
  function clearProps(e) { TS.delete(e); e.style.transform = ''; e.style.opacity = ''; }

  /* ---------- Timeline: deterministic, seekable in both directions ---------- */
  class Timeline {
    constructor(stage) {
      this.stage = stage; this.map = new Map(); this.tracks = []; this.calls = []; this.markers = [];
      this.owned = []; this.els = new Set(); this.duration = 0; this.last = -1; this.ci = 0; this.frozen = false; this.freezers = [];
    }
    track(target, key, apply, init) {
      let m = this.map.get(target); if (!m) this.map.set(target, m = new Map());
      let tr = m.get(key);
      if (!tr) { tr = { segs: [], apply, init, hasInit: arguments.length > 3, sig: undefined }; m.set(key, tr); this.tracks.push(tr); }
      return tr;
    }
    // Low-level: a segment on a track. val(k) gets linear progress k in [0,1] (already eased if ez given).
    seg(tr, start, dur, ez, val) {
      const E = ease(ez);
      tr.segs.push({ start, dur: Math.max(0, dur), val: E === EASES.linear ? val : k => val(E(k)), n: tr.segs.length });
      this.extend(start + dur); return start + dur;
    }
    // Custom continuous track (e.g. packet position): fn(k) returns a value, apply(value) draws it.
    fn(target, key, pos, dur, ez, val, apply) { return this.seg(this.track(target, key, apply), pos, dur, ez, val); }
    extend(t) { if (t > this.duration) this.duration = t; }
    wait(pos, dur = 0) { this.extend(pos + dur); return pos + dur; }
    add(targets, params = {}, pos = 0) {
      const { duration = 500, ease: ez = 'outQuad', delay = 0, ...props } = params;
      const list = targets == null ? [] : Array.isArray(targets) ? targets : [targets];
      this.extend(pos + duration);
      list.forEach((tg, i) => {
        const start = pos + (typeof delay === 'function' ? delay(tg, i) : delay);
        const isEl = tg instanceof Element;
        if (isEl) this.els.add(tg);
        for (const p in props) {
          let v = props[p]; if (typeof v === 'function') v = v(tg, i);
          const tr = this.track(tg, p, isEl ? x => writeProp(tg, p, x) : x => { tg[p] = x; });
          const cur = tr.segs.length ? tr.last : (isEl ? tstate(tg)[p] : tg[p]);
          const kf = Array.isArray(v) ? (v.length === 1 ? [cur, v[0]] : v) : [cur, v];
          tr.last = kf[kf.length - 1];
          const E = ease(ez), n = kf.length - 1;
          this.seg(tr, start, duration, 'linear', k => { if (k >= 1) return kf[n]; const f = k * n, j = Math.floor(f); return kf[j] + (kf[j + 1] - kf[j]) * E(f - j); });
        }
      });
      return pos + duration;
    }
    // Step value: from pos on, the track holds value (until the next set). init is shown before the first set.
    set(target, key, pos, value, apply, init) {
      this.seg(this.track(target, key, apply, init), pos, 0, 'linear', () => value);
      return pos;
    }
    // Escape hatch: a callback that is replayed from a reset when scrubbing backwards. Prefer set().
    call(fn, pos) { this.calls.push({ pos, fn, n: this.calls.length }); this.extend(pos); return pos; }
    mark(pos, step, text) { this.markers.push({ pos, step, text }); return pos; }
    own(fn) { this.owned.push(fn); }
    onFreeze(fn) { this.freezers.push(fn); }
    // Insert `extra` ms of time at b: everything scheduled at or after b moves later (used to give captions reading time)
    dilate(b, extra) {
      for (const tr of this.tracks) for (const q of tr.segs) if (q.start >= b) q.start += extra;
      for (const c of this.calls) if (c.pos >= b) c.pos += extra;
      for (const m of this.markers) if (m.pos >= b) m.pos += extra;
      for (const arr of [this._caps, this._pres]) if (arr) for (const o of arr) if (o.pos >= b) o.pos += extra;
      this.duration += extra;
    }
    freeze() {
      this.freezers.splice(0).forEach(f => f(this));
      for (const tr of this.tracks) tr.segs.sort((a, b) => a.start - b.start || a.n - b.n);
      this.calls.sort((a, b) => a.pos - b.pos || a.n - b.n);
      this.markers.sort((a, b) => a.pos - b.pos);
      this.frozen = true;
    }
    render(t) {
      if (!this.frozen) this.freeze();
      if (t < this.last && this.calls.length) { this.stage.reset(); this.ci = 0; for (const tr of this.tracks) tr.sig = undefined; }
      while (this.ci < this.calls.length && this.calls[this.ci].pos <= t) this.calls[this.ci++].fn();
      for (const tr of this.tracks) {
        const s = tr.segs; let i = -1, lo = 0, hi = s.length - 1;
        while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m].start <= t) { i = m; lo = m + 1; } else hi = m - 1; }
        let sig, v;
        if (i < 0) { if (tr.hasInit) { sig = 'i'; v = tr.init; } else { sig = '0:0'; v = s[0].val(0); } }
        else { const q = s[i], k = q.dur > 0 ? clamp((t - q.start) / q.dur, 0, 1) : 1; sig = i + ':' + k; v = q.val(k); }
        if (sig !== tr.sig) { tr.sig = sig; tr.apply(v); }
      }
      this.last = t;
    }
    dispose() { for (const e of this.els) clearProps(e); this.owned.forEach(f => f()); this.owned = []; }
  }

  /* ---------- Stage: camera, render loop, overlays, interaction ---------- */
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
      this.e = { ...this.cam };                                   // effective camera this frame
      this.view = { rx: 0, ry: 0, zoom: 1, px: 0, pz: 0 };        // user orbit / zoom / pan (smoothed)
      this.viewT = { ...this.view };
      this.explore = null; this.ex = null;                        // free camera target, when exploring
      this.bbs = []; this.onFrame = []; this.beforeFrame = []; this.resetters = [];
      this.devices = []; this.links = [];
      this.resetters.push(() => this.frame.classList.remove('fk-presenting')); this.spinners = []; this.layers = []; this.tracker = null;
      this.scale = 1;
      this.readTime = 900;
      const fit = () => { this.scale = frame.clientWidth / 1280; this.scaler.style.transform = `scale(${this.scale})`; };
      new ResizeObserver(fit).observe(frame); fit();
      this.caption = new Caption(this);
      this.freeEl = el('div', 'fk-free fk-hud-i', this.hud, `<span>Free camera</span><button data-a="reset">Reset view</button><button data-a="follow">Follow script</button>`);
      this.freeEl.querySelector('[data-a=reset]').onclick = () => this.resetView();
      this.freeEl.querySelector('[data-a=follow]').onclick = () => this.follow();
      this._pointer();
      this.render = this.render.bind(this);
      requestAnimationFrame(this.render);
    }
    project(p) {
      const c = this.e;
      let [x, y, z] = p;
      x -= c.x; y -= c.y; z -= c.z;
      const b = c.ry * D2R; [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
      const a = c.rx * D2R; [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
      z += this.P - c.d;
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
    render(now) {
      const dt = this._t ? Math.min(100, now - this._t) : 16; this._t = now;
      for (const f of this.beforeFrame) f(dt, now);
      const v = this.view, T = this.viewT;
      for (const k in v) v[k] += (T[k] - v[k]) * .2;
      let b = this.cam;
      if (this.explore) {
        if (!this.ex) this.ex = { ...this.cam };
        for (const k in this.explore) this.ex[k] += (this.explore[k] - this.ex[k]) * .08;
        b = this.ex;
      } else if (this.ex) {                                         // glide back onto the scripted camera
        let far = 0;
        for (const k in this.ex) { this.ex[k] += (this.cam[k] - this.ex[k]) * .12; far = Math.max(far, Math.abs(this.cam[k] - this.ex[k])); }
        b = this.ex; if (far < .5) this.ex = null;
      }
      const e = this.e;
      e.x = b.x + v.px; e.y = b.y; e.z = b.z + v.pz;
      e.rx = clamp(b.rx + v.rx, -89, 8); e.ry = b.ry + v.ry; e.d = b.d * v.zoom;
      this.world.style.transform = `translateZ(${this.P - e.d}px) rotateX(${e.rx}deg) rotateY(${e.ry}deg) translate3d(${-e.x}px,${-e.y}px,${-e.z}px)`;
      for (const s of this.spinners) s.el.style.transform = `rotateY(${(now * s.speed) % 360}deg)`;
      for (const f of this.onFrame) f(this, dt, now);
      for (const bb of this.bbs) {
        if (bb.el.style.display === 'none') continue;
        const P = typeof bb.p === 'function' ? bb.p() : bb.p;
        if (bb.screen) {
          const q = this.project(P);
          if (q.z > this.P - 40) { bb.el.style.visibility = 'hidden'; continue; }
          bb.el.style.visibility = '';
          const s = bb.scale ? Math.max(.55, Math.min(1.4, q.s)) : 1;
          bb.el.style.transform = `translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px) scale(${s.toFixed(3)})`;
        } else {
          bb.el.style.transform = `translate3d(${P[0]}px,${P[1]}px,${P[2]}px) rotateY(${-e.ry}deg) rotateX(${-e.rx}deg)`;
        }
      }
      this._trackLayer();
      const free = !!this.explore || Math.abs(T.rx) > .5 || Math.abs(T.ry) > .5 || Math.abs(T.zoom - 1) > .01 || Math.abs(T.px) > 1 || Math.abs(T.pz) > 1;
      if (free !== this._free) { this._free = free; this.freeEl.classList.toggle('on', free); }
      requestAnimationFrame(this.render);
    }
    setCam(s) { Object.assign(this.cam, s); }
    // Camera move. from: optional shot to start from (use after a cut).
    shot(tl, pos, s, dur = 1500, ez = 'inOutCubic', from) {
      const p = {};
      for (const k in s) p[k] = from ? [from[k], s[k]] : s[k];
      tl.add(this.cam, { ...p, duration: dur, ease: ez }, pos);
      return pos + dur;
    }
    dip(tl, pos, { out = 300, hold = 60, back = 600 } = {}) {
      tl.add(this.dipEl, { opacity: [0, 1], duration: out, ease: 'inQuad' }, pos);
      tl.add(this.dipEl, { opacity: [1, 0], duration: back, ease: 'outQuad' }, pos + out + hold);
      return pos + out + hold + back;
    }
    // Floating panel anchored to a 3D point; items tick in one by one.
    checklist(tl, pos, { at, title, items, step = 420, hold = 1600, result, resultColor = '#34D399', dx = 30, dy = -20, code }) {
      const html = `<div class="fk-cl"><div class="fk-panel" style="transform:translate(${dx}px,${dy}px)"><h4>${title}</h4>` +
        (code ? `<pre>${code}</pre>` : '') +
        items.map(it => `<div class="it ${it.s || 'pass'}"><b>${it.s === 'fail' ? '&#10005;' : it.s === 'warn' ? '!' : it.s === 'skip' ? '&ndash;' : '&#10003;'}</b><span>${it.t}</span></div>`).join('') +
        (result ? `<div class="res" style="color:${resultColor}">${result}</div>` : '') + `</div></div>`;
      const b = this.billboard(null, html, { screen: true, p: at });
      b.el.style.display = 'none';
      tl.own(() => this.removeBillboard(b));
      const wrap = b.el.firstChild, rows = [...b.el.querySelectorAll('.it, .res')];
      const n = rows.length, end = pos + 250 + n * step + hold + this.readTime;   // readTime: extra time to read a finished panel
      const vis = v => { b.el.style.display = v ? '' : 'none'; };
      tl.set(b, 'vis', pos, true, vis, false);
      tl.set(b, 'vis', end + 250, false);
      tl.add(wrap, { opacity: [0, 1], y: [10, 0], duration: 300, ease: 'outQuad' }, pos);
      tl.add(wrap, { opacity: [1, 0], duration: 250, ease: 'linear' }, end);
      rows.forEach((r, i) => tl.set(r, 'on', pos + 250 + i * step, true, v => r.classList.toggle('on', v), false));
      return end + 250;
    }
    // Presentation mode: hide the trace and legend panels (e.g. while a deployment view is open)
    present(tl, pos, v) { (tl._pres || (tl._pres = [])).push({ pos, v }); tl.set(this, 'present', pos, v, x => this.frame.classList.toggle('fk-presenting', x), false); return pos; }
    // Toggle a class on the frame for this timeline (e.g. 'fk-notrace' to hide the trace panel)
    flag(tl, pos, cls, v) { tl.set(this, 'flag:' + cls, pos, v, x => this.frame.classList.toggle(cls, x), false); if (!this._flags) this._flags = new Set(); if (!this._flags.has(cls)) { this._flags.add(cls); this.resetters.push(() => this.frame.classList.remove(cls)); } return pos; }
    onReset(fn) { this.resetters.push(fn); }
    reset() { this.resetters.forEach(f => f()); }

    /* --- interaction: orbit (drag), pan (right-drag or shift-drag), zoom (wheel), pick (click) --- */
    _pointer() {
      const f = this.frame; let drag = null;
      f.addEventListener('pointerdown', e => {
        if (e.target.closest('.fk-hud-i')) return;
        drag = { x: e.clientX, y: e.clientY, moved: false, pan: e.button === 2 || e.shiftKey, target: e.target };
        f.setPointerCapture(e.pointerId);
      });
      f.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 4) return;
        drag.moved = true; f.classList.add('dragging'); drag.x = e.clientX; drag.y = e.clientY;
        const sc = 1 / this.scale, T = this.viewT;
        if (drag.pan) {
          const k = this.e.d / this.P * sc, b = this.e.ry * D2R;
          T.px -= (Math.cos(b) * dx - Math.sin(b) * dy * 1.6) * k;
          T.pz -= (Math.sin(b) * dx + Math.cos(b) * dy * 1.6) * k;
        } else {
          T.ry += dx * .25 * sc; T.rx = clamp(T.rx - dy * .2 * sc, -60, 40);
        }
      });
      const up = () => {
        if (!drag) return;
        if (!drag.moved) { const d = this.deviceAt(drag.target); this.select(d); }
        drag = null; f.classList.remove('dragging');
      };
      f.addEventListener('pointerup', up); f.addEventListener('pointercancel', up);
      f.addEventListener('dblclick', e => { if (!e.target.closest('.fk-hud-i')) this.resetView(); });
      f.addEventListener('wheel', e => {
        if (e.target.closest('.fk-hud-i')) return;
        e.preventDefault();
        this.viewT.zoom = clamp(this.viewT.zoom * Math.exp(e.deltaY * .0015), .2, 3);
      }, { passive: false });
      f.addEventListener('contextmenu', e => e.preventDefault());
    }
    deviceAt(t) {
      const n = t && t.closest && (t.closest('.fk-label.dev') || t.closest('.fk-dev'));
      return n ? this.devices[+n.dataset.dev] || null : null;
    }
    resetView() { Object.assign(this.viewT, { rx: 0, ry: 0, zoom: 1, px: 0, pz: 0 }); }
    goTo(shot) { this.explore = { ...this.cam, ...shot }; this.onExplore && this.onExplore(); }
    follow() { this.explore = null; this.resetView(); }

    /* --- layers: legend, focus/dim, "you are here" --- */
    setLayers(layers) {
      this.layers = layers;
      this.legend = el('div', 'fk-legend fk-hud-i', this.hud, `<h4>Layers</h4>`);
      this.legendRows = layers.map((L, i) => {
        const r = el('div', 'lr', this.legend, `<b style="--lc:${L.color}">${L.tag || 'L' + i}</b><span>${L.name}</span><small>${L.alias || ''}</small>`);
        r.title = L.desc || '';
        r.onpointerenter = () => this.focusLayer(i, 'hover');
        r.onpointerleave = () => this.focusLayer(null, 'hover');
        r.onclick = () => { this.goTo(L.shot); this.onLayerClick && this.onLayerClick(i); };
        return r;
      });
    }
    focus(tl, pos, v) { tl.set(this, 'focus', pos, v, x => this.focusLayer(x, 'script'), null); return pos; }
    focusLayer(v, src = 'script') {
      if (src === 'script') this._fs = v; else this._fh = v;
      const f = this._fh ?? this._fs, set = f == null ? null : new Set([].concat(f));
      const dim = l => !!(set && !set.has(l));
      for (const d of this.devices) { d.g.classList.toggle('fk-dimmed', dim(d.layer)); d.labelEl.classList.toggle('dim', dim(d.layer)); }
      for (const l of this.links) l.segs.forEach(s => s.classList.toggle('fk-dimmed', dim(l.layer)));
      (this.legendRows || []).forEach((r, i) => r.classList.toggle('on', !!(set && set.has(i))));
    }
    _trackLayer() {
      if (!this.legendRows) return;
      const pk = this.tracker; let cur = -1;
      if (pk && pk.visible) {
        cur = this.layers.findIndex(L => L.test && L.test(pk.p));
        if (cur < 0) { const x = pk.p[0]; cur = this.layers.findIndex(L => !L.test && x >= L.x1 && x < L.x2); }
      }
      if (cur !== this._cur) { this._cur = cur; this.legendRows.forEach((r, i) => r.classList.toggle('cur', i === cur)); }
    }

    /* --- device info card --- */
    select(d) {
      if (this.selected) this.selected.labelEl.classList.remove('sel');
      this.selected = d || null;
      if (!this.infoEl) {
        this.infoEl = el('div', 'fk-info fk-hud-i', this.hud);
        this.infoEl.addEventListener('click', e => {
          const a = e.target.closest('button'); if (!a) return;
          if (a.dataset.a === 'close') this.select(null);
          if (a.dataset.a === 'focus' && this.selected) { this.goTo(this.selected.focusShot()); }
        });
      }
      if (!d) { this.infoEl.classList.remove('on'); return; }
      d.labelEl.classList.add('sel');
      const L = this.layers[d.layer] || {}, info = d.info || {}, fp = info.footprint;
      const max = fp ? Math.max(fp.NA, fp.EMEA, fp.APAC) : 1;
      this.infoEl.innerHTML = `<div class="hd"><b style="--lc:${L.color || '#94A3B8'}">${L.tag || 'L' + (d.layer ?? '?')}</b><span>${L.name || ''}${L.alias ? ' · ' + L.alias : ''}</span><button data-a="close" title="Close (Esc)">&#10005;</button></div>
        <h3>${d.name}</h3><div class="tech">${d.sub}</div>
        ${info.role ? `<p>${info.role}</p>` : ''}
        ${fp ? `<div class="fp"><div class="tot">${fp.label}</div>${['NA', 'EMEA', 'APAC'].map(r => `<div class="br"><span>${r}</span><i><em style="width:${(fp[r] / max * 100).toFixed(0)}%"></em></i><small>${fp[r].toLocaleString()}</small></div>`).join('')}</div>` : ''}
        ${info.controls && info.controls.length ? `<h5>Controls</h5><ul>${info.controls.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
        <div class="act"><button data-a="focus">Focus camera</button></div>`;
      this.infoEl.classList.add('on');
    }
  }

  // Caption: a card near the top of the stage; each new step crossfades in and stays until the next one.
  // While a deployment view is open (stage.present) it moves up into a compact banner so it never covers the view.
  class Caption {
    constructor(stage) {
      this.stage = stage;
      this.el = el('div', 'fk-caption', stage.hud, '<div class="st"></div><div class="tx"></div>');
      this.st = this.el.querySelector('.st'); this.tx = this.el.querySelector('.tx');
      this.readBase = 1500; this.readPerChar = 45;   // reading time: ms to notice + ms per character
      this.CY = 150; this.TY = 12; this.DS = .8;    // normal y, y and scale while a deployment view is open
      this.show(null); stage.onReset(() => this.show(null));
    }
    // Captions can be overridden from a config (window.FK_CAPTIONS[chapter title][original step]): { step, text, hold }
    at(tl, pos, step, text, { pop } = {}) {
      const ov = ((global.FK_CAPTIONS || {})[this.chapter] || {})[step] || {};
      const shown = ov.step ?? step, body = ov.text ?? text;
      tl.mark(pos, shown, body); tl.set(this, 'cap', pos, { step: shown, text: body }, v => this.show(v), null);
      if (!tl._caps) { tl._caps = []; tl.onFreeze(t2 => { this._readingTime(t2); this._layout(t2); }); }
      tl._caps.push({ pos, len: body.length, pop, hold: ov.hold });
      return pos;
    }
    // Give every caption time to be read (about 22 characters a second plus a moment to notice it): if the next
    // caption would replace it sooner, hold the whole timeline just before the next one
    // A caption's hold (seconds, from the config) replaces the reading-time rule for that caption
    _readingTime(tl) {
      const caps = tl._caps.slice().sort((a, b) => a.pos - b.pos);
      for (let i = 0; i < caps.length; i++) {
        const c = caps[i], need = c.hold != null ? c.hold * 1000 : Math.min(9000, this.readBase + c.len * this.readPerChar);
        if (i < caps.length - 1) { const window = caps[i + 1].pos - c.pos; if (window < need) tl.dilate(caps[i + 1].pos, need - window); }
        else tl.extend(c.pos + need);
      }
    }
    // Once the chapter is built: each caption fades in at its position and stays until the next one crossfades in.
    // The card only moves to make room for a deployment view (stage.present), and moves back afterwards.
    _layout(tl) {
      const { CY, TY, DS } = this, e = this.el, pres = (tl._pres || []).slice().sort((a, b) => a.pos - b.pos);
      const onAt = t => pres.reduce((v, p) => p.pos <= t ? p.v : v, false);
      const caps = tl._caps.slice().sort((a, b) => a.pos - b.pos);
      caps.forEach((c, i) => {
        const docked = c.pop === false || onAt(c.pos), y = docked ? TY : CY, sc = docked ? DS : 1;
        if (i > 0 && c.pos - caps[i - 1].pos > 400) tl.add(e, { opacity: [1, 0], duration: 180, ease: 'linear' }, c.pos - 180);
        tl.add(e, { y: [y, y], scale: [sc, sc], opacity: [0, 1], duration: 320, ease: 'outQuad' }, c.pos);
      });
      let on = false;
      for (const p of pres) {
        if (p.v === on) continue; on = p.v;
        tl.add(e, on ? { y: [CY, TY], scale: [1, DS], duration: 450, ease: 'inOutCubic' } : { y: [TY, CY], scale: [DS, 1], duration: 450, ease: 'inOutCubic' }, p.pos);
      }
    }
    hide(tl, pos) { tl.set(this, 'cap', pos, null, v => this.show(v), null); return pos; }
    show(v) {
      this.el.style.display = v ? '' : 'none'; if (!v) { this.st.textContent = ''; this.tx.textContent = ''; return; }
      this.st.textContent = v.step; this.tx.textContent = v.text;
    }
  }

  /* ---------- Trace panel (observability) ---------- */
  class Trace {
    constructor(stage) {
      this.stage = stage;
      this.el = el('div', 'fk-trace', stage.hud, `<h4><span>Distributed trace</span><span class="n">0 spans</span></h4><div class="tid"></div><div class="rows"></div>`);
      this.rows = this.el.querySelector('.rows'); this.count = this.el.querySelector('.n'); this.tid = this.el.querySelector('.tid');
      stage.onReset(() => this.paint(-1, [], '', 400));
    }
    begin(tl, { id, total = 400 }) {
      const plan = this.plan = [];
      this._apply = v => this.paint(v, plan, id, total);
      tl.set(this, 'rows', 0, -1, this._apply, -1);
      return 0;
    }
    add(tl, pos, row) { this.plan.push({ pos, ...row }); tl.set(this, 'rows', pos, pos, this._apply, -1); return pos; }
    paint(v, plan, id, total) {
      this.tid.textContent = id ? 'traceparent 00-' + id + '-01' : '';
      const rows = plan.filter(r => r.pos <= v).sort((a, b) => a.pos - b.pos), W = 100 / total;
      this.count.textContent = rows.length + ' spans';
      this.rows.innerHTML = rows.slice(-14).map(r => `<div class="row${r.pos === v ? ' nw' : ''}"><div class="svc">${r.svc}</div><div class="lane"><div class="bar ${r.status === 'error' ? 'err' : r.status === 'warn' ? 'warn' : ''}" style="left:${r.start * W}%;width:${Math.max(1.5, r.dur * W)}%"></div></div><div class="ms ${r.status === 'error' ? 'err' : ''}">${r.status === 'error' ? 'ERR' : r.dur + 'ms'}</div></div>`).join('');
    }
  }

  /* ---------- Latency budget (HUD): legs fill as a request spends time in each layer ---------- */
  class Budget {
    constructor(stage, { target, legs, title = 'Latency budget' }) {
      this.stage = stage; this.target = target; this.legs = legs;
      this.el = el('div', 'fk-budget', stage.hud, `<div class="bh"><b>${title}</b><span class="tot"></span></div><div class="bar">${legs.map(l => `<div class="sg${l.kind === 'net' ? ' net' : ''}" style="width:${(l.ms / target * 100).toFixed(2)}%;--c:${l.color}"><i></i></div>`).join('')}</div><div class="lg">${legs.map(l => `<span style="width:${(l.ms / target * 100).toFixed(2)}%">${l.label}<small>${l.ms}</small></span>`).join('')}</div>`);
      this.segs = [...this.el.querySelectorAll('.sg')]; this.labs = [...this.el.querySelectorAll('.lg span')]; this.tot = this.el.querySelector('.tot');
      this.paint(-1, [], null); stage.onReset(() => this.paint(-1, [], null));
    }
    // Show the bar for this timeline; focus: optional leg indexes to emphasise (a layer chapter)
    begin(tl, pos, focus = null) {
      const plan = this.plan = [];
      this._apply = v => this.paint(v, plan, focus);
      tl.set(this, 'spend', pos, -1, this._apply, null);
      return pos;
    }
    spend(tl, pos, i, ms) { this.plan.push({ pos, i, ms }); tl.set(this, 'spend', pos, pos, this._apply, null); return pos; }
    paint(v, plan, focus) {
      this.el.style.display = v === null ? 'none' : ''; if (v === null) return;
      const used = this.legs.map(() => null);
      plan.filter(p => p.pos <= v).forEach(p => { used[p.i] = (used[p.i] || 0) + p.ms; });
      const total = used.reduce((a, b) => a + (b || 0), 0);
      this.segs.forEach((sg, i) => { const u = used[i], l = this.legs[i]; sg.firstChild.style.width = u == null ? '0%' : Math.min(100, u / l.ms * 100) + '%'; sg.classList.toggle('over', u != null && u > l.ms); sg.classList.toggle('dim', !!(focus && !focus.includes(i))); });
      this.labs.forEach((lb, i) => { lb.classList.toggle('dim', !!(focus && !focus.includes(i))); lb.querySelector('small').textContent = used[i] == null ? this.legs[i].ms : `${used[i]}/${this.legs[i].ms}`; });
      const sub = kind => { const ls = this.legs.map((l, i) => [l, used[i]]).filter(([l]) => l.kind === kind); return ls.length ? `${ls.reduce((a, [, u]) => a + (u || 0), 0)}/${ls.reduce((a, [l]) => a + l.ms, 0)}` : null; };
      const net = sub('net'), proc = sub('proc');
      this.tot.innerHTML = (net ? `<span class="k net">network ${net}</span><span class="k">processing ${proc}</span>` : '') + `<b class="${total > this.target ? 'over' : ''}">${total} ms</b> / ${this.target}`;
    }
  }

  /* ---------- Observability wall ---------- */
  class ObsWall {
    constructor(stage, parent, { x = 0, y = -700, z = -1500, w = 2600, h = 620, title = 'Observability' } = {}) {
      this.stage = stage; this.pos = [x, y, z]; this.w = w; this.h = h;
      const f = plane(parent, { w, h, t: `translate3d(${x}px,${y}px,${z}px)`, bg: 'linear-gradient(180deg, rgba(30,27,75,.85), rgba(15,23,42,.85))', two: true });
      f.style.border = '2px solid rgba(167,139,250,.55)'; f.style.borderRadius = '18px'; f.style.boxShadow = '0 0 60px rgba(139,92,246,.25)';
      f.innerHTML = `<div style="position:absolute;left:40px;top:28px;font:700 64px system-ui;color:#DDD6FE;letter-spacing:.06em">${title}</div>
        <div style="position:absolute;left:40px;top:112px;font:30px system-ui;color:#A5B4FC">traces · logs · metrics · one trace ID across every layer</div>
        <div class="kpis" style="position:absolute;left:40px;top:180px;display:flex;gap:22px"></div>
        <div class="spark" style="position:absolute;left:40px;bottom:40px;width:${w * .42}px;height:150px;display:flex;align-items:flex-end;gap:6px"></div>
        <div class="logs" style="position:absolute;right:40px;top:40px;width:${w * .5}px;bottom:40px;font:30px/1.5 ui-monospace,Menlo,monospace;color:#C7D2FE;overflow:hidden"></div>
        <div class="alert" style="position:absolute;left:40px;top:180px;right:${w * .54}px;height:220px;border-radius:14px;border:2px solid;font:700 44px system-ui;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 20px"></div>`;
      this.el = f; this.logs = f.querySelector('.logs'); this.alertEl = f.querySelector('.alert');
      this.kpi = {};
      for (const [k, label] of [['req', 'Requests'], ['err', 'Blocked / errors'], ['p95', 'p95 latency']]) {
        const t = el('div', '', f.querySelector('.kpis'), `<div style="font:28px system-ui;color:#A5B4FC">${label}</div><div class="v" style="font:700 72px system-ui;color:#F5F3FF">0</div>`);
        t.style.cssText = 'width:390px;height:220px;border-radius:14px;background:rgba(99,102,241,.14);border:1px solid rgba(165,180,252,.3);padding:18px 22px;box-sizing:border-box';
        this.kpi[k] = t.querySelector('.v');
      }
      const sp = f.querySelector('.spark');
      for (let i = 0; i < 28; i++) { const b = el('div', 'fk-sparkbar', sp); b.style.animationDelay = (-Math.random() * 2.4).toFixed(2) + 's'; b.style.animationDuration = (1.8 + Math.random() * 1.4).toFixed(2) + 's'; }
      stage.onReset(() => { this.paintLogs(-1, []); this.paintAlert(null); });
      this.paintLogs(-1, []);
    }
    begin(tl) {
      const plan = this.plan = [];
      this._apply = v => this.paintLogs(v, plan);
      tl.set(this, 'logs', 0, -1, this._apply, -1);
      tl.set(this, 'alert', 0, null, v => this.paintAlert(v), null);
    }
    log(tl, pos, line, color = '#C7D2FE', { req = 1, err = 0 } = {}) { this.plan.push({ pos, line, color, req, err }); tl.set(this, 'logs', pos, pos, this._apply, -1); return pos; }
    paintLogs(v, plan) {
      const rows = plan.filter(r => r.pos <= v).sort((a, b) => a.pos - b.pos);
      const req = 1284 + rows.reduce((s, r) => s + r.req, 0), err = 3 + rows.reduce((s, r) => s + r.err, 0);
      this.logs.innerHTML = rows.slice(-16).reverse().map((r, i) => `<div style="color:${r.color};white-space:pre"${i === 0 && r.pos === v ? ' class="fk-new"' : ''}>${r.line}</div>`).join('');
      this.kpi.req.textContent = req.toLocaleString(); this.kpi.err.textContent = err; this.kpi.p95.textContent = '212 ms';
      this.kpi.err.style.color = err > 3 ? '#FDA4AF' : '#F5F3FF';
    }
    alert(tl, pos, html, color = '#F43F5E', bg = 'rgba(60,9,24,.97)', text = '#FECDD3') { tl.set(this, 'alert', pos, { html, color, bg, text }); return pos; }
    paintAlert(v) {
      const a = this.alertEl; a.style.display = v ? 'flex' : 'none'; if (!v) { a.innerHTML = ''; a.style.background = ''; a.classList.remove('fk-blink'); return; }
      a.innerHTML = v.html; a.style.borderColor = v.color; a.style.background = v.bg; a.style.color = v.text;
      a.classList.remove('fk-blink'); void a.offsetWidth; a.classList.add('fk-blink');
    }
  }

  /* ---------- Devices ---------- */
  const HEALTH = { ok: '#34D399', warn: '#FBBF24', down: '#F43F5E' };
  class Device {
    constructor(stage, parent, o) {
      this.stage = stage; this.o = o;
      const { x = 0, z = 0, kind = 'rack', w = 120, h = 200, d = 110, color = '#1E293B', label = '', sub = '', led = '#34D399', accent = '#38BDF8' } = o;
      this.x = x; this.z = z; this.h = h; this.layer = o.layer; this.info = o.info; this.name = label; this.sub = sub;
      this.id = stage.devices.push(this) - 1;
      this.g = g(parent, x, 0, z); this.g.classList.add('fk-dev'); this.g.dataset.dev = this.id;
      this.g.style.setProperty('--led', led); this.g.style.setProperty('--accent', accent);
      this.body = el('div', 'fk-n', this.g);       // tween target (shake, drop, pulse)
      plane(this.body, { w: w * 2.2, h: d * 2.2, t: 'translateY(-1px) rotateX(90deg)', cls: 'fk-glow', bg: 'radial-gradient(closest-side, var(--led), transparent)' });
      const build = Device.kinds[kind] || Device.kinds.rack;
      const top = build.call(this, this.body, { w, h, d, color, accent, o });
      this.topY = -(top || h);
      const L = stage.layers[o.layer];
      const badge = o.layer != null ? `<b class="ly" style="--lc:${L ? L.color : '#94A3B8'}">${(L && L.tag) || 'L' + o.layer}</b>` : '';
      this.labelBB = stage.billboard(null, `<div class="fk-label dev" data-dev="${this.id}">${badge}<i></i><span class="nm">${label}</span><span class="sub">${sub}</span></div>`, { screen: true, p: [x, this.topY - 24, z] });
      this.labelEl = this.labelBB.el.firstChild;
      this.labelEl.style.setProperty('--led', led);
      this.led0 = led;
      this.screen0 = this.screen ? this.screen.innerHTML : null;
      stage.onReset(() => this.reset());
      this.reset();
    }
    get top() { return [this.x, this.topY, this.z]; }
    port(dx = 0, dy = -50, dz = 0) { return [this.x + dx, dy, this.z + dz]; }
    focusShot() { return { x: this.x, y: this.topY * .6, z: this.z, rx: -22, ry: -18, d: 1700 }; }
    reset() {
      this.setLed(this.led0); this.g.classList.remove('down'); this.labelEl.classList.remove('active');
      this._show(!this.o.hidden); if (this.screen) this.screen.innerHTML = this.screen0;
    }
    _show(v) { this.g.style.display = v ? '' : 'none'; this.labelBB.el.style.display = v && !this.o.nolabel ? '' : 'none'; }
    show(tl, pos, v) { tl.set(this, 'shown', pos, v, x => this._show(x), !this.o.hidden); return pos; }
    // Pop in from nothing
    reveal(tl, pos, dur = 700) { this.show(tl, pos, true); tl.add(this.body, { scale: [.01, 1], duration: dur, ease: 'outBack(1.4)' }, pos); return pos + dur; }
    setLed(c) { this.g.style.setProperty('--led', c); this.labelEl.style.setProperty('--led', c); }
    health(tl, pos, state) {
      tl.set(this, 'health', pos, state, s => { this.setLed(s === 'base' ? this.led0 : HEALTH[s]); this.g.classList.toggle('down', s === 'down'); }, 'base');
      if (state === 'down') tl.add(this.body, { x: [0, -8, 8, -6, 6, 0], duration: 500, ease: 'linear' }, pos);
      return pos + 500;
    }
    // Highlight while a request is here: pulse + expanded label
    activate(tl, pos, dur = 1200) {
      const f = v => this.labelEl.classList.toggle('active', v);
      tl.set(this, 'active', pos, true, f, false);
      tl.set(this, 'active', pos + dur, false, f, false);
      tl.add(this.body, { scale: [1, 1.06, 1], duration: 500, ease: 'inOutSine' }, pos);
      return pos;
    }
    // Signposts: light the chosen sign (index) from pos on; null clears
    choose(tl, pos, i) { tl.set(this, 'sign', pos, i, v => this.signs.forEach((s, k) => s.classList.toggle('on', k === v)), null); return pos; }
    html(tl, pos, html) { tl.set(this.screen, 'html', pos, html, v => { this.screen.innerHTML = v; }, this.screen0); return pos; }
  }
  const ring3 = (parent, d, t, color, bw = 2) => { const p = plane(parent, { w: d, h: d, t, two: true }); p.style.border = `${bw}px solid ${color}`; p.style.borderRadius = '50%'; return p; };
  Device.kinds = {
    rack(p, { w, h, d, color }) {
      const b = box(p, { y: -h / 2, w, h, d, c: color });
      b.front.innerHTML = `<div class="fk-slots"></div><div class="fk-ledstrip" style="left:10px;top:10px;bottom:10px"></div><div class="fk-ledstrip" style="right:10px;top:18px;bottom:10px"></div>`;
      b.top.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
      if (this.o.icon) { const ic = plane(p, { w: 70, h: 70, t: `translate3d(0,${-h - 60}px,0)`, two: true, html: this.o.icon }); ic.style.filter = 'drop-shadow(0 0 8px var(--accent))'; return h + 100; }
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
    // A cluster of edge servers (CDN PoP)
    edge(p, { color, o }) {
      [120, 160, 120].forEach((hh, i) => {
        const b = box(p, { x: (i - 1) * 76, y: -hh / 2, w: 66, h: hh, d: 70, c: color });
        b.front.innerHTML = `<div class="fk-slots"></div><div class="fk-ledstrip" style="left:8px;top:8px;bottom:8px"></div>`;
        b.top.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
      });
      if (o.icon) { const ic = plane(p, { w: 70, h: 70, t: `translate3d(0,-220px,0)`, two: true, html: o.icon }); ic.style.filter = 'drop-shadow(0 0 8px var(--accent))'; return 260; }
      return 170;
    },
    // Signpost (DNS-based steering): tells clients where to go, carries nothing. Arrow signs point downstream.
    signpost(p, { accent, o }) {
      box(p, { y: -8, w: 120, h: 16, d: 120, c: '#0F172A' });
      box(p, { y: -150, w: 12, h: 280, d: 12, c: '#64748B' });
      const signs = o.signs || ['A', 'B'];
      this.signs = signs.map((txt, i) => {
        const pl = plane(p, { w: 240, h: 50, t: `translate3d(120px,${-262 + i * 66}px,0) rotateY(${i ? 10 : -10}deg)`, two: true,
          html: `<div class="fk-signb" style="--sc:${accent}"><div class="fk-sign">${txt}</div></div>` });
        return pl.firstChild;
      });
      const wrap = g(p, 0, -318, 0), spin = el('div', 'fk-n', wrap);
      for (let i = 0; i < 3; i++) ring3(spin, 56, `rotateY(${i * 60}deg)`, accent);
      ring3(spin, 56, 'rotateX(90deg)', accent);
      this.stage.spinners.push({ el: spin, speed: .03 });
      return 350;
    },
    // Floating wireframe globe (DNS / global steering)
    globe(p, { w, accent, o }) {
      const r = (o.r || 70), fy = o.float || 300;
      const wrap = g(p, 0, -fy - r, 0), spin = el('div', 'fk-n', wrap);
      for (let i = 0; i < 4; i++) ring3(spin, 2 * r, `rotateY(${i * 45}deg)`, accent);
      for (const [yy, rr] of [[0, r], [-r * .55, r * .835], [r * .55, r * .835]]) ring3(spin, 2 * rr, `translateY(${yy}px) rotateX(90deg)`, accent);
      this.stage.billboard(wrap, `<div style="width:${2 * r}px;height:${2 * r}px;margin:${-r}px 0 0 ${-r}px;border-radius:50%;background:radial-gradient(circle at 38% 35%, ${accent}66, ${accent}18 55%, transparent 72%)"></div>`, { p: [0, 0, 0] });
      this.stage.spinners.push({ el: spin, speed: .025 });
      this.center = [this.x, -fy - r, this.z];
      return fy + 2 * r;
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
    // Monitor on a stand (API client / terminal)
    terminal(p, { color, o }) {
      box(p, { y: -30, w: 150, h: 60, d: 110, c: '#1E293B' });
      box(p, { y: -72, w: 16, h: 24, d: 16, c: '#334155' });
      const b = box(p, { y: -140, w: 180, h: 112, d: 8, c: color });
      b.front.innerHTML = `<div class="scr" style="position:absolute;inset:6px;background:#0B1220;border-radius:3px;overflow:hidden;color:#A7F3D0;font:8px/1.35 ui-monospace,Menlo,monospace;padding:5px 6px">${o.screen || ''}</div>`;
      this.screen = b.front.querySelector('.scr');
      return 200;
    },
    // AI agent: a cube with an orbiting core
    agent(p, { color, accent }) {
      const b = box(p, { y: -50, w: 100, h: 100, d: 100, c: color });
      b.front.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;font:800 30px system-ui;color:${accent};text-shadow:0 0 10px ${accent}">AI</div>`;
      b.top.style.boxShadow = `inset 0 0 0 2px ${accent}`;
      const wrap = g(p, 0, -170, 0), spin = el('div', 'fk-n', wrap);
      ring3(spin, 90, 'rotateX(72deg)', accent); ring3(spin, 90, 'rotateY(60deg) rotateX(72deg)', accent); ring3(spin, 90, 'rotateY(-60deg) rotateX(72deg)', accent);
      this.stage.billboard(wrap, `<div style="width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,${accent} 60%);box-shadow:0 0 22px 6px ${accent}"></div>`, { p: [0, 0, 0] });
      this.stage.spinners.push({ el: spin, speed: .06 });
      return 225;
    },
    // Private connectivity endpoint: a glowing ring traffic passes through
    portal(p, { accent, o }) {
      const fx = o.facing === 'x';
      box(p, { y: -8, w: fx ? 60 : 210, h: 16, d: fx ? 210 : 60, c: '#0F172A' });
      const R = 170, ring = plane(p, { w: R, h: R, t: `translate3d(0,${-16 - R / 2}px,0)${fx ? ' rotateY(90deg)' : ''}`, two: true });
      ring.style.cssText += `border-radius:50%;border:12px solid ${accent};box-shadow:0 0 30px ${accent}, inset 0 0 30px ${accent};background:radial-gradient(closest-side, ${accent}40, transparent)`;
      return 16 + R + 10;
    },
    pods(p, { color, o }) {
      const n = o.count || 3, gap = o.gap || 110;
      this.pods = [];
      for (let i = 0; i < n; i++) {
        const pg = g(p, 0, 0, (i - (n - 1) / 2) * gap), inner = el('div', 'fk-n', pg);
        const b = box(inner, { y: -45, w: 70, h: 90, d: 70, c: color });
        b.top.innerHTML = `<div style="position:absolute;inset:12px;border-radius:50%;border:3px solid var(--accent)"></div>`;
        b.front.innerHTML = `<div class="fk-ledstrip" style="left:32px;top:10px;height:70px"></div>`;
        this.pods.push({ g: inner, z: this.z + (i - (n - 1) / 2) * gap, front: b.front, top: b.top, i });
      }
      box(p, { y: -4, w: 110, h: 8, d: gap * (n - 1) + 110, c: '#0F172A' });
      return 120;
    },
    phone(p, { color }) {
      box(p, { y: -50, w: 120, h: 100, d: 120, c: '#1E293B' });
      const s = g(p, 0, -100, 10, 'rotateX(-10deg)');
      const b = box(s, { y: -80, w: 84, h: 160, d: 8, c: color });
      b.front.style.borderRadius = '12px';
      b.front.innerHTML = `<div class="scr" style="position:absolute;inset:5px;background:#0F172A;border-radius:9px;overflow:hidden;color:#E2E8F0;font:9px system-ui;text-align:center">${this.o.screen || ''}</div>`;
      this.screen = b.front.querySelector('.scr');
      return 285;
    }
  };

  /* ---------- Zones, walls ---------- */
  function zone(stage, parent, { x1, x2, z1, z2, color = '#38BDF8', label = '', sub = '', alpha = .07 }) {
    const w = x2 - x1, d = z2 - z1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, rgba = rgbaOf(color);
    const b = box(parent, { x: cx, y: -3, z: cz, w, h: 6, d, c: color, faces: 'top,front,right,left',
      bg: { top: rgba(alpha), front: rgba(.5), right: rgba(.35), left: rgba(.35) } });
    b.top.style.border = `2px solid ${rgba(.5)}`; b.top.style.borderRadius = '6px';
    if (label) {
      const lw = Math.min(900, w - 40);
      const t = plane(parent, { w: lw, h: 110, t: `translate3d(${x1 + lw / 2 + 24}px,-7px,${z2 - 70}px) rotateX(90deg)`, html: `<div class="fk-zlabel" style="color:${rgba(.85)}">${label}${sub ? `<small>${sub}</small>` : ''}</div>` });
      t.style.pointerEvents = 'none';
    }
    return b;
  }
  // Dashed boundary drawn on the floor through [x, z] points (e.g. a cloud provider's network)
  function outline(stage, parent, { pts, color = '#FF9900', label = '', sub = '', at, width = 8, dash = '34 20', fill = .025 }) {
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]), rgba = rgbaOf(color);
    const x1 = Math.min(...xs) - 20, x2 = Math.max(...xs) + 20, z1 = Math.min(...zs) - 20, z2 = Math.max(...zs) + 20, w = x2 - x1, h = z2 - z1;
    const svg = `<svg width="${w}" height="${h}" viewBox="${x1} ${z1} ${w} ${h}" style="display:block"><polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${rgba(fill)}" stroke="${rgba(.85)}" stroke-width="${width}" stroke-dasharray="${dash}" stroke-linejoin="round"/></svg>`;
    plane(parent, { w, h, t: `translate3d(${(x1 + x2) / 2}px,-9px,${(z1 + z2) / 2}px) rotateX(90deg)`, html: svg }).style.pointerEvents = 'none';
    if (label && at) plane(parent, { w: 900, h: 110, t: `translate3d(${at[0]}px,-10px,${at[1]}px) rotateX(90deg)`, html: `<div class="fk-zlabel" style="color:${rgba(.9)};text-align:right">${label}${sub ? `<small>${sub}</small>` : ''}</div>` }).style.pointerEvents = 'none';
  }
  class Wall {
    constructor(stage, parent, { x, z1, z2, h = 210, lanes = [], gap = 170, color = '#FBBF24', label = '' }) {
      this.x = x; this.z1 = z1; this.z2 = z2; this.gates = {}; this.color = color;
      const rgba = this.rgba = rgbaOf(color);
      const bg = `repeating-linear-gradient(90deg, ${rgba(.26)} 0 2px, transparent 2px 26px), repeating-linear-gradient(0deg, ${rgba(.26)} 0 2px, transparent 2px 26px), ${rgba(.06)}`;
      const edges = [z1, ...lanes.flatMap(l => [l - gap / 2, l + gap / 2]), z2];
      for (let i = 0; i < edges.length; i += 2) {
        const a = edges[i], b = edges[i + 1]; if (b - a < 2) continue;
        const pl = plane(parent, { w: b - a, h, t: `translate3d(${x}px,${-h / 2}px,${(a + b) / 2}px) rotateY(90deg)`, bg, two: true });
        pl.style.borderTop = `3px solid ${rgba(.8)}`;
      }
      for (const l of lanes) {
        const hinge = g(parent, x, 0, l - gap / 2), door = el('div', 'fk-n', hinge);
        const pl = plane(door, { w: gap, h: h * .8, t: `translate3d(0,${-h * .4}px,${gap / 2}px) rotateY(90deg)`, bg: rgba(.22), two: true });
        pl.style.border = `2px solid ${rgba(.9)}`;
        this.gates[l] = { door, pl };
      }
      if (label) this.labelBB = stage.billboard(null, `<div class="fk-label wall" style="border-color:${rgba(.6)};--led:${color}"><i></i>${label}</div>`, { screen: true, p: [x, -h - 20, z1 + 60] });
      stage.onReset(() => Object.values(this.gates).forEach(q => this._paint(q, 'idle')));
    }
    _paint(q, s) { q.pl.style.background = s === 'pass' ? 'rgba(52,211,153,.35)' : s === 'deny' ? 'rgba(244,63,94,.5)' : this.rgba(.22); }
    _state(tl, pos, lane, s) { const q = this.gates[lane]; tl.set(q, 'st', pos, s, v => this._paint(q, v), 'idle'); }
    // Openings are collected and merged per gate when the timeline freezes, so packets that overlap at a gate
    // share one opening instead of snapping the door shut on each other.
    pass(tl, pos, lane, hold = 900) {
      if (!tl._doors) {
        tl._doors = new Map();   // gate -> { wall, iv: [[open, close]] }
        tl.freezers.unshift(t2 => t2._doors.forEach((d, q) => d.wall._emit(t2, q, d.iv)));   // before caption dilation
      }
      const q = this.gates[lane];
      if (!tl._doors.has(q)) tl._doors.set(q, { wall: this, iv: [] });
      tl._doors.get(q).iv.push([pos, pos + hold]);
      return pos + 600;
    }
    _emit(tl, q, iv) {
      iv.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const [a, b] of iv) {
        const m = merged[merged.length - 1];
        if (m && a <= m[1] + 600 + 150) m[1] = Math.max(m[1], b); else merged.push([a, b]);
      }
      for (const [a, b] of merged) {
        tl.set(q, 'st', a, 'pass', v => this._paint(q, v), 'idle');
        tl.add(q.door, { rotateY: [0, -86], duration: 600, ease: 'inOutQuad' }, a);
        tl.add(q.door, { rotateY: [-86, 0], duration: 600, ease: 'inOutQuad' }, b);
        tl.set(q, 'st', b + 600, 'idle', v => this._paint(q, v), 'idle');
      }
    }
    deny(tl, pos, lane) {
      const q = this.gates[lane];
      this._state(tl, pos, lane, 'deny');
      tl.add(q.door, { x: [0, -6, 6, -4, 0], duration: 400, ease: 'linear' }, pos);
      this._state(tl, pos + 1400, lane, 'idle');
      return pos + 400;
    }
  }

  /* ---------- Links (cables) ---------- */
  const LINK_STATES = ['lit', 'mtls', 'ok', 'bad', 'dead', 'dns', 'priv'];
  class Link {
    constructor(stage, parent, pts, { t = 8, cls = '', layer, hidden = false } = {}) {
      this.pts = pts; this.segs = []; this.layer = layer; this.hidden = hidden;
      stage.links.push(this);
      for (let i = 0; i < pts.length - 1; i++) {
        const s = el('div', 'fk-n fk-link ' + cls, parent);
        s.style.transform = orient(pts[i], pts[i + 1]);
        plane(s, { w: t, h: 100, t: 'rotateX(90deg)', two: true, bg: '' });   // no inline background: link colours come from CSS
        plane(s, { w: 100, h: t, t: 'rotateY(90deg)', two: true, bg: '' });
        this.segs.push(s);
      }
      stage.onReset(() => { this.segs.forEach(s => setLinkState(s, '')); this._show(!hidden); });
      this._show(!hidden);
    }
    _show(v) { this.segs.forEach(s => { s.style.display = v ? '' : 'none'; }); }
    show(tl, pos, v) { tl.set(this, 'shown', pos, v, x => this._show(x), !this.hidden); return pos; }
    mark(tl, pos, cls) { this.segs.forEach(s => segState(tl, s, pos, cls)); return pos; }
    clear(tl, pos) { return this.mark(tl, pos, ''); }
  }
  function setLinkState(s, v) { s.classList.remove(...LINK_STATES); if (v) s.classList.add(v); }
  const segState = (tl, s, pos, v) => tl.set(s, 'st', pos, v, x => setLinkState(s, x), '');
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
  const COLORS = { tls: '#38BDF8', mtls: '#A78BFA', open: '#FBBF24', ok: '#34D399', bad: '#F43F5E', attack: '#FB7185', dns: '#F472B6', priv: '#2DD4BF' };
  const LOCKED = new Set(['tls', 'mtls', 'priv']);
  class Packet {
    constructor(stage, parent, { size = 36 } = {}) {
      this.stage = stage; this.size = size; this.p = [0, -60, 0]; this.visible = false;
      this.g = el('div', 'fk-n', parent);
      this.sc = el('div', 'fk-n', this.g);          // scale (appear / vanish)
      this.spin = el('div', 'fk-n', this.sc);       // ambient spin
      stage.spinners.push({ el: this.spin, speed: .1 });
      this.faces = [];
      const s = size, tf = ['', 'rotateY(180deg)', 'rotateY(90deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)'];
      for (const t of tf) {
        const w = g(this.spin, 0, 0, 0, t), f = el('div', 'fk-n', w);
        const pl = plane(f, { w: s, h: s, t: `translateZ(${s / 2}px)`, two: true });
        pl.style.borderRadius = '6px';
        this.faces.push({ f, pl });
      }
      this.core = stage.billboard(this.g, '<div class="fk-core"></div>', { p: [0, 0, 0] });
      this.dot = this.core.el.firstChild;
      this.chip = stage.billboard(null, '', { screen: true, p: () => [this.p[0], this.p[1] - s - 6, this.p[2]] });
      this.bs = { s: 'tls', text: '', sub: '' };
      stage.onFrame.push(() => { this.g.style.transform = `translate3d(${this.p[0]}px,${this.p[1]}px,${this.p[2]}px)`; });
      stage.onReset(() => { this._vis(false); this.setState({ s: 'tls', text: '', sub: '' }); });
      this.setState(this.bs); this._vis(false);
    }
    _vis(v) { this.visible = v; this.g.style.display = v ? '' : 'none'; this.chip.el.style.display = v ? '' : 'none'; }
    setState({ s, text, sub }) {
      const c = COLORS[s] || s;
      for (const q of this.faces) { q.pl.style.background = `${c}33`; q.pl.style.border = `2px solid ${c}`; q.pl.style.boxShadow = `0 0 14px ${c}88, inset 0 0 12px ${c}55`; }
      this.dot.style.background = `radial-gradient(circle at 40% 35%,#fff,${c} 60%)`; this.dot.style.boxShadow = `0 0 18px 4px ${c}`;
      this.chip.el.innerHTML = text ? `<div class="fk-chip" style="--pc:${c}">${LOCKED.has(s) ? LOCK(c) : UNLOCK(c)}<span>${text}</span>${sub ? `<small>${sub}</small>` : ''}</div>` : '';
    }
    // text / sub left undefined keep their previous values
    state_(tl, pos, s, text, sub) {
      const v = this.bs = { s, text: text ?? this.bs.text, sub: sub ?? this.bs.sub };
      tl.set(this, 'state', pos, v, x => this.setState(x), { s: 'tls', text: '', sub: '' });
      return pos;
    }
    _place(tl, pos, dur, ez, val) { tl.fn(this, 'pos', pos, dur, ez, val, p => { this.p = p; }); }
    _show(tl, pos, v) { tl.set(this, 'vis', pos, v, x => this._vis(x), false); }
    appear(tl, pos, p, s = 'tls', text, sub) {
      this._place(tl, pos, 0, 'linear', () => [...p]);
      this.state_(tl, pos, s, text ?? '', sub ?? '');
      tl.add(this.faces.map(q => q.f), { z: [0, 0], opacity: [1, 1], duration: 0 }, pos);
      tl.add(this.dot, { scale: [1, 1], opacity: [1, 1], duration: 0 }, pos);
      this._show(tl, pos, true);
      tl.add(this.sc, { scale: [0, 1], duration: 400, ease: 'outBack(1.6)' }, pos);
      return pos + 400;
    }
    vanish(tl, pos) { tl.add(this.sc, { scale: [1, 0], duration: 250, ease: 'inQuad' }, pos); this._show(tl, pos + 260, false); return pos + 260; }
    // Move along a route ({pts, segs}) lighting the link segments it passes
    travel(tl, pos, r, dur, { cls = 'lit', ease: ez = 'inOutSine' } = {}) {
      const path = pathFn(r.pts), E = ease(ez);
      this._place(tl, pos, dur, ez, k => path.at(k).p);
      if (r.segs) r.segs.forEach((s, k) => { if (s && path.segs[k]) segState(tl, s, pos + dur * invEase(E, path.segs[k].start / path.total), cls); });
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
      tl.add(this.faces.map(q => q.f), { z: (f, i) => 80 + ((i * 53) % 7) * 20, opacity: [1, 0], duration: 700, ease: 'outCubic' }, pos + 150);
      tl.add(this.dot, { scale: [1, 2.5], opacity: [1, 0], duration: 500, ease: 'outQuad' }, pos + 150);
      this._show(tl, pos + 900, false);
      return pos + 900;
    }
  }

  /* ---------- Drill: a node "slides out" into its deployment view; a token walks its internal stages ---------- */
  // o: { at, dx, dy, w, title, sub, frame, lanes: [{ label | box, h, stages: [{label, sub, items}] }], panel: {lane, x, w} }
  // Stage and check states are tracks, so runs can be replayed, scrubbed and reversed like everything else.
  class Drill {
    constructor(stage, o) {
      this.stage = stage; this.o = o;
      const SW = o.sw || 148, GAP = o.gap || 20, PAD = 18, W = o.w;
      const parts = []; this.lanes = [];
      let y = 66;
      o.lanes.forEach((ln, li) => {
        const h = ln.h || 120;
        if (ln.box) { parts.push(`<div class="box" style="left:${PAD - 9}px;top:${y}px;width:${W - 2 * PAD + 18}px;height:${h + 40}px"><span>${ln.box}</span></div>`); y += 30; }
        else if (ln.label) { parts.push(`<div class="lnl" style="left:${PAD}px;top:${y}px">${ln.label}</div>`); y += 18; }
        const top = y, xs = ln.stages.map((_, i) => PAD + i * (SW + GAP));
        ln.stages.forEach((st, i) => {
          if (i) parts.push(`<i class="ar" style="left:${xs[i] - GAP}px;top:${top + 22}px;width:${GAP}px"></i>`);
          parts.push(`<div class="st" data-l="${li}" style="left:${xs[i]}px;top:${top}px;width:${SW}px;height:${h}px"><div class="nm">${st.label}</div><div class="sb">${st.sub || ''}</div>` +
            (st.items || []).map(x => `<div class="ck"><b></b><span>${x}</span></div>`).join('') + `<div class="note"></div></div>`);
        });
        this.lanes.push({ top, h, xs, rowY: top + 22 });
        y = top + h + (ln.box ? 22 : 28);
      });
      const H = y;
      if (o.panel) {
        const first = this.lanes[0], last = this.lanes[this.lanes.length - 1], ln = this.lanes[o.panel.lane ?? 0];
        const top = o.panel.full ? first.top : ln.top, h = o.panel.full ? last.top + last.h - first.top : ln.h;
        parts.push(`<div class="pl" style="left:${o.panel.x}px;top:${top}px;width:${o.panel.w}px;height:${h}px"></div>`);
      }
      Object.assign(this, { SW, W, H });
      const dx = o.dx ?? 60, dy = o.dy ?? -(H + 60);
      const html = `<div class="fk-dwrap" style="transform:translate(${dx}px,${dy}px)">
          <svg class="lead" width="${Math.abs(dx) + 10}" height="${Math.abs(dy) + 10}" style="left:${-dx}px;top:${H}px;position:absolute;overflow:visible"><line x1="0" y1="${-dy - H}" x2="${dx}" y2="0" /></svg>
          <div class="fk-drill" style="width:${W}px;height:${H}px">
            <div class="dh"><b>${o.title}</b><span>${o.sub || ''}</span></div><div class="fr">${o.frame || ''}</div>
            ${parts.join('')}<div class="tok"></div>
          </div></div>`;
      this.bb = stage.billboard(null, html, { screen: true, p: o.at });
      const q = sel => [...this.bb.el.querySelectorAll(sel)];
      this.card = q('.fk-drill')[0]; this.lead = q('.lead')[0]; this.tok = q('.tok')[0]; this.pl = q('.pl')[0];
      const sts = q('.st'); let n = 0;
      this.st = this.lanes.map(ln => ln.xs.map(() => sts[n++]));
      this._vis(false);
      stage.onReset(() => { this._vis(false); sts.forEach(e => { e.className = 'st'; e.querySelector('.note').textContent = ''; }); q('.ck').forEach(e => { e.className = 'ck'; }); this.tok.className = 'tok'; if (this.pl) this.pl.innerHTML = ''; });
    }
    _vis(v) { this.bb.el.style.display = v ? '' : 'none'; }
    pos([l, i]) { const ln = this.lanes[l]; return [ln.xs[i] + this.SW / 2, ln.rowY]; }
    stState(tl, pos, li, v, note = '') { const e = this.st[li[0]][li[1]]; tl.set(e, 'st', pos, [v, note], ([x, nt]) => { e.className = 'st' + (x ? ' ' + x : ''); e.querySelector('.note').textContent = nt; }, ['', '']); return pos; }
    ckState(tl, pos, e, v) { tl.set(e, 'ck', pos, v, x => { e.className = 'ck' + (x ? ' on ' + x : ''); }, ''); return pos; }
    tokState(tl, pos, v) { tl.set(this.tok, 'cls', pos, v, x => { this.tok.className = 'tok' + (x ? ' ' + x : ''); }, ''); return pos; }
    panel(tl, pos, html) { if (this.pl) tl.set(this.pl, 'html', pos, html, x => { this.pl.innerHTML = x; }, ''); return pos; }
    clear(tl, pos) {
      this.st.flat().forEach((e, k) => { tl.set(e, 'st', pos, ['', ''], ([x, nt]) => { e.className = 'st' + (x ? ' ' + x : ''); e.querySelector('.note').textContent = nt; }, ['', '']); e.querySelectorAll('.ck').forEach(c => this.ckState(tl, pos, c, '')); });
      return this.tokState(tl, pos, '');
    }
    moveTo(tl, pos, xy, dur = 450) { tl.add(this.tok, { x: xy[0], y: xy[1], duration: dur, ease: 'inOutSine' }, pos); return pos + dur; }
    move(tl, pos, li, dur) { return this.moveTo(tl, pos, this.pos(li), dur); }
    open(tl, pos, dur = 700) {
      tl.set(this, 'vis', pos, true, v => this._vis(v), false);
      tl.add(this.card, { scale: [.04, 1], opacity: [0, 1], duration: dur, ease: 'outBack(1.2)' }, pos);
      tl.add(this.lead, { opacity: [0, 1], duration: dur, ease: 'linear' }, pos);
      tl.add(this.tok, { x: [-24, -24], y: [this.lanes[0].rowY, this.lanes[0].rowY], opacity: [0, 0], duration: 0 }, pos);
      return pos + dur;
    }
    enter(tl, pos) {
      tl.add(this.tok, { x: [-24, -24], y: [this.lanes[0].rowY, this.lanes[0].rowY], duration: 0 }, pos);
      tl.add(this.tok, { opacity: [0, 1], duration: 200 }, pos); return pos + 200;
    }
    // Visit a stage: move there, light it, tick each check with its status ('pass' | 'fail' | 'skip'), then settle
    visit(tl, pos, li, { st, verdict, tick = 420, hold = 450, keep = false, note = '' } = {}) {
      const e = this.st[li[0]][li[1]], cks = [...e.querySelectorAll('.ck')];
      pos = this.move(tl, pos, li);
      this.stState(tl, pos, li, 'active');
      cks.forEach((c, j) => this.ckState(tl, pos + 250 + j * tick, c, (st && st[j]) || 'pass'));
      pos += 250 + cks.length * tick + hold + this.stage.readTime * .6;
      const v = verdict || ((st || []).includes('fail') ? 'fail' : 'done');
      if (!keep || v === 'fail') this.stState(tl, pos, li, v, note);
      return pos;
    }
    skip(tl, pos, li, note) { const e = this.st[li[0]][li[1]]; this.stState(tl, pos, li, 'skip', note); e.querySelectorAll('.ck').forEach(c => this.ckState(tl, pos, c, 'skip')); return pos; }
    exit(tl, pos, dir = 1) {
      pos = this.moveTo(tl, pos, [dir > 0 ? this.W + 24 : -24, this.lanes[0].rowY], dir > 0 ? 500 : 900);
      tl.add(this.tok, { opacity: [1, 0], duration: 200 }, pos); return pos + 200;
    }
    close(tl, pos, dur = 500) {
      tl.add(this.card, { scale: [1, .04], opacity: [1, 0], duration: dur, ease: 'inBack(1.2)' }, pos);
      tl.add(this.lead, { opacity: [1, 0], duration: dur, ease: 'linear' }, pos);
      tl.set(this, 'vis', pos + dur, false, v => this._vis(v), false);
      return pos + dur;
    }
  }

  /* ---------- Dot: a small glowing token with a fading tail, for subtle flows (e.g. DNS lookups) ---------- */
  class Dot {
    constructor(stage, parent, { color = '#E2E8F0', size = 11, tail = 5, lag = .018 } = {}) {
      this.p = [0, 0, 0]; this.path = null; this.k = 0; this.visible = false;
      const mk = (sz, op) => stage.billboard(parent, `<div class="fk-dot" style="--c:${color};width:${sz}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz / 2}px;opacity:${op}"></div>`, { p: [0, 0, 0] });
      this.head = mk(size, 1); this.head.p = () => this.p;
      this.tail = Array.from({ length: tail }, (_, i) => {
        const b = mk(size * (1 - (i + 1) / (tail + 1.5)), .55 * (1 - i / tail));
        b.p = () => this.path ? this.path.at(Math.max(0, this.k - lag * (i + 1))).p : this.p;
        return b;
      });
      this._vis(false); stage.onReset(() => this._vis(false));
    }
    _vis(v) { this.visible = v; [this.head, ...this.tail].forEach(b => { b.el.style.display = v ? '' : 'none'; }); }
    show(tl, pos, v) { tl.set(this, 'vis', pos, v, x => this._vis(x), false); return pos; }
    travel(tl, pos, pts, dur, ez = 'inOutSine') {
      const path = pathFn(pts), E = ease(ez);
      tl.fn(this, 'pos', pos, dur, 'linear', k => [path, E(k)], ([pa, kk]) => { this.path = pa; this.k = kk; this.p = pa.at(kk).p; });
      return pos + dur;
    }
  }

  /* ---------- Effects ---------- */
  function ring(stage, parent, tl, pos, p, color = '#38BDF8', size = 140) {
    const b = stage.billboard(parent, `<div style="width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;border:3px solid ${color};box-shadow:0 0 16px ${color}"></div>`, { p });
    b.el.style.display = 'none'; tl.own(() => stage.removeBillboard(b));
    const vis = v => { b.el.style.display = v ? '' : 'none'; };
    tl.set(b, 'vis', pos, true, vis, false); tl.set(b, 'vis', pos + 900, false);
    tl.add(b.el.firstChild, { scale: [.15, 1.6], opacity: [1, 0], duration: 900, ease: 'outQuad' }, pos);
    return pos;
  }
  // Small token flying from a to b (spans to the obs wall, cookies, bot swarms...)
  function fly(stage, parent, tl, pos, a, b, { color = '#A78BFA', dur = 900, size = 10, arc: h = -200, html, ease: ez = 'inOutSine' } = {}) {
    const o = { t: 0 };
    const d = stage.billboard(parent, html || `<div style="width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;background:${color};box-shadow:0 0 10px 2px ${color}"></div>`,
      { p: () => { const p = lerp3(a, b, o.t); p[1] += h * Math.sin(Math.PI * o.t); return p; } });
    d.el.style.display = 'none'; tl.own(() => stage.removeBillboard(d));
    const vis = v => { d.el.style.display = v ? '' : 'none'; };
    tl.set(d, 'vis', pos, true, vis, false); tl.set(d, 'vis', pos + dur, false);
    tl.add(o, { t: [0, 1], duration: dur, ease: ez }, pos);
    return pos + dur;
  }

  /* ---------- Player: chapters, transport, fine scrubbing ---------- */
  const ICON = {
    start: '<path d="M6 5v14M19 5l-10 7 10 7z"/>',
    prevStep: '<path d="M11 5l-8 7 8 7zM21 5l-8 7 8 7z"/>',
    back: '<path d="M15 6l-7 6 7 6"/>',
    rev: '<path d="M17 5L6 12l11 7z"/>',
    play: '<path d="M7 5l11 7-11 7z"/>',
    pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
    fwd: '<path d="M9 6l7 6-7 6"/>',
    nextStep: '<path d="M3 5l8 7-8 7zM13 5l8 7-8 7z"/>',
    end: '<path d="M18 5v14M5 5l10 7-10 7z"/>',
    loop: '<path d="M4 12a6 6 0 0 1 6-6h8M15 3l3 3-3 3M20 12a6 6 0 0 1-6 6H6M9 21l-3-3 3-3" fill="none"/>'
  };
  const svg = k => `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="${k === 'back' || k === 'fwd' || k === 'loop' ? 2.2 : 0}" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
  const fmt = ms => { ms = Math.max(0, Math.round(ms)); const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
  const SPEEDS = [.1, .25, .5, 1, 2, 4];

  class Player {
    constructor(stage, host, chapters, { fps = 30 } = {}) {
      this.stage = stage; this.chapters = chapters; this.tl = null; this.idx = -1;
      this.time = 0; this.playing = false; this.rate = 1; this.dir = 1; this.loop = false; this.all = false;
      this.frameMs = 1000 / fps;
      this._ui(host);
      stage.beforeFrame.push(dt => this.tick(dt));
      stage.onLayerClick = () => this.pause();
      this._keys();
    }
    _ui(host) {
      host.classList.add('fk-player'); this.host = host;
      host.innerHTML = `
        <div class="fk-chapters"></div>
        <div class="fk-scrub">
          <div class="fk-steps"></div>
          <div class="fk-track"><div class="fk-ruler"></div><div class="fk-fill"></div><div class="fk-marks"></div><div class="fk-head"><i></i></div><div class="fk-tip"></div></div>
        </div>
        <div class="fk-transport">
          <div class="grp">
            <button data-a="start" title="Go to start (Home)">${svg('start')}</button>
            <button data-a="prevStep" title="Previous step ( [ )">${svg('prevStep')}</button>
            <button data-a="back" title="Back one frame ( , or ← ) · Shift: 1 s">${svg('back')}</button>
            <button data-a="rev" title="Play backwards (J)">${svg('rev')}</button>
            <button data-a="play" class="big" title="Play / pause (Space)">${svg('play')}</button>
            <button data-a="fwd" title="Forward one frame ( . or → ) · Shift: 1 s">${svg('fwd')}</button>
            <button data-a="nextStep" title="Next step ( ] )">${svg('nextStep')}</button>
            <button data-a="end" title="Go to end (End)">${svg('end')}</button>
          </div>
          <div class="fk-time"><span class="cur">00:00.000</span><span class="dur">/ 00:00.000</span></div>
          <div class="fk-stepname"></div>
          <div class="sp"></div>
          <div class="grp speed" title="Playback speed (J / K / L shuttle)">${SPEEDS.map(s => `<button data-s="${s}">${s}×</button>`).join('')}</div>
          <button data-a="loop" class="tg" title="Loop chapter">${svg('loop')}</button>
        </div>
        <div class="fk-options">
          <button data-a="all" class="tg" title="Play every chapter in order">Play all chapters</button>
          <div class="sp"></div>
          <button data-t="trace" class="tg on" title="Trace panel (T)">Trace</button>
          <button data-t="labels" class="tg on" title="Device labels (N)">Labels</button>
          <button data-t="legend" class="tg on" title="Layer legend (Y)">Layers</button>
          <button data-a="reset" title="Reset camera (R)">Reset view</button>
          <button data-a="link" title="Copy a link to this exact moment">Copy link</button>
          <button data-a="help" title="Keyboard shortcuts (?)">?</button>
        </div>
        <div class="fk-help" hidden>
          <b>Playback</b><span>Space play / pause · J reverse · K pause · L forward (press again to speed up)</span>
          <b>Scrub</b><span>← → one frame · Shift+← → one second · Alt+← → 100 ms · , . one frame · [ ] previous / next step · Home / End</span>
          <b>Timeline</b><span>Drag to scrub · hold Shift while dragging for 10× finer control · wheel over the timeline steps frame by frame · click a step to jump to it</span>
          <b>Camera</b><span>Drag the scene to orbit · right-drag or Shift-drag to pan · wheel to zoom · double-click or R to reset · F to follow the script</span>
          <b>Explore</b><span>Click any device for details · hover a layer in the legend to isolate it · click a layer to fly there</span>
          <b>Chapters</b><span>1–9 pick from the first row · Shift+1–9 from the second · T trace · N labels · Y layers · Esc close panels</span>
        </div>`;
      const q = s => host.querySelector(s);
      this.ui = {
        chapters: q('.fk-chapters'), steps: q('.fk-steps'), track: q('.fk-track'), ruler: q('.fk-ruler'), fill: q('.fk-fill'), marks: q('.fk-marks'),
        head: q('.fk-head'), tip: q('.fk-tip'), cur: q('.fk-time .cur'), dur: q('.fk-time .dur'), stepname: q('.fk-stepname'),
        play: q('[data-a=play]'), rev: q('[data-a=rev]'), loop: q('[data-a=loop]'), all: q('[data-a=all]'), help: q('.fk-help'), scrub: q('.fk-scrub')
      };
      // Chapters can be grouped into labelled rows (e.g. Layers / Journeys); keys 1-9 pick from the first row, Shift+1-9 from the second
      const groups = this.groups = [...new Set(this.chapters.map(c => c.group || ''))];
      const rows = groups.map((gname, gi) => { const r = el('div', 'fk-chrow', this.ui.chapters, gname ? `<span class="lbl">${gname}</span>` : ''); r.dataset.g = gi; return r; });
      const seen = groups.map(() => 0);
      this.chBtns = this.chapters.map((c, i) => {
        const gi = groups.indexOf(c.group || ''), n = ++seen[gi];
        c._key = gi === 0 ? String(n) : gi === 1 ? '⇧' + n : '';
        const b = el('button', '', rows[gi], `<em>${c._key}</em>${c.title}`); b.onclick = () => { this.load(i); this.play(); }; return b;
      });
      host.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.s) { this.setRate(+b.dataset.s); return; }
        if (b.dataset.t) { this.toggleView(b.dataset.t); return; }
        const a = b.dataset.a;
        const acts = {
          start: () => this.seek(0), end: () => this.seek(this.duration), back: () => this.step(e.shiftKey ? -1000 : -this.frameMs), fwd: () => this.step(e.shiftKey ? 1000 : this.frameMs),
          prevStep: () => this.jumpStep(-1), nextStep: () => this.jumpStep(1), play: () => this.toggle(1), rev: () => this.toggle(-1),
          loop: () => { this.loop = !this.loop; this._paintButtons(); }, all: () => { this.all = !this.all; this._paintButtons(); if (this.all && !this.playing) this.play(); },
          reset: () => this.stage.follow(), link: () => this.copyLink(b), help: () => { this.ui.help.hidden = !this.ui.help.hidden; }
        };
        acts[a] && acts[a]();
      });
      this._scrubber();
      this._paintButtons();
    }
    get duration() { return this.tl ? this.tl.duration : 0; }
    load(i) {
      if (this.tl) this.tl.dispose();
      this.stage.reset(); this.stage.explore = null;
      const tl = new Timeline(this.stage);
      this.stage.caption.chapter = this.chapters[i].title;
      this.chapters[i].build(tl);
      tl.freeze();
      this.tl = tl; this.idx = i; this.time = 0; this._rt = undefined; this._endWait = 0;
      tl.render(0); this._rt = 0;
      this.chBtns.forEach((b, k) => b.classList.toggle('on', k === i));
      this._buildTimeline();
      this._paint(true);
      return tl;
    }
    play(dir = 1) {
      if (!this.tl) return;
      this.dir = dir;
      if (dir > 0 && this.time >= this.duration) this.time = 0;
      if (dir < 0 && this.time <= 0) this.time = this.duration;
      this.playing = true; this.stage.explore = null; this._paintButtons();
    }
    pause() { this.playing = false; this._paintButtons(); }
    toggle(dir = 1) { if (this.playing && this.dir === dir) this.pause(); else this.play(dir); }
    setRate(r) { this.rate = r; this._paintButtons(); }
    seek(ms) { if (!this.tl) return; this.time = clamp(ms, 0, this.duration); this._render(); }
    step(ms) { this.pause(); this.seek(this.time + ms); }
    jumpStep(d) {
      const m = this.tl ? this.tl.markers : []; if (!m.length) return;
      this.pause();
      if (d > 0) { const n = m.find(x => x.pos > this.time + 1); this.seek(n ? n.pos : this.duration); }
      else { const p = [...m].reverse().find(x => x.pos < this.time - 150); this.seek(p ? p.pos : 0); }
    }
    tick(dt) {
      if (!this.tl) return;
      if (this.playing) {
        const D = this.duration; let t = this.time + dt * this.rate * this.dir;
        if (this.dir > 0 && t >= D) {
          t = D;
          if (this.loop) t = 0;
          else if (this.all && this.idx < this.chapters.length - 1) { this._endWait += dt; if (this._endWait > 1200) { this.load(this.idx + 1); this.play(); return; } }
          else this.pause();
        }
        if (this.dir < 0 && t <= 0) { t = 0; if (this.loop) t = D; else this.pause(); }
        this.time = t;
      }
      this._render();
    }
    _render() { if (this.time !== this._rt) { this.tl.render(this.time); this._rt = this.time; } this._paint(); }
    _paint(force) {
      const D = this.duration || 1, t = this.time;
      if (!force && t === this._pt) return; this._pt = t;
      const pct = (t / D * 100).toFixed(3) + '%';
      this.ui.head.style.left = pct; this.ui.fill.style.width = pct;
      this.ui.cur.textContent = fmt(t); this.ui.dur.textContent = '/ ' + fmt(this.duration);
      const m = this.tl.markers; let k = -1;
      for (let i = 0; i < m.length; i++) if (m[i].pos <= t) k = i;
      if (k !== this._step) {
        this._step = k;
        [...this.ui.steps.children].forEach((c, i) => c.classList.toggle('on', i === k));
        this.ui.stepname.textContent = k >= 0 ? m[k].step : '';
      }
    }
    _paintButtons() {
      this.ui.play.innerHTML = svg(this.playing && this.dir > 0 ? 'pause' : 'play');
      this.ui.rev.innerHTML = svg(this.playing && this.dir < 0 ? 'pause' : 'rev');
      this.ui.play.classList.toggle('on', this.playing && this.dir > 0);
      this.ui.rev.classList.toggle('on', this.playing && this.dir < 0);
      this.ui.loop.classList.toggle('on', this.loop); this.ui.all.classList.toggle('on', this.all);
      this.host.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', +b.dataset.s === this.rate));
      if (!SPEEDS.includes(this.rate)) this.ui.stepname.dataset.rate = this.rate + '×'; else delete this.ui.stepname.dataset.rate;
    }
    _buildTimeline() {
      const D = this.duration || 1, m = this.tl.markers;
      this.ui.steps.innerHTML = m.map((x, i) => {
        const end = i < m.length - 1 ? m[i + 1].pos : D;
        return `<div style="left:${x.pos / D * 100}%;width:${(end - x.pos) / D * 100}%" data-i="${i}" title="${fmt(x.pos)} · ${x.step}: ${x.text}"><span>${x.step}</span></div>`;
      }).join('');
      this.ui.marks.innerHTML = m.map(x => `<i style="left:${x.pos / D * 100}%"></i>`).join('');
      let r = '';
      for (let s = 0; s * 1000 <= D; s++) r += `<i class="${s % 5 ? '' : 'mj'}" style="left:${s * 1000 / D * 100}%">${s % 5 ? '' : `<span>${s}s</span>`}</i>`;
      this.ui.ruler.innerHTML = r;
      this._step = undefined;
    }
    _scrubber() {
      const { scrub, tip, steps } = this.ui;
      const tAt = x => { const r = this.ui.track.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * this.duration; };
      const msPerPx = () => this.duration / this.ui.track.getBoundingClientRect().width;
      const stepAt = t => { const m = this.tl ? this.tl.markers : []; let k = null; for (const x of m) if (x.pos <= t) k = x; return k; };
      const showTip = (x, t, fine) => {
        const r = scrub.getBoundingClientRect(), s = stepAt(t);
        tip.textContent = fmt(t) + (s ? ' · ' + s.step : '') + (fine ? '  (fine)' : '');
        tip.style.left = clamp(x - r.left, 60, r.width - 60) + 'px'; tip.classList.add('on');
      };
      let drag = null;
      scrub.addEventListener('pointerdown', e => {
        if (!this.tl) return;
        const seg = e.target.closest('.fk-steps > div');
        drag = { x: e.clientX, wasPlaying: this.playing, seg, moved: false };
        this.pause(); scrub.setPointerCapture(e.pointerId);
        if (!seg) this.seek(tAt(e.clientX));
        showTip(e.clientX, this.time, e.shiftKey);
      });
      scrub.addEventListener('pointermove', e => {
        if (!this.tl) return;
        if (!drag) { showTip(e.clientX, tAt(e.clientX), false); return; }
        const dx = e.clientX - drag.x; if (Math.abs(dx) < 1) return;
        drag.moved = true; drag.x = e.clientX;
        if (e.shiftKey) this.seek(this.time + dx * msPerPx() * .1);
        else this.seek(tAt(e.clientX));
        showTip(e.clientX, this.time, e.shiftKey);
      });
      const end = e => {
        if (!drag) return;
        if (drag.seg && !drag.moved) this.seek(this.tl.markers[+drag.seg.dataset.i].pos);
        if (drag.wasPlaying) this.play(this.dir);
        drag = null;
      };
      scrub.addEventListener('pointerup', end); scrub.addEventListener('pointercancel', end);
      scrub.addEventListener('pointerleave', () => { if (!drag) tip.classList.remove('on'); });
      let acc = 0;
      scrub.addEventListener('wheel', e => {
        e.preventDefault(); acc += e.deltaY || e.deltaX;
        const n = Math.trunc(acc / 30); if (!n) return; acc -= n * 30;
        this.step(n * (e.shiftKey ? 10 : 1) * this.frameMs); showTip(e.clientX, this.time, false);
      }, { passive: false });
      steps.addEventListener('dblclick', e => e.preventDefault());
    }
    toggleView(k) {
      const f = this.stage.frame, cls = { trace: 'no-trace', labels: 'no-labels', legend: 'no-legend' }[k];
      const off = f.classList.toggle(cls);
      const b = this.host.querySelector(`[data-t=${k}]`); if (b) b.classList.toggle('on', !off);
    }
    copyLink(btn) {
      const u = new URL(location.href); u.searchParams.set('ch', this.idx + 1); u.searchParams.set('t', Math.round(this.time));
      const done = () => { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(u.toString()).then(done, () => prompt('Link to this moment', u.toString()));
      else prompt('Link to this moment', u.toString());
    }
    _keys() {
      addEventListener('keydown', e => {
        if (e.target.closest && e.target.closest('input, select, textarea')) return;
        if (e.metaKey || e.ctrlKey) return;
        const k = e.key, big = e.shiftKey ? 1000 : e.altKey ? 100 : this.frameMs;
        const map = {
          ' ': () => this.toggle(this.playing ? this.dir : 1),
          ArrowRight: () => this.step(big), ArrowLeft: () => this.step(-big),
          '.': () => this.step(this.frameMs), ',': () => this.step(-this.frameMs),
          ']': () => this.jumpStep(1), '[': () => this.jumpStep(-1),
          Home: () => this.seek(0), End: () => this.seek(this.duration),
          k: () => this.pause(), K: () => this.pause(),
          l: () => this.shuttle(1), L: () => this.shuttle(1), j: () => this.shuttle(-1), J: () => this.shuttle(-1),
          f: () => this.stage.follow(), F: () => this.stage.follow(), r: () => this.stage.resetView(), R: () => this.stage.resetView(),
          t: () => this.toggleView('trace'), T: () => this.toggleView('trace'), n: () => this.toggleView('labels'), N: () => this.toggleView('labels'),
          y: () => this.toggleView('legend'), Y: () => this.toggleView('legend'),
          '?': () => { this.ui.help.hidden = !this.ui.help.hidden; },
          Escape: () => { this.ui.help.hidden = true; this.stage.select(null); }
        };
        const dm = /^Digit([1-9])$/.exec(e.code || '');
        if (dm) {
          const gi = e.shiftKey ? 1 : 0, list = this.chapters.map((c, i) => [c, i]).filter(([c]) => (this.groups.indexOf(c.group || '')) === gi), hit = list[+dm[1] - 1];
          if (hit) { this.load(hit[1]); this.play(); e.preventDefault(); return; }
        }
        if (map[k]) { map[k](); e.preventDefault(); }
      });
    }
    // J / L shuttle: press again in the same direction to double the speed
    shuttle(dir) {
      if (this.playing && this.dir === dir) this.setRate(Math.min(8, this.rate * 2));
      else { this.setRate(1); this.play(dir); }
    }
  }

  global.FlowKit = { el, g, box, plane, orient, pathFn, arc, lerp3, route, shade, ease, invEase, Timeline, Stage, Trace, Budget, ObsWall, Device, Wall, Link, Packet, Dot, Drill, zone, outline, ring, fly, Player, COLORS };
})(window);
