import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { supabaseServer } from "@/lib/server-supabase";
import { soloDigitos } from "@/lib/normalizar";

// POST /api/vocero/login
// Recibe { cedula, codigo }, valida contra el hash en la base, y
// devuelve los datos del vocero + su urbanismo asignado para pintar el formulario.
// El cliente NO puede confiar en estos datos para autorizar acciones; la
// autorizacion real se vuelve a hacer en /api/encuesta con la misma cedula+codigo.
//
// Cedula y codigo son AMBOS numericos. Normalizamos eliminando cualquier
// caracter que no sea digito (V-, espacios, puntos, guiones) para no rechazar
// al vocero por como escriba su cedula en el telefono.

const schema = z.object({
  cedula: z.string().min(1).max(40),
  codigo: z.string().min(1).max(40),
});

const respuestaCredencialesInvalidas = () =>
  NextResponse.json(
    { ok: false, error: "Cedula o codigo invalidos. Revisa los datos y vuelve a intentar." },
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
    return respuestaCredencialesInvalidas();
  }
  const cedula = soloDigitos(parsed.data.cedula);
  const codigo = soloDigitos(parsed.data.codigo);

  // Despues de limpiar, exigimos minimos razonables: cedula >= 6 digitos,
  // codigo == 6 digitos exactos. Esto evita rebotes innecesarios contra la
  // base por entradas obviamente vacias.
  if (cedula.length < 6 || cedula.length > 10) return respuestaCredencialesInvalidas();
  if (codigo.length !== 6) return respuestaCredencialesInvalidas();

  const { data: vocero, error } = await supabaseServer
    .from("voceros")
    .select(
      `id, cedula, nombre_completo, codigo_acceso_hash, activo,
       alcance_tipo, alcance_nombre,
       urbanismo:urbanismos (
         id, nombre, tipo_construccion, organizacion_territorial, numero_cmg_a_conformar,
         parroquia:parroquias ( nombre, municipio:municipios ( nombre, estado:estados ( nombre ) ) )
       )`,
    )
    .eq("cedula", cedula)
    .maybeSingle();

  if (error || !vocero || !vocero.activo) {
    return respuestaCredencialesInvalidas();
  }

  const codigoOk = bcrypt.compareSync(codigo, vocero.codigo_acceso_hash);
  if (!codigoOk) {
    return respuestaCredencialesInvalidas();
  }

  // Saber si ya envio para mostrar pantalla apropiada (sin permitir reenvio).
  const { count } = await supabaseServer
    .from("encuestas")
    .select("id", { count: "exact", head: true })
    .eq("vocero_id", vocero.id);

  return NextResponse.json({
    ok: true,
    vocero: {
      cedula: vocero.cedula,
      nombre: vocero.nombre_completo,
      alcance_tipo: vocero.alcance_tipo,
      alcance_nombre: vocero.alcance_nombre,
    },
    urbanismo: vocero.urbanismo,
    ya_envio: (count ?? 0) > 0,
  });
}
