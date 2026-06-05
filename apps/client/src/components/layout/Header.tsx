import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../hooks/useToast';
import { AlertsBell } from './AlertsBell';

interface Props {
  companyId?: string;
  companyName?: string;
  isAdmin?: boolean;
}

export function Header({ companyId, companyName, isAdmin }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/auth');
    showToast('Signed out.', 'info');
  }

  function closeMenu() { setMenuOpen(false); }

  const inCompany = !!companyId;

  return (
    <header>
      <Link to={inCompany ? `/companies/${companyId}/events` : '/companies'} className="brand" onClick={closeMenu}>
        <div className="brand-text">
          <span className="brand-title">VenView Events</span>
          {companyName && <span className="brand-subtitle">{companyName}</span>}
          {!companyName && <span className="brand-subtitle">Vendor Intelligence for Events</span>}
        </div>
      </Link>

      <div className="nav-buttons">
        <button
          className="hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          <span /><span /><span />
        </button>

        <div className={`header-buttons${menuOpen ? ' is-open' : ''}`}>
          {!inCompany && (
            <Link to="/companies" className="nav-link" onClick={closeMenu}>My Companies</Link>
          )}

          {inCompany && (
            <>
              <Link to="/companies" className="nav-link" onClick={closeMenu}>◂ Companies</Link>
              <NavLink to={`/companies/${companyId}/events`} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>Manage Events</NavLink>
              <NavLink to={`/companies/${companyId}/recipes`} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>Recipes</NavLink>
              <NavLink to={`/companies/${companyId}/inventory`} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>My Inventory</NavLink>
              <NavLink to={`/companies/${companyId}/restock`} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>🔄 Restock</NavLink>
              <NavLink to={`/companies/${companyId}/form-builder`} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>Form Builder</NavLink>
              <NavLink to={`/companies/${companyId}/settings`} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>Settings</NavLink>
            </>
          )}

          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>Admin</NavLink>
          )}

          <button className="nav-link" onClick={() => { closeMenu(); handleLogout(); }}>Logout</button>

          {inCompany && (
            <Link to={`/companies/${companyId}/events/new`} className="nav-cta" onClick={closeMenu}>+ Add Event</Link>
          )}
        </div>

        {inCompany && <AlertsBell companyId={companyId} />}
      </div>
    </header>
  );
}
