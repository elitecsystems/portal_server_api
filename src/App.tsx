import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { StepUpProvider } from "./stepup";
import { EnlaceCorreo, Invitacion, Login, Olvide, Restablecer } from "./pages/Acceso";
import { Completar } from "./pages/Completar";
import { CondominioDetalle, Inicio } from "./pages/Condominios";
import { DetallePedido, ListaPedidos } from "./pages/Pedidos";
import { Seguridad } from "./pages/Seguridad";
import { DetalleSolicitud, ListaSolicitudes, NuevaSolicitud } from "./pages/Solicitudes";

function Protegida() {
  const { cuenta, cargando, dosFA } = useAuth();
  const { pathname } = useLocation();
  if (cargando) return <p className="vacio">Cargando…</p>;
  if (!cuenta) return <Navigate to="/login" replace />;
  if (dosFA === null) return <p className="vacio">Cargando…</p>;
  // Lo primero que se le pide a una cuenta es la verificacion en dos pasos; hasta
  // que la activa no ve nada mas (ni siquiera la informacion del condominio).
  // Asi ninguna captura se pierde a medias por tener que ir a activarla.
  if (!dosFA && pathname !== "/seguridad") {
    return <Navigate to="/seguridad" replace state={{ aviso: "Primero activa la verificación en dos pasos. Después te pediremos los datos de tu condominio." }} />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <StepUpProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/olvide" element={<Olvide />} />
        <Route path="/invitacion" element={<Invitacion />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="/verificar-correo" element={<EnlaceCorreo tipo="verificar-correo" />} />
        <Route path="/confirmar-correo-contacto" element={<EnlaceCorreo tipo="confirmar-correo-contacto" />} />
        <Route path="/revertir-correo-contacto" element={<EnlaceCorreo tipo="revertir-correo-contacto" />} />
        <Route path="/confirmar-correo-acceso" element={<EnlaceCorreo tipo="confirmar-correo-acceso" />} />
        <Route path="/revertir-correo-acceso" element={<EnlaceCorreo tipo="revertir-correo-acceso" />} />
        <Route element={<Protegida />}>
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="condominios/:id" element={<CondominioDetalle />} />
            <Route path="condominios/:id/completar" element={<Completar />} />
            <Route path="solicitudes" element={<ListaSolicitudes />} />
            <Route path="solicitudes/nueva" element={<NuevaSolicitud />} />
            <Route path="solicitudes/:id" element={<DetalleSolicitud />} />
            <Route path="pedidos" element={<ListaPedidos />} />
            <Route path="pedidos/:numero" element={<DetallePedido />} />
            <Route path="seguridad" element={<Seguridad />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StepUpProvider>
  );
}
