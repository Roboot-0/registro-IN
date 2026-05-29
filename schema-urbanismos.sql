-- =====================================================================
-- LEVANTAMIENTO DE URBANISMOS — GRAN MISIÓN VIVIENDA VENEZUELA
-- Esquema de base de datos para PostgreSQL / Supabase
-- Versión MVP rediseñada · Mayo 2026
-- Alcance: 250-300K encuestas (una por vocero) sobre urbanismos
-- =====================================================================

-- ============= EXTENSIONES =============
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para hashear los códigos de acceso
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============= ENUMS =============
CREATE TYPE tipo_construccion_enum AS ENUM (
  'multifamiliar',
  'unifamiliar',
  'bifamiliar',
  'tetracasa',
  'townhouse'
);

CREATE TYPE organizacion_territorial_enum AS ENUM (
  'manzana',
  'terraza',
  'pendiente'
);

-- El alcance del vocero: o cubre el urbanismo completo,
-- o cubre una torre (multifamiliar) o una sección (no multifamiliar).
CREATE TYPE alcance_tipo_enum AS ENUM (
  'urbanismo_completo',
  'torre',
  'seccion'
);

-- Estado de revisión de calidad (se usa en fase 2)
CREATE TYPE estado_revision_enum AS ENUM (
  'enviado',
  'en_revision',
  'validado',
  'observado'
);

-- ============= CATÁLOGO GEOGRÁFICO =============
-- Se carga desde fuentes públicas (INE / datos.gob.ve).
-- Lectura abierta para que el formulario pueda mostrar los selectores.

CREATE TABLE estados (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  codigo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE municipios (
  id SERIAL PRIMARY KEY,
  estado_id INT NOT NULL REFERENCES estados(id),
  nombre TEXT NOT NULL,
  UNIQUE (estado_id, nombre)
);
CREATE INDEX idx_municipios_estado ON municipios(estado_id);

CREATE TABLE parroquias (
  id SERIAL PRIMARY KEY,
  municipio_id INT NOT NULL REFERENCES municipios(id),
  nombre TEXT NOT NULL,
  UNIQUE (municipio_id, nombre)
);
CREATE INDEX idx_parroquias_municipio ON parroquias(municipio_id);

-- ============= URBANISMOS (maestro) =============
-- Pre-cargados desde la Excel de la GMVV.
-- Cada vocero está asignado a un urbanismo (y opcionalmente a una torre o sección).
CREATE TABLE urbanismos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parroquia_id INT NOT NULL REFERENCES parroquias(id),
  codigo TEXT,                                                -- código GMVV si existe
  nombre TEXT NOT NULL,
  -- Datos opcionales que la GMVV puede pre-cargar; si no, se llenan desde las encuestas
  tipo_construccion tipo_construccion_enum,
  organizacion_territorial organizacion_territorial_enum,    -- solo si no es multifamiliar
  numero_cmg_a_conformar INT,
  numero_viviendas_estimado INT,
  notas TEXT,
  -- Estado de avance del levantamiento sobre este urbanismo
  estado_levantamiento TEXT DEFAULT 'pendiente',              -- 'pendiente' | 'en_progreso' | 'completo'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parroquia_id, nombre)
);
CREATE INDEX idx_urbanismos_parroquia ON urbanismos(parroquia_id);
CREATE INDEX idx_urbanismos_estado ON urbanismos(estado_levantamiento);

-- ============= VOCEROS =============
-- Pre-cargados desde la Excel de la GMVV.
-- Cada vocero tiene un código de acceso (hash) y un alcance asignado.
CREATE TABLE voceros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cedula TEXT NOT NULL UNIQUE,
  nombre_completo TEXT NOT NULL,
  telefono TEXT,
  codigo_acceso_hash TEXT NOT NULL,                  -- bcrypt/argon2; el código real NUNCA se guarda en claro
  urbanismo_id UUID NOT NULL REFERENCES urbanismos(id),
  alcance_tipo alcance_tipo_enum NOT NULL,
  alcance_nombre TEXT,                                -- requerido si alcance_tipo != 'urbanismo_completo' (ej. 'Torre A', 'Manzana 1')
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_envio_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_alcance_nombre CHECK (
    alcance_tipo = 'urbanismo_completo' OR alcance_nombre IS NOT NULL
  )
);
CREATE INDEX idx_voceros_urbanismo ON voceros(urbanismo_id);
CREATE INDEX idx_voceros_activo ON voceros(activo) WHERE activo = TRUE;

