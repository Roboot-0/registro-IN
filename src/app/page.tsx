"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// =========================================================================
// Formulario publico para el Levantamiento de Urbanismos.
// Inmobiliaria Nacional S.A. - Republica Bolivariana de Venezuela.
//
// Diseno institucional "Accessible & Ethical":
//  - Cintillo tricolor (amarillo / azul / rojo) en el borde superior.
//  - Cabecera azul profundo con logo de Inmobiliaria Nacional.
//  - Tarjetas blancas con sombra muy sutil, bordes redondeados, mucho aire.
//  - Tipografia sistema (San Francisco / Segoe UI / Roboto) para velocidad y
//    legibilidad institucional.
//  - Botones grandes (>=48px) y alto contraste para uso al sol.
//  - Iconos SVG inline (no emojis), respetando reduced motion.
// =========================================================================

// ----- Tipos -----
type AlcanceTipo = "urbanismo_completo" | "torre" | "seccion";
type TipoConstruccion =
  | "multifamiliar" | "unifamiliar" | "bifamiliar" | "tetracasa" | "townhouse";
type OrgTerritorial = "manzana" | "terraza" | "pendiente";

type Vocero = {
  cedula: string;
  nombre: string;
  alcance_tipo: AlcanceTipo;
  alcance_nombre: string | null;
};

type Urbanismo = {
  id: string;
  nombre: string;
  tipo_construccion: TipoConstruccion | null;
  organizacion_territorial: OrgTerritorial | null;
  numero_cmg_a_conformar: number | null;
  parroquia: {
    nombre: string;
    municipio: { nombre: string; estado: { nombre: string } };
  } | null;
};

type Unidad = { nombre: string; viviendas: string };

// ----- Constantes -----
const TIPOS: { v: TipoConstruccion; label: string }[] = [
  { v: "multifamiliar", label: "Multifamiliar (edificios)" },
  { v: "unifamiliar",   label: "Unifamiliar (casa)" },
  { v: "bifamiliar",    label: "Bifamiliar" },
  { v: "tetracasa",     label: "Tetracasa" },
  { v: "townhouse",     label: "Townhouse" },
];
const ORGS: { v: OrgTerritorial; label: string }[] = [
  { v: "manzana", label: "Manzana" },
  { v: "terraza", label: "Terraza" },
  { v: "pendiente", label: "Pendiente" },
];

// Paleta institucional Inmobiliaria Nacional
const TINTA       = "#0F172A"; // texto principal
const TINTA_SUAVE = "#475569"; // texto secundario
const FONDO       = "#F4F7FB"; // background suave de la pagina
const LINEA       = "#E2E8F0"; // bordes sutiles
const AZUL_PROFUNDO = "#0F3470"; // cabecera y titulos
const AZUL_INSTITUCIONAL = "#1B4F9B"; // links / acentos
const ROJO_INSTITUCIONAL = "#C8102E"; // CTA principal
const VERDE_EXITO   = "#16A34A";
const ROJO_ERROR_BG = "#FEF2F2";
const ROJO_ERROR_FG = "#991B1B";
const ROJO_ERROR_BD = "#FCA5A5";

// Bandera de Venezuela (cintillo)
const BANDERA_AMARILLO = "#FCD116";
const BANDERA_AZUL     = "#00247D";
const BANDERA_ROJO     = "#CF142B";

// Fuente sistema institucional, sin descargas externas
const FUENTE_SISTEMA =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';

