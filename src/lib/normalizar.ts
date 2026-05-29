// Utilidades de normalizacion para entradas del vocero.
//
// El vocero teclea en el telefono con luz solar; el formato exacto no debe ser
// motivo de rechazo. Aceptamos cualquier combinacion razonable y comparamos
// solo digitos contra la base.
//
// Ejemplos:
//   "V-12345678"   -> "12345678"
//   "12.345.678"   -> "12345678"
//   " 12345678 "   -> "12345678"
//   "12 345 678"   -> "12345678"
//   "123-456"      -> "123456"
export function soloDigitos(valor: string): string {
  return (valor ?? "").replace(/\D+/g, "");
}
