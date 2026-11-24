/* Procedural network generation (deterministic from seed) and layer definitions. */
(function () {
  'use strict';
  var W4 = window.W4, U = W4.U;

  var LAYERS = [
    { id: 0, name: 'Clearnet', focus: 'Observación y detección de anomalías',
      rule: 'Todo es público: escanear nodos es gratis. Aprende la interfaz.', mods: { obsFree: true } },
    { id: 1, name: 'Web de Superficie', focus: 'Investigación inicial y vigilancia',
      rule: 'Las acciones ruidosas son públicas: el enfoque Directo suma +6 de Visibilidad.', mods: { directVis: 6 } },
    { id: 2, name: 'Web Bergie', focus: 'Identidades ocultas y manipulación conductual',
      rule: 'Las máscaras amplifican las sorpresas: la Divergencia cambia x1,25. Recibes 2 máscaras: cada una absorbe una detección en misión.', mods: { divMult: 1.25 } },
    { id: 3, name: 'Web Profunda', focus: 'Perfiles fantasma e infiltración institucional',
      rule: 'El anonimato favorece a los técnicos: con Hackeo accedes y desactivas a distancia. Los fantasmas aparecen más seguido.', mods: { remote: true, ghostP: 0.7 } },
    { id: 4, name: 'Web Charter', focus: 'Control social y reescritura narrativa',
      rule: 'Las narrativas viajan: el Ruido se multiplica x1,5. Al entrar, la reescritura borra 1 evidencia sin verificar salvo que tengas 20 de Ruido.', mods: { noiseMult: 1.5 } },
    { id: 5, name: 'Web de Mariana', focus: 'Arquitectura de SATURNO y redes humanas',
      rule: 'SATURNO es denso aquí: sus contramedidas son más fuertes. Las redes humanas ayudan: los contactos cobran favores sin gastar Confianza.', mods: { satMult: 1.4, freeFavor: true } },
    { id: 6, name: 'Sistemas de Cáscara Cerrada', focus: 'Sistemas institucionales de alta seguridad',
      rule: 'Sistemas sellados: Hackeo cuesta +1 energía y +1 PA por terminal; en nodos sin escanear, toda terminal cuesta +1 PA.', mods: { hackCost: 1, sealed: true } },
    { id: 7, name: 'La Niebla', focus: 'Guerra de información y realidad inestable',
      rule: 'La realidad es inestable: visión táctica de radio 3 y los informes de defensas pueden ser erróneos, salvo que el Ruido sea 30 o más.', mods: { fog: true } },
    { id: 8, name: 'Primarca', focus: 'Confrontación directa con el control sistémico',
      rule: 'No hay más rutas. El sistema responde directamente. Elige cómo termina esto.', mods: {} }
  ];

  var NAMES = {
    investigation: ['Anexo de Biblioteca Pública', 'Espejo de Registros Municipales', 'Malla Universitaria', 'Índice de Cámaras de Tránsito', 'Terminal de Archivo de Prensa', 'Panel Cívico en Vivo', 'Registros de Ingreso Hospitalario', 'Caché del Registro Judicial'],
    infiltration: ['Centro de Datos Corporativo', 'Archivo de Gobierno', 'Central de Telecomunicaciones', 'Bóveda del Buró de Crédito', 'Servidor Administrativo del Campus', 'Sala de Control de Ciudad Inteligente', 'Clúster Actuarial', 'Registro Municipal de Identidad'],
    social: ['Periodista Independiente', 'Conserje del Turno Noche', 'Colectivo Estudiantil', 'Sysadmin en el Exilio', 'Locutora de Radio Comunitaria', 'Empleado Jubilado', 'Red de Paramédicos Callejeros', 'Colectivo de Traductores'],
    resource: ['Cuarto de Servidores Abandonado', 'Casillero del Makerspace', 'Casillero de Entrega Muerta', 'Puesto del Mercado Negro', 'Trastienda del Café de Reparaciones', 'Caché del Depósito de Carga'],
    safehouse: ['Refugio Anónimo', 'Trastienda de Lavandería', 'Hostal de Peregrinos', 'Célula del Invernadero', 'Cobertizo en la Azotea', 'Departamento Tranquilo'],
    disruption: ['Relé Clandestino', 'Secuestro de Torre de Malla', 'Mástil de Transmisión', 'Subestación Baliza', 'Nodo de Tormenta de Paquetes', 'Pilón de Señal'],
    highrisk: ['Estación de Monitoreo', 'Servidor de Perfilado Conductual', 'Columna de Control', 'Centro de Policía Predictiva', 'Tribunal de Puntaje Crediticio', 'Torre de Cumplimiento'],
    elite: ['Nodo de Sincronización de SATURNO', 'Núcleo de Pronóstico de SATURNO', 'Clúster Clasificador', 'Guardián de Patrones', 'Motor de Consenso']
  };
  var GATEWAYS = ['Espejo Resolutor', 'Apretón Bergie', 'Puerta del Registro Fantasma', 'Registro Charter', 'Descenso a Mariana', 'Esclusa Cerrada', 'Umbral de la Niebla', 'Vestíbulo de Primarca', 'Núcleo de Primarca'];

  var TYPE_INFO = {
    investigation: { label: 'Investigación', glyph: 'I', desc: 'Recupera evidencia de fuentes abiertas o semiabiertas.' },
    infiltration: { label: 'Infiltración', glyph: 'N', desc: 'Entra en una red institucional. Buena para evidencia y herramientas.' },
    social: { label: 'Encuentro social', glyph: 'S', desc: 'Una persona con un problema, una oferta o una agenda.' },
    resource: { label: 'Obtención de recursos', glyph: 'R', desc: 'Suministros, herramientas u oportunidades al descubierto.' },
    safehouse: { label: 'Refugio', glyph: 'H', desc: 'Recupérate, cambia de identidad u oculta tu tráfico.' },
    disruption: { label: 'Disrupción de red', glyph: 'D', desc: 'Instala un relé y propaga señal. Ruidoso, pero genera Ruido.' },
    highrisk: { label: 'Operación de alto riesgo', glyph: '!', desc: 'Muy vigilada. Grandes recompensas.' },
    elite: { label: 'Nodo élite de SATURNO', glyph: 'E', desc: 'Una pieza de SATURNO en persona. Destruirla borra la mitad de lo que sabe de ti.' },
    gateway: { label: 'Puerta de capa', glyph: 'G', desc: 'La única forma de bajar. No se puede saltar.' }
  };

  function pickTwo(rng, pool) {
    var a = rng.pick(pool), b = a, guard = 0;
    while (b === a && guard++ < 20) b = rng.pick(pool);
    return [a, b];
  }

  function makeRewards(rng, type) {
    var r = { evidence: 0, noise: 0, item: false, strike: false, relay: false };
    switch (type) {
      case 'investigation': r.evidence = rng.int(1, 2); break;
      case 'infiltration': r.evidence = 1; r.item = rng.chance(0.5); break;
      case 'disruption': r.noise = rng.int(8, 14); r.relay = true; break;
      case 'highrisk': r.evidence = 2; r.noise = 6; r.item = true; break;
      case 'elite': r.evidence = 1; r.strike = true; break;
      default: break;
    }
    return r;
  }

  function genLayer(rng, L) {
    var used = {}, nodes = [];
    function name(type) {
      var pool = NAMES[type];
      for (var i = 0; i < 14; i++) { var n = rng.pick(pool); if (!used[n]) { used[n] = 1; return n; } }
      return rng.pick(pool);
    }
    function mk(col, row, type) {
      var threat = 1 + Math.floor(L / 2.2);
      if (type === 'highrisk' || type === 'elite') threat += 1;
      if (col > 0 && rng.chance(0.3)) threat += 1;
      if (type === 'safehouse') threat = 0;
      threat = U.clamp(threat, type === 'safehouse' ? 0 : 1, 6);
      var lo = Math.max(1, threat - rng.int(0, 1)), hi = threat + rng.int(0, 1);
      if (threat === 0) { lo = 0; hi = 0; }
      var n = {
        id: 'L' + L + '_' + nodes.length, layer: L, col: col, row: row, type: type,
        name: type === 'gateway' ? ((L === 8 ? '' : 'Puerta: ') + GATEWAYS[L]) : name(type),
        threat: threat, thrLo: lo, thrHi: hi, rewards: makeRewards(rng, type),
        status: 'locked', scanned: false, watch: false, next: [], final: type === 'gateway' && L === 8
      };
      nodes.push(n);
      return n;
    }
    var t0 = L === 0 ? 'investigation' : rng.pick(['investigation', 'social']);
    var pool1 = ['infiltration', 'social', 'resource', 'disruption', 'investigation'];
    var pool2 = L === 0 ? ['infiltration', 'disruption', 'safehouse', 'investigation', 'social']
      : ['highrisk', 'elite', 'infiltration', 'disruption', 'safehouse', 'investigation', 'social'];
    var t1 = pickTwo(rng, pool1), t2 = pickTwo(rng, pool2);
    if (t1.indexOf('safehouse') < 0 && t2.indexOf('safehouse') < 0) t2[1] = 'safehouse';

    var c0 = mk(0, 0, t0);
    var c1 = [mk(1, 0, t1[0]), mk(1, 1, t1[1])];
    var c2 = [mk(2, 0, t2[0]), mk(2, 1, t2[1])];
    var g = mk(3, 0, 'gateway');

    c0.next = [c1[0].id, c1[1].id];
    c1[0].next = [c2[0].id]; c1[1].next = [c2[1].id];
    var cross01 = rng.chance(0.65), cross10 = rng.chance(0.65);
    if (cross01) c1[0].next.push(c2[1].id);
    if (cross10) c1[1].next.push(c2[0].id);
    if (!cross01 && !cross10) { c1[rng.int(0, 1)].next.push(c2[rng.int(0, 1)].id); }
    // dedupe, guarantee every col1 node has an exit and every col2 node has an entrance
    [c1[0], c1[1]].forEach(function (n) { n.next = n.next.filter(function (v, i, a) { return a.indexOf(v) === i; }); });
    c2.forEach(function (n) { n.next = [g.id]; });
    c0.status = 'available';
    return { index: L, nodes: nodes };
  }

  function generate(seed) {
    var rng = new U.RNG(String(seed) + '|world');
    var layers = [];
    for (var L = 0; L < 9; L++) layers.push(genLayer(rng, L));
    var rr = new U.RNG(String(seed) + '|rescue');
    layers.forEach(function (Ly) {
      Ly.nodes.forEach(function (n) {
        if (Ly.index >= 1 && Ly.index <= 7 && (n.type === 'investigation' || n.type === 'infiltration' || n.type === 'highrisk') && rr.chance(0.3)) n.rescue = true;
      });
    });
    return layers;
  }

  function getNode(state, id) {
    if (typeof id !== 'string') return null;
    var L = parseInt(id.slice(1), 10);
    var layer = state.layers[L];
    if (!layer) return null;
    for (var i = 0; i < layer.nodes.length; i++) if (layer.nodes[i].id === id) return layer.nodes[i];
    return null;
  }
  function layerMods(state) { return (LAYERS[state.layerIdx] || LAYERS[0]).mods; }

  W4.World = { LAYERS: LAYERS, TYPE_INFO: TYPE_INFO, generate: generate, getNode: getNode, layerMods: layerMods };
})();