// ----- Componente principal -----
export default function Page() {
  const [step, setStep] = useState<"login" | "form" | "exito" | "ya_envio">("login");
  const [cedula, setCedula] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vocero, setVocero] = useState<Vocero | null>(null);
  const [urbanismo, setUrbanismo] = useState<Urbanismo | null>(null);
  const [idLocal, setIdLocal] = useState<string>("");

  // ----- Form state -----
  const [tipo, setTipo] = useState<TipoConstruccion | "">("");
  const [org, setOrg] = useState<OrgTerritorial | "">("");
  const [totalTorres, setTotalTorres] = useState("");
  const [totalViviendas, setTotalViviendas] = useState("");
  const [cmg, setCmg] = useState("");
  const [unidades, setUnidades] = useState<Unidad[]>([{ nombre: "", viviendas: "" }]);

  useEffect(() => {
    if (step !== "form" || !vocero) return;
    if (vocero.alcance_tipo === "urbanismo_completo") {
      setUnidades([{ nombre: "", viviendas: "" }]);
    } else {
      setUnidades([{ nombre: vocero.alcance_nombre ?? "", viviendas: "" }]);
    }
  }, [step, vocero]);

  useEffect(() => {
    if (urbanismo?.tipo_construccion) setTipo(urbanismo.tipo_construccion);
    if (urbanismo?.organizacion_territorial) setOrg(urbanismo.organizacion_territorial);
    if (urbanismo?.numero_cmg_a_conformar != null)
      setCmg(String(urbanismo.numero_cmg_a_conformar));
  }, [urbanismo]);

  const esMultifamiliar = tipo === "multifamiliar";
  const alcanceCompleto = vocero?.alcance_tipo === "urbanismo_completo";

  useEffect(() => {
    if (esMultifamiliar) {
      setOrg("");
    } else {
      setTotalTorres("");
    }
  }, [esMultifamiliar]);

  // ----- Acciones -----
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await fetch("/api/vocero/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula, codigo }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "No pudimos validar tus datos.");
        return;
      }
      setVocero(data.vocero);
      setUrbanismo(data.urbanismo);
      if (data.ya_envio) {
        setStep("ya_envio");
      } else {
        setIdLocal(crypto.randomUUID());
        setStep("form");
      }
    } catch {
      setError("No hay conexión con el servidor. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tipo) return setError("Selecciona el tipo de construcción.");
    if (!esMultifamiliar && !org) return setError("Selecciona la organización territorial.");
    if (unidades.length === 0) return setError("Agrega al menos una torre o sección.");
    for (const u of unidades) {
      if (!u.nombre.trim()) return setError("Falta el nombre de alguna torre/sección.");
      if (u.viviendas === "" || isNaN(Number(u.viviendas)))
        return setError(`Falta el número de viviendas de "${u.nombre}".`);
    }
    setCargando(true);
    try {
      const body = {
        cedula,
        codigo,
        id_local: idLocal,
        encuesta: {
          tipo_construccion: tipo,
          organizacion_territorial: esMultifamiliar ? null : org,
          numero_torres_declarado: esMultifamiliar && totalTorres ? Number(totalTorres) : null,
          numero_viviendas_total_declarado: totalViviendas ? Number(totalViviendas) : null,
          numero_cmg_a_conformar: cmg ? Number(cmg) : null,
        },
        unidades: unidades.map((u) => ({
          nombre: u.nombre.trim(),
          numero_viviendas: Number(u.viviendas),
        })),
      };
      const r = await fetch("/api/encuesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "No pudimos guardar la encuesta.");
        return;
      }
      setStep("exito");
    } catch {
      setError("No hay conexión. La encuesta se reintentará con el mismo identificador, no se duplicará.");
    } finally {
      setCargando(false);
    }
  }

  function agregarUnidad() {
    setUnidades((u) => [...u, { nombre: "", viviendas: "" }]);
  }
  function quitarUnidad(i: number) {
    setUnidades((u) => u.filter((_, idx) => idx !== i));
  }
  function actualizarUnidad(i: number, campo: "nombre" | "viviendas", v: string) {
    setUnidades((u) => u.map((x, idx) => (idx === i ? { ...x, [campo]: v } : x)));
  }

  const etiquetaUnidad = esMultifamiliar ? "Torre" : "Sección";

  // ----- Render -----
  return (
    <main
      className="min-h-screen"
      style={{ background: FONDO, color: TINTA, fontFamily: FUENTE_SISTEMA }}
    >
      <CintilloTricolor />
      <Cabecera />

      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {step === "login" && (
          <LoginCard
            cedula={cedula} codigo={codigo}
            setCedula={setCedula} setCodigo={setCodigo}
            error={error} cargando={cargando} onSubmit={handleLogin}
          />
        )}

        {step === "ya_envio" && vocero && <YaEnvio nombre={vocero.nombre} />}

        {step === "form" && vocero && urbanismo && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Card>
              <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: TINTA_SUAVE }}>
                Reportando como
              </p>
              <p className="text-lg font-semibold mt-1" style={{ color: AZUL_PROFUNDO }}>
                {vocero.nombre}
              </p>
              <div className="h-px my-4" style={{ background: LINEA }} />
              <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: TINTA_SUAVE }}>
                Urbanismo asignado
              </p>
              <p className="text-lg font-semibold mt-1" style={{ color: AZUL_PROFUNDO }}>
                {urbanismo.nombre}
              </p>
              {urbanismo.parroquia && (
                <p className="text-sm mt-1" style={{ color: TINTA_SUAVE }}>
                  {urbanismo.parroquia.municipio.estado.nombre} ·{" "}
                  {urbanismo.parroquia.municipio.nombre} ·{" "}
                  {urbanismo.parroquia.nombre}
                </p>
              )}
              <div className="mt-4">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ background: "#FEF3F2", color: ROJO_INSTITUCIONAL, border: `1px solid #FECDD3` }}
                >
                  <IconScope />
                  {alcanceCompleto
                    ? "Urbanismo completo"
                    : vocero.alcance_tipo === "torre"
                      ? `Torre ${vocero.alcance_nombre ?? ""}`.trim()
                      : `Sección ${vocero.alcance_nombre ?? ""}`.trim()}
                </span>
              </div>
            </Card>

            <Card titulo="Tipo de construcción">
              <RadioList
                name="tipo" value={tipo}
                options={TIPOS} onChange={(v) => setTipo(v as TipoConstruccion)}
              />
            </Card>

            {!esMultifamiliar && tipo !== "" && (
              <Card titulo="Organización territorial">
                <RadioList
                  name="org" value={org}
                  options={ORGS} onChange={(v) => setOrg(v as OrgTerritorial)}
                />
              </Card>
            )}

            {esMultifamiliar && (
              <Card titulo="Número total de torres en el urbanismo">
                <Input
                  type="number" min={0} inputMode="numeric"
                  value={totalTorres} onChange={(e) => setTotalTorres(e.target.value)}
                  placeholder="Ej. 8"
                />
                <p className="text-xs mt-2" style={{ color: TINTA_SUAVE }}>
                  Total que conoces en el urbanismo (aunque tú solo cubras una torre).
                </p>
              </Card>
            )}

            <Card
              titulo={
                alcanceCompleto
                  ? `Detalle por ${etiquetaUnidad.toLowerCase()}`
                  : `Tu ${etiquetaUnidad.toLowerCase()}`
              }
            >
              <div className="space-y-3">
                {unidades.map((u, i) => (
                  <div key={i} className="flex gap-2 items-end flex-wrap sm:flex-nowrap">
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-sm font-medium mb-1" style={{ color: TINTA }}>
                        Nombre / identificador
                      </label>
                      <Input
                        value={u.nombre}
                        onChange={(e) => actualizarUnidad(i, "nombre", e.target.value)}
                        disabled={!alcanceCompleto}
                        placeholder={
                          esMultifamiliar ? `Torre ${String.fromCharCode(65 + i)}` : "Manzana 1"
                        }
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm font-medium mb-1" style={{ color: TINTA }}>
                        Viviendas
                      </label>
                      <Input
                        type="number" min={0} inputMode="numeric"
                        value={u.viviendas}
                        onChange={(e) => actualizarUnidad(i, "viviendas", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    {alcanceCompleto && unidades.length > 1 && (
                      <button
                        type="button"
                        onClick={() => quitarUnidad(i)}
                        className="text-sm underline px-2 py-3 min-h-[44px]"
                        style={{ color: ROJO_INSTITUCIONAL }}
                        aria-label={`Quitar ${etiquetaUnidad.toLowerCase()} ${i + 1}`}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ))}
                {alcanceCompleto && (
                  <button
                    type="button"
                    onClick={agregarUnidad}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline min-h-[44px]"
                    style={{ color: AZUL_INSTITUCIONAL }}
                  >
                    <IconPlus />
                    Agregar otra {etiquetaUnidad.toLowerCase()}
                  </button>
                )}
                {!alcanceCompleto && (
                  <p className="text-xs" style={{ color: TINTA_SUAVE }}>
                    Tu alcance está fijo según tu asignación; solo declaras las viviendas.
                  </p>
                )}
              </div>
            </Card>

            <Card titulo="Número total de viviendas en el urbanismo">
              <Input
                type="number" min={0} inputMode="numeric"
                value={totalViviendas} onChange={(e) => setTotalViviendas(e.target.value)}
                placeholder="Ej. 240"
              />
              <p className="text-xs mt-2" style={{ color: TINTA_SUAVE }}>
                Total general de viviendas en todo el urbanismo, aunque tú solo cubras una parte.
              </p>
            </Card>

            <Card titulo="Número de CMG a conformar">
              <Input
                type="number" min={0} inputMode="numeric"
                value={cmg} onChange={(e) => setCmg(e.target.value)}
                placeholder="Ej. 3"
              />
              <p className="text-xs mt-2" style={{ color: TINTA_SUAVE }}>
                Comités Multifamiliares de Gestión que se conformarán en el urbanismo.
              </p>
            </Card>

            {error && <BannerError mensaje={error} />}

            <button
              type="submit"
              disabled={cargando}
              className="w-full text-white font-semibold py-4 rounded-xl text-lg shadow-sm transition-opacity disabled:opacity-60 min-h-[56px]"
              style={{ background: ROJO_INSTITUCIONAL }}
            >
              {cargando ? "Enviando…" : "Enviar encuesta"}
            </button>
            <p className="text-xs text-center" style={{ color: TINTA_SUAVE }}>
              Una vez enviada, no se podrá modificar. Asegúrate de que todo está correcto.
            </p>
          </form>
        )}

        {step === "exito" && <PantallaExito />}
      </section>

      <PieDePagina />
    </main>
  );
}

