import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export function Layout() {
  const { cuenta, salir, dosFA } = useAuth();
  return (
    <>
      <header className="barra">
        <div className="barra-interior">
          <NavLink to="/" className="marca" aria-label="Elitec Systems, inicio">
            <img className="logo" src="/elitec.png" alt="Elitec Systems" />
          </NavLink>
          {/* Sin 2FA solo existe la pantalla de seguridad: el menu no lleva a ninguna parte. */}
          {dosFA && (
          <nav aria-label="Principal">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "activo" : "")}>Inicio</NavLink>
            <NavLink to="/solicitudes" className={({ isActive }) => (isActive ? "activo" : "")}>Solicitudes</NavLink>
            <NavLink to="/pedidos" className={({ isActive }) => (isActive ? "activo" : "")}>Pedidos</NavLink>
            <NavLink to="/seguridad" className={({ isActive }) => (isActive ? "activo" : "")}>Seguridad</NavLink>
          </nav>
          )}
          <span className="suave">{cuenta?.nombre}</span>
          <button className="secundario" onClick={() => void salir()}>Salir</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export function Publico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="pantalla-publica">
      <span className="decoracion decoracion--1" aria-hidden="true" />
      <span className="decoracion decoracion--2" aria-hidden="true" />
      <span className="decoracion decoracion--3" aria-hidden="true" />
      <div className="centro">
        <img className="logo-grande" src="/elitec.png" alt="Elitec Systems" />
        <div className="tarjeta">
          <h1>{titulo}</h1>
          {children}
        </div>
      </div>
      <p className="pie-publico">Portal de clientes · Elitec Systems</p>
    </div>
  );
}
