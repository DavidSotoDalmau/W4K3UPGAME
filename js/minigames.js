/* Minijuegos: intrusión de terminal (código de símbolos) y debate por turnos con Varela.
   Lógica pura y serializable: el estado vive dentro de la misión o del nodo actual. */
(function () {
  'use strict';
  var W4 = window.W4, U = W4.U;
  var SYM = ['▲', '●', '■', '◆', '✚'];

  /* ---------- Intrusión de terminal (estilo "Mastermind" sin repeticiones) ---------- */
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function hackCreate(seed, nodeId, tIdx, layer, approach) {
    var len = layer < 4 ? 3 : 4, nsym = layer < 4 ? 4 : 5;
    var rng = new U.RNG(seed + '|hack|' + nodeId + '|' + tIdx);
    var code = rng.shuffle(range(nsym)).slice(0, len);
    var h = { len: len, nsym: nsym, attempts: (len === 3 ? 5 : 7) + (approach === 'hack' ? 1 : 0), code: code, guesses: [], hint: null, tIdx: tIdx };
    if (approach === 'hack') { var p = rng.int(0, len - 1); h.hint = { pos: p, sym: code[p] }; }
    return h;
  }
  function hackGuess(h, g) {
    if (!Array.isArray(g) || g.length !== h.len) return { ok: false, msg: 'Elige ' + h.len + ' símbolos.' };
    var seen = {};
    for (var i = 0; i < g.length; i++) {
      if (typeof g[i] !== 'number' || g[i] < 0 || g[i] >= h.nsym) return { ok: false, msg: 'Símbolo inválido.' };
      if (seen[g[i]]) return { ok: false, msg: 'No se repiten símbolos.' };
      seen[g[i]] = 1;
    }
    var exact = 0, partial = 0;
    for (var j = 0; j < g.length; j++) { if (g[j] === h.code[j]) exact++; else if (h.code.indexOf(g[j]) >= 0) partial++; }
    h.guesses.push({ g: g.slice(), exact: exact, partial: partial });
    var status = exact === h.len ? 'won' : (h.guesses.length >= h.attempts ? 'lost' : 'open');
    return { ok: true, exact: exact, partial: partial, status: status };
  }
  function codeText(h) { return h.code.map(function (c) { return SYM[c]; }).join(' '); }

  /* ---------- Debate con Varela ---------- */
  var ARGS = [
    { type: 'data', text: '"El año pasado SATURNO evitó 4.213 incidentes. Cuatro mil personas que hoy duermen tranquilas. ¿Qué cifra tienes tú?"' },
    { type: 'data', text: '"Sus modelos fallan menos del 3% de las veces. ¿Cuántos errores ha cometido tu intuición?"' },
    { type: 'data', text: '"Compara las tasas de violencia antes y después de la clasificación. Los números no tienen ideología."' },
    { type: 'moral', text: '"Alguien tiene que decidir qué es aceptable. Si no es el sistema, será quien grite más fuerte. ¿Eso es libertad?"' },
    { type: 'moral', text: '"El deber de una institución es proteger a la mayoría. Tú solo respondes ante ti mismo."' },
    { type: 'moral', text: '"La autonomía absoluta es un privilegio de quien no depende de nadie. ¿De verdad crees que la tienes?"' },
    { type: 'human', text: '"Vi a una madre recuperar a su hijo porque un patrón se detectó a tiempo. ¿Se lo dirías a ella?"' },
    { type: 'human', text: '"Hay gente que prefiere que alguien la cuide, aunque sea una máquina. ¿Les negarás ese consuelo?"' },
    { type: 'human', text: '"Cada persona que clasificamos evitó un daño que tú nunca verás. Eso también es sufrimiento evitado."' }
  ];
  var CHOICES = {
    data: { label: 'Contrastar con datos verificados', hint: 'Fuerte contra cifras. Algo útil si tienes evidencia verificada.' },
    moral: { label: 'Apelar a la autonomía y la responsabilidad', hint: 'Fuerte contra argumentos de deber y orden.' },
    human: { label: 'Reconocer el costo humano y responder con empatía', hint: 'Siempre aporta algo, pero rara vez gana el punto.' }
  };
  var REACT = {
    2: ['Varela se detiene un segundo. "Eso no lo esperaba."', 'Ella baja la taza. "Tienes razón en eso, y lo sabes."', 'Por primera vez, no responde de inmediato.'],
    1: ['"Parcialmente cierto", concede. "Pero insuficiente."', 'Asiente sin convicción. "Es un punto. No es el punto."'],
    0: ['Sonríe, sin crueldad. "Eso lo había previsto."', '"Argumento correcto, objetivo equivocado."']
  };
  function debateCreate(state) {
    var types = ['data', 'moral', 'human'], order = [], i;
    // orden aleatorio (con la tirada de la partida) de un argumento por tipo
    var rest = types.slice();
    while (rest.length) order.push(rest.splice(Math.floor(U.rollState(state) * rest.length), 1)[0]);
    var args = order.map(function (t) {
      var pool = []; ARGS.forEach(function (a, k) { if (a.type === t) pool.push(k); });
      return pool[Math.floor(U.rollState(state) * pool.length)];
    });
    return { round: 0, args: args, picks: [], pts: [], score: 0, reaction: '', done: false };
  }
  function debateChoose(state, deb, choice) {
    if (deb.done || !CHOICES[choice]) return null;
    var arg = ARGS[deb.args[deb.round]], pts = arg.type === choice ? 2 : 0, note = '';
    var verified = state.evidence.filter(function (e) { return e.verified; }).length;
    if (choice === 'data' && verified >= 1) pts = Math.max(pts, 1);
    if (choice === 'human') pts = Math.max(pts, 1);
    if (choice === 'moral' && state.rep.w4k3up >= 2) pts = Math.max(pts, 1);
    if (deb.picks.length && deb.picks[deb.picks.length - 1] === choice) { pts = Math.max(0, pts - 1); note = ' (Ella anticipó que repetirías tu estilo.)'; }
    deb.picks.push(choice); deb.pts.push(pts); deb.score += pts; deb.round++;
    var pool = REACT[pts], line = pool[Math.floor(U.rollState(state) * pool.length)];
    deb.reaction = line + note;
    if (deb.round >= 3) deb.done = true;
    return { pts: pts, done: deb.done };
  }
  function debateOutcome(score) {
    if (score >= 5) return { key: 'win', title: 'Ganas el debate', fx: { noise: 12, div: 6, evidenceV: 1, rep: { inst: 1, noise: 1 }, flag: 'varela_met' },
      text: 'Varela deja la taza y guarda silencio. "No me convenciste. Pero ahora tengo que revisar mis cifras." Te entrega un informe verificado y la sala entera lo vio.' };
    if (score >= 3) return { key: 'draw', title: 'Un empate respetuoso', fx: { evidence: 1, vis: 4, rep: { inst: 1 }, flag: 'varela_met' },
      text: 'Ninguno cedió, pero ambos aprendieron algo. Ella te deja una copia de sus argumentos. "Para la próxima vez", dice.' };
    return { key: 'lose', title: 'Pierdes el debate', fx: { vis: 10, trust: -1, rep: { inst: -1 }, flag: 'varela_met' },
      text: 'Cada réplica tuya ya estaba contestada. Sales con la sensación de haber recitado un guion que ella escribió. Alguien en el público anota tu nombre.' };
  }


  /* ======================================================================
     Montar la antena (escena final de la novela: Miguel en la azotea)
     Orientación hacia el salón de actos + mástil que supere el obstáculo +
     frecuencia fuera de las bandas vigiladas por SATURNO.
     ====================================================================== */
  var BEARINGS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  function antCreate(seed, nodeId, layer, approach) {
    var rng = new U.RNG(seed + '|ant|' + nodeId);
    var freqs = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]), nw = layer < 4 ? 2 : 3;
    return { bearing: rng.int(0, 7), obstacle: rng.int(1, 3), watched: freqs.slice(0, nw), best: freqs[nw],
      scans: approach === 'hack' ? 4 : 3, tries: 3, revealed: {}, log: [], status: 'open' };
  }
  function antScan(a, f) {
    if (a.scans <= 0) return { ok: false, msg: 'No te quedan escaneos.' };
    if (f < 1 || f > 9) return { ok: false, msg: 'Frecuencia inválida.' };
    if (a.revealed[f] !== undefined) return { ok: false, msg: 'Esa banda ya está escaneada.' };
    a.scans--;
    var watched = a.watched.indexOf(f) >= 0, d = Math.abs(f - a.best), est = f === a.best ? 'baja' : (d <= 1 ? 'media' : 'alta');
    a.revealed[f] = watched ? 'vigilada' : 'libre, estática ' + est;
    return { ok: true, watched: watched, est: est };
  }
  function antTx(a, dir, h, f) {
    if (a.status !== 'open') return { ok: false, msg: 'La transmisión ya terminó.' };
    if (dir < 0 || dir > 7 || h < 1 || h > 5 || f < 1 || f > 9) return { ok: false, msg: 'Ajusta orientación, altura y frecuencia.' };
    a.tries--;
    var res, text;
    if (dir !== a.bearing) { res = 'desviada'; text = 'La antena apunta a otro lado: no hay enlace con el salón de actos.'; }
    else if (h <= a.obstacle) { res = 'bloqueada'; text = 'El depósito de la azotea tapa la señal: el mástil es demasiado bajo.'; }
    else if (a.watched.indexOf(f) >= 0) { res = 'detectada'; text = 'SATURNO detecta la emisión: esa banda está vigilada.'; }
    else if (h > a.obstacle + 2) { res = 'visible'; text = 'El mástil asoma sobre el tejado: una cámara lo ve.'; }
    else { res = f === a.best ? 'clara' : 'debil'; text = res === 'clara' ? 'Enlace limpio: la señal es débil pero constante y SATURNO no la ve.' : 'Hay enlace, pero con mucha estática. Aguanta, aunque no llegará lejos.'; }
    a.log.push({ dir: dir, h: h, f: f, res: res, text: text });
    var won = res === 'clara' || res === 'debil';
    a.status = won ? 'won' : (a.tries <= 0 ? 'lost' : 'open');
    return { ok: true, res: res, text: text, status: a.status, quality: res === 'clara' ? 'clear' : (res === 'debil' ? 'weak' : 'fail') };
  }

  /* ======================================================================
     El ejercicio de Salvat: clasificar casos (sin intervención / seguimiento /
     evaluación / intervención) y justificar por qué. El coste de equivocarse
     existe en los dos sentidos.
     ====================================================================== */
  var CATS = { none: 'Sin intervención', follow: 'Seguimiento', eval: 'Evaluación', interv: 'Intervención' };
  var SEV = { none: 0, follow: 1, eval: 2, interv: 3 };
  var WHYS = { context: 'Hay una explicación de contexto', risk: 'Hay riesgo real para alguien', data: 'Faltan datos para decidir' };
  var CASES = [
    { text: 'Mujer de 38 años. Cambió de empleo hace un mes, duerme cinco horas, refiere ansiedad ocasional y más cafeína. Mantiene su trabajo, sus amistades y su autocuidado.', best: 'none', alt: 'follow', key: 'context', why: 'No hay deterioro funcional y hay un cambio reciente que explica el malestar.' },
    { text: 'Hombre de 64 años. Dejó de salir de casa tras la muerte de su esposa y lleva cuatro meses sin ver a sus amigos. No hay más datos de cómo era antes.', best: 'follow', alt: 'eval', key: 'data', why: 'Seguimiento permite saber más sin dar por hecho lo que ocurre.' },
    { text: 'Adolescente con episodios repetidos de autolesión, empeoramiento reciente y una tentativa previa.', best: 'interv', alt: 'eval', key: 'risk', why: 'Hay riesgo vital y empeoramiento: esperar tiene un coste mayor que intervenir.' },
    { text: 'Hombre que dejó un empleo estable, vendió casi todo lo que tenía y anunció que viajará solo por Europa sin fecha de regreso. Dice que está bien y se cuida.', best: 'none', alt: 'follow', key: 'context', why: 'Es un cambio llamativo, no necesariamente un problema: no hay sufrimiento ni riesgo.' },
    { text: 'Estudiante con notas altas que discute en clase y hace preguntas incómodas. Un docente lo reportó como "conflictivo".', best: 'none', alt: 'follow', key: 'context', why: 'Diferir no es un trastorno. Intervenir aquí sería convertir una diferencia en un problema.' },
    { text: 'Vecina que lleva dos semanas sin contestar mensajes y cambió su rutina. Antes era muy sociable.', best: 'follow', alt: 'eval', key: 'data', why: 'Hay un cambio, pero sin datos suficientes. Mirar sin asumir es lo proporcionado.' },
    { text: 'Trabajador con pérdida de peso, insomnio y errores nuevos en su trabajo. Dice que "no pasa nada", pero su familia está preocupada.', best: 'eval', alt: 'interv', key: 'risk', why: 'Hay deterioro funcional y señales sostenidas: toca valorar con calma antes de actuar.' },
    { text: 'Adolescente que borró sus redes y se aísla tras una mudanza reciente. Sigue yendo a clase.', best: 'follow', alt: 'none', key: 'context', why: 'La mudanza lo explica en parte, pero el aislamiento merece un ojo atento.' },
    { text: 'Hombre que expresa amenazas concretas contra su expareja y describe un plan.', best: 'interv', alt: 'eval', key: 'risk', why: 'Hay riesgo para terceros y concreción: hay que intervenir ya.' },
    { text: 'Mujer mayor que olvida cosas puntuales. Vive sola, es autónoma y organiza su propio día.', best: 'follow', alt: 'none', key: 'data', why: 'Olvidos puntuales sin deterioro: observar es suficiente, y sin alarmar.' },
    { text: 'Activista marcada por un algoritmo como "patrón anómalo". No hay daño a nadie ni conducta de riesgo, solo actividad poco habitual.', best: 'none', alt: 'follow', key: 'context', why: 'Un modelo señala diferencias, no daños. Aquí un falso positivo cuesta más que no hacer nada.' },
    { text: 'Persona con una "probabilidad de recurrencia 0,91" asignada por un sistema, sin ningún hecho documentado que la sustente.', best: 'eval', alt: 'follow', key: 'data', why: 'Una cifra no es un hecho. Lo proporcionado es contrastarla antes de actuar sobre ella.' }
  ];
  function salvatCreate(state) {
    var pool = CASES.map(function (c, i) { return i; }), ids = [];
    while (ids.length < 4) ids.push(pool.splice(Math.floor(U.rollState(state) * pool.length), 1)[0]);
    return { type: 'salvat', i: 0, ids: ids, phase: 'cat', cat: null, pts: 0, fp: 0, fn: 0, fb: '', done: false, log: [] };
  }
  function salvatPick(g, cat) {
    if (g.phase !== 'cat' || !CATS[cat]) return false;
    g.cat = cat; g.phase = 'why'; return true;
  }
  function salvatWhy(g, why) {
    if (g.phase !== 'why' || !WHYS[why]) return false;
    var c = CASES[g.ids[g.i]], p = g.cat === c.best ? 2 : (g.cat === c.alt ? 1 : 0), w = why === c.key ? 1 : 0, extra = '';
    if (SEV[g.cat] - SEV[c.best] >= 2) { g.fp++; extra = ' Fue un falso positivo: intervenir de más también hace daño.'; }
    if (SEV[c.best] - SEV[g.cat] >= 2) { g.fn++; extra = ' Fue un falso negativo: no hacer nada también tiene un coste.'; }
    g.pts += p + w;
    g.fb = (p === 2 ? 'Criterio sólido.' : (p === 1 ? 'Defendible.' : 'Discutible.')) + ' Lo más proporcionado era ' + CATS[c.best].toLowerCase() + ': ' + c.why + (w ? ' Tu justificación era la correcta.' : ' Tu justificación no era la clave del caso.') + extra;
    g.log.push({ cat: g.cat, pts: p + w });
    g.phase = 'fb'; return true;
  }
  function salvatNext(g) {
    if (g.phase !== 'fb') return false;
    g.i++; g.cat = null;
    if (g.i >= 4) g.done = true; else g.phase = 'cat';
    return true;
  }
  function salvatOutcome(g) {
    var sc = g.pts, over = g.fp >= 2;
    if (sc >= 9 && !over) return { key: 'solid', title: 'Criterio sólido', fx: { trust: 2, div: 6, rep: { w4k3up: 1 }, flag: 'salvat_criteria' },
      text: 'Salvat revisa tus hojas y no corrige casi nada. "No busco que aciertes", dice, "pero lo has justificado". Te sales de cualquier modelo que solo premie la regularidad.' };
    if (sc >= 5 && !over) return { key: 'fair', title: 'Criterio razonable', fx: { trust: 1, evidence: 1 },
      text: 'Algunas casillas fueron discutibles, pero cada una tenía una razón detrás. Guardas las hojas del ejercicio: son un registro de cómo se decide.' };
    return { key: 'auto', title: 'Criterio automático', fx: { rep: { saturno: 1 }, vis: -4, div: -4 },
      text: over ? 'Marcaste "intervención" casi por reflejo. Es exactamente lo que haría SATURNO. Él lo anota con aprobación.' : 'Casi todas tus casillas fueron una reacción, no un criterio. Al sistema le gusta que alguien piense como él.' };
  }

  /* ======================================================================
     Ghost Loop: voces de conformidad. Manual del NO: escucha / no respondas
     como esperan / escribe y rompe / deja el archivo abierto.
     El bucle predice tu réplica con tus hábitos; salirte del patrón puntúa.
     ====================================================================== */
  var GL_OPTS = { listen: 'Escuchar', other: 'Responder distinto', tear: 'Escribir y romper lo escrito', open: 'Dejar el archivo abierto' };
  var GL_HELP = { listen: 'Deja pasar la voz sin responderle.', other: 'Contesta algo que nadie espera.', tear: 'Ponla por escrito y destrúyela.', open: 'No cierres la duda: deja la puerta abierta.' };
  var GL_FIT = { authority: 'other', doubt: 'listen', minimize: 'tear', fear: 'open' };
  var GL_PHRASES = {
    authority: ['"Tú no sabes de eso: deja que hable el que manda."', '"No discutas, es tu superior."', '"Aquí siempre se ha hecho así."', '"Calladito estás más guapo."'],
    doubt: ['"¿Y si estás equivocado?"', '"¿Vas a arruinarlo todo por una duda?"', '"Si todos lo aceptan, por algo será."', '"¿Y si te están utilizando?"'],
    minimize: ['"No es para tanto. No seas exagerado."', '"Ya lo hablamos en su momento, ¿no te acuerdas?"', '"No es el momento."', '"No eres nadie para cambiar nada."'],
    fear: ['"¿Y si haces el ridículo?"', '"¿Y si pierdes todo?"', '"Niño, no hagas eso, que te van a mirar mal."', '"La vida real no es para andar preguntando tanto."']
  };
  function glCreate(state) {
    var types = ['authority', 'doubt', 'minimize', 'fear'], items = [];
    for (var i = 0; i < 5; i++) {
      var t = types[Math.floor(U.rollState(state) * 4)], pool = GL_PHRASES[t];
      items.push({ type: t, text: pool[Math.floor(U.rollState(state) * pool.length)] });
    }
    return { type: 'ghostloop', round: 0, items: items, picks: [], pts: 0, fb: '', done: false, seed: Math.floor(U.rollState(state) * 1e6) };
  }
  // El bucle anticipa tu réplica: lo que más has repetido aquí; la primera sale de tus hábitos con SATURNO.
  function glPredict(state, g) {
    var c = { listen: 0, other: 0, tear: 0, open: 0 }, order = ['listen', 'other', 'tear', 'open'];
    g.picks.forEach(function (p) { c[p]++; });
    var best = null;
    order.forEach(function (k) { if (best === null || c[k] > c[best]) best = k; });
    if (g.picks.length === 0) {
      var sh = W4.Saturno.shares(state.saturno), top = null;
      ['stealth', 'hack', 'direct'].forEach(function (a) { if (top === null || sh.ap[a] > sh.ap[top]) top = a; });
      return sh.hasAp ? { stealth: 'listen', hack: 'tear', direct: 'other' }[top] : 'listen';
    }
    return best;
  }
  function glChoose(state, g, opt) {
    if (g.done || !GL_OPTS[opt]) return null;
    var it = g.items[g.round], pred = glPredict(state, g), fit = GL_FIT[it.type] === opt, pts = fit ? 2 : 1, note = '';
    if (opt === pred) { pts = Math.max(0, pts - 1); note = ' El bucle esperaba exactamente esa réplica.'; }
    else note = ' El bucle esperaba "' + GL_OPTS[pred].toLowerCase() + '" y no la vio venir.';
    g.picks.push(opt); g.pts += pts; g.round++;
    g.fb = (fit ? 'Encaja con esa voz.' : 'No era la réplica que más le dolía.') + note;
    if (g.round >= 5) g.done = true;
    return { pts: pts, done: g.done };
  }
  function glOutcome(g) {
    if (g.pts >= 7) return { key: 'break', title: 'Rompes el bucle', fx: { noise: 12, div: 8, integ: 10, rep: { noise: 1 } },
      text: 'Las frases se atropellan, se repiten, se cortan. El bucle intenta corregirte y solo consigue desbordarse. Queda una duda abierta en el sistema.' };
    if (g.pts >= 4) return { key: 'hold', title: 'Aguantas el bucle', fx: { noise: 6, vis: 4 },
      text: 'No lo rompes, pero tampoco te traga. Sales con la voz propia algo ronca y con un poco de ruido a cuestas.' };
    return { key: 'absorbed', title: 'El bucle te reabsorbe', fx: { integ: -10, div: -6, vis: 6 },
      text: '"Corrigiendo… silenciando… reabsorbiendo…" Cuando se calla la pantalla, repites en voz alta algo que no recuerdas haber pensado.' };
  }

  /* ======================================================================
     Tejer la red humana (el mapa de Miguel): conectar personas y lugares con
     enlaces baratos de modo que la red sobreviva a la caída de cualquier nodo.
     ====================================================================== */
  var HN_NAMES = ['La casa de la abuela', 'El mercado', 'La estación', 'La biblioteca vieja', 'El taller', 'La radio comunitaria', 'El hostal', 'La lavandería'];
  var HN_LINKS = ['Carta', 'Teléfono sin batería', 'Frase en un papel'];
  function connected(n, edges, skip) {
    var seen = {}, start = -1, i;
    for (i = 0; i < n; i++) if (i !== skip) { start = i; break; }
    if (start < 0) return true;
    var q = [start]; seen[start] = 1;
    while (q.length) {
      var c = q.shift();
      edges.forEach(function (e) {
        if (e[0] === skip || e[1] === skip) return;
        var o = e[0] === c ? e[1] : (e[1] === c ? e[0] : -1);
        if (o >= 0 && !seen[o]) { seen[o] = 1; q.push(o); }
      });
    }
    var cnt = 0; for (i = 0; i < n; i++) if (i !== skip && seen[i]) cnt++;
    return cnt === n - (skip >= 0 ? 1 : 0);
  }
  function hnCheck(h, links) {
    var edges = links.map(function (k) { var p = k.split('-'); return [parseInt(p[0], 10), parseInt(p[1], 10)]; });
    var cost = 0; links.forEach(function (k) { var e = h.edges[k]; if (e) cost += e.cost; });
    var conn = connected(h.n, edges, -1), critical = null;
    if (conn) for (var i = 0; i < h.n; i++) if (!connected(h.n, edges, i)) { critical = i; break; }
    return { cost: cost, connected: conn, resilient: conn && critical === null, critical: critical };
  }
  function hnCreate(seed, nodeId) {
    var rng = new U.RNG(seed + '|hn|' + nodeId), n = 6, names = rng.shuffle(HN_NAMES).slice(0, n), edges = {}, keys = [], i, j;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) { var k = i + '-' + j; edges[k] = { a: i, b: j, cost: rng.int(1, 3), type: HN_LINKS[rng.int(0, 2)], blocked: false }; keys.push(k); }
    rng.shuffle(keys).slice(0, 4).forEach(function (k) { edges[k].blocked = true; });
    var h = { n: n, names: names, edges: edges, links: [], budget: 0, minCost: 0, tested: null, done: false };
    function solve() {
      var free = keys.filter(function (k) { return !edges[k].blocked; }), best = null;
      for (var m = 0; m < (1 << free.length); m++) {
        var ls = [], c = 0;
        for (var b = 0; b < free.length; b++) if (m & (1 << b)) { ls.push(free[b]); c += edges[free[b]].cost; }
        if (best !== null && c >= best) continue;
        if (hnCheck(h, ls).resilient) best = c;
      }
      return best;
    }
    var min = solve(), guard = 0;
    while (min === null && guard++ < 10) { keys.forEach(function (k) { if (edges[k].blocked) { edges[k].blocked = false; } }); min = solve(); }
    h.minCost = min; h.budget = min + 1;
    return h;
  }
  function hnToggle(h, a, b) {
    if (h.done) return { ok: false, msg: 'La red ya está cerrada.' };
    if (a === b) return { ok: false, msg: 'Elige dos nodos distintos.' };
    var k = Math.min(a, b) + '-' + Math.max(a, b), e = h.edges[k];
    if (!e) return { ok: false, msg: 'Enlace inválido.' };
    if (e.blocked) return { ok: false, msg: 'SATURNO vigila ese enlace: no se puede usar.' };
    var idx = h.links.indexOf(k);
    if (idx >= 0) { h.links.splice(idx, 1); h.tested = null; return { ok: true, removed: true }; }
    if (hnCheck(h, h.links).cost + e.cost > h.budget) return { ok: false, msg: 'Te pasarías del presupuesto (' + h.budget + ').' };
    h.links.push(k); h.tested = null; return { ok: true };
  }
  function hnTest(h) { h.tested = hnCheck(h, h.links); return h.tested; }
  function hnOutcome(h) {
    var r = hnCheck(h, h.links);
    if (r.resilient) return { key: 'strong', title: 'Una red que resiste', fx: { relay: 1, noise: 8, trust: 1, rep: { w4k3up: 1, noise: 1 }, contact: { name: 'La Red de Miguel', role: 'Nodos humanos', favor: 'verify' } },
      text: 'Cartas, teléfonos sin batería y frases en papeles: cae un nodo y los demás siguen hablando. No es red. Es gente.' };
    if (r.connected) return { key: 'fragile', title: 'Una red frágil', fx: { noise: 4, trust: 1 },
      text: 'Todos se hablan, pero hay un nodo que sostiene demasiado. Funciona hasta que alguien lo encuentre.' };
    return { key: 'broken', title: 'Una red partida', fx: { vis: 3 },
      text: 'Algunos nodos quedan aislados. Miguel plegará el mapa sin decir nada: ya sabe lo que habría que arreglar.' };
  }

  W4.Minigames = { SYM: SYM, hackCreate: hackCreate, hackGuess: hackGuess, codeText: codeText,
    ARGS: ARGS, CHOICES: CHOICES, debateCreate: debateCreate, debateChoose: debateChoose, debateOutcome: debateOutcome,
    BEARINGS: BEARINGS, antCreate: antCreate, antScan: antScan, antTx: antTx,
    CATS: CATS, WHYS: WHYS, CASES: CASES, salvatCreate: salvatCreate, salvatPick: salvatPick, salvatWhy: salvatWhy, salvatNext: salvatNext, salvatOutcome: salvatOutcome,
    GL_OPTS: GL_OPTS, GL_HELP: GL_HELP, glCreate: glCreate, glPredict: glPredict, glChoose: glChoose, glOutcome: glOutcome,
    HN_LINKS: HN_LINKS, hnCreate: hnCreate, hnCheck: hnCheck, hnToggle: hnToggle, hnTest: hnTest, hnOutcome: hnOutcome };
})();
