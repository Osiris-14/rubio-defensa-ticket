-- =====================================================
-- EL RUBIO DEFENSA TICKET - Supabase Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (user roles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('recepcion','produccion','pintura','instalacion','marquilla','admin')),
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets Recepción
CREATE TABLE IF NOT EXISTS tickets_recepcion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  numero_factura TEXT NOT NULL,
  numero_orden TEXT NOT NULL,
  fecha DATE,
  hora_entrega TIME,
  entregado_por TEXT,
  modelo TEXT NOT NULL,
  tipo_modelo TEXT,
  nivel_gasolina TEXT,
  micas_rotas TEXT,
  cristales_rotos TEXT,
  calidad_luces TEXT,
  pertenencias_personales TEXT,
  rayaduras TEXT,
  fotos_urls JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets Producción
CREATE TABLE IF NOT EXISTS tickets_produccion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  numero_factura TEXT NOT NULL,
  numero_orden TEXT NOT NULL,
  a_cargo_de TEXT,
  fecha_entrega DATE,
  modelo TEXT NOT NULL,
  tipo_modelo TEXT,
  re_trabajo TEXT,
  piezas TEXT[] DEFAULT '{}',
  fecha_compromiso DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets Pintura
CREATE TABLE IF NOT EXISTS tickets_pintura (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  numero_factura TEXT NOT NULL,
  numero_orden TEXT NOT NULL,
  a_cargo_de TEXT,
  fecha_entrega DATE,
  modelo TEXT NOT NULL,
  tipo_modelo TEXT,
  re_trabajo TEXT,
  piezas TEXT[] DEFAULT '{}',
  fecha_compromiso DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets Instalación
CREATE TABLE IF NOT EXISTS tickets_instalacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  numero_factura TEXT NOT NULL,
  numero_orden TEXT NOT NULL,
  a_cargo_de TEXT,
  fecha_entrega DATE,
  modelo TEXT NOT NULL,
  tipo_modelo TEXT,
  re_trabajo TEXT,
  piezas TEXT[] DEFAULT '{}',
  fecha_compromiso DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marquilla
CREATE TABLE IF NOT EXISTS tickets_marquilla (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  numero_factura TEXT NOT NULL,
  numero_orden TEXT NOT NULL,
  fecha_entrega DATE,
  modelo TEXT NOT NULL,
  tipo_modelo TEXT,
  piezas TEXT[] DEFAULT '{}',
  color TEXT,
  requerimiento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_recepcion_created ON tickets_recepcion(created_at DESC);
CREATE INDEX idx_produccion_created ON tickets_produccion(created_at DESC);
CREATE INDEX idx_pintura_created ON tickets_pintura(created_at DESC);
CREATE INDEX idx_instalacion_created ON tickets_instalacion(created_at DESC);
CREATE INDEX idx_marquilla_created ON tickets_marquilla(created_at DESC);
CREATE INDEX idx_recepcion_factura ON tickets_recepcion(numero_factura);

-- Row Level Security
ALTER TABLE tickets_recepcion ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_pintura ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_instalacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_marquilla ENABLE ROW LEVEL SECURITY;

-- Policies: users can see their own + admin sees all
CREATE POLICY "Users see own or admin" ON tickets_recepcion
  FOR ALL USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- (Repeat similar policies for other tables)

-- Demo users (passwords are set through Supabase Auth)
-- After creating users in Supabase Auth, run:
-- INSERT INTO profiles (user_id, name, role, username) VALUES 
--   ('<user_id>', 'Carlos Martínez', 'recepcion', 'recepcion'),
--   ('<user_id>', 'Luis García', 'produccion', 'produccion'),
--   ('<user_id>', 'Pedro Rodríguez', 'pintura', 'pintura'),
--   ('<user_id>', 'Juan Torres', 'instalacion', 'instalacion'),
--   ('<user_id>', 'Ana López', 'marquilla', 'marquilla'),
--   ('<user_id>', 'Administrador', 'admin', 'admin');

