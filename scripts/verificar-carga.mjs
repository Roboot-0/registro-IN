import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

console.log("--- URBANISMOS en Supabase ---");
const { data: urbs } = await supabase
  .from("urbanismos")
  .select("nombre, codigo, tipo_construccion, organizacion_territorial, numero_cmg_a_conformar, parroquias(nombre, municipios(nombre, estados(nombre)))")
  .order("nombre");
for (const u of urbs) {
  const p = u.parroquias, m = p?.municipios, e = m?.estados;
  console.log(`  - ${u.nombre} [${u.codigo || 'sin codigo'}]`);
  console.log(`      tipo: ${u.tipo_construccion}${u.organizacion_territorial ? ', org: ' + u.organizacion_territorial : ''}, CMG: ${u.numero_cmg_a_conformar}`);
  console.log(`      ubicacion: ${e?.nombre} / ${m?.nombre} / ${p?.nombre}`);
}

console.log("\n--- VOCEROS en Supabase ---");
const { data: vocs } = await supabase
  .from("voceros")
  .select("cedula, nombre_completo, telefono, alcance_tipo, alcance_nombre, activo, urbanismos(nombre), codigo_acceso_hash")
  .order("cedula");
for (const v of vocs) {
  const hashOk = v.codigo_acceso_hash?.startsWith("$2") ? "hash bcrypt OK" : "HASH SOSPECHOSO";
  const alc = v.alcance_tipo === "urbanismo_completo" ? "urbanismo completo" : `${v.alcance_tipo}: ${v.alcance_nombre}`;
  console.log(`  - ${v.cedula} ${v.nombre_completo} (${v.telefono || 'sin tel'})`);
  console.log(`      urbanismo: ${v.urbanismos?.nombre} | alcance: ${alc} | activo: ${v.activo} | ${hashOk}`);
}

console.log("\n--- CONTEOS ---");
const { count: uc } = await supabase.from("urbanismos").select("*", { count: "exact", head: true });
const { count: vc } = await supabase.from("voceros").select("*", { count: "exact", head: true });
const { count: ac } = await supabase.from("audit_log").select("*", { count: "exact", head: true });
console.log(`  urbanismos: ${uc}, voceros: ${vc}, registros en audit_log: ${ac}`);
