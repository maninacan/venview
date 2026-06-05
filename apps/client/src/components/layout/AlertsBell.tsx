import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';

const GET_ALERTS = gql`
  query GetInventoryAlerts($companyId: ID!) {
    inventoryAlerts(companyId: $companyId) {
      id isRead triggeredAt
      item { id name }
    }
  }
`;

const MARK_ALL_READ = gql`
  mutation MarkAllAlertsRead($companyId: ID!) {
    markAllAlertsRead(companyId: $companyId)
  }
`;

interface Props {
  companyId: string;
}

export function AlertsBell({ companyId }: Props) {
  const [open, setOpen] = useState(false);

  const { data, refetch } = useQuery(GET_ALERTS, {
    variables: { companyId },
    pollInterval: 60000,
  });

  const [markAll] = useMutation(MARK_ALL_READ, {
    variables: { companyId },
    onCompleted: () => refetch(),
  });

  const alerts = data?.inventoryAlerts ?? [];
  const unread = alerts.filter((a: { isRead: boolean }) => !a.isRead).length;

  return (
    <>
      <button className="alerts-bell" onClick={() => setOpen(o => !o)} aria-label="Reorder alerts">
        🔔
        {unread > 0 && <span className="alerts-badge">{unread}</span>}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setOpen(false)}
          />
          <div className="alerts-panel">
            <div className="alerts-panel-header">
              <strong>Reorder Alerts</strong>
              <button className="alerts-mark-all" onClick={() => markAll()}>Mark all read</button>
              <button className="alerts-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            {alerts.length === 0 ? (
              <p className="alerts-empty">No reorder alerts.</p>
            ) : (
              alerts.map((a: { id: string; isRead: boolean; item: { name: string }; triggeredAt: string }) => (
                <div
                  key={a.id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: '0.84rem',
                    opacity: a.isRead ? 0.5 : 1,
                  }}
                >
                  <strong>{a.item.name}</strong> is low on stock
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                    {new Date(a.triggeredAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