-- ============= ENCUESTAS (envíos de los voceros) =============
-- Envío único: un vocero solo puede enviar UNA encuesta (UNIQUE en vocero_id).
-- Idempotencia: id_local UUID generado en el cliente evita duplicados por reintento.
-- Inmodificable desde el cliente; correcciones por incoherencia se manejan en fase 2.
CREATE TABLE encuestas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_local UUID NOT NULL UNIQUE,                                -- idempotencia
  vocero_id UUID NOT NULL UNIQUE REFERENCES voceros(id),        -- envío único
  urbanismo_id UUID NOT NULL REFERENCES urbanismos(id),

  -- Datos declarados por el vocero sobre el urbanismo (campos del cuestionario)
  tipo_construccion tipo_construccion_enum NOT NULL,
  organizacion_territorial organizacion_territorial_enum,        -- solo si tipo != multifamiliar
  numero_torres_declarado INT,                                   -- total que el vocero conoce (multifamiliar)
  numero_viviendas_total_declarado INT,                          -- total que el vocero conoce
  numero_cmg_a_conformar INT,

  -- Alcance que cubrió este vocero (se replica desde voceros para que la encuesta sea autosuficiente)
  alcance_tipo alcance_tipo_enum NOT NULL,
  alcance_nombre TEXT,

  -- Metadata de envío (para auditoría y debug)
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_origen INET,
  user_agent TEXT,

  -- Revisión de calidad (fase 2)
  estado_revision estado_revision_enum NOT NULL DEFAULT 'enviado',
  notas_revision TEXT,
  validado_por UUID,
  fecha_validacion TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Coherencia: organización territorial solo aplica si no es multifamiliar
  CONSTRAINT chk_tipo_organizacion CHECK (
    (tipo_construccion = 'multifamiliar' AND organizacion_territorial IS NULL)
    OR (tipo_construccion <> 'multifamiliar' AND organizacion_territorial IS NOT NULL)
  )
);
CREATE INDEX idx_encuestas_urbanismo ON encuestas(urbanismo_id);
CREATE INDEX idx_encuestas_fecha ON encuestas(fecha_envio);
CREATE INDEX idx_encuestas_estado_revision ON encuestas(estado_revision);

-- ============= DETALLE POR UNIDAD (torre o sección) =============
-- Lista de torres o secciones que el vocero reportó en su encuesta.
-- - Vocero cubre 1 torre/sección  -> 1 fila aquí.
-- - Vocero cubre el urbanismo completo (multifamiliar) -> N filas (una por cada torre del urbanismo).
-- - Nomenclatura libre: 'A', '1', 'Este', 'Manzana 3', etc. — varía por urbanismo.
CREATE TABLE encuesta_unidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  encuesta_id UUID NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  nombre_unidad TEXT NOT NULL,                                  -- 'Torre A', '1', 'Manzana 3', ...
  numero_viviendas INT NOT NULL CHECK (numero_viviendas >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (encuesta_id, nombre_unidad)
);
CREATE INDEX idx_encuesta_unidades_encuesta ON encuesta_unidades(encuesta_id);

-- ============= AUDITORÍA INMUTABLE =============
-- Solo INSERT; nunca se actualiza ni se borra.
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id UUID NOT NULL,
  accion TEXT NOT NULL,                       -- 'INSERT' o 'UPDATE'
  usuario_id UUID,                            -- auth.uid() si la acción la hizo un admin autenticado
  vocero_id UUID,                             -- si la acción fue de un vocero (vía el endpoint)
  ip_origen INET,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  valores_despues JSONB
);
CREATE INDEX idx_audit_tabla_registro ON audit_log(tabla, registro_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

-- ============= TRIGGERS DE AUDITORÍA =============

CREATE OR REPLACE FUNCTION fn_audit_encuestas() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (tabla, registro_id, accion, vocero_id, valores_despues)
  VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NEW.vocero_id, to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_encuestas
  AFTER INSERT OR UPDATE ON encuestas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_encuestas();

CREATE OR REPLACE FUNCTION fn_audit_generico() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (tabla, registro_id, accion, usuario_id, valores_despues)
  VALUES (TG_TABLE_NAME, NEW.id, TG_OP, auth.uid(), to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_voceros
  AFTER UPDATE ON voceros
  FOR EACH ROW EXECUTE FUNCTION fn_audit_generico();

CREATE TRIGGER audit_urbanismos
  AFTER INSERT OR UPDATE ON urbanismos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_generico();

-- ============= ROW LEVEL SECURITY =============
-- Modelo de seguridad:
-- * Los VOCEROS no acceden a Supabase directamente. Pasan por un endpoint de Next.js
--   que valida (cédula + código) y usa la service_role key en el servidor para insertar.
--   Por eso las tablas sensibles (voceros, encuestas, urbanismos, audit_log) tienen RLS activo
--   y NO tienen políticas para el rol anon: desde el cliente no se ve nada.
-- * Los ADMINS (fase 2) usarán Supabase Auth con email/contraseña. Sus políticas se agregarán
--   cuando se construya la interfaz de revisión de calidad.
-- * El catálogo geográfico (estados, municipios, parroquias) tiene lectura abierta porque
--   el formulario público necesita cargar los selectores.

ALTER TABLE estados            ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE parroquias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE urbanismos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE voceros            ENABLE ROW LEVEL SECURITY;
ALTER TABLE encuestas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE encuesta_unidades  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;

-- Catálogo geográfico: lectura abierta (anon y auth).
CREATE POLICY estados_lectura    ON estados    FOR SELECT USING (TRUE);
CREATE POLICY municipios_lectura ON municipios FOR SELECT USING (TRUE);
CREATE POLICY parroquias_lectura ON parroquias FOR SELECT USING (TRUE);

-- Resto de tablas: SIN políticas para anon -> acceso bloqueado desde el cliente.
-- (Las operaciones reales viajan por la service_role key en el servidor de Next.js.)
-- Las políticas para admins se añadirán en la fase 2.

-- ============= DATOS DE PRUEBA (descomentar para tener un entorno de prueba inmediato) =============
-- INSERT INTO estados (nombre, codigo) VALUES ('Distrito Capital','DC');
-- INSERT INTO municipios (estado_id, nombre) VALUES (1, 'Libertador');
-- INSERT INTO parroquias (municipio_id, nombre) VALUES (1, 'El Valle');
-- (Urbanismos y voceros se cargan desde la Excel de la GMVV en el Paso 4.)

-- =====================================================================
-- FIN DEL ESQUEMA
-- =====================================================================
