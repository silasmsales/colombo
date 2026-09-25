-- ==========================================================
-- COLOMBO AGRO - SISTEMA DE PESAGEM DE GADO
-- Script de Criação das Tabelas no Supabase
-- ==========================================================

-- 1. Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Limpar tabelas caso já existam (Ordem correta para respeitar chaves estrangeiras)
DROP TABLE IF EXISTS public.weighing_items CASCADE;
DROP TABLE IF EXISTS public.weighing_sessions CASCADE;
DROP TABLE IF EXISTS public.sellers CASCADE;

-- 3. Tabela de Vendedores / Fazendas
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_name TEXT NOT NULL,
    responsible_name TEXT NOT NULL,
    location TEXT NOT NULL,
    phone TEXT,
    state_registration TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Sessões de Pesagem (Romaneios)
CREATE TABLE IF NOT EXISTS public.weighing_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
    farm_name TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    location TEXT NOT NULL,
    responsible_name TEXT NOT NULL,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    observations TEXT,
    total_animals INTEGER NOT NULL DEFAULT 0,
    total_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    avg_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_arrobas NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed', -- 'draft', 'completed', 'verified'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Itens de Pesagem (Cada pesagem individual / lote na balança)
CREATE TABLE IF NOT EXISTS public.weighing_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.weighing_sessions(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    animal_count INTEGER NOT NULL DEFAULT 1,
    weight_kg NUMERIC(10, 2) NOT NULL,
    avg_weight_kg NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_sessions_seller ON public.weighing_sessions(seller_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.weighing_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_items_session ON public.weighing_items(session_id);

-- 7. Configuração de Row Level Security (RLS)
-- Para facilitar o acesso direto na fazenda, permitimos leitura, inserção, atualização e exclusão públicas:
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weighing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weighing_items ENABLE ROW LEVEL SECURITY;

-- Políticas para Sellers (Vendedores / Fazendas)
DROP POLICY IF EXISTS "Permitir leitura pública de vendedores" ON public.sellers;
DROP POLICY IF EXISTS "Permitir inserção pública de vendedores" ON public.sellers;
DROP POLICY IF EXISTS "Permitir atualização pública de vendedores" ON public.sellers;
DROP POLICY IF EXISTS "Permitir exclusão pública de vendedores" ON public.sellers;

CREATE POLICY "Permitir leitura pública de vendedores" ON public.sellers FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de vendedores" ON public.sellers FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública de vendedores" ON public.sellers FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública de vendedores" ON public.sellers FOR DELETE USING (true);

-- Políticas para Weighing Sessions (Romaneios de Pesagem)
DROP POLICY IF EXISTS "Permitir leitura pública de sessões" ON public.weighing_sessions;
DROP POLICY IF EXISTS "Permitir inserção pública de sessões" ON public.weighing_sessions;
DROP POLICY IF EXISTS "Permitir atualização pública de sessões" ON public.weighing_sessions;
DROP POLICY IF EXISTS "Permitir exclusão pública de sessões" ON public.weighing_sessions;

CREATE POLICY "Permitir leitura pública de sessões" ON public.weighing_sessions FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de sessões" ON public.weighing_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública de sessões" ON public.weighing_sessions FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública de sessões" ON public.weighing_sessions FOR DELETE USING (true);

-- Políticas para Weighing Items (Balançadas Individuais)
DROP POLICY IF EXISTS "Permitir leitura pública de itens" ON public.weighing_items;
DROP POLICY IF EXISTS "Permitir inserção pública de itens" ON public.weighing_items;
DROP POLICY IF EXISTS "Permitir atualização pública de itens" ON public.weighing_items;
DROP POLICY IF EXISTS "Permitir exclusão pública de itens" ON public.weighing_items;

CREATE POLICY "Permitir leitura pública de itens" ON public.weighing_items FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de itens" ON public.weighing_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública de itens" ON public.weighing_items FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública de itens" ON public.weighing_items FOR DELETE USING (true);
