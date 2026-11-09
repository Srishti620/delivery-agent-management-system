import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteAgent, getAgent, patchAgent } from '../api.js';
import { VEHICLE_TYPES, formatDateTime, labelFor } from '../constants.js';
import { emptySvg } from '../lib/art.js';
import StatusBadge from './StatusBadge.jsx';
import { Art, Monogram } from './ui.jsx';

export default function AgentDetail() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, agent: null, error: '' });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, agent: null, error: '' });
    getAgent(agentId)
      .then((agent) => !cancelled && setState({ loading: false, agent, error: '' }))
      .catch((err) => !cancelled && setState({ loading: false, agent: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const { loading, agent, error } = state;

  async function toggleStatus() {
    setBusy(true);
    setActionError('');
    try {
      const next = agent.status === 'active' ? 'inactive' : 'active';
      const updated = await patchAgent(agent.agentId, { status: next });
      setState({ loading: false, agent: updated, error: '' });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${agent.fullName} (${agent.agentId})? This cannot be undone.`)) return;
    setBusy(true);
    setActionError('');
    try {
      await deleteAgent(agent.agentId);
      navigate('/agents');
    } catch (err) {
      setActionError(err.message);
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  if (error) {
    return (
      <div className="notice">
        <Art className="notice-art" html={emptySvg()} />
        <h1>Couldn’t load this agent</h1>
        <p className="muted">{error}</p>
        <Link className="btn" to="/agents">Back to agents</Link>
      </div>
    );
  }

  const facts = [
    ['Phone', agent.phoneNumber],
    ['Email', agent.email],
    ['Service area', agent.serviceArea],
    ['Vehicle', labelFor(VEHICLE_TYPES, agent.vehicleType)],
    ['Added', formatDateTime(agent.createdAt)],
    ['Last changed', formatDateTime(agent.updatedAt)],
  ];

  return (
    <section className="stack">
      <Link to="/agents" className="back">← Agents</Link>

      <div className="title-row">
        <div className="who">
          <Monogram seed={agent.agentId} name={agent.fullName} size={52} />
          <div>
            <h1>{agent.fullName}</h1>
            <div className="who-meta">
              <span className="id">{agent.agentId}</span>
              <StatusBadge status={agent.status} />
            </div>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={toggleStatus} disabled={busy}>
            Mark {agent.status === 'active' ? 'inactive' : 'active'}
          </button>
          <Link className="btn" to={`/agents/${agent.agentId}/edit`}>Edit</Link>
          <button className="btn btn-danger" onClick={handleDelete} disabled={busy}>Delete</button>
        </div>
      </div>

      {actionError && <div className="alert" role="alert">{actionError}</div>}

      <dl className="card facts">
        {facts.map(([term, value]) => (
          <div key={term} className="fact">
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
