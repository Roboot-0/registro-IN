// Importador de la Excel de voceros y urbanismos para Inmobiliaria Nacional.
// Uso:
//   node --env-file=.env.local scripts/importar-excel.mjs <ruta-a-la-excel>
//
// Flujo:
//   1) Lee la Excel y la valida fila por fila.
//   2) Si hay errores, no escribe NADA en la base — solo los reporta.
//   3) Si todo esta OK: dedupea urbanismos, genera codigos aleatorios para voceros NUEVOS,
//      los hashea con bcrypt, e inserta en Supabase usando la service_role key.
//   4) Produce un CSV con (cedula, nombre, codigo) en claro PARA QUE INMOBILIARIA NACIONAL
//      LO DISTRIBUYA. En la base de datos solo queda el hash; el codigo en claro nunca se
//      vuelve a saber.

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";

// Helper compartido con los endpoints: la cedula del vocero se guarda y compara
// SOLO como digitos. Asi "V-12345678" en la Excel y "12345678" tecleado en el
// telefono representan al mismo vocero.
const soloDigitos = (v) => String(v ?? "").replace(/\D+/g, "");

const __dirname = dirname(fileURLToPath(import.meta.url));

// ----- Argumentos y env -----
const excelPath = process.argv[2];
if (!excelPath) {
  console.error("Uso: node --env-file=.env.local scripts/importar-excel.mjs <ruta-a-la-excel>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ----- Leer Excel -----
console.log(`Leyendo Excel: ${excelPath}`);
const wb = XLSX.read(readFileSync(excelPath), { type: "buffer" });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
console.log(`  ${rows.length} filas detectadas`);

// ----- Cargar catalogo geografico -----
console.log("Cargando catalogo geografico...");
const [estadosRes, municipiosRes, parroquiasRes] = await Promise.all([
  supabase.from("estados").select("id,nombre"),
  supabase.from("municipios").select("id,nombre,estado_id"),
  supabase.from("parroquias").select("id,nombre,municipio_id"),
]);
if (estadosRes.error || municipiosRes.error || parroquiasRes.error) {
  console.error("Error cargando catalogo:", estadosRes.error || municipiosRes.error || parroquiasRes.error);
  process.exit(1);
}
const estados = estadosRes.data;
const municipios = municipiosRes.data;
const parroquias = parroquiasRes.data;
console.log(`  ${estados.length} estados, ${municipios.length} municipios, ${parroquias.length} parroquias`);

const norm = s => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const estadoByNombre = new Map(estados.map(e => [norm(e.nombre), e]));
const municipioBy = (estadoId, nombre) =>
  municipios.find(m => m.estado_id === estadoId && norm(m.nombre) === norm(nombre));
const parroquiaBy = (municipioId, nombre) =>
  parroquias.find(p => p.municipio_id === municipioId && norm(p.nombre) === norm(nombre));

// ----- Validar todas las filas -----
const TIPOS_CONSTR = new Set(["multifamiliar","unifamiliar","bifamiliar","tetracasa","townhouse"]);
const ORG_TERR    = new Set(["manzana","terraza","pendiente"]);
const ALCANCES    = new Set(["urbanismo_completo","torre","seccion"]);

const errores = [];
const cedulasVistas = new Set();
const urbanismosByKey = new Map(); // parroquia_id|nombre_lower
const filasOk = [];

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const fila = i + 2; // fila 1 es header
  const err = (msg) => errores.push({ fila, msg });

  const cedulaRaw = String(r.cedula ?? "").trim();
  const cedula = soloDigitos(cedulaRaw);
  const nombre = String(r.nombre_completo ?? "").trim();
  const telefono = String(r.telefono ?? "").trim() || null;
  const estadoN = String(r.estado ?? "").trim();
  const municipioN = String(r.municipio ?? "").trim();
  const parroquiaN = String(r.parroquia ?? "").trim();
  const urbanismoN = String(r.urbanismo_nombre ?? "").trim();
  const urbanismoC = String(r.urbanismo_codigo ?? "").trim() || null;
  const tipoC = String(r.tipo_construccion ?? "").trim().toLowerCase() || null;
  const orgT  = String(r.organizacion_territorial ?? "").trim().toLowerCase() || null;
  const cmgR  = r.numero_cmg_a_conformar;
  const cmg   = cmgR === "" || cmgR === null || cmgR === undefined ? null : Number(cmgR);
  const alcT  = String(r.alcance_tipo ?? "").trim().toLowerCase();
  const alcN  = String(r.alcance_nombre ?? "").trim() || null;

  if (!cedula)     { err(`cedula vacia o sin digitos (valor original: "${cedulaRaw}")`); continue; }
  if (cedula.length < 6 || cedula.length > 10) {
    err(`cedula con largo invalido (${cedula.length} digitos, original "${cedulaRaw}"); se esperan 6-10 digitos`);
    continue;
  }
  if (cedulasVistas.has(cedula)) { err(`cedula duplicada en la Excel: ${cedula}`); continue; }
  cedulasVistas.add(cedula);
  if (!nombre)     { err("nombre_completo vacio"); continue; }
  if (!estadoN || !municipioN || !parroquiaN) { err("falta estado / municipio / parroquia"); continue; }
  const eo = estadoByNombre.get(norm(estadoN));
  if (!eo)         { err(`estado no existe en catalogo: ${estadoN}`); continue; }
  const mo = municipioBy(eo.id, municipioN);
  if (!mo)         { err(`municipio no existe en ${estadoN}: ${municipioN}`); continue; }
  const po = parroquiaBy(mo.id, parroquiaN);
  if (!po)         { err(`parroquia no existe en ${municipioN}: ${parroquiaN}`); continue; }
  if (!urbanismoN) { err("urbanismo_nombre vacio"); continue; }
  if (tipoC && !TIPOS_CONSTR.has(tipoC)) { err(`tipo_construccion invalido: ${tipoC}`); continue; }
  if (orgT  && !ORG_TERR.has(orgT))      { err(`organizacion_territorial invalida: ${orgT}`); continue; }
  if (orgT  && tipoC === "multifamiliar"){ err("organizacion_territorial no aplica a multifamiliar"); continue; }
  if (cmg !== null && (!Number.isInteger(cmg) || cmg < 0)) { err(`numero_cmg invalido: ${cmgR}`); continue; }
  if (!ALCANCES.has(alcT)) { err(`alcance_tipo invalido: ${alcT}`); continue; }
  if (alcT !== "urbanismo_completo" && !alcN) { err(`alcance_nombre requerido para ${alcT}`); continue; }

  const urbKey = `${po.id}|${urbanismoN.toLowerCase()}`;
  if (!urbanismosByKey.has(urbKey)) {
    urbanismosByKey.set(urbKey, {
      parroquia_id: po.id, codigo: urbanismoC, nombre: urbanismoN,
      tipo_construccion: tipoC, organizacion_territorial: orgT,
      numero_cmg_a_conformar: cmg,
    });
  }
  filasOk.push({ cedula, nombre, telefono, urbKey, alcance_tipo: alcT, alcance_nombre: alcN });
}

console.log(`\nValidacion:`);
console.log(`  Filas validas:        ${filasOk.length}`);
console.log(`  Urbanismos unicos:    ${urbanismosByKey.size}`);
console.log(`  Errores:              ${errores.length}`);

if (errores.length > 0) {
  console.error(`\n=== ERRORES (no se carga nada hasta corregir) ===`);
  for (const { fila, msg } of errores.slice(0, 50)) console.error(`  Fila ${fila}: ${msg}`);
  if (errores.length > 50) console.error(`  ... y ${errores.length - 50} mas`);
  process.exit(1);
}

// ----- Insertar urbanismos (upsert por parroquia_id + nombre) -----
const urbArr = Array.from(urbanismosByKey.values());
console.log(`\nInsertando/actualizando ${urbArr.length} urbanismos...`);
const { data: urbIns, error: urbErr } = await supabase
  .from("urbanismos")
  .upsert(urbArr, { onConflict: "parroquia_id,nombre" })
  .select("id, parroquia_id, nombre");
if (urbErr) { console.error("Error en urbanismos:", urbErr); process.exit(1); }
const urbKeyToId = new Map(urbIns.map(u => [`${u.parroquia_id}|${u.nombre.toLowerCase()}`, u.id]));
console.log(`  ${urbIns.length} urbanismos en base ahora.`);

// ----- Voceros: separar nuevos vs existentes (no sobreescribimos codigos) -----
const cedulasArr = filasOk.map(v => v.cedula);
const { data: existentes, error: exErr } = await supabase
  .from("voceros").select("cedula").in("cedula", cedulasArr);
if (exErr) { console.error("Error consultando voceros existentes:", exErr); process.exit(1); }
const yaExisten = new Set(existentes.map(v => v.cedula));
const vocerosNuevos = filasOk.filter(v => !yaExisten.has(v.cedula));
console.log(`\nVoceros:`);
console.log(`  En la Excel:          ${filasOk.length}`);
console.log(`  Ya existian en base:  ${yaExisten.size} (codigos no se regeneran)`);
console.log(`  Nuevos a insertar:    ${vocerosNuevos.length}`);

// ----- Generar codigos aleatorios para los nuevos -----
// Codigo de acceso = 6 digitos. Mas facil de teclear en el telefono que el
// alfanumerico anterior. Rechazamos algunos patrones triviales para que el
// vocero no reciba un codigo facilmente adivinable.
const TRIVIALES = new Set([
  "000000","111111","222222","333333","444444","555555",
  "666666","777777","888888","999999",
  "012345","123456","234567","345678","456789",
  "987654","876543","765432","654321","543210",
]);
const generarCodigo = () => {
  // randomInt(0, 1_000_000) -> entero uniforme; rellenamos con ceros a 6 digitos.
  for (let intento = 0; intento < 100; intento++) {
    const n = randomInt(0, 1_000_000);
    const s = String(n).padStart(6, "0");
    if (!TRIVIALES.has(s)) return s;
  }
  // En la practica nunca llega aqui; si llegara, mejor fallar ruidosamente.
  throw new Error("No se pudo generar un codigo no trivial tras 100 intentos.");
};

const conCodigos = vocerosNuevos.map(v => {
  const codigo = generarCodigo();
  return {
    ...v,
    codigo_plano: codigo,
    codigo_acceso_hash: bcrypt.hashSync(codigo, 10),
    urbanismo_id: urbKeyToId.get(v.urbKey),
  };
});

const sinUrb = conCodigos.filter(v => !v.urbanismo_id);
if (sinUrb.length > 0) {
  console.error("ERROR: voceros sin urbanismo_id resuelto:", sinUrb.map(v => v.cedula));
  process.exit(1);
}

// ----- Insertar voceros -----
if (conCodigos.length > 0) {
  const payload = conCodigos.map(v => ({
    cedula: v.cedula,
    nombre_completo: v.nombre,
    telefono: v.telefono,
    codigo_acceso_hash: v.codigo_acceso_hash,
    urbanismo_id: v.urbanismo_id,
    alcance_tipo: v.alcance_tipo,
    alcance_nombre: v.alcance_nombre,
  }));
  console.log(`Insertando ${payload.length} voceros nuevos...`);
  const { error: vocErr } = await supabase.from("voceros").insert(payload);
  if (vocErr) { console.error("Error insertando voceros:", vocErr); process.exit(1); }
}

// ----- Escribir CSV con codigos en claro (para la GMVV) -----
const outDir = resolve(__dirname, "output");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const csvPath = resolve(outDir, `codigos_${ts}.csv`);
const esc = s => `"${String(s).replace(/"/g, '""')}"`;
const csv = ["cedula,nombre,codigo_acceso"];
for (const v of conCodigos) csv.push(`${esc(v.cedula)},${esc(v.nombre)},${esc(v.codigo_plano)}`);
writeFileSync(csvPath, csv.join("\n") + "\n");

// ----- Reporte final -----
console.log(`\n========================== REPORTE ==========================`);
console.log(`Urbanismos en base:          ${urbIns.length}`);
console.log(`Voceros nuevos cargados:     ${conCodigos.length}`);
console.log(`Voceros existentes omitidos: ${yaExisten.size}`);
console.log(``);
console.log(`Codigos en claro (entregar a Inmobiliaria Nacional):`);
console.log(`  ${csvPath}`);
console.log(``);
console.log(`En Supabase solo queda el hash bcrypt; el codigo en claro NO se puede recuperar.`);
console.log(`=============================================================`);
