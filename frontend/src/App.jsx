import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import AgentList from './components/AgentList.jsx';
import AgentDetail from './components/AgentDetail.jsx';
import AgentForm from './components/AgentForm.jsx';
import { Art } from './components/ui.jsx';
import { emptySvg, logoSvg } from './lib/art.js';

function NotFound() {
  return (
    <div className="notice">
      <Art className="notice-art" html={emptySvg()} />
      <h1>Page not found</h1>
      <p className="muted">There is nothing at this address.</p>
      <Link className="btn" to="/agents">Back to agents</Link>
    </div>
  );
}

export default function App() {
  return (
    <>
      <header className="site">
        <div className="site-inner">
          <Link to="/agents" className="brand">
            <Art className="brand-logo" html={logoSvg()} />
            <span>Delivery Agents</span>
          </Link>
          <nav aria-label="Main">
            <NavLink to="/agents" end>Agents</NavLink>
            <NavLink to="/agents/new">Add agent</NavLink>
          </nav>
        </div>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/agents" replace />} />
          <Route path="/agents" element={<AgentList />} />
          <Route path="/agents/new" element={<AgentForm mode="create" />} />
          <Route path="/agents/:agentId" element={<AgentDetail />} />
          <Route path="/agents/:agentId/edit" element={<AgentForm mode="edit" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
