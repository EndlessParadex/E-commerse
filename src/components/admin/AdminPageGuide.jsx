import AdminIcon from './AdminIcon';

import { adminGuideByView } from '../../data/adminGuideData';

export default function AdminPageGuide({ view }) {
  const steps = adminGuideByView[view];
  if (!steps?.length) return null;
  return (
    <details className="admin-page-guide">
      <summary aria-label="Petunjuk halaman">
        <span aria-hidden="true">?</span> Petunjuk
      </summary>
      <nav aria-label="Panduan halaman Admin">
        <ol className="admin-page-guide-steps">
          {steps.map(([icon, label, description], index) => (
            <li className="admin-page-guide-step" key={label}>
              <span className="admin-page-guide-number">{index + 1}</span>
              <span className="admin-page-guide-icon">
                <AdminIcon name={icon} />
              </span>
              <span className="admin-page-guide-copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
