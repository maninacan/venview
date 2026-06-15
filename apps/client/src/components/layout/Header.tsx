import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { supabase, showToast } from '@org/data';
import { AlertsBell } from './AlertsBell';
import venviewLogo from '../../assets/venview-icon-lg.png';

interface Props {
  companyId?: string;
  companyName?: string;
}

const linkBase =
  'bg-transparent border-0 text-[#222] text-[0.87rem] font-medium rounded-md cursor-pointer transition-colors no-underline inline-flex items-center font-[inherit] hover:text-[#0B2A4A] hover:bg-[rgba(11,42,74,0.06)] px-3 py-2 w-full md:w-auto md:px-[10px] md:py-[7px]';
const linkActive = 'text-[#0B2A4A] bg-[rgba(11,42,74,0.06)] font-semibold';

export function Header({ companyId, companyName }: Props) {
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
    <header className="bg-white text-[#222] px-5 h-[70px] flex items-center justify-between sticky top-0 z-[100] shadow-[0_2px_6px_rgba(0,0,0,0.08)] border-b border-[#dde3f0]">
      <Link
        to={inCompany ? `/companies/${companyId}/events` : '/companies'}
        className="flex items-center gap-2.5 no-underline flex-shrink-0"
        onClick={closeMenu}
      >
        <img src={venviewLogo} alt="VenView" className="h-[50px] w-auto" />
        <div>
          <span
            className="block text-[1.05rem] leading-tight font-bold"
            style={{ color: '#2E7D32' }}
          >
            VenView Events
          </span>
          <span className="block text-[0.68rem] text-[#666]">
            {companyName ?? 'Vendor Intelligence for Events'}
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-0.5">
        {/* Hamburger — mobile only */}
        <button
          className="flex flex-col justify-between w-[22px] h-4 bg-transparent border-0 cursor-pointer p-0 md:hidden"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          <span className="block w-full h-0.5 bg-[#222] rounded-sm" />
          <span className="block w-full h-0.5 bg-[#222] rounded-sm" />
          <span className="block w-full h-0.5 bg-[#222] rounded-sm" />
        </button>

        {/* Nav links */}
        <div
          className={`${menuOpen ? 'flex' : 'hidden'} fixed top-[70px] left-0 right-0 z-[99] flex-col bg-white p-2.5 gap-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] border-t border-[#dde3f0] md:flex md:static md:flex-row md:bg-transparent md:p-0 md:gap-0.5 md:shadow-none md:z-auto md:border-0`}
        >
          {!inCompany && (
            <Link to="/companies" className={linkBase} onClick={closeMenu}>My Companies</Link>
          )}

          {inCompany && (
            <>
              <Link to="/companies" className={linkBase} onClick={closeMenu}>◂ Companies</Link>
              <NavLink to={`/companies/${companyId}/events`} className={({ isActive }) => `${linkBase}${isActive ? ` ${linkActive}` : ''}`} onClick={closeMenu}>Manage Events</NavLink>
              <NavLink to={`/companies/${companyId}/recipes`} className={({ isActive }) => `${linkBase}${isActive ? ` ${linkActive}` : ''}`} onClick={closeMenu}>Recipes</NavLink>
              <NavLink to={`/companies/${companyId}/inventory`} className={({ isActive }) => `${linkBase}${isActive ? ` ${linkActive}` : ''}`} onClick={closeMenu}>My Inventory</NavLink>
              <NavLink to={`/companies/${companyId}/restock`} className={({ isActive }) => `${linkBase}${isActive ? ` ${linkActive}` : ''}`} onClick={closeMenu}><i className="fa-solid fa-arrows-rotate" /> Restock</NavLink>
              <NavLink to={`/companies/${companyId}/form-builder`} className={({ isActive }) => `${linkBase}${isActive ? ` ${linkActive}` : ''}`} onClick={closeMenu}>Form Builder</NavLink>
              <NavLink to={`/companies/${companyId}/settings`} className={({ isActive }) => `${linkBase}${isActive ? ` ${linkActive}` : ''}`} onClick={closeMenu}>Settings</NavLink>
            </>
          )}

          <button className={linkBase} onClick={() => { closeMenu(); handleLogout(); }}>Logout</button>

          {inCompany && (
            <Link
              to={`/companies/${companyId}/events/new`}
              className="mt-1 w-full justify-center text-white border-0 text-[0.87rem] font-semibold px-[14px] py-[7px] rounded-md cursor-pointer no-underline inline-flex items-center font-[inherit] md:mt-0 md:w-auto md:ml-1.5"
              style={{ background: '#00ABE2', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0085b0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00ABE2')}
              onClick={closeMenu}
            >
              + Add Event
            </Link>
          )}
        </div>

        {inCompany && <AlertsBell companyId={companyId} />}
      </div>
    </header>
  );
}
