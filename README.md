# TradingView Gratis 📈

> **Una alternativa open-source y 100% gratis a TradingView Pro, pensada para LATAM.**
> Velas en vivo, indicadores propios, watchlist, dibujo técnico, detección automática de patrones — sin pagar USD, sin login, sin ads.

Plataforma de charts para **crypto** (Binance) y **acciones** (Yahoo Finance), construida sobre la misma librería de render que usa TradingView ([`lightweight-charts`](https://github.com/tradingview/lightweight-charts)).

---

## 🤖 Ejecutalo con Claude Code (recomendado)

Si tenés [Claude Code](https://claude.com/claude-code) instalado, no hace falta que sepas nada de Node.js ni de comandos — Claude arma, instala y levanta el proyecto por vos, y también le podés pedir que agregue funciones nuevas.

**1. Instalá los requisitos (una sola vez):**
- [Node.js](https://nodejs.org) (versión LTS)
- Claude Code: `npm install -g @anthropic-ai/claude-code`

**2. Clonás el repo y entrás a la carpeta:**
```bash
git clone https://github.com/totoschi10-collab/tradingview-mesa-chica.git
cd tradingview-mesa-chica/app
```

**3. Arrancás Claude Code ahí adentro:**
```bash
claude
```

**4. Le pedís, tal cual:**
```
Instalá las dependencias y levantá el servidor de desarrollo. Después abrime la app en el navegador.
```

Claude va a correr `npm install`, `npm run dev`, y te va a mostrar la app funcionando. A partir de ahí le podés pedir lo que quieras:
- *"Agregá un indicador de Bollinger Bands"*
- *"Cambiá el color de las velas alcistas a azul"*
- *"Quiero que la watchlist tenga un buscador arriba"*
- *"Agregá soporte para futuros de Binance"*

Como el proyecto ya trae un archivo `AGENTS.md` con el contexto del stack, Claude entiende la estructura del código desde el primer mensaje.

---

## 🚀 Empezar manualmente (sin Claude Code)

```bash
git clone https://github.com/totoschi10-collab/tradingview-mesa-chica.git
cd tradingview-mesa-chica/app
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

---

## ✨ Features

- 📊 **Velas en vivo** — crypto vía WebSocket de Binance, acciones vía Yahoo Finance (sin API key)
- 🔍 **Búsqueda de símbolo** — pares USDT de Binance y tickers de acciones/ETFs
- ⏱️ **Multi-timeframe**: 1m / 5m / 15m / 1h / 4h / 1d / 1w, con % de variación calculado según el timeframe activo
- 📐 **Indicadores client-side**: EMA 20/50/200, RSI 14, MACD 12/26/9, Volumen
- ✏️ **Herramientas de dibujo**: línea horizontal, línea de tendencia (segmento/rayo/extendida), Fibonacci (retroceso + extensión unificados), regla de medida (funciona incluso en el área futura del chart)
- 🧠 **Detección automática de patrones**, cada uno con su propio toggle:
  - Soportes y resistencias validados (clustering de pivotes)
  - Líneas de tendencia automáticas
  - Canales paralelos (estilo herramienta de canal de TradingView)
  - Banderas alcistas/bajistas (bull flag / bear flag)
  - Fibonacci automático sobre el último cambio de tendencia
- 💼 **Estrategias globales** — guardá un set de dibujos y aplicalo a cualquier símbolo
- 👁️ **Watchlist** con dos pestañas (Cripto / Acciones), precios en vivo y % dinámico
- 🖱️ **Zoom de precio con la rueda** sobre el eje derecho, igual que TradingView
- 🎨 **Visual idéntica a TradingView** (paleta, fuentes, layout)
- 💾 **Persistencia** en localStorage (símbolo, timeframe, indicadores, dibujos, estrategias)
- 🌐 100% client-side salvo el proxy de Yahoo Finance — deploy fácil en Vercel

## 🛠️ Stack

| Capa | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS 4 + shadcn/ui |
| Charts | [lightweight-charts](https://github.com/tradingview/lightweight-charts) v5 |
| Estado | Zustand (con persistencia) |
| Iconos | lucide-react |
| Datos crypto | Binance Public REST + WebSocket |
| Datos acciones | Yahoo Finance (vía API route propia) |

## 📐 Arquitectura

```
src/
├── app/
│   ├── api/stocks/         # Proxy a Yahoo Finance (quote, chart, search)
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css        # Paleta TradingView
├── components/
│   ├── chart/
│   │   ├── PriceChart.tsx        # Chart core (lightweight-charts + panes)
│   │   ├── DrawingToolbar.tsx    # Barra de herramientas de dibujo
│   │   ├── FibOverlay.tsx        # Fibonacci (retroceso/extensión)
│   │   ├── TrendLineOverlay.tsx
│   │   ├── PatternOverlay.tsx    # S/R, trendlines, canales, banderas, fib auto
│   │   ├── StrategyDialog.tsx    # Estrategias globales
│   │   └── IndicatorMenu.tsx     # Toggles de indicadores y patrones
│   ├── layout/
│   ├── watchlist/
│   │   └── Watchlist.tsx         # Precios live crypto + acciones
│   └── ui/                       # shadcn primitives
└── lib/
    ├── binance/            # klines / ticker / WS multiplex
    ├── yahoo/              # rest.ts — quotes y klines de acciones
    ├── indicators/         # SMA, EMA, RSI (Wilder), MACD
    ├── patterns.ts         # Detección de S/R, trendlines, canales, banderas, fib auto
    ├── store/
    │   └── chart-store.ts  # Zustand global state
    └── format.ts
```

## 🌐 Deploy a Vercel

```bash
npm i -g vercel
vercel
```

O conectá el repo en [vercel.com/new](https://vercel.com/new) y deploy automático — importante: seteá el **Root Directory en `app`**. No hay variables de entorno que configurar.

## 📄 Licencia

MIT — usalo, forkealo, monetizalo, lo que quieras.

`lightweight-charts` es Apache 2.0 con atribución a TradingView.
