# W4K3UP: SIN CLASIFICAR (versión completa, Etapa 6)

Roguelike táctico por turnos sobre vigilancia, predicción, identidad y resistencia, basado en el universo de
*Cómo se codificó el primer NO — El efecto W4K3UP*. Todo el juego está en español.

## Cómo ejecutarlo
* Abre `index.html` directamente (funciona con `file://`), o
* Sube esta carpeta a un repositorio de GitHub y activa **Settings → Pages → Deploy from branch → `/ (root)`**.

Sitio estático: HTML, CSS y JavaScript puro. Sin compilación ni peticiones externas.

## Estructura
```
index.html
css/style.css
js/util.js      PRNG con semilla y utilidades
js/save.js      localStorage versionado (v2), validación y recuperación de guardados dañados
js/world.js     capas y generador procedural de la red
js/saturno.js   motor de predicción conductual
js/events.js    eventos narrativos
js/persist.js   mundo persistente: fantasmas, memoria, herencia y consecuencias
js/minigames.js intrusión de terminal y debate con Varela
js/missions.js  motor táctico (cuadrícula, visión, detección, IA enemiga)
js/tactical.js  dibujo en Canvas 2D y traducción de toques
js/audio.js     efectos de sonido con Web Audio
js/game.js      reglas y máquina de estados
js/ui.js        interfaz
js/main.js      arranque
```

## Qué hay en la Etapa 2
Cada operación (investigación, infiltración, disrupción, alto riesgo, élite, puerta) es una misión táctica en una
cuadrícula de 10x10 o 12x12, generada de forma determinista a partir de la semilla y el nodo:

* **Turnos y PA:** 3 PA (Sigilo/Hackeo) o 4 PA (Directo). Mover, Observar, Acceder a terminal, Recoger evidencia,
  Señuelo, Esconderse, Desactivar vigilancia, Neutralizar (solo Directo, costoso), Extraer y Terminar turno.
* **Enemigos:** cámaras que giran cada turno, patrullas con rutas, persecución y búsqueda de señuelos, procesos de monitoreo fijos.
* **Visión y detección:** línea de visión con obstáculos, conos visibles, niebla de guerra, cobertura y sospecha acumulada.
* **Objetivos y salida:** terminales, relés, núcleos de SATURNO, evidencia y punto de extracción. Se puede extraer de forma parcial.
* **SATURNO en el mapa:** su contramedida son unidades extra contra el enfoque que predijo (cámaras contra Sigilo,
  procesos de monitoreo contra Hackeo, patrullas contra Directo), telegrafiadas en el informe previo.
* **Reglas de capa** adaptadas a lo táctico (acceso remoto en la Web Profunda, visión reducida en la Niebla, etc.).

## Qué hay en la Etapa 3: SATURNO completo
* **Qué observa:** enfoque por tipo de nodo, ruta (segura/riesgosa), herramientas tácticas (Señuelo, Esconderse, Desactivar,
  Observar), tipos de misión, ahorro de energía al entrar, extracción completa o parcial y si respondes a peticiones de ayuda.
* **Modelo:** frecuencias ponderadas con decaimiento exponencial. Las predicciones se calculan y guardan antes de que actúes.
* **Predice y se adapta:** enfoque (contramedida = unidades extra), ruta (vigila el nodo esperado) y herramienta táctica
  (entrenamiento: señuelos de corto alcance, coberturas menos efectivas, desactivar/observar cuestan 2 PA). Una sola
  contramedida táctica por misión y de fuerza fija, siempre telegrafiada en el informe previo.
* **Divergencia real:** se calcula con la diferencia entre lo predicho y lo observado en enfoque, ruta y herramienta.
  Un fallo muy confiado sube más la Divergencia; el Inhibidor de Señal, el Ruido, los Señuelos y los nodos élite permiten engañarlo.
* **Pantalla SATURNO:** clasificación y estilo táctico, pronóstico actual, tendencias, hábitos tácticos, perfil de riesgo,
  pronóstico por tipo de nodo, contramedidas activas y registro de predicciones acertadas/falladas.
* **Transmisiones:** a veces SATURNO anuncia su pronóstico en el registro.

## Qué hay en la Etapa 4: mundo persistente
* **Fantasmas:** si una operación termina en derrota, SATURNO crea un fantasma con tu perfil conductual (pesos de enfoque,
  herramientas tácticas, ruta, ayuda a contactos), tu equipo, tu última misión y tus decisiones importantes. Hay hasta 5 activos;
  los más viejos pasan al archivo histórico. Cada partida usa como máximo 2 y solo uno por capa.
* **Cómo aparecen:** como patrulla institucional que actúa según tu perfil (Sigilo: acecha entre coberturas; Hackeo: custodia
  una terminal; Directo: persigue con paso doble; ignora o cae en señuelos según tus hábitos), como contacto falso, como aliado
  inesperado (si respondías a peticiones de ayuda) o como fuente de evidencia histórica. Sustituyen a una patrulla, no se suman.
