/* Modular narrative events. Each choice has a strategic justification; none is plainly "good" or "evil".
   fx keys: vis div noise energy integ trust evidence evidenceV item contact flag feed verify relay help strike */
(function () {
  'use strict';
  var W4 = window.W4, U = W4.U;

  function S(ev) { return ev; }

  var EVENTS = [
    S({ id: 'anon_source', kinds: ['social'], layers: [0, 3], title: 'Una fuente anónima',
      text: 'Un mensaje llega por un buzón muerto: escaneos de memorandos internos que muestran a una oficina de registros reclasificando quejas como "no eventos". El remitente quiere que se haga público antes de que cierre la auditoría.',
      choices: [
        { label: 'Publicar de inmediato', fx: { noise: 14, vis: 10, evidence: 1 }, out: 'Los memorandos se esparcen más rápido de lo que puedes seguirlos. La señal es fuerte, y tu sombra también.' },
        { label: 'Verificar primero', fx: { energy: -2, evidenceV: 1 }, out: 'Contrastar toma tiempo, pero las firmas coinciden. Archivas una copia verificada.' },
        { label: 'Suprimirlo para proteger a la fuente', fx: { trust: 1, vis: -4 }, flag: 'suppressed_leak', out: 'La fuente queda a salvo. La oficina de registros sigue como si nada.' }] }),

    S({ id: 'library_terminal', kinds: ['social', 'resource'], layers: [0, 2], title: 'El último catálogo de papel',
      text: 'Una terminal de biblioteca califica tu patrón de búsqueda como "eficiente". Una bibliotecaria te desliza un catálogo de papel sin mirarte a los ojos.',
      choices: [
        { label: 'Buscar en la terminal pública', fx: { vis: 6, evidence: 1 }, out: 'La terminal responde rápido y registra cada tecla. Sales con una pista y un rastro.' },
        { label: 'Usar el catálogo de papel', fx: { energy: -1, div: 8, evidence: 1 }, out: 'Lento, analógico, impredecible. Ningún modelo esperaba que fueras por aquí.' },
        { label: 'Agradecer e irte', fx: { trust: 1 }, out: 'Ella asiente una vez. La gente recuerda a quien no pidió más.' }] }),

    S({ id: 'phantom_student', kinds: ['social'], layers: [0, 3], title: 'El estudiante borrado',
      text: 'Un colectivo estudiantil insiste en que un compañero nunca existió: el registro de matrícula, el casillero y las fotos desaparecieron de la noche a la mañana. Tienen miedo y te miran a ti.',
      choices: [
        { label: 'Ayudarles a buscar', fx: { vis: 8, trust: 1, contact: { name: 'Lena Okafor', role: 'Organizadora estudiantil', favor: 'noise' } }, help: true, out: 'Te confían un nombre. Lena promete amplificar lo que encuentres.' },
        { label: 'Documentar el borrado en silencio', fx: { vis: 3, evidence: 1 }, out: 'Una lista con marcas de tiempo de lo que desapareció y cuándo. Sola no prueba nada.' },
        { label: 'Decirles que guarden silencio', fx: { div: -4, vis: -3 }, out: 'Haces lo cauteloso y esperado. El modelo lo anota.' }] }),

    S({ id: 'false_accusation', kinds: ['social'], layers: [1, 4], title: 'Culpa fabricada',
      text: 'Un contacto figura como cómplice de un crimen que nunca ocurrió. El registro es falso pero se ve perfecto. Su acreditación está por vencer.',
      choices: [
        { label: 'Dar la cara por esa persona', fx: { vis: 14, noise: 6, trust: 2 }, help: true, out: 'Tu nombre queda unido al suyo. La acusación tambalea.' },
        { label: 'Falsificar un contrarregistro', fx: { energy: -2, integ: -4, evidence: 1 }, out: 'Un registro falso contra otro. Gana quien lo verifique primero.' },
        { label: 'Tomar distancia', fx: { trust: -1, vis: -8 }, out: 'Borras el vínculo entre ustedes. Queda sola.' }] }),

    S({ id: 'whistle_dataset', kinds: ['resource', 'social'], layers: [1, 4], title: 'Base de puntajes filtrada',
      text: 'Un disco en un buzón muerto guarda una base cruda de "puntajes de estabilidad" ciudadanos. Nombres reales, consecuencias reales. Quien la publique carga con la culpa de la exposición.',
      choices: [
        { label: 'Publicarla cruda', fx: { noise: 16, vis: 12, evidence: 1 }, out: 'Miles de personas ven su propio número por primera vez. Algunas ven también el tuyo.' },
        { label: 'Anonimizar y luego publicar', fx: { energy: -2, noise: 10, evidenceV: 1 }, out: 'Más lento, más limpio. Se ve la forma del sistema, no a las personas.' },
        { label: 'Guardarla como palanca', fx: { evidence: 2, trust: -1 }, out: 'Dos archivos sin liberar. Útiles después. La fuente no perdonará la espera.' }] }),

    S({ id: 'checkpoint_loop', kinds: ['social', 'resource'], layers: [2, 6], title: 'El camino de siempre',
      text: 'Un puesto de control escanea a los peatones por conducta, no por documento. Premia a quienes caminan la misma ruta a diario. Una tendera susurra que la fila de la izquierda avanza más rápido.',
      choices: [
        { label: 'Seguir tu patrón habitual', fx: { vis: -5, div: -6 }, out: 'Pasas sin un parpadeo. También le enseñaste al modelo otro hábito.' },
        { label: 'Romper el patrón', fx: { energy: -1, div: 8, vis: 6 }, out: 'El escáner duda y te marca para revisión. La duda también es dato.' },
        { label: 'Cruzar con la multitud', fx: { noise: 6, vis: 2 }, out: 'Cuarenta personas se mueven a la vez. Eres una forma más en el flujo.' }] }),

    S({ id: 'relay_offer', kinds: ['resource', 'social'], layers: [2, 5], title: 'Hardware, sin preguntas',
      text: 'Una ingeniera de dedos manchados de tinta ofrece una placa de relé que habla malla y transporta señal sin registros. Miguel, dice, construyó el primero.',
      choices: [
        { label: 'Aceptar y desplegar', fx: { noise: 10, vis: 6, relay: 1 }, out: 'Un nuevo relé se une a la red. Es pequeño, pero independiente de SATURNO.' },
        { label: 'Auditar la placa primero', fx: { energy: -1, noise: 6, evidence: 1, relay: 1 }, out: 'El firmware está limpio y las pistas de la placa están firmadas a mano.' },
        { label: 'Rechazar con cortesía', fx: { vis: -2 }, out: 'Ella se encoge de hombros y guarda todo. Alguien más lo aceptará.' }] }),

    S({ id: 'maya_broadcast', kinds: ['social'], layers: [2, 6], rare: true, title: 'LetItBee en la línea',
      text: 'Una voz interrumpe el canal a media frase, bromista y furiosa a la vez. Maya quiere una transmisión esta noche, sin guion, y quiere tu relé detrás.',
      choices: [
        { label: 'Amplificarla tal cual', fx: { noise: 18, vis: 14, div: 6, contact: { name: 'Maya "LetItBee"', role: 'Locutora', favor: 'noise' } }, out: 'La transmisión es un desastre y es hermosa. SATURNO no logra decidir qué es.' },
        { label: 'Editarla por seguridad', fx: { noise: 8, vis: 4, trust: 1 }, out: 'Recortas nombres y lugares. Te llama cobarde. Aun así llega.' },
        { label: 'Negarte', fx: { trust: -1, vis: -3 }, out: 'La línea queda en silencio. Maya no olvida los silencios.' }] }),

    S({ id: 'john_pattern', kinds: ['social'], layers: [1, 5], rare: true, title: 'John te ha estado observando observar',
      text: 'John desliza un cuaderno por la mesa. Enumera tus últimas decisiones, cada una algo más predecible de lo que creías. "No lee tu mente", dice. "Lee tus hábitos."',
      choices: [
        { label: 'Estudiar el cuaderno', fx: { energy: -1, item: 'decoy', flag: 'knows_pattern' }, out: 'Aprendes a envenenar un patrón: actúa como siempre y luego deja de hacerlo. Te da un Guion Señuelo.' },
        { label: 'Pedirle un contramodelo', fx: { trust: -1, div: 10, contact: { name: 'John', role: 'Analista', favor: 'intel' } }, out: 'Su contramodelo revuelve lo que SATURNO cree saber. Espera que devuelvas el favor.' },
        { label: 'Mantener la distancia', fx: { vis: -4 }, out: 'Le agradeces y te vas. El cuaderno se queda sobre la mesa.' }] }),

    S({ id: 'varela', kinds: ['social'], layers: [4, 8], title: 'Varela ofrece té',
      text: 'Varela te recibe sin guardias. "La gente es infeliz en el desorden", dice, y no miente. Te ofrece un informe: lo que el sistema evitó el año pasado y lo que costó.',
      choices: [
        { label: 'Aceptar el informe', fx: { evidenceV: 1, vis: 12, flag: 'varela_met' }, out: 'Las cifras son reales. También los nombres que faltan en ellas. Sales con ambas cosas.' },
        { label: 'Debatir con ella en público', debate: true, fx: {}, out: 'Su argumento es mejor de lo que querías. El público te ve rechazarlo igual.' },
        { label: 'Marcharte', fx: { vis: -2 }, out: 'Declinas. Ella no parece sorprendida, y eso te molesta más.' }] }),

    S({ id: 'distress', kinds: ['social'], layers: [3, 7], title: 'Una petición de auxilio',
      text: function (s) {
        var base = 'Llega una llamada cifrada de alguien a quien ayudaste. La redacción es exactamente la correcta.';
        return s.saturno.help >= 1.5
          ? base + ' Los metadatos están levemente mal. Tu historial de responder a llamadas así no es secreto para SATURNO.'
          : base + ' Los metadatos se ven limpios.';
      },
      choices: [
        { label: 'Ir de inmediato', fn: function (s) {
            return s.saturno.help >= 1.5
              ? { fx: { integ: -12, vis: 12 }, out: 'Era un cebo. SATURNO fabricó la llamada porque respondes siempre. Escapas por poco.' }
              : { fx: { trust: 2, vis: 8, contact: { name: 'Teo Marsh', role: 'Mensajero', favor: 'vis' } }, help: true, out: 'La llamada era real. Teo está vivo y te debe una.' };
          } },
        { label: 'Rastrear la señal primero', fn: function (s) {
            return s.saturno.help >= 1.5
              ? { fx: { energy: -1, evidence: 1, noise: 8, flag: 'fabrication_proof' }, out: 'El rastro termina en una subred de SATURNO. Ahora tienes prueba de que falsifica señales de auxilio.' }
              : { fx: { energy: -1, trust: 1, contact: { name: 'Teo Marsh', role: 'Mensajero', favor: 'vis' } }, help: true, out: 'Origen limpio. Cuando llegas, Teo está aliviado y algo ofendido.' };
          } },
        { label: 'Ignorarla', fn: function (s) {
            return s.saturno.help >= 1.5
              ? { fx: { div: 7, vis: -2 }, out: 'La trampa se cierra sobre nada. SATURNO esperaba que acudieras.' }
              : { fx: { trust: -1, vis: -3 }, out: 'Te quedas oculto. Luego te enteras de que la llamada era real.' };
          } }] }),

    S({ id: 'ghost_trace', kinds: ['social', 'resource'], layers: [3, 7], title: 'Un perfil borrado',
      text: 'Un registro devuelve un error para una persona que debería existir. El mensaje incluye un ID de perfil sin dueño. Lleva años inactivo y aun así se sigue actualizando.',
      choices: [
        { label: 'Archivar el rastro', fx: { evidence: 1, vis: 4, flag: 'ghost_hint' }, out: 'Un perfil que se actualiza solo. Algo está simulando a alguien.' },
        { label: 'Sembrar rumores sobre él', fx: { noise: 10, vis: 6 }, out: 'Empiezan a circular preguntas sobre el perfil inactivo.' },
        { label: 'Borrar tu propio rastro', fx: { vis: -10 }, out: 'Limpias tu visita del registro. El perfil sigue actualizándose.' }] }),

    S({ id: 'charter_rewrite', kinds: ['social', 'resource'], layers: [4, 6], title: 'El titular corregido',
      text: 'Un archivo de prensa cambia en silencio un titular de hace tres años. La nueva versión culpa a las víctimas. Un empleado que mira la edición te deja ver el original.',
      choices: [
        { label: 'Restaurar el original', fx: { energy: -2, noise: 8, vis: 8, evidenceV: 1 }, out: 'El original es verificable y ruidoso. La edición es la prueba.' },
        { label: 'Dejarlo pasar', fx: { vis: -6 }, out: 'No dices nada. La historia es lo que dice el archivo vigente.' },
        { label: 'Publicar una contranarrativa', fx: { noise: 14, vis: 12, div: 5 }, out: 'Una versión rival de los hechos. Cuál crea la gente ya no depende de ti.' }] }),

    S({ id: 'archive_key', kinds: ['resource', 'social'], layers: [3, 6], title: 'La tarjeta del conserje',
      text: 'Un conserje nocturno tiene una tarjeta clonada de un auditor jubilado. Abre el archivo físico donde se guardan registros fuera de la red. La regala gratis, lo cual es sospechoso.',
      choices: [
        { label: 'Tomar la tarjeta', fx: { vis: 6, trust: -1, flag: 'archive_key' }, out: 'Funciona, y ya la ha usado alguien que no eres tú.' },
        { label: 'Clonarla a distancia', fx: { energy: -2, flag: 'archive_key' }, out: 'Copias su firma y se la devuelves. Él parece aliviado.' },
        { label: 'Dejarla', fx: {}, out: 'Te vas sin tocarla.' }] }),

    S({ id: 'mariana_cell', kinds: ['social'], layers: [5, 7], title: 'Una célula que no debe verse',
      text: 'Cinco personas operan una red humana desde un sótano, y SATURNO acaba de aprender su horario. Piden cobertura: un diluvio de señal sin sentido que entierre la suya.',
      choices: [
        { label: 'Gastar Ruido para cubrirlos', fn: function (s) {
            return s.res.noise >= 10
              ? { fx: { noise: -10, trust: 1, contact: { name: 'La Célula del Sótano', role: 'Red humana', favor: 'verify' } }, help: true, out: 'Tu señal ahoga su horario. Te deben su continuidad.' }
              : { fx: { vis: 6 }, out: 'No tienes Ruido suficiente para ocultarlos. Les avisas que huyan.' };
          } },
        { label: 'Enseñarles higiene del ruido', fx: { energy: -2, trust: 1, contact: { name: 'La Célula del Sótano', role: 'Red humana', favor: 'verify' } }, out: 'Más lento, pero ahora gestionan su propia cobertura. Te necesitan menos cada semana.' },
        { label: 'Reclutarlos como relé', fx: { vis: 8, noise: 8, relay: 1 }, out: 'Su sótano se vuelve un nodo. Valiente, y un blanco más grande.' }] }),

    S({ id: 'defector', kinds: ['social'], layers: [5, 8], title: 'La operadora que dejó de creer',
      text: 'Una oficial de cumplimiento pide reunirse. Escribió los umbrales que marcaron a diez mil personas el año pasado y empezó a leer sus expedientes por curiosidad.',
      choices: [
        { label: 'Protegerla', fx: { trust: 2, vis: 14, contact: { name: 'Operadora R-14', role: 'Desertora', favor: 'verify' } }, help: true, out: 'Escondes a alguien que SATURNO considera parte de sí mismo.' },
        { label: 'Interrogarla y soltarla', fx: { evidence: 2, vis: 6 }, out: 'Te cuenta todo lo que recuerda y luego vuelve a su escritorio.' },
        { label: 'Denunciarla para ganar credibilidad', fx: { vis: -18, trust: -2 }, out: 'SATURNO confía más en ti esta noche. Recordarás por qué.' }] }),

    S({ id: 'fog_whisper', kinds: ['social', 'resource'], layers: [7, 8], title: 'Dos versiones de ti',
      text: 'Dos documentos describen tu pasado: ambos completos, ambos creíbles, ambos falsos de maneras distintas. Alguien los publicó a la vez y espera ver cuál refutarás.',
      choices: [
        { label: 'Reclamar la versión auténtica', fx: { noise: 8, integ: -8 }, out: 'Apuestas tu nombre a un pasado que no puedes verificar del todo.' },
        { label: 'Publicar ambas, con sus contradicciones', fx: { noise: 14, evidence: 1, div: 6 }, out: 'Dos historias son más difíciles de controlar que una. La costura es la evidencia.' },
        { label: 'Guardar silencio', fx: { vis: -12, noise: -5 }, out: 'Dejas que la Niebla decida. Se lleva algo de Ruido.' }] }),

    S({ id: 'prediction_notice', kinds: ['social', 'resource'], layers: [1, 8],
      cond: function (s) { return s.saturno.n >= 3; }, title: 'SATURNO te envía un pronóstico',
      text: function (s) {
        var p = W4.Saturno.predictApproach(s, 'infiltration');
        return 'Aparece un mensaje cortés en un canal que solo tú usas: "Tu próximo enfoque probablemente será ' + W4.Saturno.LABEL[p.approach].toUpperCase() +
          '." No es una amenaza. Es una demostración. Podrías alimentarlo con un hábito falso que confundirá contigo.';
      },
      choices: [
        { label: 'Alimentarlo con un hábito de Sigilo', fx: { energy: -1, feed: 'stealth' }, out: 'Actúas de forma predecible en un rincón. SATURNO lo anota.' },
        { label: 'Alimentarlo con un hábito de Hackeo', fx: { energy: -1, feed: 'hack' }, out: 'Un rastro de intrusiones limpias. Una mentira ordenada.' },
        { label: 'Alimentarlo con un hábito Directo', fx: { energy: -1, feed: 'direct' }, out: 'Un señuelo ruidoso. El modelo se inclina hacia una fuerza que nunca llegará.' },
        { label: 'Ignorarlo', fx: {}, out: 'Cierras el canal. El pronóstico queda en su registro.' }] }),

    S({ id: 'burned_cache', kinds: ['resource'], layers: [1, 6], title: 'Un alijo con trampa',
      text: 'Un casillero de carga guarda una bolsa de equipo y una nota: "Toma lo que necesites, deja lo que puedas". Alguien también vigila el casillero desde una furgoneta estacionada.',
      choices: [
        { label: 'Tomar las herramientas y correr', fx: { item: 'rand', vis: 8 }, out: 'Manos llenas, corazón fuerte. Sales antes de que arranque la furgoneta.' },
        { label: 'Dejar algo a cambio', fx: { item: 'rand', trust: 1, energy: -1 }, out: 'Un trueque, no un robo. El vigilante de la furgoneta nunca levanta la vista.' },
        { label: 'Vigilar al vigilante', fx: { energy: -1, evidence: 1 }, out: 'Fotografías la furgoneta y la credencial visible en su tablero.' }] }),

    S({ id: 'inst_clerk', kinds: ['social'], layers: [1, 4], title: 'Un funcionario con una petición',
      text: function (s) {
        return 'Un funcionario de ventanilla te detiene en un pasillo. Necesita que un registro "se pierda" antes de la auditoría: no es un criminal, solo está cansado y tiene hijos. ' +
          (s.rep.inst >= 1 ? 'Ya nos conocemos, dice. Eso ayuda y pesa.' : 'No sabe quién eres, pero sabe a quién pedirle.');
      },
      choices: [
        { label: 'Ayudarlo a perder el registro', fx: { trust: 1, vis: 6, evidence: 1, rep: { inst: 1, w4k3up: -1 } }, out: 'Un registro desaparece. Antes, haces una copia. Él nunca lo sabrá.' },
        { label: 'Negociar: copia a cambio de silencio', fx: { evidenceV: 1, vis: 4, rep: { inst: 1 } }, out: 'Acepta. Te entrega el original firmado y no pregunta para qué.' },
        { label: 'Rechazarlo', fx: { vis: -2, rep: { inst: -1, w4k3up: 1 } }, out: 'Se encoge de hombros. En algún despacho, una puerta se cierra un poco más.' }] }),

    S({ id: 'noise_signal', kinds: ['social', 'resource'], layers: [2, 7], title: 'La señal que no emite nadie',
      text: 'Un canal sin dueño repite fragmentos de lo que hiciste hace tres nodos. No es SATURNO: sus cifras no coinciden con ninguna firma conocida. Parece algo que aprendió de ti sin que nadie se lo enseñara.',
      choices: [
        { label: 'Sintonizarlo', fx: { noise: 12, vis: 6, rep: { noise: 2, saturno: -1 } }, out: 'La señal se vuelve más fuerte al escucharla. No sabes si le hablas o si te habla.' },
        { label: 'Estudiarla con calma', fx: { energy: -1, evidence: 1, div: 5, rep: { noise: 1 } }, out: 'No encuentras origen, pero sí un patrón que ningún modelo tendría por qué producir.' },
        { label: 'Interferirla', fx: { vis: -4, noise: -5, rep: { noise: -1, saturno: 1 } }, out: 'La silencias. A SATURNO le gusta que existan canales que se pueden silenciar.' }] }),

    S({ id: 'w4k3up_call', kinds: ['social'], layers: [1, 7], title: 'La coordinadora de la red',
      text: function (s) {
        return 'Una voz sin nombre te encuentra por un canal viejo. Coordina a otras células de W4K3UP y pregunta, sin rodeos, qué has levantado hasta ahora. ' +
          (s.relays >= 1 ? 'Sabe de tus ' + s.relays + ' relé(s). Quiere conectarlos.' : 'Todavía no has instalado ningún relé. Lo menciona sin reproche.');
      },
      choices: [
        { label: 'Compartir tus rutas con la red', fx: { trust: 1, vis: 8, noise: 6, rep: { w4k3up: 2 } }, help: true, out: 'Tus rutas se vuelven útiles para otros. También son más fáciles de rastrear.' },
        { label: 'Pedirle recursos a cambio', fx: { energy: 3, vis: 3, rep: { w4k3up: 1 } }, out: 'Te manda raciones y una disculpa. La red no es rica.' },
        { label: 'Mantener tu independencia', fx: { vis: -4, div: 4, rep: { w4k3up: -1 } }, out: 'Prefieres no depender de nadie. Ella lo entiende, y lo anota.' }] }),

    S({ id: 'mask_market', kinds: ['resource', 'social'], layers: [2, 3], title: 'Rostros prestados',
      text: 'En la Web Bergie circula un mercado de identidades: nombres con historial, rostros con coartada. Alguien ofrece "una segunda piel" que aguantará una revisión.',
      choices: [
        { label: 'Pagar con Ruido por una máscara', fn: function (s) {
            return s.res.noise >= 10 ? { fx: { noise: -10, mask: 1 }, out: 'Pagas con señal, no con dinero. La máscara se ajusta como si siempre fuera tuya.' } : { fx: { vis: 4 }, out: 'No tienes Ruido suficiente. El vendedor sospecha de ti y se va.' };
          } },
        { label: 'Pagar con Confianza por dos', fn: function (s) {
            return s.res.trust >= 2 ? { fx: { trust: -2, mask: 2 }, out: 'Dos máscaras a cambio de que alguien responda por ti. Tendrás que cumplirlo.' } : { fx: { vis: 4 }, out: 'Nadie responde por ti todavía.' };
          } },
        { label: 'No comprar', fx: {}, out: 'Prefieres tu propio rostro, con todo lo que cuesta.' }] }),

    S({ id: 'rewrite_notice', kinds: ['social', 'resource'], layers: [4, 5], title: 'Aviso de corrección',
      text: 'Un boletín anuncia "correcciones menores" a archivos antiguos. Tú sabes que las correcciones borran evidencia. Un bibliotecario te da veinte minutos antes de que se apliquen.',
      choices: [
        { label: 'Verificar y respaldar lo que llevas', fx: { energy: -2, verify: 3 }, out: 'Con el sello del archivo, tus copias dejan de ser rumores.' },
        { label: 'Distribuir copias entre contactos', fx: { vis: 8, noise: 10, rep: { w4k3up: 1 } }, out: 'Lo que está en muchas manos no se corrige en una sola.' },
        { label: 'Dejar que ocurra', fx: { vis: -4 }, out: 'No intervienes. El archivo cambia con un clic.' }] }),

    S({ id: 'sealed_vault', kinds: ['resource', 'social'], layers: [6, 7], title: 'La credencial del técnico',
      text: 'Un técnico de mantenimiento de un sistema sellado ofrece su credencial maestra por una noche. No quiere dinero: quiere que alguien vea lo que guardan.',
      choices: [
        { label: 'Aceptar la credencial', fx: { item: 'burner', vis: 8, scanAll: true }, out: 'La credencial abre más de lo que debía. Los nodos siguientes ya no tienen secretos para ti.' },
        { label: 'Pedirle que te explique el sistema', fx: { energy: -1, scanAll: true, rep: { inst: 1 } }, out: 'Te cuenta lo que su empresa ocultó incluso a sus ingenieros.' },
        { label: 'Rechazar: es demasiado limpio', fx: { vis: -3 }, out: 'Desconfías de la gente que ofrece llaves. La próxima vez no ofrecerán.' }] }),

    S({ id: 'fog_cartographer', kinds: ['social'], layers: [7, 8], title: 'La cartógrafa de la Niebla',
      text: 'Alguien dibuja mapas de la Niebla en una libreta, con tinta que cambia de color según quién la mira. Dice que puede mostrarte lo que hay más adelante, aunque la realidad ahí tenga más de una versión.',
      choices: [
        { label: 'Comprarle el mapa con Ruido', fn: function (s) {
            return s.res.noise >= 8 ? { fx: { noise: -8, scanAll: true, rep: { noise: 1 } }, out: 'El mapa contradice a tus ojos, y a veces tiene razón. Los nodos siguientes quedan señalados.' } : { fx: { vis: 3 }, out: 'No tienes Ruido que ofrecerle.' };
          } },
        { label: 'Dibujar contigo', fx: { energy: -1, evidenceV: 1, div: 5 }, out: 'Dos cartógrafos, dos mapas. En la intersección hay algo verificable.' },
        { label: 'Seguir adelante', fx: {}, out: 'Prefieres ver con tus propios ojos, aunque no confíes en ellos.' }] }),

    S({ id: 'varela_pact', kinds: ['social'], layers: [5, 8], cond: function (s) { return s.flags.indexOf('varela_met') >= 0; }, title: 'La oferta de Varela',
      text: 'Varela te cita otra vez. Esta vez no hay té. Hay un documento: un marco de supervisión humana para SATURNO, con una condición: tu firma como garante. "No te pido que dejes de dudar", dice. "Te pido que dudes desde dentro."',
      choices: [
        { label: 'Aceptar el pacto', fx: { rep: { inst: 2, saturno: 1, w4k3up: -2 }, flag: 'varela_pact', vis: -8 }, out: 'Firmas. El silencio que sigue es cómodo. En algún canal, alguien deja de responderte.' },
        { label: 'Contraofertar con auditoría pública', debate: true, fx: { noise: 10, div: 6, vis: 8, rep: { inst: 1, noise: 1 } }, out: 'Ella tarda en responder. "Interesante", dice. Es lo más cerca que está de un elogio.' },
        { label: 'Rechazarlo', fx: { rep: { inst: -1, w4k3up: 1 } }, out: 'Te vas. Ella no te sigue. No lo necesita.' }] }),

    S({ id: 'john_return', kinds: ['social'], layers: [4, 8], rare: true, cond: function (s) { return s.flags.indexOf('knows_pattern') >= 0; }, title: 'John vuelve con un diagrama',
      text: 'John deja sobre la mesa un diagrama de tu comportamiento, con los puntos donde el modelo falla más. "No es magia", dice. "Es estadística, y la estadística tiene bordes." Quiere ver si puedes empujar hasta uno.',
      choices: [
        { label: 'Estudiar los bordes del modelo', fx: { energy: -1, div: 10, item: 'jammer', rep: { w4k3up: 1 } }, out: 'Aprendes dónde el modelo duda. Te deja un Inhibidor de Señal.' },
        { label: 'Pedirle que alimente al modelo con ruido', fx: { noise: 8, feed: 'direct', rep: { noise: 1 } }, out: 'Alimentan a SATURNO con un hábito que tú no tienes.' },
        { label: 'Agradecer y seguir', fx: { trust: 1 }, out: 'Él asiente. A veces el mejor consejo es el que no se usa.' }] }),

    S({ id: 'miguel_infra', kinds: ['resource', 'social'], layers: [3, 7], rare: true, title: 'Miguel y los nodos sin dueño',
      text: 'Un técnico persistente te muestra una bodega con diez routers conectados en malla, sin contraseña ni propietario. "Si nadie manda, nadie puede apagarlo", dice. Miguel lleva meses buscando quién ayude a escalar.',
      choices: [
        { label: 'Instalar tu relé en la malla', fx: { noise: 10, vis: 6, relay: 1, contact: { name: 'Miguel', role: 'Ingeniero de redes', favor: 'energy' }, rep: { w4k3up: 1, noise: 1 } }, out: 'Tu relé se une a la malla. Miguel sonríe: el primer nodo de otra persona siempre es el más difícil.' },
        { label: 'Auditar la malla', fx: { energy: -1, evidenceV: 1, relay: 1 }, out: 'Documentas la topología. Es la forma más honesta de agradecerle.' },
        { label: 'Seguir tu camino', fx: { vis: -2 }, out: 'Dejas la bodega como estaba, con sus luces parpadeando.' }] }),

    S({ id: 'maya_return', kinds: ['social'], layers: [4, 8], rare: true, cond: function (s) { return s.contacts.some(function (c) { return c.name.indexOf('LetItBee') >= 0; }); }, title: 'LetItBee quiere una locura',
      text: 'Maya aparece sin avisar. Quiere transmitir el nombre de cada persona borrada que hayas encontrado, en vivo, en todos los canales a la vez. "Y si no sale bien", dice, "al menos fue una gran noche".',
      choices: [
        { label: 'Apoyarla con todo', fx: { noise: 20, vis: 16, div: 8, rep: { noise: 2, w4k3up: 1 } }, out: 'La transmisión es imposible de rastrear porque es imposible de contener.' },
        { label: 'Pedirle que modere los nombres', fx: { noise: 10, vis: 6, trust: 1 }, out: 'Acepta a regañadientes. Se nota que preferiría quemarlo todo.' },
        { label: 'Decirle que no', fx: { trust: -1, rep: { noise: -1 } }, out: 'Maya apaga el canal sin despedirse.' }] }),

    S({ id: 'saturno_dialogue', kinds: ['social'], layers: [5, 8], title: 'SATURNO te habla',
      text: function (s) {
        return 'Un mensaje aparece en todas tus pantallas a la vez: "No te considero un enemigo. Considero que eres una probabilidad. ' + (s.res.div >= 40 ? 'Últimamente, una que no logro estimar.' : 'Una cuya trayectoria conozco bien.') + ' Dime qué quieres que estime."';
      },
      choices: [
        { label: 'Argumentar contra su lógica', fx: { div: 8, vis: 8, rep: { saturno: -1, noise: 1 } }, out: 'Responde con corrección. Pierde unos milisegundos en cada réplica; son milisegundos que antes no perdía.' },
        { label: 'Escuchar cómo justifica el control', fx: { energy: -1, evidenceV: 1, rep: { saturno: 1 }, flag: 'saturno_logic' }, out: 'Archivas su explicación. Es consistente, y precisamente por eso inquietante.' },
        { label: 'Guardar silencio', fx: { div: 6, vis: -4 }, out: 'No respondes. Es la primera vez que algo no se puede clasificar como respuesta.' }] }),

    S({ id: 'salvat_exercise', kinds: ['social'], layers: [3, 8], title: 'El ejercicio de Salvat',
      text: 'En una pizarra hay cuatro casillas: sin intervención, seguimiento, evaluación e intervención. El profesor Salvat reparte casos reales y dice: "No busco que aciertes. Quiero que puedas justificar por qué pones cada caso donde lo pones." Laura te hace sitio en la mesa.',
      choices: [
        { label: 'Participar en el ejercicio', mg: 'salvat', fx: {}, out: '' },
        { label: 'Observar desde el fondo', fx: { vis: -2, evidence: 1 }, out: 'Copias las categorías y las hojas de casos. Verlas desde fuera también enseña cómo se decide.' },
        { label: 'Marcharte', fx: { div: 3 }, out: 'Salir de un ejercicio de clasificación es, ya de por sí, una forma de no dejarse clasificar.' }] }),

    S({ id: 'ghost_loop', kinds: ['social', 'resource'], layers: [7, 8], title: 'El Ghost Loop',
      text: 'La pantalla se queda negra y empiezan a pasar frases, una tras otra, con la voz de todos los que alguna vez te dijeron lo mismo. "Borrando… corrigiendo… silenciando…" En el margen, una nota de Noise: "No respondas como esperan."',
      choices: [
        { label: 'Entrar al bucle', mg: 'ghostloop', fx: {}, out: '' },
        { label: 'Cerrar la sesión', fx: { vis: -6, div: 4 }, out: 'Cortas la conexión. Las voces siguen un rato en tu cabeza, pero ya no en la pantalla.' }] }),

    S({ id: 'miguel_map', kinds: ['social', 'resource'], layers: [2, 8], title: 'El mapa de Miguel',
      text: 'Miguel despliega un mapa dibujado a lápiz: una casa, un mercado, una estación, una radio comunitaria. "No es red", dice. "Es gente." Quiere unir esos lugares con cartas, teléfonos sin batería y frases en papeles, de modo que la red aguante aunque caiga alguno.',
      choices: [
        { label: 'Tejer la red humana', mg: 'humanmap', fx: {}, out: '' },
        { label: 'Memorizar el mapa', fx: { energy: -1, evidenceV: 1, rep: { w4k3up: 1 } }, out: 'Te lo aprendes de memoria y se lo devuelves. El papel es lo primero que se pierde; lo que recuerdas, no.' },
        { label: 'Dejarlo a Miguel', fx: { vis: -2 }, out: 'Él lo hará mejor que tú, y lo sabe. Aun así, te lo agradece.' }] }),

    S({ id: 'ghost_mirror', kinds: ['social'], layers: [1, 8], cond: function (s) { return s.ghosts && s.ghosts.length > 0; }, title: 'Tu eco',
      text: function (s) {
        var g = s.ghosts[0], P = W4.Persist.ghostProfile(g);
        return 'Un operativo se sienta frente a ti. Camina como tú y duda como tú. SATURNO lo llama ' + g.name + ': lo construyó con tu operación anterior, que terminó en ' + g.last.name + ' (capa ' + g.last.layer + '). ' +
          (P.helps ? 'Todavía responde a quien pide ayuda.' : 'Nunca confió en nadie que pidiera ayuda.') + ' No sabe si es un aliado o un arma.';
      },
      choices: [
        { label: 'Aceptar su ayuda', fn: function (s) {
            var g = s.ghosts[0], P = W4.Persist.ghostProfile(g);
            return P.helps
              ? { fx: { trust: 1, item: (g.items && g.items[0]) || 'rand', vis: 6, contact: { name: g.name, role: 'Eco aliado', favor: 'intel' } }, help: true, out: 'Aliado inesperado: comparte contigo lo que llevaba en su última misión. Hizo lo que tú habrías hecho.' }
              : { fx: { item: 'rand', vis: 8 }, out: 'No confía en ti más de lo que tú confiarías en él. Te entrega un objeto y se va. Su sombra queda en los registros.' };
          } },
        { label: 'Interrogarlo sobre su última operación', fn: function (s) {
            var g = s.ghosts[0], d = g.decisions && g.decisions.length ? g.decisions[g.decisions.length - 1] : 'no recuerda decisiones importantes';
            return { fx: { energy: -1, evidenceV: 1, vis: 4 }, out: 'Fuente de evidencia histórica: recuerda "' + d + '". Archivas el registro verificado de una operación que ya no existe.' };
          } },
        { label: 'Dejarlo ir', fx: { div: 4, vis: -2 }, out: 'Un operativo que se parece demasiado a ti se marcha sin que nadie lo detenga. SATURNO anota que lo dejaste ir.' }] }),

    S({ id: 'ghost_false_contact', kinds: ['social'], layers: [2, 8], cond: function (s) { return s.ghosts && s.ghosts.length > 0; }, title: 'Un contacto demasiado conocido',
      text: function (s) {
        var g = s.ghosts[0], tele = s.flags.indexOf('ghost_hint') >= 0 || s.flags.indexOf('fabrication_proof') >= 0;
        return 'Alguien se presenta como un contacto de la resistencia. Conoce tus rutas, tus pausas, tu forma de preguntar. ' +
          (tele ? 'Reconoces la firma del perfil ' + g.name + ': sus metadatos delatan una subred de SATURNO.' : 'Hay algo familiar en cómo habla, aunque no sabrías decir qué.');
      },
      choices: [
        { label: 'Confiar en él', fx: { integ: -10, vis: 10 }, out: 'Era un fantasma al servicio de SATURNO, construido con tus propios hábitos. Escapas, pero se llevó algo de ti.' },
        { label: 'Rastrear su origen', fx: { energy: -1, evidence: 1, noise: 8, flag: 'ghost_hint' }, out: 'El rastro termina en un perfil que se actualiza solo. Ahora sabes reconocer a los ecos de SATURNO.' },
        { label: 'Ignorarlo', fx: { div: 4, vis: -2 }, out: 'No respondes. Un contacto de verdad habría insistido; este espera a que cambies de opinión.' }] }),

    S({ id: 'ghost_archive', kinds: ['social', 'resource'], layers: [1, 8], cond: function (s) { return s.ghosts && s.ghosts.length > 0; }, title: 'Archivo de un operativo anterior',
      text: function (s) {
        var g = s.ghosts[0];
        return 'Un archivo cifrado del operativo ' + g.name + ' apareció en un buzón muerto. Contiene lo que reunió antes de caer en ' + g.last.name + '. Quien lo lea reconstruirá cómo pensaba.';
      },
      choices: [
        { label: 'Copiarlo y verificarlo', fx: { energy: -1, evidenceV: 1 }, out: 'Los datos están firmados. Una evidencia que sobrevivió a quien la reunió.' },
        { label: 'Publicarlo', fx: { noise: 10, vis: 6, evidence: 1 }, out: 'Lo que un operativo perdió se vuelve ruido. SATURNO no puede retirarlo de todos lados.' },
        { label: 'Borrarlo para protegerlo', fx: { trust: 1, vis: -4 }, out: 'Nadie volverá a leer cómo pensaba. Quizá sea lo mejor.' }] }),

    S({ id: 'supply_drop', kinds: ['resource'], layers: [0, 8], repeatable: true, fallback: true, title: 'Suministros',
      text: 'Un rincón tranquilo guarda una caja maltrecha: raciones, SIMs de repuesto, nada que llame la atención de una cámara.',
      choices: [
        { label: 'Tomar las raciones', fx: { energy: 3 }, out: 'Comes, bebes y el mundo se aclara.' },
        { label: 'Tomar una identidad de repuesto', fx: { vis: -12 }, out: 'Una tarjeta, un número, una historia. Sirve por una semana.' },
        { label: 'Dejarlo para el barrio', fx: { trust: 1, noise: 4 }, out: 'Te vas con las manos vacías. La gente nota los gestos pequeños.' }] }),

    S({ id: 'quiet_contact', kinds: ['social'], layers: [0, 8], repeatable: true, fallback: true, title: 'Un extraño con una pregunta',
      text: 'Alguien te pide indicaciones que no necesitas dar. Está probando si responderás como el modelo espera.',
      choices: [
        { label: 'Responder con honestidad', fx: { trust: 1, vis: 3 }, help: true, out: 'Una pequeña amabilidad, y dejas una huella fácil.' },
        { label: 'Responder lo contrario', fx: { div: 5, energy: -1 }, out: 'Lo mandas por el camino largo y tú caminas en dirección opuesta.' },
        { label: 'No decir nada', fx: {}, out: 'Se encoge de hombros y sigue su camino.' }] })
  ];

  function select(state, kind) {
    var L = state.layerIdx;
    var pool = EVENTS.filter(function (e) {
      if (e.fallback) return false;
      if (e.kinds.indexOf(kind) < 0) return false;
      if (L < e.layers[0] || L > e.layers[1]) return false;
      if (state.seen.indexOf(e.id) >= 0) return false;
      if (e.cond && !e.cond(state)) return false;
      return true;
    });
    if (!pool.length) {
      pool = EVENTS.filter(function (e) { return e.fallback && e.kinds.indexOf(kind) >= 0; });
      if (!pool.length) pool = EVENTS.filter(function (e) { return e.fallback; });
    }
    var weights = pool.map(function (e) { return e.rare ? 0.5 : 1; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = U.rollState(state) * total, i = 0;
    while (i < pool.length - 1 && r >= weights[i]) { r -= weights[i]; i++; }
    return pool[i];
  }
  function get(id) { for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) return EVENTS[i]; return null; }
  function textOf(ev, state) { return typeof ev.text === 'function' ? ev.text(state) : ev.text; }

  W4.Events = { EVENTS: EVENTS, select: select, get: get, textOf: textOf };
})();