// ===== Componentes de marca / layout =====

function CintilloTricolor() {
  // Cintillo con los colores de la bandera. Es decorativo (aria-hidden).
  return (
    <div aria-hidden="true" className="w-full" style={{ height: 6, display: "flex" }}>
      <div style={{ flex: 1, background: BANDERA_AMARILLO }} />
      <div style={{ flex: 1, background: BANDERA_AZUL }} />
      <div style={{ flex: 1, background: BANDERA_ROJO }} />
    </div>
  );
}

function Cabecera() {
  return (
    <header style={{ background: AZUL_PROFUNDO }} className="text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-4">
        <div
          className="rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "white", width: 56, height: 56, padding: 6 }}
        >
          <Image
            src="/logo-in.png"
            alt="Logo de Inmobiliaria Nacional S.A."
            width={48}
            height={48}
            style={{ objectFit: "contain", width: "100%", height: "100%" }}
            priority
          />
        </div>
        <div className="leading-tight">
          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-80">
            República Bolivariana de Venezuela
          </div>
          <div className="text-lg sm:text-xl font-bold mt-0.5">
            Inmobiliaria Nacional S.A.
          </div>
          <div className="text-sm opacity-90">Levantamiento de Urbanismos</div>
        </div>
      </div>
    </header>
  );
}

