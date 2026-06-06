import { useCallback, useEffect, useState } from 'react';
import { getBuilders, getOpportunities, triggerScrape, type Builder, type Opportunity } from './api/client';
import { serviceZoneLabel } from './lib/labels';

type Tab = 'opportunities' | 'builders';

export default function App() {
  const [tab, setTab] = useState<Tab>('opportunities');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [county, setCounty] = useState('lee');
  const [minScore, setMinScore] = useState('0');
  const [serviceZone, setServiceZone] = useState('');
  const [requiresSeptic, setRequiresSeptic] = useState('');
  const [city, setCity] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { county, minScore, limit: '100' };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (serviceZone) params.serviceZone = serviceZone;
      if (requiresSeptic) params.requiresSeptic = requiresSeptic;
      if (city) params.city = city;

      const [oppRes, builderRes] = await Promise.all([
        getOpportunities(params),
        getBuilders(),
      ]);
      setOpportunities(oppRes.data);
      setBuilders(builderRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [county, minScore, serviceZone, requiresSeptic, city, fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleScrape() {
    setScraping(true);
    try {
      await triggerScrape(30);
      setTimeout(loadData, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scrape failed');
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Zurcher — Detector de Obras</h1>
            <p className="text-sm text-slate-500">Lehigh Acres + 200 km · Nuevas construcciones · Sépticos</p>
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {scraping ? 'Scrapeando...' : 'Ejecutar scrape'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">County</label>
            <select
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="lee">Lee</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Zona</label>
            <select
              value={serviceZone}
              onChange={(e) => setServiceZone(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Todas</option>
              <option value="lehigh_core">Lehigh Acres (core)</option>
              <option value="service_area">Zona de servicio</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Séptico</label>
            <select
              value={requiresSeptic}
              onChange={(e) => setRequiresSeptic(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Requiere séptico</option>
              <option value="false">Sin mención</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Ciudad</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Lehigh Acres"
              className="w-36 rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Score mínimo</label>
            <input
              type="number"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-20 rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={loadData}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
          >
            Filtrar
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <TabButton active={tab === 'opportunities'} onClick={() => setTab('opportunities')}>
            Oportunidades ({opportunities.length})
          </TabButton>
          <TabButton active={tab === 'builders'} onClick={() => setTab('builders')}>
            Constructoras ({builders.length})
          </TabButton>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : tab === 'opportunities' ? (
          <OpportunitiesTable data={opportunities} />
        ) : (
          <BuildersTable data={builders} />
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium ${
        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function OpportunitiesTable({ data }: { data: Opportunity[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
        No hay oportunidades. Ejecuta un scrape para recopilar permisos.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Permiso</th>
            <th className="px-4 py-3">Constructora</th>
            <th className="px-4 py-3">Ciudad / Zona</th>
            <th className="px-4 py-3">Séptico</th>
            <th className="px-4 py-3">Valor est.</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Fuente</th>
          </tr>
        </thead>
        <tbody>
          {data.map((opp) => (
            <tr key={opp.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                  {opp.score}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{opp.permit.permitNumber}</td>
              <td className="px-4 py-3">{opp.builder?.name ?? opp.permit.builderName ?? '—'}</td>
              <td className="px-4 py-3">
                <div>{opp.permit.city ?? '—'}</div>
                <div className="text-xs text-slate-500">{serviceZoneLabel(opp.permit.serviceZone)}</div>
                {opp.permit.address && (
                  <div className="text-xs text-slate-400">{opp.permit.address}</div>
                )}
              </td>
              <td className="px-4 py-3">
                {opp.permit.requiresSeptic ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Sí
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {opp.permit.estimatedValue ? `$${opp.permit.estimatedValue.toLocaleString()}` : '—'}
              </td>
              <td className="px-4 py-3 text-xs">{opp.permit.recordStatus ?? '—'}</td>
              <td className="px-4 py-3">
                <a
                  href={opp.permit.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Ver registro
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BuildersTable({ data }: { data: Builder[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
        No hay constructoras registradas aún.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Constructora</th>
            <th className="px-4 py-3">Obras detectadas</th>
            <th className="px-4 py-3">Teléfono</th>
            <th className="px-4 py-3">Email</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{b.name}</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                  {b.projectsDetected}
                </span>
              </td>
              <td className="px-4 py-3">{b.phone ?? '—'}</td>
              <td className="px-4 py-3">{b.email ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
