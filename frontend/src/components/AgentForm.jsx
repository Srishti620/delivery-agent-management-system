import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createAgent, getAgent, updateAgent } from '../api.js';
import { STATUSES, VEHICLE_TYPES } from '../constants.js';
import { emptySvg, riderSvg } from '../lib/art.js';
import { Art } from './ui.jsx';

const EMPTY = {
  fullName: '',
  phoneNumber: '',
  email: '',
  serviceArea: '',
  status: 'active',
  vehicleType: 'none',
};

function Field({ label, name, error, hint, children }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export default function AgentForm({ mode }) {
  const editing = mode === 'edit';
  const { agentId } = useParams();
  const navigate = useNavigate();

  const [values, setValues] = useState(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!editing) return undefined;
    let cancelled = false;
    getAgent(agentId)
      .then((a) => {
        if (cancelled) return;
        setValues({
          fullName: a.fullName,
          phoneNumber: a.phoneNumber,
          email: a.email,
          serviceArea: a.serviceArea,
          status: a.status,
          vehicleType: a.vehicleType,
        });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, editing]);

  const bind = (name) => ({
    id: name,
    name,
    value: values[name],
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setFieldErrors((f) => ({ ...f, [name]: undefined }));
    },
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      const saved = editing ? await updateAgent(agentId, values) : await createAgent(values);
      navigate(`/agents/${saved.agentId}`);
    } catch (err) {
      const byField = {};
      (err.details || []).forEach((d) => {
        if (d.field && !byField[d.field]) byField[d.field] = d.message;
      });
      setFieldErrors(byField);
      setFormError(Object.keys(byField).length ? 'Some fields need fixing.' : err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  if (loadError) {
    return (
      <div className="notice">
        <Art className="notice-art" html={emptySvg()} />
        <h1>Couldn’t load this agent</h1>
        <p className="muted">{loadError}</p>
        <Link className="btn" to="/agents">Back to agents</Link>
      </div>
    );
  }

  const cancelTo = editing ? `/agents/${agentId}` : '/agents';

  return (
    <section className="stack">
      <Link to={cancelTo} className="back">← {editing ? 'Back to agent' : 'Agents'}</Link>
      <h1>{editing ? 'Edit agent' : 'Add agent'}</h1>

      <div className="form-layout">
        <form className="card form" onSubmit={handleSubmit} noValidate>
          {formError && <div className="alert" role="alert">{formError}</div>}

          <Field label="Full name" name="fullName" error={fieldErrors.fullName}>
            <input type="text" autoComplete="off" required maxLength={100} {...bind('fullName')} />
          </Field>

          <div className="grid-2">
            <Field label="Phone" name="phoneNumber" error={fieldErrors.phoneNumber} hint="With country code, e.g. +919876543210">
              <input type="tel" required {...bind('phoneNumber')} />
            </Field>
            <Field label="Email" name="email" error={fieldErrors.email}>
              <input type="email" required {...bind('email')} />
            </Field>
          </div>

          <Field label="Service area" name="serviceArea" error={fieldErrors.serviceArea} hint="Neighbourhood or zone, e.g. Kanpur - Civil Lines">
            <input type="text" required maxLength={100} {...bind('serviceArea')} />
          </Field>

          <div className="grid-2">
            <Field label="Status" name="status" error={fieldErrors.status}>
              <select {...bind('status')}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Vehicle" name="vehicleType" error={fieldErrors.vehicleType}>
              <select {...bind('vehicleType')}>
                {VEHICLE_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add agent'}
            </button>
            <Link className="btn" to={cancelTo}>Cancel</Link>
          </div>
        </form>

        <div className="form-side">
          <Art className="form-art" html={riderSvg()} />
          <p className="muted small">Email and phone have to be unique, so two agents can’t share either.</p>
        </div>
      </div>
    </section>
  );
}
