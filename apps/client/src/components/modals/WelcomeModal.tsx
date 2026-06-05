import { useNavigate } from 'react-router-dom';

interface Props {
  companyId: string;
  onClose: () => void;
}

export function WelcomeModal({ companyId, onClose }: Props) {
  const navigate = useNavigate();

  function goCreateEvent() {
    onClose();
    navigate(`/companies/${companyId}/events/new`);
  }

  function goManageEvents() {
    onClose();
    navigate(`/companies/${companyId}/events`);
  }

  return (
    <div className="modal-overlay">
      <div className="welcome-modal">
        <div className="welcome-header">
          <div className="welcome-badge">🧪 Beta</div>
          <h2>Welcome to VenView!</h2>
          <p className="welcome-subtitle">You're helping us build the simplest way for event vendors to know if they actually made money.</p>
          <p className="welcome-note">This beta version is focused on one thing:<br /><strong>Getting you from event → to true profit in minutes.</strong></p>
        </div>

        <div className="welcome-body">
          <p className="welcome-section-label">Get started in 3 steps</p>
          <div className="welcome-steps">
            <div className="welcome-step">
              <div className="step-number">1</div>
              <h3>Add a Real Event</h3>
              <p>Use a past event from the last 30 days.</p>
              <ul>
                <li>Farmers Market</li>
                <li>Catering job</li>
                <li>School event</li>
                <li>Festival</li>
              </ul>
              <button className="btn-primary welcome-action" onClick={goCreateEvent}>Create Your First Event</button>
            </div>

            <div className="welcome-step">
              <div className="step-number">2</div>
              <h3>Connect &amp; Sync Sales</h3>
              <p>If you use Square, connect it in Settings. VenView will pull your real sales and tax data automatically.</p>
              <p>If not, enter totals manually.</p>
              <button className="btn-secondary welcome-action" onClick={goManageEvents}>Sync Sales</button>
            </div>

            <div className="welcome-step">
              <div className="step-number">3</div>
              <h3>Add Your Costs</h3>
              <p>Enter labor, supplies, event fees, and food tax. Then open your Profit Summary.</p>
              <button className="btn-secondary welcome-action" onClick={goManageEvents}>View Profit Summary</button>
            </div>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>What You'll Discover</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.86rem', lineHeight: 1.8, color: 'var(--text)' }}>
              <li>✅ Your true net profit (after tax + fees)</li>
              <li>✅ Your real labor cost impact</li>
              <li>✅ Whether the event was worth it</li>
              <li>✅ Where you lost margin</li>
            </ul>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>
            This is a beta version. Please report bugs. Financial calculations are based on the data entered or synced. If something looks incorrect, tell us.
          </p>
        </div>

        <div className="welcome-footer">
          <button className="cta-btn cta-primary" onClick={goCreateEvent}>🚀 Let's Go — Create My First Event</button>
          <button className="cta-btn cta-secondary" onClick={onClose}>I'll explore on my own</button>
        </div>
      </div>
    </div>
  );
}
