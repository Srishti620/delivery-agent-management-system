import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteAgent, listAgents } from '../api.js';
import { VEHICLE_TYPES, labelFor } from '../constants.js';
import { emptySvg } from '../lib/art.js';
import StatusBadge from './StatusBadge.jsx';
import { Art, Monogram } from './ui.jsx';

const PAGE_SIZE = 10;
const FILTERS = [
  { value: '', label: 'All', key: 'total' },
  { value: 'active', label: 'Active', key: 'active' },
  { value: 'on_leave', label: 'On leave', key: 'on_leave' },
  { value: 'inactive', label: 'Inactive', key: 'inactive' },
];

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Counts for the filter tabs: four tiny list requests (limit=1) that Redis serves after the first time. */
function useCounts(reloadKey) {
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const total = (params) => listAgents({ limit: 1, ...params }).then((r) => r.meta.total);
    Promise.all([total({}), total({ status: 'active' }), total({ status: 'on_leave' }), total({ status: 'inactive' })])
      .then(([all, active, onLeave, inactive]) => {
        if (!cancelled) setCounts({ total: all, active, on_leave: onLeave, inactive });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);
  return counts;
}

export default function AgentList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, error: '', agents: [], meta: null });
  const [actionError, setActionError] = useState('');
  const debouncedSearch = useDebounced(search);
  const counts = useCounts(reloadKey);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    listAgents({ page, limit: PAGE_SIZE, search: debouncedSearch, status })
      .then(({ data, meta }) => {
        if (!cancelled) setState({ loading: false, error: '', agents: data, meta });
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: err.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, status, reloadKey]);

  async function handleDelete(agent) {
    if (!window.confirm(`Delete ${agent.fullName} (${agent.agentId})? This cannot be undone.`)) return;
    setActionError('');
    try {
      await deleteAgent(agent.agentId);
      if (state.agents.length === 1 && page > 1) setPage(page - 1);
      else setReloadKey((n) => n + 1);
    } catch (err) {
      setActionError(err.message);
      if (err.status === 404) setReloadKey((n) => n + 1);
    }
  }

  const { loading, error, agents, meta } = state;
  const first = meta && meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const last = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <section className="stack">
      <div className="title-row">
        <h1>Agents</h1>
        <Link className="btn btn-primary" to="/agents/new">Add agent</Link>
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`chip${status === f.value ? ' on' : ''}`}
              aria-pressed={status === f.value}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
            >
              {f.label}
              {counts && <span>{counts[f.key]}</span>}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search by name, email, phone or ID"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search agents"
        />
      </div>

      {error && (
        <div className="alert" role="alert">
          {error} <button className="link" onClick={() => setReloadKey((n) => n + 1)}>Try again</button>
        </div>
      )}
      {actionError && <div className="alert" role="alert">{actionError}</div>}

      <div className={`card table-wrap ${loading ? 'is-loading' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Agent ID</th>
              <th>Phone</th>
              <th>Service area</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.agentId}>
                <td>
                  <Link to={`/agents/${a.agentId}`} className="person">
                    <Monogram seed={a.agentId} name={a.fullName} />
                    <span>
                      <span className="person-name">{a.fullName}</span>
                      <span className="muted small">{a.email}</span>
                    </span>
                  </Link>
                </td>
                <td><span className="id">{a.agentId}</span></td>
                <td className="nowrap">{a.phoneNumber}</td>
                <td>{a.serviceArea}</td>
                <td>{labelFor(VEHICLE_TYPES, a.vehicleType)}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="row-actions">
                  <Link to={`/agents/${a.agentId}/edit`}>Edit</Link>
                  <button className="link danger" onClick={() => handleDelete(a)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && !error && agents.length === 0 && (
          <div className="empty">
            <Art className="empty-art" html={emptySvg()} />
            <p>{search || status ? 'No agents match that search.' : 'No agents yet.'}</p>
            {!search && !status && <Link className="btn btn-primary" to="/agents/new">Add the first one</Link>}
          </div>
        )}
        {loading && agents.length === 0 && <div className="empty muted">Loading…</div>}
      </div>

      {meta && meta.total > 0 && (
        <div className="pager">
          <span className="muted">{first}–{last} of {meta.total}</span>
          {meta.totalPages > 1 && (
            <span className="pager-btns">
              <button className="btn btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="btn btn-sm" disabled={page >= meta.totalPages || loading} onClick={() => setPage(page + 1)}>Next</button>
            </span>
          )}
        </div>
      )}
    </section>
  );
}
