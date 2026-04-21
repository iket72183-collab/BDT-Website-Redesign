// Backup of the removed navigation UI from the single-page redesign.
// Kept so the sidebar and mobile drawer can be restored later if the site grows.

const NAV_ITEMS = [
  { id: 'about-me', label: 'About Me' },
  { id: 'riverdale-crew', label: 'Riverdale Crew' },
  { id: 'what-we-do', label: 'What We Do' },
  { id: 'products', label: 'Products' },
  { id: 'contact-me', label: 'Contact Me' },
];

function MobileBar({ mobileMenuOpen, onToggle }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '14px 18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', borderRadius: 20, background: 'rgba(8,8,10,0.92)', border: '1px solid rgba(201,168,76,0.14)', backdropFilter: 'blur(16px)', boxShadow: '0 16px 34px rgba(0,0,0,0.32)' }}>
        <button type="button" onClick={onToggle} aria-expanded={mobileMenuOpen} aria-label="Toggle navigation"
          style={{ width: 46, height: 46, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, border: '1px solid rgba(201,168,76,0.22)', background: 'rgba(255,255,255,0.04)', color: T.goldWarm, fontSize: '1.2rem', cursor: 'pointer' }}>
          {mobileMenuOpen ? '×' : '☰'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: T.goldLight, whiteSpace: 'nowrap' }}>BDT Talent Group</div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.46)', whiteSpace: 'nowrap' }}>Navigation</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ active, onNav, isMobile, mobileMenuOpen, onCloseMobileMenu }) {
  if (isMobile) {
    return (
      <>
        <div onClick={onCloseMobileMenu}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.58)', opacity: mobileMenuOpen ? 1 : 0, pointerEvents: mobileMenuOpen ? 'auto' : 'none', transition: 'opacity .28s ease', zIndex: 24 }} />
        <aside style={{ position: 'fixed', inset: '0 auto 0 0', width: 'min(82vw, 320px)', display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 18px', background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(75,0,130,0.28) 0%, transparent 60%), linear-gradient(180deg,#0d0d10,#080808)', borderRight: '1px solid rgba(201,168,76,0.15)', boxShadow: '24px 0 60px rgba(0,0,0,0.32)', transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-110%)', transition: 'transform .32s ease', zIndex: 25 }}>
          <div style={{ textAlign: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
            <img src="./assets/bdt-logo.jpeg" alt="BDT Talent Group" style={{ width: 'min(100%, 180px)', height: 'auto', opacity: 0.92 }} />
          </div>
          <nav style={{ display: 'grid', gap: 10 }}>
            {NAV_ITEMS.map(({ id, label }) => {
              const isActive = active === id;
              return (
                <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); onNav(id); }}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', minHeight: 46, padding: '0 14px 0 28px', border: `1px solid ${isActive ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.1)'}`, borderRadius: 16, background: isActive ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)', color: isActive ? T.goldWarm : T.silver, fontSize: '0.74rem', letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none', transform: isActive ? 'translateX(4px)' : 'none', transition: 'all .2s', boxShadow: isActive ? '0 0 12px rgba(201,168,76,0.08)' : 'none' }}>
                  <span style={{ position: 'absolute', left: 11, fontSize: '0.42rem', color: T.gold, opacity: isActive ? 1 : 0.2 }}>◆</span>
                  {label}
                </a>
              );
            })}
          </nav>
          <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: '1px solid rgba(201,168,76,0.1)', fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.9 }}>
            BDT Talent Group<br />Houston, TX · 2026<br />AI-Powered · Human-Centered
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside style={{ width: 260, flexShrink: 0, height: '100vh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 28, padding: '28px 18px', background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(75,0,130,0.28) 0%, transparent 60%), linear-gradient(180deg,#0d0d10,#080808)', borderRight: '1px solid rgba(201,168,76,0.15)', zIndex: 10 }}>
      <div style={{ textAlign: 'center', paddingBottom: 18, borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
        <img src="./assets/bdt-logo.jpeg" alt="BDT Talent Group" style={{ width: 130, height: 'auto', opacity: 0.92 }} />
      </div>
      <nav style={{ display: 'grid', gap: 8 }}>
        {NAV_ITEMS.map(({ id, label }) => {
          const isActive = active === id;
          return (
            <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); onNav(id); }}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 14px 0 28px', border: `1px solid ${isActive ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.1)'}`, borderRadius: 14, background: isActive ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)', color: isActive ? T.goldWarm : T.silver, fontSize: '0.76rem', letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'none', transform: isActive ? 'translateX(5px)' : 'none', transition: 'all .2s', boxShadow: isActive ? '0 0 12px rgba(201,168,76,0.08)' : 'none' }}>
              <span style={{ position: 'absolute', left: 11, fontSize: '0.42rem', color: T.gold, opacity: isActive ? 1 : 0.2 }}>◆</span>
              {label}
            </a>
          );
        })}
      </nav>
      <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: '1px solid rgba(201,168,76,0.1)', fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.9 }}>
        BDT Talent Group<br />Houston, TX · 2026<br />AI-Powered · Human-Centered
      </div>
    </aside>
  );
}

function NavigationAppShell() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 960);
  const [active, setActive] = useState('about-me');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 960;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const sectionEls = NAV_ITEMS
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean);

    if (!sectionEls.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (visible) {
          setActive(visible.target.id);
        }
      },
      {
        threshold: [0.2, 0.4, 0.65],
        rootMargin: isMobile ? '-12% 0px -45% 0px' : '-18% 0px -40% 0px',
      }
    );

    sectionEls.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [isMobile]);

  const handleNav = (id) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
    setMobileMenuOpen(false);
    window.history.replaceState(null, '', `#${id}`);
  };

  return { isMobile, active, mobileMenuOpen, setMobileMenuOpen, handleNav };
}
