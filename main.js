/* FAST Heart Particles — Optimized for mobile/GPUs
   - Pre-rendered sprites (sharp + glow)
   - Capped DPR
   - Fewer particles by default
*/
(() => {
  const cnv = document.getElementById('heart');
  const ctx = cnv.getContext('2d', { alpha: false });

  // === Performance knobs ===
  const DPR_CAP = 1.25;         // bajar si sigue pesado (1.0–1.25)
  const COUNT   = 850;           // subir/bajar densidad (600–1200)
  const REPULSE_RADIUS = 120;    // bajar para menos cálculos
  const RETURN_SPRING  = 0.06;
  const FRICTION       = 0.86;
  const REVEAL_SPEED   = 0.014;
  const THICKNESS      = 0.03;

  const COLOR       = '#ff5fa2';
  const COLOR_SOFT  = '#ff8fc0';
  const BG          = '#000';

  let DPR = Math.min(DPR_CAP, window.devicePixelRatio || 1);

  // Sprites (pre-rendered)
  let dotSprite, glowSprite;

  // Fondo cacheado
  let bgFill = null;

  // Partículas
  let particles = [];
  let pointer = { x: 0, y: 0, down:false, inside:false };
  let pulse = 0, revealT = 0;

  function makeDot(radius = 2, glow = false) {
    const s = Math.ceil((radius + (glow ? 16 : 0)) * 2);
    const off = document.createElement('canvas');
    off.width = off.height = s;
    const c = off.getContext('2d');

    c.translate(s/2, s/2);
    if (glow) {
      c.shadowColor = COLOR_SOFT;
      c.shadowBlur = 16;        // solo una vez, no por frame
    }
    c.fillStyle = COLOR;
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI*2);
    c.fill();

    return off;
  }

  function heartPoint(t, scale, cx, cy) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    return { x: cx + (x * scale), y: cy - (y * scale) };
  }

  function rebuild() {
    const w = cnv.width / DPR, h = cnv.height / DPR;

    // Fondo cacheado (una vez por resize)
    const g = ctx.createRadialGradient(w*0.5, h*0.5, Math.min(w,h)*0.1, w*0.5, h*0.5, Math.max(w,h)*0.6);
    g.addColorStop(0, BG);
    g.addColorStop(1, BG);
    bgFill = g;

    // Sprites
    dotSprite  = makeDot(1.8, false);
    glowSprite = makeDot(1.8, true);

    const scale = Math.min(w, h) * 0.02;
    const cx = w * 0.5;
    const cy = h * 0.55;

    particles = [];
    for (let i=0; i<COUNT; i++){
      const t = (i / COUNT) * Math.PI * 2 + (Math.random()-0.5)*0.003;
      const p = heartPoint(t, scale, cx, cy);
      const angle = t + Math.PI/2;
      const r = (Math.random()*2 - 1) * THICKNESS * Math.min(w,h);
      const tx = p.x + Math.cos(angle) * r;
      const ty = p.y + Math.sin(angle) * r;

      particles.push({
        x: cx + (Math.random()-0.5)*10,
        y: cy + (Math.random()-0.5)*10,
        vx: 0, vy: 0,
        tx, ty,
        order: i / COUNT,
        size: 1 + Math.random()*1.2
      });
    }
    revealT = 0;
  }

  function resize() {
    DPR = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    const { innerWidth:w, innerHeight:h } = window;
    cnv.width  = Math.floor(w * DPR);
    cnv.height = Math.floor(h * DPR);
    cnv.style.width = w + 'px';
    cnv.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    rebuild();
  }

  function onPointer(e){
    pointer.down = e.type === 'pointerdown' ? true :
                   e.type === 'pointerup'   ? false : pointer.down;
    if (e.type === 'pointerenter') pointer.inside = true;
    if (e.type === 'pointerleave') { pointer.inside = false; pointer.down=false; }

    if (e.type === 'pointermove' || e.type === 'pointerdown' || e.type === 'pointerup'){
      const rect = cnv.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left);
      pointer.y = (e.clientY - rect.top);
    }
    if (e.type === 'click' || e.type === 'pointerdown'){ pulse = 1; }
  }

  const R2 = REPULSE_RADIUS * REPULSE_RADIUS;

  function step() {
    const w = cnv.width / DPR, h = cnv.height / DPR;

    // Fondo (cacheado)
    ctx.fillStyle = bgFill;
    ctx.fillRect(0,0,w,h);

    if (revealT < 1) revealT = Math.min(1, revealT + REVEAL_SPEED);
    if (pulse > 0)   pulse   = Math.max(0, pulse - 0.045);

    // Dibujamos glow en una pasada y luego el punto nítido
    for (let i=0; i<particles.length; i++){
      const p = particles[i];
      if (p.order <= revealT){
        const spring = RETURN_SPRING * (1 + pulse*0.4);
        p.vx += (p.tx - p.x) * spring;
        p.vy += (p.ty - p.y) * spring;
      }

      if (pointer.inside){
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < R2){
          const dist = Math.max(12, Math.sqrt(d2));
          const force = (1100 / (dist*dist));  // REPULSE_FORCE
          p.vx += (dx/dist) * force;
          p.vy += (dy/dist) * force;
        }
      }

      p.vx *= FRICTION;
      p.vy *= FRICTION;
      p.x  += p.vx;
      p.y  += p.vy;
    }

    // Render (dos imágenes por partícula: glow+sharp)
    const k = 1 + pulse*0.6;
    for (let i=0; i<particles.length; i++){
      const p = particles[i];
      const s = p.size * k;
      // glow (barato: drawImage del sprite ya borroso)
      const gw = glowSprite.width, gh = glowSprite.height;
      ctx.drawImage(glowSprite, p.x - gw/2, p.y - gh/2);
      // punto nítido
      const dw = dotSprite.width * (s/1.8);
      const dh = dotSprite.height * (s/1.8);
      ctx.drawImage(dotSprite, p.x - dw/2, p.y - dh/2, dw, dh);
    }

    requestAnimationFrame(step);
  }

  // Eventos
  window.addEventListener('resize', resize);
  cnv.addEventListener('pointerenter', onPointer);
  cnv.addEventListener('pointerleave', onPointer);
  cnv.addEventListener('pointermove', onPointer);
  cnv.addEventListener('pointerdown', onPointer);
  cnv.addEventListener('pointerup', onPointer);
  cnv.addEventListener('click', onPointer);
  cnv.addEventListener('touchstart', e => { e.preventDefault(); }, {passive:false});

  // Init
  resize();
  requestAnimationFrame(step);
})();
