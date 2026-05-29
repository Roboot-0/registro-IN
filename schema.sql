-- =====================================================================
-- REGISTRO DE HABITANTES — GRAN MISIÓN VIVIENDA VENEZUELA
-- Esquema de base de datos para PostgreSQL / Supabase
-- Versión MVP · Mayo 2026
-- Optimizado para: 1M viviendas, 5M personas, miles de voceros
-- =====================================================================

-- ============= EXTENSIONES =============
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============= CATÁLOGOS (ENUMS) =============
CREATE TYPE genero_enum AS ENUM ('masculino','femenino','otro','prefiere_no_decir');
CREATE TYPE parentesco_enum AS ENUM ('jefe_hogar','conyuge','hijo','padre_madre','hermano','abuelo','nieto','otro_familiar','no_familiar');
CREATE TYPE nivel_educativo_enum AS ENUM ('ninguno','preescolar','primaria_incompleta','primaria_completa','secundaria_incompleta','secundaria_completa','tecnico','universitario_incompleto','universitario_completo','postgrado');
CREATE TYPE tenencia_enum AS ENUM ('propia_pagada','propia_pagando','cedida','otra');
CREATE TYPE estado_formulario_enum AS ENUM ('completado','sincronizado','validado','rechazado','auditado');
CREATE TYPE rol_usuario_enum AS ENUM ('vocero','supervisor_edificio','coordinador_urbanismo','analista','admin_nacional');

-- ============= GEOGRAFÍA (jerárquica) =============
CREATE TABLE estados (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  codigo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE municipios (
  id SERIAL PRIMARY KEY,
  estado_id INT REFERENCES estados(id),
  nombre TEXT NOT NULL,
  UNIQUE(estado_id, nombre)
);

CREATE TABLE parroquias (
  id SERIAL PRIMARY KEY,
  municipio_id INT REFERENCES municipios(id),
  nombre TEXT NOT NULL,
  UNIQUE(municipio_id, nombre)
);

CREATE TABLE urbanismos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parroquia_id INT REFERENCES parroquias(id),
  nombre TEXT NOT NULL,
  codigo_gmvv TEXT UNIQUE,
  fecha_entrega DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE edificios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  urbanismo_id UUID REFERENCES urbanismos(id),
  codigo TEXT NOT NULL,
  num_pisos INT,
  total_apartamentos INT,
  direccion_referencia TEXT,
  UNIQUE(urbanismo_id, codigo)
);

CREATE TABLE apartamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edificio_id UUID REFERENCES edificios(id),
  torre TEXT,
  piso INT,
  numero TEXT NOT NULL,
  censado BOOLEAN DEFAULT FALSE,
  UNIQUE(edificio_id, torre, numero)
);