* **Qué persiste:** memoria de SATURNO sobre ti, descubrimientos (dan herramientas y evidencia iniciales), nodos clandestinos
  (Ruido inicial y canal alterno más barato), contactos veteranos, evidencia salvada por el Ruido y consecuencias de cada desenlace.
* **Desenlaces con consecuencias distintas:** Exposición reduce a la mitad la memoria de SATURNO; Liberación suma nodos clandestinos;
  Reforma debilita sus contramedidas; Anomalía borra su memoria y empiezas con Divergencia 15.
* **Sin bonos de poder:** el mundo da información, contactos y herramientas, y SATURNO también aprende de cada partida.
* **Pantallas:** "Mundo persistente" (fantasmas, memoria, red, descubrimientos, archivo) e "Historial" con las consecuencias de cada run.
  Al empezar puedes ver la herencia y desactivarla para jugar desde cero.

## Qué hay en la Etapa 5: profundidad narrativa
* **34 eventos distintos** (más 2 de relleno) repartidos por capas, con condiciones sobre banderas, contactos, reputación,
  fantasmas, relés y conocimiento de SATURNO. Aparecen John, Maya/LetItBee, Miguel y Varela como contactos o referencias, no como unidades.
* **Facciones:** reputación (-5 a +5) con W4K3UP, SATURNO, Ruido y Operadores institucionales. Con 3+ en W4K3UP recibes +1 energía
  al descender; con 3+ en Ruido, +3 Ruido. Operadores y SATURNO abren el pacto de Estabilidad.
* **Una mecánica propia por capa:** Clearnet (escaneo libre), Web de Superficie (acciones directas públicas), Web Bergie
  (2 máscaras que absorben detecciones), Web Profunda (acceso remoto y más fantasmas), Web Charter (reescritura que borra
  evidencia sin verificar salvo con 20 de Ruido), Web de Mariana (favores gratis y SATURNO denso), Cáscara Cerrada (terminales selladas),
  La Niebla (visión corta e informes poco fiables), Primarca (desenlaces).
* **6 desenlaces:** Exposición, Liberación, Reforma, Sin clasificar (oculto) y dos nuevos: **Estabilidad** (pacto con Varela, aparece si
  la conociste) y **Resonancia** (el Ruido sostiene la red sin ti, aparece con mucho Ruido). Cada uno tiene consecuencias persistentes distintas.

## Qué hay en la Etapa 6: pulido y balance
* **Balance:** fallos tácticos menos castigadores (-1/-1/-2 de Integridad), el refugio recupera 12 de Integridad, Exposición pide 14 de peso
  y 3 verificadas, y la memoria heredada de SATURNO tiene tope (70%). Un bot que esquiva conos llegó al final en ~60% de las partidas.
* **Controles táctiles:** toca una celda para ver el coste y toca de nuevo para moverte (se activa solo en pantallas táctiles);
  tocar un enemigo u objeto lo inspecciona en vez de actuar; ahora Desactivar y Neutralizar usan el enemigo inspeccionado.
* **Teclado (opcional):** flechas/WASD mueven; T termina turno; O observar; C recoger; X acceder; H esconderse; F desactivar; N neutralizar; E extraer.
* **Ajustes:** sonido, tutorial, confirmar movimientos, texto grande, reducir animaciones y reinicio del tutorial.
* **Retroalimentación:** destellos en las barras al cambiar, barra de sospecha que parpadea en alerta, sonidos distintos para detección,
  máscaras consumidas, éxito y derrota.
* **Rejugabilidad:** botón "Semilla del día" (misma semilla para todos cada día), repetir semilla y herencia opcional del mundo.

## Minijuegos
* **Intrusión de terminal:** al usar Acceder se abre un puzzle de código de símbolos sin repetir (3 símbolos de 4 en las capas 0-3; 4 de 5
  después). Cada intento da ●N (correcto en su lugar) y ○N (correcto en otro lugar). Resuelto en 2 intentos o menos: recuperas 1 PA.
  Fallar o forzar el acceso abre la terminal igual, pero salta una alarma (+30 sospecha), así que nunca hay callejones sin salida.
  Hackeo recibe 1 intento extra y una pista. El código es el mismo para la misma semilla. Se puede desactivar en Ajustes.
* **Debate con Varela:** tres rondas por turnos en los encuentros con Varela. Cada argumento es de cifras, de deber o de personas, y se
  responde mejor con datos verificados, autonomía o empatía respectivamente. Repetir tu estilo hace que ella lo anticipe. El resultado
  (ganar, empatar, perder) cambia la reputación con los operadores, da Ruido o evidencia y deja constancia de que la conociste (Estabilidad).

## Minijuegos inspirados en la novela
Se revisó el manuscrito *Cómo se codificó el primer NO*; estos minijuegos salen de sus escenas:
* **Montar la antena** (final, Miguel en la azotea): al instalar un relé en una disrupción. Orientación hacia el salón de actos, mástil que
  supere el depósito sin asomar y frecuencia fuera de las bandas vigiladas. Los escaneos revelan bandas vigiladas y la estática de las libres.
  Un enlace limpio da +8 Ruido; fallar o abandonar suma 30 de sospecha.
