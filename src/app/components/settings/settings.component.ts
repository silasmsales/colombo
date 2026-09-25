import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, SupabaseConfig } from '../../services/supabase.service';
import { AudioFeedbackService } from '../../services/audio.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-view animate-fade">
      
      <div class="card hero-settings">
        <h2 class="hero-title">Configurações & Banco de Dados</h2>
        <p class="hero-desc">Conecte sua instância do <strong>Supabase</strong> para sincronizar os dados de pesagem em tempo real na nuvem.</p>
      </div>

      <!-- Status da Conexão Atual -->
      <div class="card">
        <h3 class="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="title-icon">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
          </svg>
          Status da Conexão Supabase
        </h3>

        <div class="status-banner" [class.connected]="supabase.isConnected()">
          <div class="sb-indicator">
            <span class="sb-dot"></span>
            <strong>{{ supabase.isConnected() ? 'Conexão Supabase Estabelecida' : 'Modo Offline / LocalStorage Ativo' }}</strong>
          </div>
          <p class="sb-msg">{{ supabase.connectionMessage() }}</p>
        </div>

        <button type="button" class="btn btn-secondary btn-block mt-2" (click)="testConnection()" [disabled]="isTesting()">
          <span *ngIf="!isTesting()">⚡ Testar Conexão Agora</span>
          <span *ngIf="isTesting()">Testando comunicação com Supabase...</span>
        </button>
      </div>

      <!-- Credenciais Supabase -->
      <div class="card">
        <h3 class="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="title-icon">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Credenciais do Projeto Supabase
        </h3>

        <form (ngSubmit)="saveConfig()">
          <div class="form-group">
            <label class="form-label">Project URL (Supabase URL)</label>
            <input 
              type="url" 
              class="form-control" 
              placeholder="https://seu-projeto.supabase.co" 
              [(ngModel)]="config.url" 
              name="url" 
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Anon / Public API Key</label>
            <textarea 
              class="form-control" 
              rows="3" 
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
              [(ngModel)]="config.key" 
              name="key" 
              required
            ></textarea>
          </div>

          <div class="actions-row">
            <button type="submit" class="btn btn-primary flex-1">
              💾 Salvar Credenciais
            </button>
            <button type="button" class="btn btn-secondary" (click)="restoreDefaults()">
              Restaurar Padrão
            </button>
          </div>
        </form>
      </div>

      <!-- Script SQL Pronto para o Supabase SQL Editor -->
      <div class="card">
        <div class="card-header-row">
          <h3 class="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="title-icon">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            Estrutura SQL do Supabase
          </h3>
          <button type="button" class="btn-text" (click)="copySqlScript()">
            {{ copiedSql ? '✓ Copiado!' : '📋 Copiar SQL' }}
          </button>
        </div>
        <p class="sql-hint">Copie e cole este script no <strong>SQL Editor</strong> do seu painel Supabase para criar as tabelas 'sellers', 'weighing_sessions' e 'weighing_items' automaticamente com políticas de segurança.</p>
        
        <pre class="sql-code-box"><code>{{ sqlScript }}</code></pre>
      </div>

      <!-- Gerenciamento de Armazenamento Local -->
      <div class="card">
        <h3 class="card-title">Armazenamento Local & Cache</h3>
        <p class="text-muted text-sm mb-3">
          O aplicativo salva automaticamente todas as pesagens no dispositivo para que você possa utilizá-lo mesmo sem sinal de internet no curral.
        </p>
        <button type="button" class="btn btn-danger btn-block" (click)="resetLocalData()">
          🗑️ Restaurar Dados de Demonstração
        </button>
      </div>

    </div>
  `,
  styles: [`
    .settings-view {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .hero-settings {
      background: linear-gradient(135deg, rgba(5, 150, 105, 0.2) 0%, rgba(19, 29, 49, 0.95) 100%);
      border: 1px solid rgba(5, 150, 105, 0.3);
    }

    .hero-title {
      font-size: 1.35rem;
      margin-bottom: 0.25rem;
    }

    .hero-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .title-icon {
      width: 20px;
      height: 20px;
      color: #34d399;
    }

    .status-banner {
      background: var(--warning-bg);
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 0.85rem;
      border-radius: var(--radius-md);
      margin-bottom: 0.5rem;
    }

    .status-banner.connected {
      background: var(--success-bg);
      border-color: rgba(16, 185, 129, 0.4);
    }

    .sb-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
      margin-bottom: 0.25rem;
      color: #fbbf24;
    }

    .status-banner.connected .sb-indicator {
      color: #34d399;
    }

    .sb-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    .sb-msg {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .actions-row {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.85rem;
    }

    .card-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .btn-text {
      background: none;
      border: none;
      color: #34d399;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .sql-hint {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }

    .sql-code-box {
      background: var(--bg-page);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.85rem;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: #34d399;
      max-height: 220px;
      overflow-y: auto;
      white-space: pre;
    }

    .text-sm {
      font-size: 0.85rem;
    }

    .mb-3 {
      margin-bottom: 0.85rem;
    }

    .mt-2 {
      margin-top: 0.5rem;
    }
  `]
})
export class SettingsComponent implements OnInit {
  supabase = inject(SupabaseService);
  audio = inject(AudioFeedbackService);

  config: SupabaseConfig = { url: '', key: '' };
  isTesting = signal<boolean>(false);
  copiedSql = false;

  sqlScript = `-- Script de Criação das Tabelas Colombo Agro no Supabase:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- RLS
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weighing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weighing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sellers_all" ON public.sellers FOR ALL USING (true);
CREATE POLICY "sessions_all" ON public.weighing_sessions FOR ALL USING (true);
CREATE POLICY "items_all" ON public.weighing_items FOR ALL USING (true);`;

  ngOnInit() {
    this.config = { ...this.supabase.currentConfig() };
  }

  async testConnection() {
    this.audio.playClick();
    this.isTesting.set(true);
    await this.supabase.testConnection();
    this.isTesting.set(false);
  }

  saveConfig() {
    this.audio.playClick();
    this.supabase.saveConfig(this.config);
    this.testConnection();
  }

  restoreDefaults() {
    this.audio.playClick();
    localStorage.removeItem('colombo_supabase_config');
    this.config = { ...this.supabase.loadConfig() };
    this.supabase.initializeClient();
  }

  copySqlScript() {
    this.audio.playClick();
    navigator.clipboard.writeText(this.sqlScript);
    this.copiedSql = true;
    setTimeout(() => {
      this.copiedSql = false;
    }, 3000);
  }

  resetLocalData() {
    if (confirm('Deseja restaurar os dados de demonstração da Fazenda Santa Maria e Estância Boi Gordo?')) {
      this.audio.playDelete();
      localStorage.removeItem('colombo_local_sellers');
      localStorage.removeItem('colombo_local_sessions');
      window.location.reload();
    }
  }
}