-- ============= USUARIOS =============
-- Extiende auth.users de Supabase
CREATE TABLE perfiles_usuario (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cedula TEXT UNIQUE NOT NULL,
  nombre_completo TEXT NOT NULL,
  telefono TEXT,
  rol rol_usuario_enum NOT NULL DEFAULT 'vocero',
  activo BOOLEAN DEFAULT TRUE,
  primer_ingreso BOOLEAN DEFAULT TRUE,
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asignación geográfica de cada usuario
CREATE TABLE asignaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES perfiles_usuario(id),
  nivel TEXT NOT NULL,          -- 'edificio','urbanismo','parroquia','municipio','estado','nacional'
  referencia_id UUID,           -- UUID del nivel correspondiente (NULL si nivel='nacional')
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_asignaciones_usuario ON asignaciones(usuario_id) WHERE activa = TRUE;

-- ============= FORMULARIOS (núcleo) =============
CREATE TABLE formularios_vivienda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- IDEMPOTENCIA: id generado en el cliente. Evita duplicados en reintentos de sync.
  id_local UUID UNIQUE NOT NULL,

  apartamento_id UUID REFERENCES apartamentos(id),
  vocero_id UUID REFERENCES perfiles_usuario(id),

  -- Metadata de captura
  fecha_captura TIMESTAMPTZ NOT NULL,
  fecha_sincronizacion TIMESTAMPTZ DEFAULT NOW(),
  gps_lat DOUBLE PRECISION,
  gps_lon DOUBLE PRECISION,
  gps_precision_m FLOAT,
  duracion_captura_segundos INT,
  app_version TEXT,

  -- Control de calidad
  estado estado_formulario_enum DEFAULT 'sincronizado',
  validado_por UUID REFERENCES perfiles_usuario(id),
  fecha_validacion TIMESTAMPTZ,

  -- Consentimiento (obligatorio)
  consentimiento_otorgado BOOLEAN NOT NULL,

  -- Vivienda
  tenencia tenencia_enum,
  num_habitaciones INT,
  num_banos INT,
  tiene_agua BOOLEAN,
  frecuencia_agua TEXT,
  tiene_electricidad BOOLEAN,
  frecuencia_fallas_electricas TEXT,
  forma_cocinar TEXT,
  tiene_internet BOOLEAN,
  tipo_internet TEXT,
  condicion_estructural TEXT,
  observaciones_estructurales TEXT,

  -- Hogar
  num_hogares INT DEFAULT 1,
  num_personas_total INT,
  personas_migraron INT DEFAULT 0,

  -- Programas sociales
  recibe_clap BOOLEAN,
  miembros_carnet_patria INT DEFAULT 0,
  pensionados_en_hogar INT DEFAULT 0,

  -- Necesidades (opcional)
  necesidades_prioritarias TEXT[],
  observaciones_vocero TEXT,

  -- Datos de contacto del jefe de familia (preparación capa bidireccional)
  contacto_telefono TEXT,
  contacto_email TEXT,
  consentimiento_contacto BOOLEAN DEFAULT FALSE,
  canal_preferencia TEXT,       -- 'whatsapp','correo','ambos'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_form_vocero ON formularios_vivienda(vocero_id);
CREATE INDEX idx_form_estado ON formularios_vivienda(estado);
CREATE INDEX idx_form_apartamento ON formularios_vivienda(apartamento_id);
CREATE INDEX idx_form_fecha ON formularios_vivienda(fecha_captura);

-- ============= PERSONAS (1..N por formulario) =============
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formulario_id UUID REFERENCES formularios_vivienda(id) ON DELETE CASCADE,

  -- Identificación (según decisión de la autoridad: nominal u opcional)
  nombre_completo TEXT,
  cedula TEXT,

  -- Demográfico
  edad INT,
  genero genero_enum,
  parentesco parentesco_enum,
  nacionalidad TEXT,

  -- Educación
  nivel_educativo nivel_educativo_enum,
  asiste_centro_educativo BOOLEAN,
  tipo_institucion TEXT,

  -- Trabajo
  situacion_laboral TEXT,

  -- Salud (agregado, no diagnóstico)
  tiene_condicion_cronica BOOLEAN,
  requiere_atencion_especial BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_personas_formulario ON personas(formulario_id);
CREATE INDEX idx_personas_edad ON personas(edad);

-- ============= ARCHIVOS (fotos / firmas) =============
CREATE TABLE archivos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formulario_id UUID REFERENCES formularios_vivienda(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,           -- 'foto_fachada','firma_consentimiento'
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_archivos_formulario ON archivos(formulario_id);

-- ============= AUDITORÍA INMUTABLE =============
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id UUID NOT NULL,
  accion TEXT NOT NULL,         -- 'INSERT','UPDATE','DELETE'
  usuario_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  valores_despues JSONB
);
CREATE INDEX idx_audit_tabla_registro ON audit_log(tabla, registro_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

-- ============= FUNCIÓN Y TRIGGER DE AUDITORÍA =============
CREATE OR REPLACE FUNCTION fn_audit() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(tabla, registro_id, accion, usuario_id, valores_despues)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(tabla, registro_id, accion, usuario_id, valores_despues)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_formularios
  AFTER INSERT OR UPDATE ON formularios_vivienda
  FOR EACH ROW EXECUTE FUNCTION fn_audit();

-- ============= ROW LEVEL SECURITY =============
ALTER TABLE formularios_vivienda ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_usuario ENABLE ROW LEVEL SECURITY;

-- Un vocero solo ve/escribe formularios de su edificio asignado.
-- Un admin_nacional ve todo.
CREATE POLICY vocero_formularios ON formularios_vivienda
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM asignaciones a
      JOIN apartamentos ap ON ap.id = formularios_vivienda.apartamento_id
      WHERE a.usuario_id = auth.uid()
        AND a.activa = TRUE
        AND (
          (a.nivel = 'edificio' AND a.referencia_id = ap.edificio_id) OR
          (a.nivel = 'nacional')
        )
    )
  );

-- Personas: heredan el acceso del formulario padre
CREATE POLICY vocero_personas ON personas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM formularios_vivienda f
      WHERE f.id = personas.formulario_id
    )
  );

-- Cada usuario puede leer su propio perfil
CREATE POLICY usuario_propio_perfil ON perfiles_usuario
  FOR SELECT
  USING (id = auth.uid());

-- Apartamentos: visibles para quien tenga asignación sobre su edificio
CREATE POLICY vocero_apartamentos ON apartamentos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM asignaciones a
      WHERE a.usuario_id = auth.uid()
        AND a.activa = TRUE
        AND (
          (a.nivel = 'edificio' AND a.referencia_id = apartamentos.edificio_id) OR
          (a.nivel = 'nacional')
        )
    )
  );

-- ============= DATOS DE PRUEBA (para el MVP) =============
-- Descomentar y ejecutar para tener un entorno de prueba inmediato.

-- INSERT INTO estados (nombre, codigo) VALUES ('Distrito Capital','DC');
-- INSERT INTO municipios (estado_id, nombre) VALUES (1, 'Libertador');
-- INSERT INTO parroquias (municipio_id, nombre) VALUES (1, 'El Valle');
-- INSERT INTO urbanismos (parroquia_id, nombre, codigo_gmvv)
--   VALUES (1, 'Urbanismo Ciudad Tiuna', 'GMVV-DC-001');
-- (continuar con edificio, apartamentos y vocero de prueba según necesidad)

-- =====================================================================
-- FIN DEL ESQUEMA
-- =====================================================================
