# ScrapZurcher — Detector de Obras

Herramienta interna para detectar nuevas construcciones residenciales en Florida y recopilar información de constructoras.

**Stack:** Node.js + Express + Prisma + PostgreSQL + Playwright + React + Tailwind

## Requisitos

- Node.js 20+
- Docker (para PostgreSQL) o PostgreSQL local

## Inicio rápido

### 1. Base de datos

```bash
docker compose up -d
cp .env.example .env
```

### 2. Instalar dependencias

```bash
npm install
npm run db:generate
npm run db:push
```

### 3. Ejecutar scrape (recopilar permisos)

```bash
npm run scrape
```

### 4. Levantar API y dashboard

Terminal 1:
```bash
npm run dev:api
```

Terminal 2:
```bash
npm run dev:web
```

- API: http://localhost:3001
- Dashboard: http://localhost:5173

## Estructura

```
apps/
  api/      → Express REST API
  worker/   → Playwright scraper (Lee County Accela)
  web/      → React dashboard
prisma/     → Modelo de datos
spike/      → Scripts de validación Fase 0
```

## API

| Endpoint | Descripción |
|---|---|
| `GET /api/opportunities` | Oportunidades con filtros |
| `GET /api/builders` | Ranking de constructoras |
| `GET /api/permits` | Permisos detectados |
| `POST /api/scrape/trigger` | Lanzar scrape manual |

## Scoring (prioridad comercial)

| Factor | Puntos |
|---|---|
| Vivienda nueva (Residential New Primary Structure) | +50 |
| Constructora identificada | +20 |
| Teléfono / Email | +10 c/u |
| Valor estimado ≥ $100k | +10 |
| Mención séptico en condiciones | +15 |
| **Lehigh Acres (zona core)** | **+20** |
| Resto zona de servicio (~200 km) | +5 |

## Zona de servicio

- **Core:** Lehigh Acres (donde más trabaja Zurcher)
- **Servicio:** Lee, Charlotte, Collier, Sarasota, Hendry, Glades, DeSoto (~200 km)

## Próximos pasos

- [ ] LandMarkWeb NOC (Fase 2)
- [ ] Enriquecimiento DBPR / Sunbiz
- [ ] Counties adicionales (Charlotte, Collier, Sarasota)
- [ ] Deploy en Railway
