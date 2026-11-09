import { STATUSES, labelFor } from '../constants.js';

export default function StatusBadge({ status }) {
  return (
    <span className={`status status-${status}`}>
      <i aria-hidden="true" />
      {labelFor(STATUSES, status)}
    </span>
  );
}
