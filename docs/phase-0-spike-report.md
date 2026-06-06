# Fase 0 — Informe de Spike Técnico

**Proyecto:** Detector de Obras — Zurcher Construction  
**County:** Lee County, Florida  
**Fecha:** 2026-06-06  
**Veredicto:** ✅ **GO** para MVP con Accela/eConnect como fuente primaria

---

## 1. Resumen ejecutivo

| Fuente | Estado spike | Viabilidad MVP | Recomendación |
|---|---|---|---|
| **Accela/eConnect (LEECO)** | ✅ Validado con Playwright | **Alta** | **Fuente primaria** |
| **Accela API pública** | ⚠️ Requiere App ID | Media-Alta | Registrar Citizen App en developer.accela.com |
| **LandMarkWeb (NOC)** | ❌ No accesible desde entorno de prueba | Media (con subscriber) | Fuente secundaria — validar desde red de Zurcher |

### Hallazgo principal

En **30 días** (07/05/2026 – 06/06/2026), la búsqueda automatizada encontró **8+ permisos** de tipo `Residential New Primary Structure`, con datos de constructora, teléfono y email **sin necesidad de login**.

Ejemplo real extraído hoy (`RES2026-04792`):

| Campo | Valor |
|---|---|
| Constructora | Nathan's Homes Inc |
| Contratista | NATHAN KAMINSKY SR (CBC1269904) |
| Teléfono | 7869553704 |
| Email | OFFICE@BEST-INVESTING.COM |
| Estado | Documents Uploaded (obra temprana) |
| Descripción | Model SEABREEZE PRO — 1266 SF total |

---

## 2. Pruebas Accela/eConnect (LEECO)

### 2.1 Portal de búsqueda

**URL:** `https://aca-prod.accela.com/LEECO/Cap/CapHome.aspx?module=Permitting`

| Prueba | Resultado |
|---|---|
| Carga del portal | HTTP 200 ✅ |
| Filtro `Residential New Primary Structure` | Presente en dropdown (47 tipos totales) ✅ |
| Filtro por fechas Start/End | Funcional ✅ |
| Búsqueda sin cuenta | Funcional ✅ |
| Resultados últimos 30 días | 8+ registros ✅ |

**Permisos detectados (muestra):**

- RES2026-04792
- RES2026-04822
- RES2026-04821
- RES2026-04795
- RES2026-04807
- RES2026-04813
- RES2026-04820
- RES2026-04825

### 2.2 Detalle de permiso — campos confirmados

Analizados: `RES2024-12654` (cerrado) y `RES2026-04792` (activo).

| Campo requerido | Disponible | Selector / ubicación |
|---|---|---|
| County | ✅ | Fijo: Lee |
| Fecha | ⚠️ Parcial | Status visible; fechas exactas en sección Reports |
| Número de permiso | ✅ | `Record RES20XX-XXXXX` |
| Tipo de permiso | ✅ | Heading: Residential New Primary Structure |
| Dirección | ✅ | `.fontbold` en Work Location |
| Ciudad/Estado/ZIP | ✅ | Work Location block |
| Valor estimado | ✅ | `Est. Const. Value` en Application Information |
| Constructora | ✅ | `.contactinfo_businessname` (Applicant) |
| Contratista licenciado | ✅ | Licensed Professional block + license # |
| Teléfono | ✅ | `.ACA_PhoneNumberLTR` |
| Email | ✅ | `.contactinfo_email` |
| Propietario | ⚠️ | Sección Owner existe; no siempre poblada en vista pública |
| URL original | ✅ | Construible desde capID o ALTID |
| Descripción proyecto | ✅ | Project Description |

### 2.3 Ejemplo comercial validado (RES2024-12654)

- **Builder:** BLUESHINE BUILDER LLC
- **Applicant:** Blueshine Builder LLC (Marisel Armenteros)
- **Teléfono:** 2392016630
- **Dirección obra:** 1316 JACKSON AVE, LEHIGH ACRES FL 33972
- **Valor estimado:** $170,000
- **Tipo:** Single Family Residence
- **Estado:** Closed-CO Issued

### 2.4 API Accela

**Endpoint:** `POST https://apis.accela.com/v4/search/records`

**Resultado:** HTTP 400 — requiere header `x-accela-appid`.

```
App ID or access token is required.
Please set App ID to request HTTP header 'x-accela-appid' for anonymous access
```