function PieDePagina() {
  return (
    <footer className="mt-10 border-t" style={{ borderColor: LINEA }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 text-center text-xs" style={{ color: TINTA_SUAVE }}>
        Inmobiliaria Nacional S.A. · Levantamiento de Urbanismos<br />
        República Bolivariana de Venezuela
      </div>
    </footer>
  );
}

// ===== Tarjetas y controles =====

function Card(props: { children: React.ReactNode; titulo?: string }) {
  return (
    <div
      className="bg-white rounded-2xl p-5 sm:p-6"
      style={{
        border: `1px solid ${LINEA}`,
        boxShadow: "0 1px 2px rgba(15, 52, 112, 0.04), 0 4px 12px rgba(15, 52, 112, 0.05)",
      }}
    >
      {props.titulo && (
        <h3 className="font-semibold text-base sm:text-lg mb-3" style={{ color: AZUL_PROFUNDO }}>
          {props.titulo}
        </h3>
      )}
      {props.children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-lg px-3.5 py-3 text-base bg-white outline-none transition-shadow " +
        "focus:ring-2 focus:ring-offset-0 disabled:bg-gray-50 disabled:text-gray-500 " +
        (props.className ?? "")
      }
      style={{
        border: `1px solid ${LINEA}`,
        color: TINTA,
        minHeight: 48,
        // Focus ring institucional via ringColor de Tailwind
        ...((props.style as object) ?? {}),
      }}
    />
  );
}

function RadioList<T extends string>(props: {
  name: string;
  value: T | "";
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      {props.options.map((o) => {
        const seleccionado = props.value === o.v;
        return (
          <label
            key={o.v}
            className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-colors"
            style={{
              border: `1px solid ${seleccionado ? AZUL_INSTITUCIONAL : LINEA}`,
              background: seleccionado ? "#EFF4FB" : "white",
              minHeight: 52,
            }}
          >
            <input
              type="radio" name={props.name} value={o.v}
              checked={seleccionado}
              onChange={() => props.onChange(o.v)}
              className="w-5 h-5"
              style={{ accentColor: AZUL_INSTITUCIONAL }}
            />
            <span className="text-base" style={{ color: TINTA, fontWeight: seleccionado ? 600 : 400 }}>
              {o.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function BannerError(props: { mensaje: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl p-3.5 text-sm flex items-start gap-3"
      style={{ background: ROJO_ERROR_BG, color: ROJO_ERROR_FG, border: `1px solid ${ROJO_ERROR_BD}` }}
    >
      <IconAlerta />
      <span>{props.mensaje}</span>
    </div>
  );
}

// ===== Pantallas =====

function LoginCard(props: {
  cedula: string; codigo: string;
  setCedula: (v: string) => void; setCodigo: (v: string) => void;
  error: string | null; cargando: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const soloDigitos = (v: string) => v.replace(/\D+/g, "");
  return (
    <form onSubmit={props.onSubmit} className="space-y-5">
      <Card>
        <h2 className="text-xl sm:text-2xl font-bold" style={{ color: AZUL_PROFUNDO }}>
          Identifícate
        </h2>
        <p className="text-sm mt-1.5" style={{ color: TINTA_SUAVE }}>
          Ingresa tu cédula y el código de acceso que te entregó Inmobiliaria Nacional.
        </p>

        <div className="mt-5">
          <label htmlFor="cedula" className="block text-sm font-semibold mb-1.5" style={{ color: TINTA }}>
            Cédula
          </label>
          <Input
            id="cedula"
            value={props.cedula}
            onChange={(e) => props.setCedula(soloDigitos(e.target.value))}
            placeholder="Ej. 12345678"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            autoComplete="username"
            required
          />
          <p className="text-xs mt-1.5" style={{ color: TINTA_SUAVE }}>
            Solo los números, sin la V ni el guion.
          </p>
        </div>

        <div className="mt-4">
          <label htmlFor="codigo" className="block text-sm font-semibold mb-1.5" style={{ color: TINTA }}>
            Código de acceso
          </label>
          <Input
            id="codigo"
            type="password"
            value={props.codigo}
            onChange={(e) => props.setCodigo(soloDigitos(e.target.value))}
            placeholder="6 dígitos"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="current-password"
            required
          />
          <p className="text-xs mt-1.5" style={{ color: TINTA_SUAVE }}>
            Son 6 números que te entregó Inmobiliaria Nacional.
          </p>
        </div>

        {props.error && (
          <div className="mt-4">
            <BannerError mensaje={props.error} />
          </div>
        )}

        <button
          type="submit"
          disabled={props.cargando}
          className="w-full text-white font-semibold py-4 rounded-xl text-lg shadow-sm mt-5 transition-opacity disabled:opacity-60 min-h-[56px]"
          style={{ background: ROJO_INSTITUCIONAL }}
        >
          {props.cargando ? "Validando…" : "Continuar"}
        </button>
      </Card>

      <p className="text-xs text-center px-4" style={{ color: TINTA_SUAVE }}>
        Si no recuerdas tus datos, comunícate con tu coordinación territorial.
      </p>
    </form>
  );
}

function YaEnvio(props: { nombre: string }) {
  return (
    <Card>
      <div className="text-center py-4">
        <div
          className="mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ background: "#E0F2FE", color: AZUL_INSTITUCIONAL, width: 72, height: 72 }}
          aria-hidden="true"
        >
          <IconDocumento />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: AZUL_PROFUNDO }}>
          Tu encuesta ya fue enviada
        </h2>
        <p className="text-base" style={{ color: TINTA_SUAVE }}>
          Hola <strong style={{ color: TINTA }}>{props.nombre}</strong>, ya tenemos tu encuesta registrada.
          Si hay algo que corregir, contacta a tu coordinación territorial.
        </p>
      </div>
    </Card>
  );
}

function PantallaExito() {
  return (
    <Card>
      <div className="text-center py-6">
        <div
          className="mx-auto rounded-full flex items-center justify-center mb-4 text-white"
          style={{ background: VERDE_EXITO, width: 72, height: 72 }}
          aria-hidden="true"
        >
          <IconCheck />
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: AZUL_PROFUNDO }}>
          Encuesta enviada
        </h2>
        <p className="text-base" style={{ color: TINTA_SUAVE }}>
          ¡Gracias por tu colaboración con Inmobiliaria Nacional!
        </p>
      </div>
    </Card>
  );
}

// ===== Iconos SVG inline (estilo Lucide, sin dependencias) =====

function IconCheck() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconDocumento() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function IconAlerta() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconScope() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
