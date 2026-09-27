# 🏍️ Bike Race Web (Recreación 2D para Navegadores - 100 Niveles)

Una recreación moderna, ligera y 100% web del legendario juego móvil **Bike Race**, desarrollada con **HTML5 Canvas**, **JavaScript** y el motor de físicas 2D **Matter.js**.

¡No requiere ninguna instalación! Funciona directamente en cualquier navegador de PC, portátil, tablet o smartphone.

---

## 🚀 Características Principales

* **100 Niveles & 10 Mundos Únicos:**
  * **Mundo 1:** Desierto Cálido (Niveles 1 - 10)
  * **Mundo 2:** Cañón Rocoso (Niveles 11 - 20)
  * **Mundo 3:** Valle de los Loops 360° (Niveles 21 - 30)
  * **Mundo 4:** Glaciar Ártico (Niveles 31 - 40)
  * **Mundo 5:** Dunas Carmesí (Niveles 41 - 50)
  * **Mundo 6:** Selva & Ruinas (Niveles 51 - 60)
  * **Mundo 7:** Metrópolis Neón (Niveles 61 - 70)
  * **Mundo 8:** Picos de Lava (Niveles 71 - 80)
  * **Mundo 9:** Tormenta Eléctrica (Niveles 81 - 90)
  * **Mundo 10:** Dimensión Titán (Niveles 91 - 100)
* **Sistema de 3 Estrellas (Hasta 300 Estrellas):** Desbloqueo progresivo de niveles, guardado de mejor tiempo y recuento total de estrellas en `localStorage`.
* **Física de Motocross Realista:**
  * Silueta auténtica de Dirt Bike: guardabarros delantero agresivo (*beak*), colín alzado (*rear fender*), horquillas telescópicas doradas y monoamortiguador con muelle helicoidal rojo.
  * Neumáticos de tacos (*knobby tires*) con radios metálicos.
  * Piloto con casco de visera afilada y **gafas amarillas reflectantes** del juego original.
* **Física de Impacto & Ragdoll:** Detección de caída al abismo (*death floor*), choques de cabeza o aterrizajes invertidos con expulsión del piloto (*ragdoll*).
* **Loops 360° & Piruetas:** Detección automática en el aire de *Backflips* y *Frontflips*.
* **Audio Sintetizado con Web Audio API:** Sonidos de motor, aceleración, derrapes, choques y fanfarrias generados proceduralmente sin archivos pesados.
* **Interfaz Limpia sin Botones en Pantalla:** Solo leyenda elegante de controles en el pie de pantalla.

---

## 🎮 Controles

| Acción | Tecla (PC) |
| :--- | :--- |
| **Acelerar (Gas)** | Flecha Arriba `↑` o `W` |
| **Frenar** | Flecha Abajo `↓` o `S` |
| **Inclinarse Atrás (Wheelie / Backflip)** | Flecha Izquierda `←` o `A` |
| **Inclinarse Delante (Stoppie / Frontflip)** | Flecha Derecha `→` o `D` |
| **Reiniciar Nivel** | `R` o Barra Espaciadora |
| **Abrir / Cerrar Mapa de 100 Niveles** | `M` o `Esc` |

---

## 📂 Cómo Probarlo en Local

1. Abre la carpeta `bike-race-web`.
2. Haz doble clic en el archivo [`index.html`](file:///index.html) para abrirlo en tu navegador favorito (Chrome, Edge, Firefox, Safari).
3. ¡A acelerar y conseguir las 300 estrellas!

---

## 🌐 Cómo Publicarlo Gratis en GitHub Pages

Para que el juego esté disponible en una página web pública accesible desde cualquier dispositivo:

1. **Crea un repositorio en GitHub:** [github.com/new](https://github.com/new) con el nombre `bike-race-web`.
2. **Sube los archivos desde tu terminal:**
   ```bash
   git add .
   git commit -m "Update: 100 levels system and clean HUD"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/bike-race-web.git
   git push -u origin main
   ```
3. **Activar GitHub Pages:**
   * En tu repositorio de GitHub, ve a **Settings** > **Pages**.
   * En *Branch*, selecciona `main` y la carpeta `/(root)`.
   * Pulsa **Save**.
   * En menos de un minuto tendrás tu enlace listo: `https://TU_USUARIO.github.io/bike-race-web/`.

---

## 🛠️ Tecnologías Utilizadas

* **HTML5 Canvas & JavaScript moderno** (ES6+)
* **Matter.js** (Motor de física rígida 2D)
* **Web Audio API** (Efectos de sonido procedurales)
