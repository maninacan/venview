interface Props {
  context: 'report' | 'finalize' | 'history' | 'pdf' | 'multiday' | string;
  onClose: () => void;
}

const CONTEXTS: Record<string, { icon: string; text: string }> = {
  report: { icon: '📊', text: 'Post-Event Reports are a Pro feature.' },
  finalize: { icon: '✅', text: 'Starter includes 1 finalized event. Upgrade to track more.' },
  history: { icon: '📋', text: 'Viewing finalized event history requires Pro.' },
  pdf: { icon: '📄', text: 'PDF export is a Pro feature.' },
  multiday: { icon: '📅', text: 'Starter supports up to 2-day events. Upgrade to Pro for longer festivals.' },
};

export function UpgradeModal({ context, onClose }: Props) {
  const ctx = CONTEXTS[context] ?? { icon: '🔒', text: context };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="upgrade-modal">
        <div className="modal-header" style={{ position: 'relative' }}>
          <button className="modal-close" onClick={onClose} style={{ color: 'rgba(255,255,255,0.7)' }}>✕</button>
          <div className="pro-badge">⚡ Venview Pro</div>
          <h2>Unlock the complete picture.</h2>
          <p>See every event's true profit, track trends over time, and make smarter decisions — faster.</p>
        </div>

        <div className="trigger-reason">
          <span className="reason-icon">{ctx.icon}</span>
          <span>{ctx.text}</span>
        </div>

        <div className="modal-body">
          <p className="features-label">Everything in Pro</p>
          <ul className="feature-list">
            <li><span className="feature-check fi-reports">✓</span><div><strong>Post-Event Reports</strong><br /><span>Full profit &amp; loss breakdown, shareable and printable</span></div></li>
            <li><span className="feature-check fi-events">✓</span><div><strong>Unlimited finalized events</strong><br /><span>Track every market, festival, and pop-up you run</span></div></li>
            <li><span className="feature-check fi-pdf">✓</span><div><strong>PDF export</strong><br /><span>Download branded reports for your records or accountant</span></div></li>
            <li><span className="feature-check fi-history">✓</span><div><strong>Full event history</strong><br /><span>Compare events over time to find your most profitable markets</span></div></li>
            <li><span className="feature-check fi-square">✓</span><div><strong>Square POS sync</strong><br /><span>Pull real sales data — fees, refunds, and discounts included</span></div></li>
            <li><span className="feature-check fi-design">✓</span><div><strong>Custom form templates</strong><br /><span>Design event forms that match exactly how you work</span></div></li>
          </ul>
          <div className="starter-note">
            <span>📋</span>
            <span>You're on <strong>Venview Starter</strong> — includes 1 finalized event and basic profit summary.</span>
          </div>
        </div>

        <div className="modal-divider" />
        <div className="modal-footer">
          {/* Stub: upgrade button is a placeholder for future billing */}
          <button className="cta-btn cta-primary" onClick={onClose}>⚡ Upgrade to Pro</button>
          <p className="price-note">Contact us to upgrade &nbsp;·&nbsp; No spreadsheets, no guesswork</p>
          <button className="cta-btn cta-secondary" onClick={onClose}>Maybe later</button>
        </div>
      </div>
    </div>
  );
}
