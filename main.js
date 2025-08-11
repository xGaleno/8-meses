/* Heart Particles — HTML5 Canvas
   Interacciones:
   - Hover / touchmove: repulsión (se abre y vuelve)
   - Click / tap: pulso tipo “latido”
   Sin librerías.  */
(() => {
  const cnv = document.getElementById('heart');
  const ctx = cnv.getContext('2d');

  // DPI scaling para nitidez
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  // Configuración estética
  const COLOR = '#ff5fa2';
  const COLOR_SOFT = '#ff8fc0';
  const BG = '#000000';

  // Partículas
  const COUNT = 1500;        // cantidad total
  const THICKNESS = 0.035;   // grosor del trazo (desvío aleatorio)
  const REVEAL_SPEED = 0.012;// velocidad de “dibujo” inicial (0..1)
  const RETURN_SPRING = 0.06;// fuerza de regreso a su destino
  const FRICTION = 0.86;     // freno del movimiento
  const REPULSE_FORCE = 1100;// fuerza de repulsión del puntero
  const REPULSE_RADIUS = 130;// radio efectivo (en px canvas)
  const GLOW = 18;           // blur base

  let particles = [];
  let pointer = { x: 0, y: 0, down:false, inside:false };
  let pulse = 0; // 0..1 para el “latido”
  let revealT = 0; // progreso de dibujo 0..1

  function resize() {
    const { innerWidth:w, innerHeight:h } = window;
    cnv.width = Math.floor(w * DPR);
    cnv.height = Math.floor(h * DPR);
    cnv.style.width = w + 'px';
    cnv.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    rebuild();
  }

  // Paramétricas del corazón (símbolo clásico)
  // Escalamos y centramos según el viewport
  function heartPoint(t, scale, cx, cy) {
    // t en [0, 2π]
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    return {
      x: cx + (x * scale),
      y: cy - (y * scale)
    };
  }

  // Construye partículas ubicadas a lo largo de la curva con un pequeño grosor
  function rebuild() {
    const w = cnv.width / DPR;
    const h = cnv.height / DPR;

    const scale = Math.min(w, h) * 0.02; // tamaño del corazón
    const cx = w * 0.5;
    const cy = h * 0.55;

    particles = [];
    for (let i=0; i<COUNT; i++){
      // distribuimos t con leve jitter para llenar huecos
      const t = (i / COUNT) * Math.PI * 2 + (Math.random()-0.5)*0.003;
      const p = heartPoint(t, scale, cx, cy);

      // engrosar borde con ruido perpendicular
      const angle = t + Math.PI/2;
      const r = (Math.random()*2 - 1) * THICKNESS * Math.min(w,h);
      const tx = p.x + Math.cos(angle) * r;
      const ty = p.y + Math.sin(angle) * r;

      // posición inicial: centro (se “dibuja” al ir apareciendo)
      const startX = cx + (Math.random()-0.5)*10;
      const startY = cy + (Math.random()-0.5)*10;

      particles.push({
        x: startX,
        y: startY,
        vx: 0, vy: 0,
        tx, ty,
        // “orden” de revelado: a lo largo del trazo
        order: i / COUNT,
        size: 1 + Math.random()*1.4
      });
    }
    revealT = 0; // reiniciar anim de dibujo al redimensionar
  }

  function onPointer(e){
    pointer.down = e.type === 'pointerdown';
    if (e.type === 'pointerup') pointer.down = false;
    if (e.type === 'pointerenter') pointer.inside = true;
    if (e.type === 'pointerleave') { pointer.inside = false; pointer.down=false; }

    if (e.type === 'pointermove' || e.type === 'pointerdown' || e.type === 'pointerup'){
      const rect = cnv.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left);
      pointer.y = (e.clientY - rect.top);
    }
    if (e.type === 'click' || e.type === 'pointerdown'){
      // latido
      pulse = 1;
    }
  }

  function step() {
    ctx.clearRect(0,0,cnv.width,cnv.height);

    // Fondo (ligero viñeteo sutil con radial gradient, sin costo grande)
    const w = cnv.width / DPR, h = cnv.height / DPR;
    const g = ctx.createRadialGradient(w*0.5, h*0.5, Math.min(w,h)*0.1, w*0.5, h*0.5, Math.max(w,h)*0.6);
    g.addColorStop(0, BG);
    g.addColorStop(1, BG);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // Avanza revelado
    if (revealT < 1) revealT = Math.min(1, revealT + REVEAL_SPEED);

    // Disipa pulso
    if (pulse > 0) pulse = Math.max(0, pulse - 0.045);

    // Glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = COLOR_SOFT;
    ctx.shadowBlur = GLOW + pulse*24;

    // Dibujar partículas
    for (const p of particles){
      // Progreso de revelado: sólo animar las que “tocan” el orden
      const appear = (p.order <= revealT);

      // Fuerza hacia el destino (primavera)
      if (appear){
        const spring = RETURN_SPRING * (1 + pulse*0.4); // más rápido durante el latido
        p.vx += (p.tx - p.x) * spring;
        p.vy += (p.ty - p.y) * spring;
      }

      // Repulsión del puntero
      if (pointer.inside){
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx*dx + dy*dy;
        const r = REPULSE_RADIUS;
        if (d2 < r*r){
          const dist = Math.max(12, Math.sqrt(d2));
          const force = (REPULSE_FORCE / (dist*dist));
          p.vx += (dx/dist) * force;
          p.vy += (dy/dist) * force;
        }
      }

      // Fricción
      p.vx *= FRICTION;
      p.vy *= FRICTION;

      // Actualizar posición
      p.x += p.vx;
      p.y += p.vy;

      // Render de partícula
      const s = (p.size + pulse*0.9); // agranda un toque con el latido
      ctx.fillStyle = COLOR;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
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
  // Habilitar para touch en iOS/Android
  cnv.addEventListener('touchstart', e => { e.preventDefault(); }, {passive:false});

  // Init
  resize();
  requestAnimationFrame(step);
})();
