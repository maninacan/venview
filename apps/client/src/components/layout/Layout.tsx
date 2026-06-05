import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';

const GET_ME = gql`
  query GetMe {
    me { id isAdmin }
  }
`;

export function CompanyLayout() {
  const { companyId, company } = useCurrentCompany();
  const { data } = useQuery(GET_ME);

  return (
    <div className="app-shell">
      <Header
        companyId={companyId ?? undefined}
        companyName={company?.name}
        isAdmin={data?.me?.isAdmin}
      />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export function RootLayout() {
  const { data } = useQuery(GET_ME);

  return (
    <div className="app-shell">
      <Header isAdmin={data?.me?.isAdmin} />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
