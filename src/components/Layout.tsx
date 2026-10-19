import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export function Layout() {
  const { cuenta, salir, dosFA } = useAuth();
  return (
    <>
      <header className="barra">
        <div className="barra-interior">
          <NavLink to="/" className="marca">
            Elitec Systems
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
    <div className="centro">
      <p className="marca" style={{ marginBottom: 16 }}>Elitec Systems · Portal de clientes</p>
      <div className="tarjeta">
        <h1>{titulo}</h1>
        {children}
      </div>
    </div>
  );
}