**Acción requerida:** Registrar **Citizen App** en [developer.accela.com](https://developer.accela.com) → My Apps.

**Headers necesarios:**
```
x-accela-appid: {app_id}
x-accela-agency: LEECO
x-accela-environment: PROD
```

**Recomendación:** Intentar API primero post-registro; Playwright como fallback probado y funcional.

### 2.5 Estrategia de extracción Accela (confirmada)

```
1. Playwright → CapHome.aspx?module=Permitting
2. Seleccionar permit type: Permitting/Residential/New Primary Structure/NA
3. Setear Start Date / End Date (ventanas de 30 días)
4. Click Search (#ctl00_PlaceHolderMain_btnNewSearch)
5. Parsear grid → links CapDetail.aspx
6. Por cada permiso → fetch detalle → extraer campos CSS
7. Dedup por recordId
```

**Volumen estimado:** ~8–15 permisos nuevos/mes solo para este tipo en Lee County (muestra de 30 días).

---

## 3. Pruebas LandMarkWeb (NOC)

### 3.1 Resultado del spike

| Prueba | Resultado |
|---|---|
| Carga home | ❌ `net::ERR_HTTP2_PROTOCOL_ERROR` |
| Búsqueda Document Type NOC | ❌ No alcanzable |
| Acceso PDF sin login (CFN 2023000307714) | ❌ No alcanzable desde este entorno |

> **Nota:** El fallo es de conectividad/protocolo desde el entorno de desarrollo actual, no necesariamente un bloqueo del sistema. Se requiere validación desde la red de Zurcher o Railway.

### 3.2 Evidencia secundaria (documentación pública + fetch previo)

| Aspecto | Confirmado |
|---|---|
| Document type NOC existe | ✅ |
| Búsqueda por fecha (7/30/90 días) | ✅ |
| Límite 2000 resultados/query | ✅ |
| Export Excel | ✅ |
| PDFs restringidos sin subscriber | ✅ (mensaje estatutario confirmado) |
| Cuenta subscriber gratuita | ✅ |
| Bloqueo sesión 60 min sin Log Off | ✅ |

### 3.3 Campos esperados en NOC (F.S. 713.13)

- Owner name + address
- Contractor name + address + **phone**
- Description of improvement (texto libre)
- Legal description + street address
- Expiration date

### 3.4 Acción pendiente LandMarkWeb

- [ ] Ejecutar `npm run spike:landmark` desde red corporativa de Zurcher
- [ ] Registrar cuenta subscriber a nombre de Zurcher
- [ ] Medir volumen NOC/día vs permisos/día
- [ ] Evaluar si metadatos del grid bastan sin PDF

---

## 4. Correlación Accela ↔ NOC

| Dimensión | Accela Permits | LandMarkWeb NOC |
|---|---|---|
| Timing | Más temprano (solicitud permiso) | Más tardío (inicio obra) |
| Filtro nueva vivienda | Estructurado ✅ | Texto libre ⚠️ |
| Teléfono contractor | A veces | Sí (campo legal) |
| Valor estimado | Sí | No |
| Automatización probada | ✅ | Pendiente |

**Clave de correlación propuesta:** dirección normalizada + ventana de fechas ±60 días.

---

## 5. Riesgos actualizados post-spike

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Accela cambia UI | Media | Alto | Tests Playwright + raw HTML guardado |
| Accela API no habilitada para LEECO | Media | Bajo | Playwright ya funciona |
| LandMarkWeb inaccesible desde cloud | Media | Medio | Ejecutar scraper NOC desde IP residencial/US o validar en Railway |
| PDF NOC requiere subscriber | Alta | Medio | Cuenta dedicada Zurcher |
| Owner-Builder sin empresa | Alta | Medio | Flag `owner_builder`, score reducido |
| Fechas exactas no en vista pública | Media | Bajo | Parsear Reports o custom forms |

---

## 6. Decisiones de arquitectura post-spike

### Confirmadas

1. **MVP Fase 1 = solo Accela LEECO** — riesgo bajo, valor alto, datos suficientes para ventas.
2. **Playwright + Cheerio** para scraping Accela (probado).
3. **NestJS + Prisma + PostgreSQL** sin cambios.
4. **OpenAI** para normalización de nombres de builder, no para scraping.
5. **LandMarkWeb NOC** → Fase 2, tras validar acceso desde infraestructura de producción.

### Ajustadas

| Antes | Después (post-spike) |
|---|---|
| LandMarkWeb como punto de entrada | Accela como fuente primaria |
| API Accela sin auth | Requiere registro Citizen App |
| Supuesto de captcha en LandMarkWeb | Problema real es conectividad HTTP/2 + PDF subscriber |

---

## 7. Scripts de spike incluidos

```
spike/
├── accela-spike.mjs          # Búsqueda + listado
├── accela-detail-spike.mjs   # Detalle de permiso reciente
├── landmark-spike.mjs        # NOC (requiere red compatible)
├── results/
│   ├── accela-spike.json
│   ├── accela-detail-recent.json
│   └── *.png
└── package.json
```

**Ejecutar:**
```bash
cd spike
npm install
npx playwright install chromium
npm run spike:all
```

---

## 8. Go / No-Go

| Componente | Decisión |
|---|---|
| MVP Accela Lee County | ✅ **GO** |
| Dashboard + API | ✅ **GO** |
| Enriquecimiento builders | ✅ **GO** (DBPR + cache) |
| LandMarkWeb NOC | ⏸️ **PENDING** — validar acceso en producción |
| Accela API directa | ⏸️ **PENDING** — registrar App ID |

---

## 9. Próximo paso recomendado (Fase 1)

1. Registrar Citizen App en Accela Developer Portal
2. Crear monorepo NestJS + Prisma + worker Playwright
3. Implementar `LeeAccelaPermitsAdapter` con búsqueda diaria incremental
4. Persistir permisos + detectar oportunidades + dashboard mínimo
5. En paralelo: Zurcher ejecuta spike LandMarkWeb desde su red
