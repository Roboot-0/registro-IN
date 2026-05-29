import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { supabaseServer } from "@/lib/server-supabase";
import { soloDigitos } from "@/lib/normalizar";

// POST /api/encuesta
// Recibe (cedula, codigo, id_local, encuesta, unidades).
// Valida credenciales OTRA VEZ (no confiamos en el cliente).
// Es idempotente: si el id_local ya existe, devuelve la encuesta original sin duplicar.
//
// Cedula y codigo se normalizan a solo digitos (igual que en /api/vocero/login).

const tipoConstruccion = z.enum([
  "multifamiliar", "unifamiliar", "bifamiliar", "tetracasa", "townhouse",
]);
const orgTerritorial = z.enum(["manzana", "terraza", "pendiente"]);

const schema = z.object({
  cedula: z.string().min(1).max(40),
  codigo: z.string().min(1).max(40),
  id_local: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "id_local debe ser un UUID v4",
    ),
  encuesta: z.object({
    tipo_construccion: tipoConstruccion,
    organizacion_territorial: orgTerritorial.nullish(),
    numero_torres_declarado: z.number().int().min(0).nullish(),
    numero_viviendas_total_declarado: z.number().int().min(0).nullish(),
    numero_cmg_a_conformar: z.number().int().min(0).nullish(),
  }),
  unidades: z
    .array(
      z.object({
        nombre: z.string().trim().min(1).max(80),
        numero_viviendas: z.number().int().min(0),
      }),
    )
    .min(1, "Debe incluir al menos una unidad (torre o seccion)"),
});

const credInvalidas = () =>
  NextResponse.json(
    { ok: false, error: "Credenciales invalidas." },
    { status: 401 },
  );

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud invalida." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Datos invalidos.",
        detalles: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { id_local, encuesta, unidades } = parsed.data;
  const cedula = soloDigitos(parsed.data.cedula);
  const codigo = soloDigitos(parsed.data.codigo);
  if (cedula.length < 6 || cedula.length > 10 || codigo.length !== 6) {
    return credInvalidas();
  }

  // Coherencia tipo / organizacion territorial.
  if (encuesta.tipo_construccion === "multifamiliar" && encuesta.organizacion_territorial) {
    return NextResponse.json(
      { ok: false, error: "Para multifamiliar no se llena organizacion territorial." },
      { status: 400 },
    );
  }
  if (encuesta.tipo_construccion !== "multifamiliar" && !encuesta.organizacion_territorial) {
    return NextResponse.json(
      { ok: false, error: "Falta organizacion territorial (manzana / terraza / pendiente)." },
      { status: 400 },
    );
  }

  // Idempotencia por id_local.
  const { data: yaExiste } = await supabaseServer
    .from("encuestas")
    .select("id")
    .eq("id_local", id_local)
    .maybeSingle();
  if (yaExiste) {
    return NextResponse.json({ ok: true, id_encuesta: yaExiste.id, idempotente: true });
  }

  // Re-autenticar (no confiar en el cliente).
  const { data: vocero, error: voErr } = await supabaseServer
    .from("voceros")
    .select("id, codigo_acceso_hash, activo, urbanismo_id, alcance_tipo, alcance_nombre")
    .eq("cedula", cedula)
    .maybeSingle();
  if (voErr || !vocero || !vocero.activo) return credInvalidas();
  if (!bcrypt.compareSync(codigo, vocero.codigo_acceso_hash)) return credInvalidas();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;

  // Insertar encuesta.
  const { data: nueva, error: encErr } = await supabaseServer
    .from("encuestas")
    .insert({
      id_local,
      vocero_id: vocero.id,
      urbanismo_id: vocero.urbanismo_id,
      tipo_construccion: encuesta.tipo_construccion,
      organizacion_territorial: encuesta.organizacion_territorial ?? null,
      numero_torres_declarado: encuesta.numero_torres_declarado ?? null,
      numero_viviendas_total_declarado: encuesta.numero_viviendas_total_declarado ?? null,
      numero_cmg_a_conformar: encuesta.numero_cmg_a_conformar ?? null,
      alcance_tipo: vocero.alcance_tipo,
      alcance_nombre: vocero.alcance_nombre,
      ip_origen: ip,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (encErr) {
    if ((encErr as { code?: string }).code === "23505") {
      return NextResponse.json(
        { ok: false, error: "Ya enviaste tu encuesta. No se puede modificar." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar la encuesta: " + encErr.message },
      { status: 500 },
    );
  }

  // Insertar unidades (torres o secciones).
  const payloadUnidades = unidades.map((u) => ({
    encuesta_id: nueva.id,
    nombre_unidad: u.nombre,
    numero_viviendas: u.numero_viviendas,
  }));
  const { error: unErr } = await supabaseServer
    .from("encuesta_unidades")
    .insert(payloadUnidades);
  if (unErr) {
    // Limpieza: borrar la encuesta para no quedar a medias.
    await supabaseServer.from("encuestas").delete().eq("id", nueva.id);
    return NextResponse.json(
      { ok: false, error: "No se pudieron guardar las unidades: " + unErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id_encuesta: nueva.id });
}