* **El ejercicio de Salvat** (clase de Laura): 4 casos con cuatro casillas (sin intervención, seguimiento, evaluación, intervención) y una
  justificación. Los falsos positivos y negativos cuentan. Pensar como SATURNO sube su reputación; el criterio sólido da Confianza y Divergencia.
* **Ghost Loop** (nivel 7.5, Manual del NO): 5 voces de conformidad. Cada tipo se contesta mejor con una regla del manual, y el bucle predice
  tu réplica con tus hábitos: repetirte resta puntos.
* **Tejer la red humana** (el mapa de Miguel): unir 6 personas y lugares con enlaces de coste limitado (algunos vigilados) para que la red
  aguante la caída de cualquier nodo. Una red resistente da un relé, Ruido, un contacto y reputación.
* Los tres últimos son eventos (capas 3+, 7+ y 2+). La antena y la intrusión se desactivan en Ajustes.

## Mecánica añadida: rescate y escolta de contactos
* Algunas operaciones (investigación, infiltración, alto riesgo, capas 1 a 7) traen una **señal de auxilio**: una persona retenida (C en el mapa).
* **Liberar** (2 PA, 1 con Hackeo) estando adyacente. Después te sigue a una celda de distancia; las cámaras y patrullas también la ven
  (suman sospecha) y si una patrulla se le acerca, la capturan. Debe estar junto a la salida cuando extraigas.
* **Recompensa:** se une a tu red como contacto con un favor, +2 Confianza y reputación con W4K3UP. Si la capturan, pierdes Confianza y reputación.
* **Juego mental con SATURNO:** cada rescate cuenta como ayuda a un contacto. Si respondes siempre a las peticiones de ayuda, SATURNO puede
  fabricar una trampa: al liberar al señuelo se dispara una alerta, pero conservas una prueba de que fabrica señales (descubrimiento
  persistente). Escanear el nodo revela si los metadatos de la señal no cuadran.
* Atajo de teclado: L = Liberar.

## Lista de pruebas manuales
1. Menú → Nueva operación → Comenzar. Escanea y entra a un nodo de investigación.
2. Elige un enfoque. Muévete tocando una celda; observa los conos rojos y cómo giran las cámaras al terminar el turno.
3. Recoge evidencia, llega a X y extrae. Revisa cómo cambian Visibilidad y Divergencia.
4. Repite el mismo enfoque 3 veces: aparece el pronóstico y la contramedida (unidades con borde ámbar).
5. Prueba Señuelo, Esconderse en una cobertura y Desactivar. Con Directo, prueba Neutralizar.
6. Recarga la página: "Reanudar operación" te devuelve a la misma misión.
7. Repite una semilla: mapa y misiones idénticos.
11. Baja a la Web Bergie: recibes 2 máscaras (se ven en la cabecera de misión). En la Web Charter, la evidencia sin verificar corre peligro.
13. Abre Ajustes: activa Texto grande y Confirmar movimientos. En una misión, toca una celda dos veces para moverte; toca una cámara para inspeccionarla.
16. Accede a una terminal: resuelve el código (símbolos y ●/○). Prueba también Forzar acceso y desactivar el minijuego en Ajustes.
18. Instala un relé (nodo de disrupción) y monta la antena. Busca los eventos Salvat, Ghost Loop y el mapa de Miguel.
17. Si aparece Varela, elige Debatir y juega las tres rondas.
15. Busca un nodo con "Petición de auxilio": escanéalo, libera a la persona (botón Liberar), escóltala a la salida y comprueba que se une a Contactos.
14. Con teclado: flechas/WASD para mover y T para terminar el turno.
12. En el Operativo revisa las Facciones y cómo cambian con tus decisiones.
9. Pierde una partida: en el final se listan las consecuencias y se crea un fantasma. En Menú → Mundo persistente aparece con su comportamiento.
10. Empieza otra operación: la herencia aparece en la ventana de inicio. En las capas 1+ un nodo de operación puede traer a tu fantasma (borde azul con F).
8. Usa el mismo enfoque y la misma herramienta (p. ej. Sigilo + Señuelo) 8 o más veces: en el informe aparece el entrenamiento táctico. Cambia de enfoque y mira subir la Divergencia en la pestaña SATURNO.

## Limitaciones conocidas
* Los guardados de la Etapa 1 se descartan al actualizar (se conserva el historial).
* Los guardados de la Etapa 2 siguen funcionando (SATURNO completa sus campos nuevos al cargar).
* El balance se calibró con bots, no con jugadores reales: conviene ajustar con partidas humanas.
* No se ha probado en dispositivos físicos ni se ha verificado visualmente el Canvas.
* El balance táctico se probó con bots; falta probarlo con jugadores y en pantallas reales.
