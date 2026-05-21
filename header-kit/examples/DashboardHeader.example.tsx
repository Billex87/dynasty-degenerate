import HeaderLightFx from './components/HeaderLightFx';
import './styles/header-light-fx.css';

export function DashboardHeader() {
  return (
    <header className="dd-header-shell">
      <HeaderLightFx intensity="nav" />

      <div className="dd-header-content">
        {/* Your existing header/nav markup stays here */}
      </div>
    </header>
  );
}