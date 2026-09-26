# 🏍️ Bike Race Web (Recreación 2D para Navegadores)

Una recreación moderna, ligera y 100% web del legendario juego móvil **Bike Race**, desarrollada con **HTML5 Canvas**, **JavaScript** y el motor de físicas 2D **Matter.js**.

¡No requiere ninguna instalación! Funciona directamente en cualquier navegador de PC, portátil, tablet o smartphone.

---

## 🚀 Características Principales

* **Física 2D Realista:** Simulación con ruedas independientes, suspensión de muelles, chasis rígido y detección de impacto en el casco del piloto.
* **Loops 360° y Rampas Acrobáticas:** Diseñado con curvas físicas para realizar saltos de gran altura y bucles completos.
* **Sistema de Piruetas (Flips):** Detección automática en el aire de *Backflips* y *Frontflips* con recompensas en pantalla.
* **Audio Sintetizado con Web Audio API:** Sonidos de motor, aceleración, derrapes, choques y fanfarrias generados proceduralmente sin necesidad de descargar archivos de audio pesados.
* **Editor de Pistas Sandbox (Nivel 5):** Permite dibujar tus propias pistas con el ratón o el dedo en tiempo real y jugarlas al instante.
* **Soporte Móvil y Táctil Completo:** Botones táctiles integrados en pantalla para acelerar, frenar e inclinarse.
* **Listo para GitHub Pages:** Subes este repositorio a GitHub, activas GitHub Pages y tendrás tu propio enlace web público al instante.

---

## 🎮 Controles

| Acción | Teclado (PC) | Pantalla Táctil (Móvil/Tablet) |
| :--- | :--- | :--- |
| **Acelerar (Gas)** | Flecha Arriba `↑` o `W` | Botón verde `🚀 Gas` o tocar mitad derecha de pantalla |
| **Frenar** | Flecha Abajo `↓` o `S` | Botón rojo `🛑 Freno` o tocar mitad izquierda de pantalla |
| **Inclinarse Atrás (Wheelie)** | Flecha Izquierda `←` o `A` | Botón `⤺ Atrás` |
| **Inclinarse Delante** | Flecha Derecha `→` o `D` | Botón `⤻ Adelante` |
| **Reiniciar Nivel** | `R` o Barra Espaciadora | Botón `⟳` en el encabezado |

---

## 📂 Cómo Probarlo en Local

1. Abre la carpeta `bike-race-web`.
2. Haz doble clic en el archivo [`index.html`](file:///index.html) para abrirlo en tu navegador favorito (Chrome, Edge, Firefox, Safari).
3. ¡A acelerar!

---

## 🌐 Cómo Publicarlo Gratis en GitHub Pages (Para que cualquiera lo juegue online)

Para que el juego esté disponible en una página web pública accesible desde cualquier lugar:

1. **Crea un repositorio en GitHub:**
   * Entra a [github.com/new](https://github.com/new).
   * Ponle un nombre (por ejemplo: `bike-race-web`).
   * Déjalo en público o privado según prefieras.

2. **Sube los archivos desde tu terminal:**
   ```bash
   git add .
   git commit -m "Initial commit: Bike Race Web"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/bike-race-web.git
   git push -u origin main
   ```

3. **Activar GitHub Pages:**
   * En tu repositorio de GitHub, ve a **Settings** (Configuración) > **Pages**.
   * En *Branch*, selecciona `main` y la carpeta `/(root)`.
   * Pulsa **Save**.
   * En menos de un minuto tendrás tu enlace listo: `https://TU_USUARIO.github.io/bike-race-web/`.

---

## 🛠️ Tecnologías Utilizadas

* **HTML5 Canvas & JavaScript moderno** (ES6+)
* **Matter.js** (Motor de física rígida 2D)
* **Web Audio API** (Efectos de sonido procedurales)
