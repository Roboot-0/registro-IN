// Genera una Excel de prueba con voceros y urbanismos sinteticos
// para probar el importador sin esperar la Excel real de la GMVV.
//
// Uso:  node scripts/generar-excel-prueba.mjs
// Salida: scripts/voceros-prueba.xlsx

import * as XLSX from "xlsx";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const filas = [
  // --- Urbanismo "Ciudad Caribia" - multifamiliar, 3 voceros (uno por torre) ---
  { cedula: "V-10000001", nombre_completo: "Maria Gonzalez Perez", telefono: "0412-1111111",
    estado: "Miranda", municipio: "Baruta", parroquia: "Baruta",
    urbanismo_codigo: "GMVV-MIR-001", urbanismo_nombre: "Ciudad Caribia",
    tipo_construccion: "multifamiliar", organizacion_territorial: "",
    numero_cmg_a_conformar: 3, alcance_tipo: "torre", alcance_nombre: "Torre A" },
  { cedula: "V-10000002", nombre_completo: "Juan Rodriguez Sosa", telefono: "0414-2222222",
    estado: "Miranda", municipio: "Baruta", parroquia: "Baruta",
    urbanismo_codigo: "GMVV-MIR-001", urbanismo_nombre: "Ciudad Caribia",
    tipo_construccion: "multifamiliar", organizacion_territorial: "",
    numero_cmg_a_conformar: 3, alcance_tipo: "torre", alcance_nombre: "Torre B" },
  { cedula: "V-10000003", nombre_completo: "Carlos Mendoza", telefono: "0416-3333333",
    estado: "Miranda", municipio: "Baruta", parroquia: "Baruta",
    urbanismo_codigo: "GMVV-MIR-001", urbanismo_nombre: "Ciudad Caribia",
    tipo_construccion: "multifamiliar", organizacion_territorial: "",
    numero_cmg_a_conformar: 3, alcance_tipo: "torre", alcance_nombre: "Torre C" },

  // --- Urbanismo "Las Flores" - unifamiliar, 1 vocero (completo) ---
  { cedula: "V-20000001", nombre_completo: "Carla Mendez", telefono: "0424-4444444",
    estado: "Carabobo", municipio: "Valencia", parroquia: "San Jose",
    urbanismo_codigo: "", urbanismo_nombre: "Urbanismo Las Flores",
    tipo_construccion: "unifamiliar", organizacion_territorial: "manzana",
    numero_cmg_a_conformar: 1, alcance_tipo: "urbanismo_completo", alcance_nombre: "" },

  // --- Urbanismo "Caricuao UD-4" - bifamiliar, 2 voceros (uno por seccion) ---
  { cedula: "V-30000001", nombre_completo: "Andrea Lopez", telefono: "0412-5555555",
    estado: "Distrito Capital", municipio: "Libertador", parroquia: "Caricuao",
    urbanismo_codigo: "GMVV-DC-007", urbanismo_nombre: "Caricuao UD-4",
    tipo_construccion: "bifamiliar", organizacion_territorial: "manzana",
    numero_cmg_a_conformar: 2, alcance_tipo: "seccion", alcance_nombre: "Manzana 1" },
  { cedula: "V-30000002", nombre_completo: "Roberto Silva", telefono: "0414-6666666",
    estado: "Distrito Capital", municipio: "Libertador", parroquia: "Caricuao",
    urbanismo_codigo: "GMVV-DC-007", urbanismo_nombre: "Caricuao UD-4",
    tipo_construccion: "bifamiliar", organizacion_territorial: "manzana",
    numero_cmg_a_conformar: 2, alcance_tipo: "seccion", alcance_nombre: "Manzana 2" },
];

const ws = XLSX.utils.json_to_sheet(filas);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "voceros");
const outPath = resolve(__dirname, "voceros-prueba.xlsx");
XLSX.writeFile(wb, outPath);
console.log(`Excel de prueba generada: ${outPath}`);
console.log(`  ${filas.length} voceros, 3 urbanismos esperados:`);
console.log(`    - Ciudad Caribia  (Miranda/Baruta/Baruta, multifamiliar, 3 voceros)`);
console.log(`    - Las Flores      (Carabobo/Valencia/San Jose, unifamiliar, 1 vocero completo)`);
console.log(`    - Caricuao UD-4   (DC/Libertador/Caricuao, bifamiliar, 2 voceros por seccion)`);
