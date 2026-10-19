import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, onSesionInvalida, type Cuenta, type Estado2fa } from "./api";

type Estado = { cuenta: Cuenta | null; cargando: boolean };
type Ctx = Estado & {
  entrar: (c: Cuenta) => void;
  salir: () => Promise<void>;
  /** ¿Ya configuro la verificacion en dos pasos? null = todavia no se sabe. Es lo
   *  PRIMERO que se le pide a una cuenta nueva: sin esto no ve nada mas. */
  dosFA: boolean | null;
  refrescar2fa: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ cuenta: null, cargando: true });
  const [dosFA, setDosFA] = useState<boolean | null>(null);

  const refrescar2fa = useCallback(async () => {
    try {
      setDosFA((await api.get<Estado2fa>("/2fa")).configurado);
    } catch {
      setDosFA(null);
    }
  }, []);

  // Cada vez que hay (o cambia) una cuenta se consulta su 2FA; sin cuenta, nada.
  const cuentaId = estado.cuenta?.id ?? null;
  useEffect(() => {
    if (cuentaId === null) {
      setDosFA(null);
      return;
    }
    void refrescar2fa();
  }, [cuentaId, refrescar2fa]);

  const cargar = useCallback(async () => {
    try {
      setEstado({ cuenta: await api.get<Cuenta>("/yo"), cargando: false });
    } catch {
      setEstado({ cuenta: null, cargando: false });
    }
  }, []);

  useEffect(() => {
    onSesionInvalida(() => setEstado({ cuenta: null, cargando: false }));
    void cargar();
  }, [cargar]);

  const entrar = (cuenta: Cuenta) => setEstado({ cuenta, cargando: false });
  const salir = async () => {
    try {
      await api.post("/logout");
    } finally {
      setEstado({ cuenta: null, cargando: false });
    }
  };

  return <AuthCtx.Provider value={{ ...estado, entrar, salir, dosFA, refrescar2fa }}>{children}</AuthCtx.Provider>;
}
