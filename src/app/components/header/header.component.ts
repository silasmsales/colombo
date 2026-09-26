import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AudioFeedbackService } from '../../services/audio.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="app-header">
      <div class="header-container">
        <!-- Logo e Título Colombo Agro -->
        <div class="brand-link">
          <img src="colombo_logo.png" alt="Colombo Agro Logo" class="brand-logo" onerror="this.style.display='none'" />
          <div class="brand-titles">
            <span class="brand-main">COLOMBO AGRO</span>
            <span class="brand-sub">PESAGEM DE GADO</span>
          </div>
        </div>

        <!-- Ações do Cabeçalho e Indicador de Conexão/Sincronização -->
        <div class="header-actions">
          <!-- Indicador de Status da Nuvem / Sincronização -->
          <button 
            type="button" 
            class="sync-indicator-btn"
            [class.syncing]="supabase.isSyncing()"
            [class.pending]="isSellerRoute() && supabase.pendingSyncCount() > 0 && !supabase.isSyncing()"
            [class.online]="supabase.isConnected() && (!isSellerRoute() || supabase.pendingSyncCount() === 0)"
            [class.offline]="!supabase.isConnected() && !supabase.isOnline()"
            (click)="triggerManualSync()"
            [title]="getSyncTooltip()"
          >
            <!-- Ícone Girando se estiver sincronizando -->
            <span *ngIf="supabase.isSyncing()" class="sync-spinner">🔄</span>
            
            <!-- Ponto Verde se Conectado e sem pendências -->
            <span *ngIf="!supabase.isSyncing() && supabase.isConnected() && (!isSellerRoute() || supabase.pendingSyncCount() === 0)" class="status-dot green"></span>
            
            <!-- Ponto Laranja se houver pendências no vendedor -->
            <span *ngIf="!supabase.isSyncing() && isSellerRoute() && supabase.pendingSyncCount() > 0" class="status-dot orange"></span>
            
            <!-- Ponto Cinza se offline -->
            <span *ngIf="!supabase.isSyncing() && !supabase.isConnected() && (!isSellerRoute() || supabase.pendingSyncCount() === 0)" class="status-dot gray"></span>

            <span class="sync-text">
              {{ getSyncLabel() }}
            </span>
          </button>

          <!-- Toggle Modo Sol Forte / Alto Contraste para Curral -->
          <button 
            type="button" 
            class="icon-button" 
            [class.active]="isSunlightMode"
            (click)="toggleSunlightMode()"
            title="Alternar Modo Sol Forte (Alto Contraste)"
          >
            <svg *ngIf="!isSunlightMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg *ngIf="isSunlightMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background: var(--bg-surface-glass);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 90;
      padding: 0.65rem 1.25rem;
    }

    .header-container {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .brand-link {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      user-select: none;
    }

    .brand-logo {
      height: 38px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }

    .brand-titles {
      display: flex;
      flex-direction: column;
    }

    .brand-main {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.1rem;
      letter-spacing: -0.01em;
      color: #34d399;
      line-height: 1.1;
    }

    .brand-sub {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--accent-light);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Indicador de Sincronização / Nuvem */
    .sync-indicator-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      font-weight: 700;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .sync-indicator-btn:hover {
      background: var(--bg-surface);
      border-color: var(--border-focus);
    }

    .sync-indicator-btn.online {
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.1);
      color: #34d399;
    }

    .sync-indicator-btn.pending {
      border-color: rgba(245, 158, 11, 0.4);
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
    }

    .sync-indicator-btn.syncing {
      border-color: rgba(59, 130, 246, 0.4);
      background: rgba(59, 130, 246, 0.15);
      color: #93c5fd;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .status-dot.green {
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }

    .status-dot.orange {
      background: #f59e0b;
      box-shadow: 0 0 6px #f59e0b;
      animation: pulse 1.5s infinite;
    }

    .status-dot.gray {
      background: #64748b;
    }

    .sync-spinner {
      display: inline-block;
      animation: spin 1s linear infinite;
      font-size: 0.8rem;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    .icon-button {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: var(--radius-md);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .icon-button svg {
      width: 18px;
      height: 18px;
    }

    .icon-button.active, .icon-button:hover {
      color: #fbbf24;
      border-color: #f59e0b;
    }

    @media (max-width: 520px) {
      .sync-text {
        display: none;
      }
      .sync-indicator-btn {
        padding: 0.45rem 0.55rem;
      }
    }
  `]
})
export class HeaderComponent {
  supabase = inject(SupabaseService);
  audio = inject(AudioFeedbackService);
  router = inject(Router);
  isSunlightMode = false;

  isSellerRoute(): boolean {
    return !this.router.url.includes('/comprador');
  }

  getSyncLabel(): string {
    if (!this.isSellerRoute()) {
      if (this.supabase.isConnected()) {
        return 'Nuvem Online';
      }
      return 'Nuvem Offline';
    }

    if (this.supabase.isSyncing()) {
      return 'Sincronizando...';
    }
    const pending = this.supabase.pendingSyncCount();
    if (pending > 0) {
      return `${pending} pendente${pending > 1 ? 's' : ''}`;
    }
    if (this.supabase.isConnected()) {
      return 'Nuvem Conectada';
    }
    if (!this.supabase.isOnline()) {
      return 'Modo Offline';
    }
    return 'Nuvem Desconectada';
  }

  getSyncTooltip(): string {
    if (!this.isSellerRoute()) {
      return this.supabase.isConnected()
        ? 'Painel Administrativo conectado em tempo real com o banco de dados na nuvem.'
        : 'Painel Administrativo sem conexão com o servidor.';
    }

    if (this.supabase.isSyncing()) {
      return 'Sincronizando pesagens com o banco de dados em segundo plano...';
    }
    const pending = this.supabase.pendingSyncCount();
    if (pending > 0) {
      return `Existem ${pending} pesagem(ns) salva(s) no aparelho aguardando envio. Clique para sincronizar agora.`;
    }
    if (this.supabase.isConnected()) {
      return 'Banco de dados Supabase conectado e sincronizado.';
    }
    return 'Operando no modo local/offline. Clique para tentar conectar.';
  }

  async triggerManualSync() {
    this.audio.playClick();
    if (this.isSellerRoute()) {
      await this.supabase.syncPendingSessions();
    } else {
      await this.supabase.testConnection();
    }
  }

  toggleSunlightMode() {
    this.audio.playClick();
    this.isSunlightMode = !this.isSunlightMode;
    if (this.isSunlightMode) {
      document.body.classList.add('sunlight-mode');
    } else {
      document.body.classList.remove('sunlight-mode');
    }
  }
}

