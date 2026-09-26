import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AudioFeedbackService } from '../../services/audio.service';
import { ExportService } from '../../services/export.service';
import { Seller } from '../../models/seller.model';
import { WeighingItem, WeighingSession } from '../../models/weighing.model';

@Component({
  selector: 'app-seller',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div id="seller-top" class="seller-wrapper animate-fade">
      
      <!-- Abas de Navegação no Topo: Nova Pesagem vs Pesagens Anteriores -->
      <div class="seller-mode-tabs">
        <button 
          type="button" 
          class="seller-tab-btn" 
          [class.active]="activeTab() === 'new'" 
          (click)="onNewPesagemTabClick()"
        >
          ➕ Nova Pesagem
        </button>
        <button 
          type="button" 
          class="seller-tab-btn" 
          [class.active]="activeTab() === 'history'" 
          [disabled]="isWeighingInProgress()"
          [title]="isWeighingInProgress() ? 'Conclua ou cancele a pesagem atual para acessar o histórico' : 'Ver pesagens anteriores'"
          (click)="switchTab('history')"
        >
          📂 Pesagens Anteriores ({{ pastSessions().length }})
        </button>
      </div>

      <!-- Banner de Sincronização Pendente -->
      <div class="pending-sync-banner animate-fade" *ngIf="supabase.pendingSyncCount() > 0">
        <div class="psb-info">
          <span class="psb-icon">⏳</span>
          <div class="psb-text">
            <strong class="psb-title">{{ supabase.pendingSyncCount() }} pesagem(ns) salva(s) no aparelho</strong>
            <span class="psb-sub">Aguardando envio para o banco de dados da Colombo Agro.</span>
          </div>
        </div>
        <button 
          type="button" 
          class="btn-psb-sync" 
          (click)="syncNow()" 
          [disabled]="supabase.isSyncing()"
        >
          <span *ngIf="!supabase.isSyncing()">📤 Enviar Agora</span>
          <span *ngIf="supabase.isSyncing()">Sincronizando...</span>
        </button>
      </div>

      <!-- ========================================== -->
      <!-- ABA: HISTÓRICO DE PESAGENS ANTERIORES     -->
      <!-- ========================================== -->
      <div *ngIf="activeTab() === 'history'" class="history-section animate-fade">

        <div *ngIf="pastSessions().length === 0" class="card empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-text">Nenhuma pesagem anterior registrada.</div>
          <p class="empty-sub">As pesagens concluídas na balança ficam salvas aqui para consulta, edição e exportação.</p>
          <button type="button" class="btn btn-primary" (click)="switchTab('new')">
            + Iniciar Primeira Pesagem
          </button>
        </div>

        <div *ngFor="let ps of pastSessions()" class="card session-history-card animate-fade">
          <div class="shc-header">
            <div>
              <div class="shc-farm">{{ ps.farm_name }}</div>
              <div class="shc-meta">📅 {{ ps.created_at ? (ps.created_at | date:'dd/MM/yyyy HH:mm') : ps.session_date }} • 👤 {{ ps.responsible_name }} • 📍 {{ ps.location }}</div>
              <div class="shc-updated" *ngIf="ps.updated_at && ps.updated_at !== ps.created_at" style="font-size: 0.8rem; color: var(--color-accent); font-weight: 600; margin-top: 3px;">
                ✏️ Atualizado: {{ ps.updated_at | date:'dd/MM/yyyy HH:mm' }}
              </div>
            </div>
            <div class="shc-badges">
              <!-- Status de Sincronização / Envio -->
              <span 
                class="badge-sync-pill"
                [class.synced]="ps.sync_status === 'synced'"
                [class.pending]="ps.sync_status !== 'synced'"
                [title]="ps.sync_status === 'synced' ? 'Pesagem transmitida e gravada na nuvem Colombo Agro' : 'Salva apenas no aparelho. Será enviada automaticamente ao reconectar.'"
              >
                {{ ps.sync_status === 'synced' ? '🟢 Enviado' : '🟡 No Aparelho' }}
              </span>
              <span class="badge badge-success">{{ ps.total_animals }} cab</span>
            </div>
          </div>

          <div class="shc-stats-row">
            <div class="shc-stat">
              <span class="shc-lbl">Peso Total:</span>
              <strong>{{ ps.total_weight_kg | number:'1.1-1' }} kg</strong>
            </div>
            <div class="shc-stat">
              <span class="shc-lbl">Média:</span>
              <strong class="text-accent">{{ ps.avg_weight_kg | number:'1.1-1' }} kg/cab</strong>
            </div>
            <div class="shc-stat" *ngIf="ps.items && ps.items.length > 0">
              <span class="shc-lbl">Balançadas:</span>
              <strong>{{ ps.items.length }}</strong>
            </div>
          </div>

          <div class="shc-obs" *ngIf="ps.observations">
            🏷️ <em>{{ ps.observations }}</em>
          </div>

          <div class="shc-actions">
            <button type="button" class="btn-action view" (click)="viewPastSession(ps)" title="Visualizar Balançadas">
              🔍 Ver
            </button>
            <button type="button" class="btn-action edit" (click)="editSession(ps)" title="Editar / Continuar Pesagem">
              ✏️ Editar
            </button>
            <button 
              *ngIf="ps.sync_status !== 'synced'" 
              type="button" 
              class="btn-action send" 
              (click)="syncSessionNow(ps)" 
              title="Enviar esta pesagem para a nuvem agora"
            >
              📤 Enviar
            </button>
            <button type="button" class="btn-action csv" (click)="exportPastSessionCsv(ps)" title="Baixar Planilha CSV">
              📥 CSV
            </button>
            <button type="button" class="btn-action zap" (click)="sharePastSessionWhatsApp(ps)" title="Compartilhar no WhatsApp">
              <svg class="whatsapp-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z"/>
              </svg>
              Zap
            </button>
            <button type="button" class="btn-action del" (click)="promptDeleteSession(ps)" title="Excluir Romaneio">
              🗑️ Excluir
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- ABA: FLUXO DE PESAGEM / CADASTRO                           -->
      <!-- ============================================================ -->
      <div *ngIf="activeTab() === 'new'" class="new-session-flow animate-fade">

        <!-- SOLUÇÃO 1: Stepper Visual de Etapas -->
        <div class="stepper">
          <button 
            type="button" 
            class="step-pill" 
            [class.active]="currentStep() === 1" 
            [class.completed]="currentStep() > 1" 
            (click)="goToStep(1)"
          >
            <span class="step-num">{{ currentStep() > 1 ? '✓' : '1' }}</span>
            <span class="step-label">Identificação</span>
          </button>
          <div class="step-line" [class.completed]="currentStep() > 1"></div>
          <button 
            type="button" 
            class="step-pill" 
            [class.active]="currentStep() === 2" 
            [class.completed]="currentStep() > 2" 
            (click)="goToStep(2)"
            [disabled]="!canGoToStep(2)"
          >
            <span class="step-num">{{ currentStep() > 2 ? '✓' : '2' }}</span>
            <span class="step-label">Balança Digital</span>
          </button>
          <div class="step-line" [class.completed]="currentStep() > 2"></div>
          <button 
            type="button" 
            class="step-pill" 
            [class.active]="currentStep() === 3" 
            [class.completed]="currentStep() > 3" 
            (click)="goToStep(3)"
            [disabled]="!canGoToStep(3)"
          >
            <span class="step-num">3</span>
            <span class="step-label">Fechamento</span>
          </button>
        </div>

        <!-- ============================================================ -->
        <!-- ETAPA 1: IDENTIFICAÇÃO DO PRODUTOR & FAZENDA                -->
        <!-- ============================================================ -->
        <div *ngIf="currentStep() === 1" class="step-content animate-fade">
          <div class="card header-hero">
            <div class="hero-tag">Venda Colombo Agro</div>
            <h2 class="hero-title">Identificação do Produtor & Fazenda</h2>
            <p class="hero-desc">Selecione ou cadastre a propriedade para iniciar o registro das pesagens na balança.</p>
          </div>

        <!-- Seção de Seleção Rápida de Vendedor Cadastrado -->
        <div *ngIf="sellers().length > 0 && !showNewSellerForm" class="card">
          <div class="card-header-row">
            <h3 class="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="title-icon">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Fazendas Cadastradas
            </h3>
            <button type="button" class="btn-text" (click)="toggleNewSeller(true)">
              + Nova Fazenda
            </button>
          </div>

          <div class="seller-list">
            <div 
              *ngFor="let s of sellers()" 
              class="seller-item"
              [class.selected]="selectedSeller?.id === s.id"
              (click)="selectSeller(s)"
            >
              <div class="seller-info">
                <div class="seller-farm">{{ s.farm_name }}</div>
                <div class="seller-meta">
                  <span>👤 {{ s.responsible_name }}</span> • 
                  <span>📍 {{ s.location }}</span>
                </div>
              </div>
              <div class="seller-item-actions">
                <button 
                  type="button" 
                  class="btn-del-farm" 
                  (click)="deleteSeller($event, s.id)" 
                  title="Remover esta fazenda"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
                <div class="seller-radio">
                  <div class="radio-circle" [class.checked]="selectedSeller?.id === s.id"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Formulário de Cadastro de Novo Produtor / Fazenda -->
        <div *ngIf="showNewSellerForm || sellers().length === 0" class="card">
          <div class="card-header-row">
            <h3 class="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="title-icon">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              Cadastrar Nova Fazenda / Produtor
            </h3>
            <button *ngIf="sellers().length > 0" type="button" class="btn-text" (click)="toggleNewSeller(false)">
              Cancelar
            </button>
          </div>

          <form (ngSubmit)="saveAndSelectSeller()">
            <div class="form-group">
              <label class="form-label">Nome da Fazenda / Propriedade *</label>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Ex: Fazenda Santa Maria" 
                [(ngModel)]="newSeller.farm_name" 
                name="farm_name" 
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Nome do Produtor / Vendedor *</label>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Ex: João Pereira de Souza" 
                [(ngModel)]="newSeller.responsible_name" 
                name="responsible_name" 
                required
              />
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">Localização (Cidade/UF) *</label>
                <input 
                  type="text" 
                  class="form-control" 
                  placeholder="Ex: Marabá-PA" 
                  [(ngModel)]="newSeller.location" 
                  name="location" 
                  required
                />
              </div>

              <div class="form-group flex-1">
                <label class="form-label">Telefone / WhatsApp</label>
                <input 
                  type="tel" 
                  class="form-control" 
                  placeholder="(94) 99999-9999" 
                  [(ngModel)]="newSeller.phone" 
                  name="phone"
                />
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block" [disabled]="!newSeller.farm_name || !newSeller.responsible_name || !newSeller.location">
              Salvar e Selecionar
            </button>
          </form>
        </div>

        <!-- Dados do Dia da Pesagem -->
        <div class="card">
          <h3 class="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="title-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Dados da Pesagem
          </h3>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Responsável pela Pesagem *</label>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Nome do operador da balança" 
                [(ngModel)]="sessionWeigher" 
                name="sessionWeigher" 
                required
              />
            </div>

            <div class="form-group flex-1">
              <label class="form-label">Data e Hora da Pesagem *</label>
              <input 
                type="datetime-local" 
                class="form-control" 
                [(ngModel)]="sessionDate" 
                name="sessionDate" 
                required
              />
            </div>
          </div>

          <div class="form-group mb-0">
            <label class="form-label">Observações do Lote (Opcional)</label>
            <textarea 
              class="form-control" 
              rows="3" 
              placeholder="Ex: Lote Nelore macho castrado, piquete 04..." 
              [(ngModel)]="sessionObservations" 
              name="sessionObservations"
            ></textarea>
          </div>
        </div>

        <!-- Botão de Avanço -->
        <div class="action-footer">
          <button 
            type="button" 
            class="btn btn-primary btn-lg btn-block"
            [disabled]="!selectedSeller || !sessionWeigher || !sessionDate"
            (click)="proceedToWeighing()"
          >
            Iniciar Pesagem na Balança ➔
          </button>
        </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- ETAPA 2: BALANÇA DIGITAL - FLUXO REAL DO CURRAL -->
      <!-- ============================================================ -->
      <div *ngIf="currentStep() === 2" id="scale-step-anchor" class="step-content animate-fade">
        
        <!-- Header Rápido da Sessão Ativa -->
        <div class="session-quick-bar">
          <div class="sq-info">
            <span class="sq-farm">📍 {{ selectedSeller?.farm_name }}</span>
            <span class="sq-meta">{{ sessionWeigher }} • {{ sessionDate | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>
          <button type="button" class="btn-sm-outline" (click)="goToStep(1)">Alterar</button>
        </div>

        <!-- Display da Balança Digital -->
        <div class="card scale-card">
          <div class="scale-header">
            <div class="scale-badge">
              <span class="pulse-dot"></span>
              BALANÇA DIGITAL
            </div>
            <div class="scale-seq">Balançada #{{ weighingItems().length + 1 }}</div>
          </div>

          <!-- Passo 1: Quantidade de animais na balança (Padrão: 1) -->
          <div class="animal-count-section">
            <div class="scale-instruction">
              <span class="step-badge">1</span>
              <label class="scale-label">ANIMAIS NA BALANÇA NESTA PESAGEM</label>
            </div>
            
            <!-- Botões Rápidos Táteis (Padrão 1 Animal) -->
            <div class="animal-pills">
              <button 
                type="button" 
                *ngFor="let qty of quickQuantities" 
                class="qty-pill" 
                [class.active]="currentAnimalCount === qty && !isCustomQty"
                (click)="setAnimalCount(qty)"
              >
                {{ qty === 1 ? '1 Animal' : qty + ' Animais' }}
              </button>
              <button 
                type="button" 
                class="qty-pill custom"
                [class.active]="isCustomQty"
                (click)="enableCustomQty()"
              >
                Outro
              </button>
            </div>

            <!-- Ajuste Rápido de Quantidade Customizada -->
            <div *ngIf="isCustomQty" class="custom-qty-row animate-fade">
              <button type="button" class="qty-step-btn" (click)="adjustCustomQty(-1)">-</button>
              <input 
                type="number" 
                class="custom-qty-input" 
                [(ngModel)]="currentAnimalCount" 
                min="1" 
                max="50"
              />
              <button type="button" class="qty-step-btn" (click)="adjustCustomQty(1)">+</button>
              <span class="custom-qty-unit">cabeças na balança</span>
            </div>
          </div>

          <!-- Passo 2: Visor de Peso com Teclado Numérico Touch Integrado -->
          <div class="scale-weight-display">
            <div class="scale-instruction-row">
              <div class="scale-instruction">
                <span class="step-badge">2</span>
                <label class="scale-label">PESO NA BALANÇA (KG)</label>
              </div>
              <button 
                type="button" 
                class="btn-clear-visor" 
                [style.visibility]="weightString ? 'visible' : 'hidden'"
                [style.opacity]="weightString ? '1' : '0'"
                (click)="clearKeypad()"
              >
                Limpar
              </button>
            </div>

            <!-- Visor Digital de Peso com Subtotais Integrados (Sem Sobreposição) -->
            <div class="weight-display-screen">
              <div class="visor-top-row">
                <span class="visor-digits" [class.empty]="!weightDigits">
                  {{ weightString || '0' }}
                </span>
                <span class="visor-unit">KG</span>
              </div>

              <div class="visor-sub-bar">
                <div class="visor-sub-item highlight">
                  <span class="vsi-label">Média Calculada:</span>
                  <strong class="vsi-val" [class.empty]="numericWeight <= 0">
                    {{ numericWeight > 0 ? (numericWeight / (currentAnimalCount || 1)).toFixed(1) + ' kg/cab' : '---' }}
                  </strong>
                </div>
              </div>
            </div>

            <!-- TECLADO NUMÉRICO TOUCH COM PONTO AUTOMÁTICO -->
            <div class="touch-keypad">
              <div class="keypad-row">
                <button type="button" class="keypad-key" (click)="keypadPress('1')">1</button>
                <button type="button" class="keypad-key" (click)="keypadPress('2')">2</button>
                <button type="button" class="keypad-key" (click)="keypadPress('3')">3</button>
              </div>
              <div class="keypad-row">
                <button type="button" class="keypad-key" (click)="keypadPress('4')">4</button>
                <button type="button" class="keypad-key" (click)="keypadPress('5')">5</button>
                <button type="button" class="keypad-key" (click)="keypadPress('6')">6</button>
              </div>
              <div class="keypad-row">
                <button type="button" class="keypad-key" (click)="keypadPress('7')">7</button>
                <button type="button" class="keypad-key" (click)="keypadPress('8')">8</button>
                <button type="button" class="keypad-key" (click)="keypadPress('9')">9</button>
              </div>
              <div class="keypad-row">
                <button type="button" class="keypad-key" (click)="keypadPress('00')">00</button>
                <button type="button" class="keypad-key" (click)="keypadPress('0')">0</button>
                <button type="button" class="keypad-key backspace" (click)="keypadBackspace()" title="Apagar último dígito">
                  ⌫
                </button>
              </div>
            </div>
          </div>

          <!-- Anotação Opcional (Ex: Brinco, Lote) -->
          <div class="form-group notes-group">
            <input 
              type="text" 
              class="form-control form-control-sm" 
              placeholder="Anotação opcional (ex: Brinco 104, Nelore, etc.)"
              [(ngModel)]="currentItemNotes"
            />
          </div>

          <!-- BOTÃO GIGANTE DE REGISTRAR BALANÇADA -->
          <button 
            type="button" 
            class="btn btn-success btn-lg btn-block register-btn"
            [disabled]="numericWeight <= 0"
            (click)="addWeighingItem()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="btn-icon">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            REGISTRAR PESAGEM
          </button>
        </div>

        <!-- PAINEL DE ACÚMULO EM TEMPO REAL -->
        <div class="stats-grid animate-fade" *ngIf="weighingItems().length > 0">
          <div class="stat-card">
            <div class="stat-val">{{ stats().totalAnimals }}</div>
            <div class="stat-lbl">Cabeças Pesadas</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">{{ stats().totalWeightKg | number:'1.0-1' }} <span class="unit">kg</span></div>
            <div class="stat-lbl">Peso Total</div>
          </div>
          <div class="stat-card">
            <div class="stat-val text-accent">{{ stats().avgWeightKg | number:'1.1-1' }} <span class="unit">kg</span></div>
            <div class="stat-lbl">Média / Cab</div>
          </div>
        </div>

        <!-- HISTÓRICO DAS BALANÇADAS EFETUADAS -->
        <div class="card entries-card">
          <div class="card-header-row">
            <h3 class="card-title">
              Pesagens Realizadas ({{ weighingItems().length }})
            </h3>
            <span class="badge badge-success">{{ stats().totalAnimals }} cabeças</span>
          </div>

          <div *ngIf="weighingItems().length === 0" class="empty-state">
            <div class="empty-icon">⚖️</div>
            <div class="empty-text">A balança está pronta.</div>
            <div class="empty-sub">Digite o peso no teclado numérico acima e toque em "REGISTRAR PESAGEM".</div>
          </div>

          <div *ngIf="weighingItems().length > 0" class="items-list">
            <div *ngFor="let item of reversedWeighingItems()" class="weigh-item animate-fade">
              <div class="item-seq">#{{ item.sequence_number }}</div>
              <div class="item-details">
                <div class="item-main-row">
                  <span class="item-count">{{ item.animal_count }} {{ item.animal_count === 1 ? 'animal' : 'animais' }}</span>
                  <span class="item-weight">{{ item.weight_kg | number:'1.1-1' }} kg</span>
                </div>
                <div class="item-sub-row">
                  <span class="item-avg">Média: {{ item.avg_weight_kg | number:'1.1-1' }} kg/cab</span>
                  <span *ngIf="item.created_at" class="item-time">🕒 {{ item.created_at | date:'HH:mm:ss' }}</span>
                  <span *ngIf="item.notes" class="item-notes">🏷️ {{ item.notes }}</span>
                </div>
              </div>
              <button type="button" class="item-del-btn" (click)="removeItemBySeq(item.sequence_number)" title="Excluir pesagem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Botão de Finalizar Pesagem do Lote -->
        <div class="action-footer">
          <button 
            type="button" 
            class="btn btn-accent btn-lg btn-block"
            [disabled]="weighingItems().length === 0"
            (click)="goToStep(3)"
          >
            Finalizar Pesagem ➔
          </button>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- ETAPA 3: RESUMO DOS DADOS & TRANSMISSÃO -->
      <!-- ============================================================ -->
      <div *ngIf="currentStep() === 3" class="step-content animate-fade">
        
        <!-- Resumo Consolidado do Romaneio -->
        <div class="card summary-details-card">
          <div class="summary-card-header">
            <div class="success-icon-badge">✓</div>
            <div class="summary-header-text">
              <h2 class="summary-title">Resumo da Pesagem</h2>
              <p class="summary-subtitle">Confira os totais do lote antes de enviar à Colombo Agro</p>
            </div>
          </div>

          <div class="summary-divider"></div>

          <div class="summary-section-title">PROPRIEDADE & LOTE</div>
          
          <div class="summary-grid-details">
            <div class="summary-row">
              <span class="s-label">Fazenda:</span>
              <strong class="s-val">{{ selectedSeller?.farm_name }}</strong>
            </div>
            <div class="summary-row">
              <span class="s-label">Produtor:</span>
              <strong class="s-val">{{ selectedSeller?.responsible_name }}</strong>
            </div>
            <div class="summary-row">
              <span class="s-label">Localização:</span>
              <strong class="s-val">{{ selectedSeller?.location }}</strong>
            </div>
            <div class="summary-row">
              <span class="s-label">Pesador:</span>
              <strong class="s-val">{{ sessionWeigher }}</strong>
            </div>
            <div class="summary-row">
              <span class="s-label">Data e Hora:</span>
              <strong class="s-val">{{ sessionDate | date:'dd/MM/yyyy HH:mm' }}</strong>
            </div>
            <div class="summary-row" *ngIf="sessionObservations">
              <span class="s-label">Observações:</span>
              <span class="s-val">{{ sessionObservations }}</span>
            </div>
          </div>

          <div class="summary-divider"></div>

          <div class="summary-section-title">RESULTADOS DA PESAGEM</div>
          
          <div class="summary-metrics-grid">
            <div class="sm-card">
              <span class="sm-label">Total de Cabeças</span>
              <strong class="sm-value">{{ stats().totalAnimals }} cab</strong>
            </div>
            <div class="sm-card">
              <span class="sm-label">Balançadas</span>
              <strong class="sm-value">{{ weighingItems().length }}</strong>
            </div>
            <div class="sm-card highlight">
              <span class="sm-label">Peso Bruto Total</span>
              <strong class="sm-value">{{ stats().totalWeightKg | number:'1.2-2' }} kg</strong>
            </div>
            <div class="sm-card highlight">
              <span class="sm-label">Média por Cabeça</span>
              <strong class="sm-value">{{ stats().avgWeightKg | number:'1.2-2' }} kg/cab</strong>
            </div>
          </div>

          <!-- SOLUÇÃO 5: Detalhamento Compacto / Recolhível de Balançadas -->
          <div class="summary-divider"></div>
          <div class="summary-items-toggle-box">
            <button type="button" class="btn-summary-toggle" (click)="toggleSummaryDetails()">
              <span>📋 Ver Balançadas Individuais ({{ weighingItems().length }})</span>
              <span class="toggle-arrow">{{ showSummaryDetails ? '▲ Ocultar' : '▼ Expandir' }}</span>
            </button>
            <div *ngIf="showSummaryDetails" class="summary-items-scroll animate-fade">
              <div *ngFor="let item of weighingItems()" class="summary-item-row">
                <span class="sir-seq">#{{ item.sequence_number }}</span>
                <span class="sir-qty">{{ item.animal_count }} {{ item.animal_count === 1 ? 'cab' : 'cabs' }}</span>
                <span class="sir-weight"><strong>{{ item.weight_kg | number:'1.1-1' }}</strong> kg</span>
                <span class="sir-avg text-accent">{{ item.avg_weight_kg | number:'1.1-1' }} kg/cab</span>
                <span *ngIf="item.notes" class="sir-notes">🏷️ {{ item.notes }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Ações de Envio e Transmissão -->
        <div class="submit-actions-card card">
          <h3 class="card-title">Transmissão & Exportação</h3>
          
          <button 
            type="button" 
            class="btn btn-primary btn-lg btn-block submit-btn"
            [disabled]="isSaving()"
            (click)="submitWeighingSession()"
          >
            <span *ngIf="!isSaving()">
              {{ activeSessionId() ? '💾 SALVAR ALTERAÇÕES NA PESAGEM' : '🚀 ENVIAR PESAGEM PARA COLOMBO AGRO' }}
            </span>
            <span *ngIf="isSaving()">Gravando dados...</span>
          </button>

          <div class="secondary-actions">
            <button type="button" class="btn btn-secondary flex-1" (click)="exportCsv()">
              📥 Baixar CSV
            </button>
            <button type="button" class="btn btn-whatsapp flex-1" (click)="shareWhatsApp()">
              <svg class="whatsapp-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z"/>
              </svg>
              WhatsApp
            </button>
          </div>

          <button type="button" class="btn btn-secondary btn-block" (click)="goToStep(2)">
            ⬅ Voltar e Ajustar Lançamentos
          </button>
        </div>

        <!-- Modal de Sucesso após Envio -->
        <div *ngIf="showSuccessModal" class="modal-overlay">
          <div class="modal-dialog">
            <div class="modal-icon">{{ lastSaveSynced ? '✅' : '💾' }}</div>
            <h3 class="modal-title">
              {{ activeSessionId() ? 'Pesagem Atualizada!' : (lastSaveSynced ? 'Pesagem Enviada com Sucesso!' : 'Pesagem Salva no Aparelho!') }}
            </h3>
            
            <!-- Mensagem contextualizada de sincronização -->
            <div class="modal-sync-feedback" [class.synced]="lastSaveSynced" [class.pending]="!lastSaveSynced">
              <span *ngIf="lastSaveSynced">
                🟢 <strong>Transmitida para a Nuvem Colombo Agro</strong> (Disponível para a equipe de compras)
              </span>
              <span *ngIf="!lastSaveSynced">
                🟡 <strong>Salva no Aparelho (Modo Offline)</strong>: Os dados serão enviados automaticamente assim que houver conexão com a internet.
              </span>
            </div>

            <p class="modal-desc">
              O romaneio de <strong>{{ stats().totalAnimals }} animais ({{ stats().totalWeightKg | number:'1.0-0' }} kg)</strong> foi registrado com sucesso.
            </p>

            <div class="modal-actions">
              <button type="button" class="btn btn-primary btn-block" (click)="goToStart()">
                🏠 Ir para o Início
              </button>
              <button type="button" class="btn btn-secondary btn-block" (click)="startNewSession()">
                ➕ Iniciar Nova Pesagem
              </button>
              <button type="button" class="btn btn-secondary btn-block" (click)="exportCsv()">
                📥 Baixar Planilha (CSV)
              </button>
              <button type="button" class="btn btn-whatsapp btn-block" (click)="shareWhatsApp()">
                <svg class="whatsapp-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z"/>
                </svg>
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- ============================================================ -->
      <!-- MODAL DE VISUALIZAÇÃO DE PESAGEM ANTERIOR                    -->
      <!-- ============================================================ -->
      <div *ngIf="activeViewingSession" class="modal-overlay" (click)="closeViewingSession()">
        <div class="modal-dialog modal-xl modal-view-session animate-fade" (click)="$event.stopPropagation()">
          
          <!-- Header do Modal -->
          <div class="modal-header-row">
            <div class="modal-header-left">
              <div class="modal-tag-row">
                <span class="badge badge-success">ROMANEIO</span>
                <span 
                  class="badge-sync-pill"
                  [class.synced]="activeViewingSession.sync_status === 'synced'"
                  [class.pending]="activeViewingSession.sync_status !== 'synced'"
                >
                  {{ activeViewingSession.sync_status === 'synced' ? '🟢 Nuvem Colombo' : '🟡 No Aparelho' }}
                </span>
              </div>
              <h2 class="modal-title mt-1">{{ activeViewingSession.farm_name }}</h2>
              <div class="modal-meta-grid">
                <span>👤 {{ activeViewingSession.seller_name }}</span>
                <span>📅 {{ activeViewingSession.created_at ? (activeViewingSession.created_at | date:'dd/MM/yyyy HH:mm') : activeViewingSession.session_date }}</span>
                <span>⚖️ Pesador: {{ activeViewingSession.responsible_name }}</span>
                <span *ngIf="activeViewingSession.updated_at && activeViewingSession.updated_at !== activeViewingSession.created_at" class="meta-updated">
                  ✏️ Atualizado: {{ activeViewingSession.updated_at | date:'dd/MM/yyyy HH:mm' }}
                </span>
              </div>
            </div>
            <button type="button" class="btn-close" (click)="closeViewingSession()" title="Fechar">✕</button>
          </div>

          <div class="modal-obs-box" *ngIf="activeViewingSession.observations">
            🏷️ <strong>Obs:</strong> {{ activeViewingSession.observations }}
          </div>

          <!-- Métricas Resumidas (KPIs) -->
          <div class="modal-metrics-bar">
            <div class="mm-item">
              <span class="mm-lbl">Cabeças</span>
              <strong class="mm-val">{{ activeViewingSession.total_animals }}</strong>
            </div>
            <div class="mm-item">
              <span class="mm-lbl">Peso Total</span>
              <strong class="mm-val">{{ activeViewingSession.total_weight_kg | number:'1.1-1' }} <small>kg</small></strong>
            </div>
            <div class="mm-item highlight">
              <span class="mm-lbl">Média / Cab</span>
              <strong class="mm-val text-accent">{{ activeViewingSession.avg_weight_kg | number:'1.1-1' }} <small>kg</small></strong>
            </div>
          </div>

          <!-- Seção de Balançadas (Cards Mobile-First) -->
          <div class="modal-items-header">
            <span class="modal-section-lbl">Balançadas Realizadas ({{ activeViewingSession.items?.length || 0 }})</span>
          </div>

          <div class="modal-items-container">
            <div *ngFor="let item of activeViewingSession.items" class="modal-item-row animate-fade">
              <span class="mir-seq">#{{ item.sequence_number }}</span>
              <div class="mir-info">
                <div class="mir-main">
                  <span class="mir-qty">{{ item.animal_count }} {{ item.animal_count === 1 ? 'cab' : 'cabs' }}</span>
                  <span class="mir-weight"><strong>{{ item.weight_kg | number:'1.1-1' }}</strong> kg</span>
                </div>
                <div class="mir-sub">
                  <span class="mir-avg">Média: {{ item.avg_weight_kg | number:'1.1-1' }} kg/cab</span>
                  <span *ngIf="item.created_at" class="mir-time">🕒 {{ item.created_at | date:'HH:mm:ss' }}</span>
                  <span *ngIf="item.notes" class="mir-notes">🏷️ {{ item.notes }}</span>
                </div>
              </div>
            </div>

            <div *ngIf="!activeViewingSession.items || activeViewingSession.items.length === 0" class="empty-state py-2">
              <p class="text-muted">Nenhum detalhe de balançada registrado.</p>
            </div>
          </div>

          <!-- Ações do Modal -->
          <div class="modal-actions-box">
            <button 
              *ngIf="activeViewingSession.sync_status !== 'synced'" 
              type="button" 
              class="btn btn-warning btn-lg btn-block"
              (click)="syncSessionNow(activeViewingSession)"
            >
              📤 Enviar para Nuvem Colombo
            </button>
            <button type="button" class="btn btn-primary btn-lg btn-block" (click)="editSession(activeViewingSession)">
              ✏️ Editar / Retomar Pesagem
            </button>
            <div class="modal-export-row">
              <button type="button" class="btn btn-secondary flex-1" (click)="exportPastSessionCsv(activeViewingSession)">
                📥 Baixar CSV
              </button>
              <button type="button" class="btn btn-whatsapp flex-1" (click)="sharePastSessionWhatsApp(activeViewingSession)">
                <svg class="whatsapp-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z"/>
                </svg>
                WhatsApp
              </button>
            </div>
            <div class="modal-export-row">
              <button type="button" class="btn btn-outline-danger flex-1" (click)="promptDeleteSession(activeViewingSession)" title="Excluir esta pesagem">
                🗑️ Excluir Pesagem
              </button>
              <button type="button" class="btn btn-secondary flex-1" (click)="closeViewingSession()">
                ✕ Fechar
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- ============================================================ -->
      <!-- MODAL DE ALERTA DE PESO FORA DO PADRÃO (DEDOS GORDOS)        -->
      <!-- ============================================================ -->
      <div *ngIf="weightAnomalyWarning()" class="modal-overlay animate-fade" (click)="dismissAnomalyWarning()">
        <div class="modal-dialog modal-anomaly" (click)="$event.stopPropagation()">
          <div class="anomaly-icon-badge">⚠️</div>
          <h3 class="modal-title">Peso Fora do Padrão</h3>
          
          <div class="anomaly-info-card">
            <div class="anomaly-msg">{{ weightAnomalyWarning()?.message }}</div>
            <div class="anomaly-details-grid">
              <div class="ad-item">
                <span class="ad-lbl">Peso Digitado</span>
                <strong class="ad-val">{{ numericWeight }} kg</strong>
              </div>
              <div class="ad-item">
                <span class="ad-lbl">Quantidade</span>
                <strong class="ad-val">{{ currentAnimalCount }} {{ currentAnimalCount === 1 ? 'cab' : 'cabs' }}</strong>
              </div>
              <div class="ad-item highlight">
                <span class="ad-lbl">Média / Cab</span>
                <strong class="ad-val text-accent">{{ weightAnomalyWarning()?.avg | number:'1.1-1' }} kg</strong>
              </div>
            </div>
          </div>

          <p class="modal-desc">
            O peso informado está fora da faixa típica de pesagem no curral (<strong>120 a 900 kg/cab</strong>). Verifique se não houve erro de digitação.
          </p>

          <div class="modal-actions">
            <button type="button" class="btn btn-warning btn-lg btn-block" (click)="confirmAddWeighingItem()">
              ✅ Confirmar Balançada ({{ numericWeight }} kg)
            </button>
            <button type="button" class="btn btn-secondary btn-lg btn-block" (click)="dismissAnomalyWarning()">
              ✏️ Corrigir Peso no Teclado
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- MODAL DE CONFIRMAÇÃO: CANCELAR E REINICIAR PESAGEM DO ZERO   -->
      <!-- ============================================================ -->
      <div *ngIf="showCancelConfirmModal" class="modal-overlay animate-fade" (click)="closeCancelConfirmModal()">
        <div class="modal-dialog modal-danger-dialog" (click)="$event.stopPropagation()">
          <div class="modal-icon text-danger">⚠️</div>
          <h3 class="modal-title">Cancelar Pesagem Atual?</h3>
          
          <div class="cancel-warning-box" *ngIf="selectedSeller">
            <div class="cwb-title">Você já possui uma pesagem em andamento:</div>
            <div class="cwb-details">
              <span>📍 Fazenda: <strong>{{ selectedSeller?.farm_name || 'Propriedade em pesagem' }}</strong></span>
              <span>⚖️ Balanço: <strong>{{ stats().totalAnimals }} cabeças pesadas</strong> ({{ stats().totalWeightKg | number:'1.0-1' }} kg)</span>
            </div>
          </div>

          <p class="modal-desc">
            Iniciar uma nova pesagem agora irá <strong>descartar todos os lançamentos atuais</strong> e começar uma pesagem do zero. Deseja continuar?
          </p>

          <div class="modal-actions">
            <button type="button" class="btn btn-danger btn-lg btn-block" (click)="cancelAndStartFresh()">
              🗑️ Sim, Cancelar e Começar do Zero
            </button>
            <button type="button" class="btn btn-secondary btn-lg btn-block" (click)="closeCancelConfirmModal()">
              ⬅ Continuar Pesagem Atual
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE PESAGEM                  -->
      <!-- ============================================================ -->
      <div *ngIf="showDeleteModal()" class="modal-overlay animate-fade" (click)="closeDeleteModal()">
        <div class="modal-dialog modal-danger-dialog" (click)="$event.stopPropagation()">
          <div class="modal-icon text-danger">🗑️</div>
          <h3 class="modal-title">Excluir Pesagem?</h3>

          <div class="cancel-warning-box" *ngIf="sessionToDelete()">
            <div class="cwb-title">{{ sessionToDelete()?.farm_name }}</div>
            <div class="cwb-details">
              <span>📅 Data: <strong>{{ sessionToDelete()?.created_at ? (sessionToDelete()?.created_at | date:'dd/MM/yyyy HH:mm') : sessionToDelete()?.session_date }}</strong></span>
              <span>⚖️ Total: <strong>{{ sessionToDelete()?.total_animals }} cabeças</strong> ({{ sessionToDelete()?.total_weight_kg | number:'1.0-1' }} kg)</span>
            </div>
          </div>

          <p class="modal-desc">
            Tem certeza que deseja excluir permanentemente este registro de pesagem? Esta ação não poderá ser desfeita.
          </p>

          <div class="modal-actions">
            <button type="button" class="btn btn-danger btn-lg btn-block" (click)="confirmDeleteSession()">
              🗑️ Sim, Excluir Pesagem
            </button>
            <button type="button" class="btn btn-secondary btn-lg btn-block" (click)="closeDeleteModal()">
              ✕ Cancelar
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .seller-wrapper {
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* Stepper */
    .stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.35rem;
      background: var(--bg-surface);
      padding: 0.45rem 0.75rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
    }

    .step-pill {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      opacity: 0.55;
      transition: all 0.2s ease;
    }

    .step-pill.active {
      opacity: 1;
      font-weight: 700;
    }

    .step-pill.completed {
      opacity: 0.9;
    }

    .step-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .step-pill.active .step-num {
      background: var(--primary);
      color: #fff;
    }

    .step-pill.completed .step-num {
      background: #10b981;
      color: #fff;
    }

    .step-label {
      font-size: 0.75rem;
      color: var(--text-main);
    }

    @media (max-width: 440px) {
      .step-label {
        display: none;
      }
    }

    .step-line {
      flex: 1;
      height: 2px;
      background: var(--border);
      margin: 0 0.4rem;
    }

    .step-line.completed {
      background: #10b981;
    }

    /* Hero */
    .header-hero {
      background: linear-gradient(135deg, rgba(5, 150, 105, 0.22) 0%, rgba(19, 29, 49, 0.9) 100%);
      border: 1px solid rgba(5, 150, 105, 0.3);
      padding: 0.85rem 1.1rem;
      margin-bottom: 0.65rem;
    }

    .hero-tag {
      font-size: 0.68rem;
      font-weight: 800;
      color: #34d399;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.15rem;
    }

    .hero-title {
      font-size: 1.15rem;
      margin-bottom: 0.25rem;
    }

    .hero-desc {
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    /* Cards e Formulários */
    .card-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.65rem;
    }

    .title-icon {
      width: 20px;
      height: 20px;
      color: #34d399;
    }

    .btn-text {
      background: none;
      border: none;
      color: #34d399;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .seller-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .seller-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-surface-elevated);
      border: 1.5px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.55rem 0.8rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .seller-item:hover, .seller-item.selected {
      border-color: #34d399;
      background: var(--primary-subtle);
    }

    .seller-farm {
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--text-main);
    }

    .seller-meta {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .radio-circle {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--border);
      position: relative;
    }

    .radio-circle.checked {
      border-color: #34d399;
      background: #34d399;
    }

    .seller-item-actions {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .btn-del-farm {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }

    .btn-del-farm:hover {
      background: #ef4444;
      color: #ffffff;
      border-color: #ef4444;
      transform: scale(1.08);
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
    }

    .form-row {
      display: flex;
      gap: 0.75rem;
    }

    .flex-1 {
      flex: 1;
      min-width: 0;
    }

    @media (max-width: 580px) {
      .form-row {
        flex-direction: column;
        gap: 0;
      }
    }

    .mb-0 {
      margin-bottom: 0;
    }

    /* Balança Digital */
    .session-quick-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-md);
      font-size: 0.85rem;
    }

    .sq-farm {
      font-weight: 700;
      display: block;
      color: var(--text-main);
    }

    .sq-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .btn-sm-outline {
      background: none;
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .scale-card {
      background: linear-gradient(180deg, #131d31 0%, #0c1424 100%);
      border: 2px solid rgba(5, 150, 105, 0.4);
      box-shadow: var(--shadow-glow);
    }

    .scale-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .scale-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(5, 150, 105, 0.2);
      border: 1px solid rgba(5, 150, 105, 0.4);
      padding: 0.3rem 0.65rem;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 800;
      color: #34d399;
      letter-spacing: 0.05em;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      animation: pulseScale 1s infinite;
    }

    .scale-seq {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--accent-light);
    }

    .scale-instruction-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 34px;
      margin-bottom: 0.5rem;
    }

    .scale-instruction {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .step-badge {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #34d399;
      color: #0b1120;
      font-size: 0.75rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .scale-label {
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    .btn-clear-visor {
      background: var(--danger-bg);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 0.32rem 0.85rem;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.15s ease, visibility 0.15s ease;
    }

    .animal-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .qty-pill {
      flex: 1;
      min-width: 92px;
      min-height: 48px;
      background: var(--bg-surface-elevated);
      border: 1.5px solid var(--border);
      color: var(--text-main);
      padding: 0.75rem 0.6rem;
      border-radius: var(--radius-md);
      font-weight: 800;
      font-size: 0.95rem;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .qty-pill:active {
      transform: scale(0.95);
    }

    .qty-pill.active {
      background: var(--primary);
      border-color: var(--primary-light);
      color: #ffffff;
      box-shadow: 0 0 14px var(--primary-glow);
    }

    .custom-qty-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 0.75rem;
    }

    .qty-step-btn {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      color: var(--text-main);
      font-size: 1.35rem;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .custom-qty-input {
      width: 90px;
      height: 48px;
      text-align: center;
      background: var(--bg-surface-elevated);
      border: 1.5px solid var(--border-focus);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-size: 1.25rem;
      font-weight: 800;
    }

    .custom-qty-unit {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    /* Visor Digital de Peso */
    .scale-weight-display {
      margin-top: 1rem;
      background: rgba(0, 0, 0, 0.35);
      padding: 1rem;
      border-radius: var(--radius-lg);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .weight-display-screen {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #060e1a;
      border: 2px solid rgba(5, 150, 105, 0.5);
      border-radius: var(--radius-lg);
      padding: 0.65rem 1.25rem 0.45rem 1.25rem;
      margin-bottom: 0.75rem;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.6);
      height: 104px;
      min-height: 104px;
      max-height: 104px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .visor-top-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      width: 100%;
      height: 48px;
    }

    .visor-digits {
      font-family: var(--font-mono);
      font-size: 2.6rem;
      font-weight: 800;
      color: #34d399;
      letter-spacing: 0.04em;
      line-height: 1;
    }

    .visor-digits.empty {
      color: rgba(52, 211, 153, 0.35);
    }

    .visor-unit {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text-muted);
    }

    .visor-sub-bar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 0.25rem;
      margin-top: 0.25rem;
      width: 100%;
      height: 26px;
      box-sizing: border-box;
      white-space: nowrap;
      overflow: hidden;
    }

    .visor-sub-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      white-space: nowrap;
    }

    .vsi-label {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .vsi-val {
      font-family: var(--font-mono);
      font-size: 0.95rem;
      color: var(--text-main);
      font-weight: 700;
      white-space: nowrap;
    }

    .visor-sub-item.highlight .vsi-val {
      color: #34d399;
      font-weight: 800;
    }

    .visor-sub-item.highlight .vsi-val.empty {
      color: rgba(255, 255, 255, 0.25);
    }

    @media (max-width: 440px) {
      .weight-display-screen {
        height: 98px;
        min-height: 98px;
        max-height: 98px;
        padding: 0.5rem 0.85rem;
      }
      .visor-digits {
        font-size: 2.1rem;
      }
      .vsi-label {
        font-size: 0.68rem;
      }
      .vsi-val {
        font-size: 0.85rem;
      }
    }

    /* TECLADO NUMÉRICO TOUCH */
    .touch-keypad {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      margin-top: 0.65rem;
    }

    .keypad-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.55rem;
    }

    .keypad-key {
      background: var(--bg-surface-elevated);
      border: 1.5px solid var(--border);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-family: var(--font-mono);
      font-size: 1.75rem;
      font-weight: 800;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      transition: all 0.1s ease;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
    }

    .keypad-key:active {
      background: var(--primary);
      color: #ffffff;
      transform: scale(0.94);
      border-color: var(--primary-light);
    }

    .keypad-key.dot {
      font-size: 2rem;
      padding-bottom: 0.3rem;
    }

    .keypad-key.backspace {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      font-size: 1.5rem;
      font-weight: 800;
    }

    .keypad-key.backspace:active {
      background: var(--danger);
      color: #ffffff;
    }

    .notes-group {
      margin-top: 0.85rem;
      margin-bottom: 0.5rem;
    }

    .form-control-sm {
      min-height: 42px;
      font-size: 0.9rem;
      padding: 0.55rem 0.85rem;
    }

    .register-btn {
      margin-top: 0.65rem;
      min-height: 62px;
      font-size: 1.2rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      border-radius: var(--radius-lg);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);
    }

    /* Alerta de Peso Anômalo */
    .weight-anomaly-box {
      background: rgba(245, 158, 11, 0.14);
      border: 2px solid #f59e0b;
      border-radius: var(--radius-lg);
      padding: 0.85rem 1rem;
      margin-top: 0.65rem;
      margin-bottom: 0.45rem;
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.25);
    }

    .wab-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }

    .wab-icon {
      font-size: 1.35rem;
    }

    .wab-title {
      display: flex;
      flex-direction: column;
    }

    .wab-title strong {
      color: #fbbf24;
      font-size: 0.95rem;
      font-weight: 800;
    }

    .wab-title span {
      font-size: 0.8rem;
      color: #fde68a;
    }

    .wab-desc {
      font-size: 0.82rem;
      color: var(--text-muted);
      margin: 0.35rem 0 0.65rem 0;
      line-height: 1.35;
    }

    .wab-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .wab-cancel {
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: var(--text-main);
      background: rgba(0, 0, 0, 0.35);
      padding: 0.55rem;
      font-weight: 700;
      border-radius: var(--radius-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .wab-confirm {
      background: #f59e0b;
      color: #000;
      border: none;
      padding: 0.55rem;
      font-weight: 800;
      border-radius: var(--radius-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .wab-confirm:active {
      transform: scale(0.97);
    }

    .btn-icon {
      width: 24px;
      height: 24px;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.65rem;
    }

    .stat-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      padding: 0.85rem;
      border-radius: var(--radius-md);
      text-align: center;
    }

    .stat-val {
      font-family: var(--font-mono);
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .stat-val .unit {
      font-size: 0.8rem;
      color: var(--text-dim);
    }

    .stat-val.text-accent {
      color: #34d399;
    }

    .stat-val.text-amber {
      color: #fbbf24;
    }

    .stat-lbl {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* Items List */
    .entries-card {
      max-height: 380px;
      overflow-y: auto;
    }

    .empty-state {
      text-align: center;
      padding: 1.5rem 1rem;
    }

    .empty-icon {
      font-size: 2.2rem;
      margin-bottom: 0.5rem;
    }

    .empty-text {
      font-weight: 700;
      color: var(--text-main);
    }

    .empty-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .items-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .weigh-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.85rem;
    }

    .item-seq {
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 0.9rem;
      color: var(--accent-light);
      background: var(--accent-subtle);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
    }

    .item-details {
      flex: 1;
    }

    .item-main-row {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: 0.95rem;
    }

    .item-sub-row {
      display: flex;
      gap: 0.75rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .item-del-btn {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #f87171;
      width: 36px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all 0.15s ease;
      flex-shrink: 0;
    }

    .item-del-btn:hover {
      color: #ffffff;
      background: var(--danger);
      border-color: var(--danger);
      transform: scale(1.06);
    }

    .item-del-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Etapa 3: Resumo Compacto */
    .summary-card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.15rem 0;
    }

    .success-icon-badge {
      width: 38px;
      height: 38px;
      min-width: 38px;
      border-radius: 50%;
      background: #10b981;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      font-weight: 900;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.45);
    }

    .summary-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin: 0;
      color: #ffffff;
      line-height: 1.2;
    }

    .summary-subtitle {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin: 0.2rem 0 0 0;
    }

    .summary-details-card {
      padding: 0.85rem 1rem;
    }

    .summary-section-title {
      font-size: 0.7rem;
      font-weight: 800;
      color: #34d399;
      letter-spacing: 0.06em;
      margin-bottom: 0.35rem;
    }

    .summary-grid-details {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.15rem;
    }

    @media (min-width: 600px) {
      .summary-grid-details {
        grid-template-columns: 1fr 1fr;
        gap: 0.2rem 1.25rem;
      }
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.84rem;
      padding: 0.22rem 0;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
    }

    .s-label {
      color: var(--text-muted);
      font-size: 0.82rem;
    }

    .s-val {
      color: var(--text-main);
      text-align: right;
      font-weight: 600;
      font-size: 0.84rem;
    }

    .summary-divider {
      height: 1px;
      background: var(--border);
      margin: 0.6rem 0;
    }

    .summary-metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.45rem;
      margin-top: 0.45rem;
    }

    .sm-card {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.5rem 0.6rem;
      text-align: center;
    }

    .sm-card.highlight {
      border-color: rgba(5, 150, 105, 0.4);
      background: var(--primary-subtle);
    }

    .sm-card.gold {
      border-color: rgba(217, 119, 6, 0.4);
      background: var(--accent-subtle);
    }

    .sm-label {
      display: block;
      font-size: 0.68rem;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 0.15rem;
    }

    .sm-value {
      font-family: var(--font-mono);
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-main);
    }

    .sm-card.gold .sm-value {
      color: #fbbf24;
    }

    .submit-actions-card {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding: 0.85rem 1rem;
      margin-top: 0.65rem;
    }

    .submit-btn {
      font-size: 0.98rem;
      padding: 0.75rem 1rem;
    }

    .secondary-actions {
      display: flex;
      gap: 0.5rem;
    }

    /* Modal */
    .modal-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      background: rgba(0, 0, 0, 0.85) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 1.25rem !important;
      z-index: 999999 !important;
      margin: 0 !important;
      box-sizing: border-box !important;
      overflow-y: auto !important;
    }

    .modal-dialog {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: 2rem 1.5rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow-lg);
      margin: auto !important;
      box-sizing: border-box !important;
      position: relative !important;
      animation: modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    .modal-icon {
      font-size: 3rem;
      margin-bottom: 0.75rem;
    }

    .modal-title {
      font-size: 1.35rem;
      margin-bottom: 0.5rem;
    }

    .modal-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }

    .modal-actions {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    /* Modal de Alerta de Anomalia de Peso */
    .modal-dialog.modal-anomaly {
      border: 1.5px solid #f59e0b;
      box-shadow: 0 0 30px rgba(245, 158, 11, 0.25);
    }

    .anomaly-icon-badge {
      font-size: 2.8rem;
      margin-bottom: 0.5rem;
      animation: pulse 1.5s infinite;
    }

    .anomaly-info-card {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: var(--radius-md);
      padding: 0.75rem;
      margin-bottom: 0.85rem;
    }

    .anomaly-msg {
      color: #fbbf24;
      font-weight: 700;
      font-size: 0.88rem;
      margin-bottom: 0.6rem;
    }

    .anomaly-details-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.4rem;
      background: var(--bg-surface-elevated);
      padding: 0.5rem;
      border-radius: var(--radius-sm);
    }

    .ad-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
    }

    .ad-item.highlight {
      border-left: 1px solid var(--border);
      padding-left: 0.35rem;
    }

    .ad-lbl {
      font-size: 0.68rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 700;
    }

    .ad-val {
      font-family: var(--font-mono);
      font-size: 0.88rem;
      color: var(--text-main);
    }

    /* Modal de Alerta de Cancelamento de Pesagem */
    .modal-dialog.modal-danger-dialog {
      border: 1.5px solid rgba(239, 68, 68, 0.6);
      box-shadow: 0 0 35px rgba(239, 68, 68, 0.25);
    }

    .cancel-warning-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-md);
      padding: 0.75rem 0.85rem;
      margin-bottom: 0.85rem;
      text-align: left;
    }

    .cwb-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #fca5a5;
      margin-bottom: 0.4rem;
    }

    .cwb-details {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.82rem;
      color: var(--text-main);
    }

    .btn-danger {
      background: #ef4444;
      color: #ffffff;
      font-weight: 700;
      border: 1px solid #dc2626;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    /* SOLUÇÃO 6: Rodapé Sticky Ergonômico de Ação na Balança */
    .action-footer {
      margin-top: 1rem;
      position: sticky;
      bottom: 0.75rem;
      z-index: 20;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 0.65rem;
      border-radius: var(--radius-lg);
      border: 1.5px solid rgba(52, 211, 153, 0.35);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    /* SOLUÇÃO 3: Banner de Edição Ativa */
    .editing-banner {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(30, 41, 59, 0.95) 100%);
      border: 1.5px solid #f59e0b;
      border-radius: var(--radius-lg);
      padding: 0.65rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
    }

    .eb-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .eb-tag {
      background: #f59e0b;
      color: #000;
      font-weight: 800;
      font-size: 0.68rem;
      padding: 0.2rem 0.45rem;
      border-radius: var(--radius-sm);
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .eb-text {
      color: var(--text-main);
    }

    .btn-cancel-edit, .btn-eb-cancel {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.45);
      color: #fca5a5;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .btn-cancel-edit:hover, .btn-eb-cancel:hover {
      background: rgba(239, 68, 68, 0.4);
      color: #fff;
    }

    /* SOLUÇÃO 2: Banner de Proteção de Sessão Ativa ao navegar no Histórico */
    .active-session-alert-banner {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%);
      border: 1.5px solid #10b981;
      border-radius: var(--radius-lg);
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.85rem;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.2);
      margin-bottom: 0.75rem;
    }

    .asab-info {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .asab-icon {
      font-size: 1.6rem;
      animation: pulse 1.5s infinite;
    }

    .asab-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .asab-text strong {
      color: #34d399;
      font-size: 0.92rem;
    }

    .asab-text span {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .asab-btn {
      white-space: nowrap;
      font-weight: 800;
      padding: 0.5rem 0.85rem;
    }

    /* SOLUÇÃO 5: Estilos para Detalhamento Compacto / Recolhível no Resumo */
    .summary-items-toggle-box {
      margin-top: 0.5rem;
    }

    .btn-summary-toggle {
      width: 100%;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.85rem;
      color: var(--text-main);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.15s ease;
    }

    .btn-summary-toggle:hover {
      border-color: #34d399;
      background: var(--primary-subtle);
    }

    .toggle-arrow {
      font-size: 0.75rem;
      color: #34d399;
    }

    .summary-items-scroll {
      margin-top: 0.5rem;
      max-height: 220px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.4rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .summary-item-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.35rem 0.55rem;
      background: var(--bg-surface-elevated);
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
    }

    .sir-seq {
      font-family: var(--font-mono);
      font-weight: 800;
      color: var(--text-muted);
      width: 28px;
    }

    .sir-qty {
      font-weight: 700;
      color: var(--text-main);
    }

    .sir-weight {
      font-family: var(--font-mono);
      color: var(--text-main);
    }

    .sir-avg {
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }

    .sir-notes {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-left: auto;
    }

    /* Abas de Modo no Vendedor */
    .seller-mode-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      margin-bottom: 0.85rem;
    }

    .seller-tab-btn {
      background: var(--bg-surface);
      border: 1.5px solid var(--border);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      padding: 0.75rem 0.5rem;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
    }

    .seller-tab-btn.active {
      background: var(--bg-surface-elevated);
      border-color: #34d399;
      color: #34d399;
      box-shadow: 0 0 10px rgba(52, 211, 153, 0.15);
    }

    .seller-tab-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      border-color: var(--border);
      background: rgba(0, 0, 0, 0.15);
      color: var(--text-muted);
      box-shadow: none;
    }

    /* Cards de Histórico de Pesagens */
    .history-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .session-history-card {
      padding: 1rem;
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    /* Banner de Sincronização Pendente */
    .pending-sync-banner {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(30, 41, 59, 0.95) 100%);
      border: 1.5px solid #f59e0b;
      border-radius: var(--radius-lg);
      padding: 0.85rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.85rem;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
    }

    .psb-info {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .psb-icon {
      font-size: 1.5rem;
      animation: pulse 1.5s infinite;
    }

    .psb-text {
      display: flex;
      flex-direction: column;
    }

    .psb-title {
      font-size: 0.9rem;
      color: #fbbf24;
    }

    .psb-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .btn-psb-sync {
      background: #f59e0b;
      color: #000;
      border: none;
      font-weight: 800;
      font-size: 0.82rem;
      padding: 0.5rem 0.85rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .btn-psb-sync:hover {
      background: #d97706;
      color: #fff;
    }

    .btn-psb-sync:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .shc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .shc-badges {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .badge-sync-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-full);
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .badge-sync-pill.synced {
      background: rgba(16, 185, 129, 0.18);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
    }

    .badge-sync-pill.pending {
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(245, 158, 11, 0.45);
      color: #fbbf24;
    }

    .btn-warning {
      background: #f59e0b;
      color: #000;
      font-weight: 700;
    }

    .btn-warning:hover {
      background: #d97706;
      color: #fff;
    }

    .modal-tag-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.25rem;
    }

    .modal-sync-feedback {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      padding: 0.65rem 0.85rem;
      border-radius: var(--radius-md);
      font-size: 0.85rem;
      margin-bottom: 0.85rem;
      text-align: left;
    }

    .modal-sync-feedback.synced {
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.1);
      color: #34d399;
    }

    .modal-sync-feedback.pending {
      border-color: rgba(245, 158, 11, 0.4);
      background: rgba(245, 158, 11, 0.12);
      color: #fbbf24;
    }

    .shc-farm {
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--text-main);
    }

    .shc-meta {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 0.15rem;
    }

    .shc-stats-row {
      display: flex;
      gap: 1rem;
      background: var(--bg-surface-elevated);
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      flex-wrap: wrap;
    }

    .shc-stat {
      display: flex;
      gap: 0.35rem;
      align-items: center;
    }

    .shc-lbl {
      color: var(--text-muted);
    }

    .shc-obs {
      font-size: 0.8rem;
      color: var(--text-muted);
      background: rgba(0, 0, 0, 0.2);
      padding: 0.35rem 0.55rem;
      border-radius: var(--radius-sm);
    }

    .shc-actions {
      display: flex;
      gap: 0.45rem;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 0.4rem;
    }

    .btn-action {
      border: 1px solid var(--border);
      background: var(--bg-surface-elevated);
      color: var(--text-main);
      padding: 0.48rem 0.8rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      white-space: nowrap;
      min-height: 38px;
    }

    .btn-action .whatsapp-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .btn-action:hover {
      background: var(--bg-surface);
      border-color: var(--primary-light);
      transform: translateY(-1px);
    }

    .btn-action.view {
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.35);
      background: rgba(56, 189, 248, 0.12);
    }

    .btn-action.view:hover {
      background: #0284c7;
      color: #fff;
    }

    .btn-action.edit {
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.35);
      background: rgba(245, 158, 11, 0.12);
    }

    .btn-action.edit:hover {
      background: #f59e0b;
      color: #000;
      border-color: #f59e0b;
    }

    .btn-action.send {
      color: #fb923c;
      border-color: rgba(251, 146, 60, 0.35);
      background: rgba(251, 146, 60, 0.12);
    }

    .btn-action.send:hover {
      background: #ea580c;
      color: #fff;
      border-color: #ea580c;
    }

    .btn-action.csv {
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.35);
      background: rgba(16, 185, 129, 0.12);
    }

    .btn-action.csv:hover {
      background: #10b981;
      color: #fff;
    }

    .btn-action.zap {
      color: #22c55e;
      border-color: rgba(34, 197, 94, 0.35);
      background: rgba(34, 197, 94, 0.12);
    }

    .btn-action.zap:hover {
      background: #16a34a;
      color: #fff;
    }

    .btn-action.del {
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.35);
      background: rgba(239, 68, 68, 0.12);
    }

    .btn-action.del:hover {
      background: #ef4444;
      color: #fff;
      border-color: #ef4444;
    }

    @media (max-width: 640px) {
      .shc-actions {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
        width: 100%;
        margin-top: 0.6rem;
      }

      .btn-action {
        padding: 0.65rem 0.4rem;
        font-size: 0.88rem;
        min-height: 44px;
        width: 100%;
        border-radius: 8px;
      }
    }

    @media (max-width: 380px) {
      .shc-actions {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* Modal XL - Visualização de Romaneio */
    .modal-dialog.modal-xl {
      max-width: 640px !important;
      width: 96vw !important;
      text-align: left;
      padding: 1.25rem 1rem !important;
      max-height: 92vh !important;
      display: flex !important;
      flex-direction: column !important;
      overflow-y: auto !important;
    }

    @media (min-width: 600px) {
      .modal-dialog.modal-xl {
        padding: 1.75rem 1.5rem !important;
      }
    }

    .modal-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.65rem;
    }

    .modal-header-left {
      flex: 1;
      min-width: 0;
    }

    .modal-meta-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.2rem;
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    @media (min-width: 500px) {
      .modal-meta-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .meta-updated {
      color: var(--color-accent);
      font-weight: 600;
    }

    .btn-close {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      color: var(--text-muted);
      width: 34px;
      height: 34px;
      border-radius: 50%;
      cursor: pointer;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .btn-close:hover {
      color: #fff;
      border-color: var(--primary-light);
    }

    .modal-obs-box {
      background: rgba(0, 0, 0, 0.25);
      border-left: 3px solid #f59e0b;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }

    .modal-metrics-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.4rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.6rem 0.4rem;
      margin-bottom: 0.75rem;
      text-align: center;
    }

    .mm-item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .mm-item.highlight {
      border-left: 1px solid var(--border);
    }

    .mm-lbl {
      font-size: 0.68rem;
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .mm-val {
      font-family: var(--font-mono);
      font-size: 1.05rem;
      color: var(--text-main);
      font-weight: 800;
    }

    .mm-val small {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    /* Lista de Balançadas no Modal (Mobile First) */
    .modal-items-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.4rem;
    }

    .modal-section-lbl {
      font-size: 0.72rem;
      font-weight: 800;
      color: #34d399;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .modal-items-container {
      max-height: 250px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.45rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 0.85rem;
    }

    .modal-item-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: var(--bg-surface-elevated);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: var(--radius-sm);
      padding: 0.5rem 0.65rem;
    }

    .mir-seq {
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 0.85rem;
      color: #34d399;
      background: var(--primary-subtle);
      padding: 0.2rem 0.45rem;
      border-radius: var(--radius-sm);
      flex-shrink: 0;
    }

    .mir-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .mir-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.88rem;
    }

    .mir-qty {
      font-weight: 700;
      color: var(--text-main);
    }

    .mir-weight {
      font-family: var(--font-mono);
      color: var(--text-main);
    }

    .mir-sub {
      display: flex;
      gap: 0.65rem;
      font-size: 0.72rem;
      color: var(--text-muted);
      flex-wrap: wrap;
    }

    .mir-avg {
      color: #34d399;
      font-family: var(--font-mono);
    }

    .mir-time {
      color: var(--text-muted);
    }

    .mir-notes {
      color: #fbbf24;
      font-style: italic;
    }

    /* Ações do Modal de Visualização */
    .modal-actions-box {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }

    .modal-export-row {
      display: flex;
      gap: 0.5rem;
      width: 100%;
    }

    .btn-outline-danger {
      background: transparent;
      border: 1.5px solid var(--color-danger, #ef4444);
      color: var(--color-danger, #ef4444);
      font-weight: 600;
      border-radius: var(--radius-md, 8px);
      padding: 0.65rem 1rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      transition: all 0.2s ease;
    }

    .btn-outline-danger:hover, .btn-outline-danger:active {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border-color: #f87171;
    }
  `]
})
export class SellerComponent implements OnInit {
  supabase = inject(SupabaseService);
  audio = inject(AudioFeedbackService);
  exportService = inject(ExportService);
  router = inject(Router);

  // Stepper state
  currentStep = signal<number>(1);
  isSaving = signal<boolean>(false);
  showSuccessModal = false;
  lastSaveSynced = false;
  showSummaryDetails = false;

  toggleSummaryDetails() {
    this.audio.playClick();
    this.showSummaryDetails = !this.showSummaryDetails;
  }

  // Abas de Modo no Vendedor (Nova Pesagem vs Pesagens Anteriores)
  activeTab = signal<'new' | 'history'>('new');
  activeSessionId = signal<string | null>(null);
  editingSessionOriginal: WeighingSession | null = null;
  pastSessions = signal<WeighingSession[]>(this.supabase.getLocalSessions().filter(s => s.status !== 'deleted'));
  activeViewingSession: WeighingSession | null = null;
  weightAnomalyWarning = signal<{ isAnomaly: boolean; avg: number; message: string } | null>(null);
  showCancelConfirmModal = false;
  sessionToDelete = signal<WeighingSession | null>(null);
  showDeleteModal = signal<boolean>(false);

  // Pesagem em andamento bloqueia a aba de pesagens anteriores
  isWeighingInProgress = computed(() => {
    return this.currentStep() >= 2 || this.weighingItems().length > 0 || !!this.activeSessionId();
  });

  // Sellers
  sellers = signal<Seller[]>(this.supabase.getLocalSellers());
  selectedSeller: Seller | null = null;
  showNewSellerForm = false;
  newSeller: Partial<Seller> = {
    farm_name: '',
    responsible_name: '',
    location: '',
    phone: ''
  };

  getNowLocalDateTime(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  formatToLocalDateTime(dateStr?: string): string {
    if (!dateStr) return this.getNowLocalDateTime();
    if (dateStr.includes('T') && dateStr.length >= 16) {
      return dateStr.substring(0, 16);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${dateStr}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return this.getNowLocalDateTime();
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return this.getNowLocalDateTime();
    }
  }

  // Header da Pesagem (Sem pedir quantidade prévia de cabeças)
  sessionWeigher = '';
  sessionDate = this.getNowLocalDateTime();
  sessionObservations = '';

  // Balança State
  quickQuantities = [1, 2];
  currentAnimalCount = 1; // Padrão: 1 animal na balança
  isCustomQty = false;

  // Digitação de peso no teclado numérico touch com ponto automático
  weightDigits = '';
  currentItemNotes = '';
  weighingItems = signal<WeighingItem[]>([]);
  reversedWeighingItems = computed(() => [...this.weighingItems()].reverse());

  // Digitação direta do peso em KG inteiros (ex: 520 -> 520 kg)
  get weightString(): string {
    return this.weightDigits;
  }

  // Retorna o peso numérico digitado
  get numericWeight(): number {
    const val = parseInt(this.weightDigits, 10);
    return isNaN(val) ? 0 : val;
  }

  // Totalizadores acumulados em tempo real
  stats = computed(() => {
    const items = this.weighingItems();
    const totalAnimals = items.reduce((acc, i) => acc + i.animal_count, 0);
    const totalWeightKg = items.reduce((acc, i) => acc + i.weight_kg, 0);
    const avgWeightKg = totalAnimals > 0 ? totalWeightKg / totalAnimals : 0;
    const totalArrobas = totalWeightKg / 30;

    return {
      totalAnimals,
      totalWeightKg,
      avgWeightKg,
      totalArrobas,
      batchCount: items.length
    };
  });

  scrollToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;

      // Executa após a atualização e renderização do DOM do Angular
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        const anchor = document.getElementById('scale-step-anchor') || document.getElementById('seller-top');
        if (anchor) {
          anchor.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
        }
      });

      setTimeout(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }, 50);
    }
  }

  ngOnInit() {
    this.scrollToTop();
    // 1. Carregamento instantâneo do cache local (0ms de atraso, nunca pisca/some)
    this.sellers.set(this.supabase.getLocalSellers());
    this.pastSessions.set(this.supabase.getLocalSessions().filter(s => s.status !== 'deleted'));

    // 2. Revalidação em segundo plano sem bloquear a interface
    this.loadSellers();
    this.loadPastSessions();
  }

  async loadSellers() {
    const data = await this.supabase.getSellers();
    if (data) {
      this.sellers.set(data);
    }
  }

  async loadPastSessions() {
    const data = await this.supabase.getWeighingSessions();
    if (data) {
      this.pastSessions.set(data);
    }
  }

  async syncNow() {
    this.audio.playClick();
    const res = await this.supabase.syncPendingSessions();
    await this.loadPastSessions();
    if (res.syncedCount > 0) {
      this.audio.playScaleSuccess();
    }
  }

  async syncSessionNow(session: WeighingSession) {
    this.audio.playClick();
    await this.supabase.syncPendingSessions();
    await this.loadPastSessions();
    if (this.activeViewingSession && this.activeViewingSession.id === session.id) {
      this.activeViewingSession.sync_status = 'synced';
    }
    this.audio.playScaleSuccess();
  }

  onNewPesagemTabClick() {
    this.audio.playClick();
    if (this.isWeighingInProgress()) {
      this.showCancelConfirmModal = true;
    } else {
      this.switchTab('new');
    }
  }

  cancelAndStartFresh() {
    this.audio.playDelete();
    this.showCancelConfirmModal = false;
    this.activeSessionId.set(null);
    this.editingSessionOriginal = null;
    this.weighingItems.set([]);
    this.sessionObservations = '';
    this.weightDigits = '';
    this.currentStep.set(1);
    this.activeTab.set('new');
    this.scrollToTop();
  }

  closeCancelConfirmModal() {
    this.audio.playClick();
    this.showCancelConfirmModal = false;
  }

  switchTab(tab: 'new' | 'history') {
    if (tab === 'history' && this.isWeighingInProgress()) {
      return;
    }
    this.audio.playClick();
    this.activeTab.set(tab);
    if (tab === 'history') {
      this.loadPastSessions();
    }
  }

  selectSeller(seller: Seller) {
    this.audio.playClick();
    this.selectedSeller = seller;
    this.sessionWeigher = seller.responsible_name;
  }

  async deleteSeller(event: Event, sellerId: string) {
    event.stopPropagation();
    if (!confirm('Deseja realmente remover esta fazenda cadastrada?')) return;
    this.audio.playDelete();
    await this.supabase.deleteSeller(sellerId);
    await this.loadSellers();
    if (this.selectedSeller?.id === sellerId) {
      this.selectedSeller = null;
      this.sessionWeigher = '';
    }
  }

  toggleNewSeller(show: boolean) {
    this.audio.playClick();
    this.showNewSellerForm = show;
  }

  async saveAndSelectSeller() {
    if (!this.newSeller.farm_name || !this.newSeller.responsible_name || !this.newSeller.location) return;
    this.audio.playClick();

    const saved = await this.supabase.saveSeller(this.newSeller as Omit<Seller, 'id'>);
    await this.loadSellers();
    this.selectedSeller = saved;
    this.sessionWeigher = saved.responsible_name;
    this.showNewSellerForm = false;
    this.newSeller = { farm_name: '', responsible_name: '', location: '', phone: '' };
  }

  canGoToStep(step: number): boolean {
    if (step === 1) return true;
    if (step === 2) {
      return !!(this.selectedSeller && this.sessionWeigher && this.sessionDate);
    }
    if (step === 3) {
      return !!(this.selectedSeller && this.sessionWeigher && this.sessionDate && this.weighingItems().length > 0);
    }
    return false;
  }

  proceedToWeighing() {
    if (!this.canGoToStep(2)) return;
    this.audio.playClick();
    this.currentStep.set(2);
    this.scrollToTop();
  }

  goToStep(step: number) {
    if (!this.canGoToStep(step)) {
      return;
    }
    this.audio.playClick();
    this.currentStep.set(step);
    this.scrollToTop();
  }

  // ==========================================
  // EDIÇÃO DE PESAGEM EXISTENTE
  // ==========================================
  editSession(session: WeighingSession) {
    this.audio.playClick();
    this.editingSessionOriginal = JSON.parse(JSON.stringify(session));
    this.activeSessionId.set(session.id);

    // Tenta encontrar o vendedor correspondente
    const seller = this.sellers().find(s => s.id === session.seller_id);
    if (seller) {
      this.selectedSeller = seller;
    } else {
      this.selectedSeller = {
        id: session.seller_id,
        farm_name: session.farm_name,
        responsible_name: session.seller_name,
        location: session.location,
        phone: ''
      };
    }

    this.sessionWeigher = session.responsible_name;
    this.sessionDate = this.formatToLocalDateTime(session.session_date);
    this.sessionObservations = session.observations || '';

    // Carrega os itens da pesagem para edição no curral
    const clonedItems: WeighingItem[] = (session.items || []).map((item, idx) => ({
      ...item,
      sequence_number: idx + 1
    }));
    this.weighingItems.set(clonedItems);

    this.closeViewingSession();
    this.activeTab.set('new');
    this.currentStep.set(2);
    this.scrollToTop();
  }

  cancelEditing() {
    this.audio.playClick();
    this.editingSessionOriginal = null;
    this.activeSessionId.set(null);
    this.weighingItems.set([]);
    this.sessionObservations = '';
    this.weightDigits = '';
    this.currentStep.set(1);
    this.activeTab.set('new');
    this.scrollToTop();
  }

  viewPastSession(session: WeighingSession) {
    this.audio.playClick();
    this.activeViewingSession = session;
  }

  closeViewingSession() {
    this.activeViewingSession = null;
  }

  promptDeleteSession(sessionOrId: WeighingSession | string) {
    this.audio.playClick();
    if (typeof sessionOrId === 'string') {
      const found = this.pastSessions().find(s => s.id === sessionOrId);
      this.sessionToDelete.set(found || null);
    } else {
      this.sessionToDelete.set(sessionOrId);
    }
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.audio.playClick();
    this.showDeleteModal.set(false);
    this.sessionToDelete.set(null);
  }

  async confirmDeleteSession() {
    const session = this.sessionToDelete();
    if (!session || !session.id) {
      this.closeDeleteModal();
      return;
    }

    const sessionId = session.id;
    this.audio.playDelete();
    this.showDeleteModal.set(false);
    this.sessionToDelete.set(null);

    // Atualização otimista e reativa imediata na lista de sessões
    this.pastSessions.update(sessions => sessions.filter(s => s.id !== sessionId));

    if (this.activeViewingSession?.id === sessionId) {
      this.closeViewingSession();
    }

    if (this.activeSessionId() === sessionId) {
      this.cancelEditing();
    }

    await this.supabase.deleteWeighingSession(sessionId);
    await this.loadPastSessions();
  }

  deletePastSession(sessionId: string) {
    this.promptDeleteSession(sessionId);
  }

  exportPastSessionCsv(session: WeighingSession) {
    this.audio.playClick();
    this.exportService.exportSessionToCsv(session);
  }

  sharePastSessionWhatsApp(session: WeighingSession) {
    this.audio.playClick();
    const seller = this.sellers().find(s => s.id === session.seller_id);
    const url = this.exportService.getWhatsAppShareUrl(session, seller?.phone);
    window.open(url, '_blank');
  }

  // ==========================================
  // BALANÇA DIGITAL
  // ==========================================
  setAnimalCount(qty: number) {
    this.audio.playClick();
    this.currentAnimalCount = qty;
    this.isCustomQty = false;
  }

  enableCustomQty() {
    this.audio.playClick();
    this.isCustomQty = true;
    if (this.currentAnimalCount < 1) this.currentAnimalCount = 1;
  }

  adjustCustomQty(delta: number) {
    this.audio.playClick();
    this.currentAnimalCount = Math.max(1, (this.currentAnimalCount || 1) + delta);
  }

  // Teclado Numérico Touch com Ponto Decimal Automático
  keypadPress(char: string) {
    this.audio.playClick();
    if (char === '00') {
      if (this.weightDigits.length > 0 && this.weightDigits.length <= 4) {
        this.weightDigits += '00';
      }
    } else {
      if (this.weightDigits.length < 6) {
        if (this.weightDigits === '' && char === '0') return;
        this.weightDigits += char;
      }
    }
  }

  keypadBackspace() {
    this.audio.playClick();
    if (this.weightDigits.length > 0) {
      this.weightDigits = this.weightDigits.slice(0, -1);
    }
  }

  clearKeypad() {
    this.audio.playDelete();
    this.weightDigits = '';
  }

  addWeighingItem() {
    const weight = this.numericWeight;
    if (weight <= 0) return;

    const qty = Math.max(1, this.currentAnimalCount || 1);
    const avg = weight / qty;

    // Trava contra "Dedos Gordos": Se o peso por cabeça estiver fora de 120 kg a 900 kg
    if (avg < 120 || avg > 900) {
      this.audio.playWarning();
      this.weightAnomalyWarning.set({
        isAnomaly: true,
        avg,
        message: avg < 120 ? 'Peso muito leve (< 120 kg/cab)' : 'Peso muito elevado (> 900 kg/cab)'
      });
      return;
    }

    this.commitWeighingItem(weight, qty, avg);
  }

  confirmAddWeighingItem() {
    const weight = this.numericWeight;
    if (weight <= 0) return;
    const qty = Math.max(1, this.currentAnimalCount || 1);
    const avg = weight / qty;
    this.weightAnomalyWarning.set(null);
    this.commitWeighingItem(weight, qty, avg);
  }

  dismissAnomalyWarning() {
    this.audio.playClick();
    this.weightAnomalyWarning.set(null);
  }

  private commitWeighingItem(weight: number, qty: number, avg: number) {
    const nowIso = new Date().toISOString();
    const newItem: WeighingItem = {
      sequence_number: this.weighingItems().length + 1,
      animal_count: qty,
      weight_kg: weight,
      avg_weight_kg: Number(avg.toFixed(2)),
      notes: this.currentItemNotes ? this.currentItemNotes.trim() : undefined,
      created_at: nowIso,
      updated_at: nowIso
    };

    this.audio.playScaleSuccess();
    this.weighingItems.update(items => [...items, newItem]);
    this.weightAnomalyWarning.set(null);

    // Reseta balança para a próxima cabeçada
    this.weightDigits = '';
    this.currentItemNotes = '';
    this.currentAnimalCount = 1;
    this.isCustomQty = false;
  }

  removeItem(index: number) {
    this.audio.playDelete();
    this.weighingItems.update(items => {
      const updated = items.filter((_, idx) => idx !== index);
      return updated.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
    });
  }

  removeItemBySeq(sequenceNumber: number) {
    this.audio.playDelete();
    this.weighingItems.update(items => {
      const updated = items.filter(item => item.sequence_number !== sequenceNumber);
      return updated.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
    });
  }

  async submitWeighingSession() {
    if (!this.selectedSeller || this.weighingItems().length === 0) return;

    this.isSaving.set(true);
    const currentStats = this.stats();
    const nowIso = new Date().toISOString();

    const isEditing = !!this.activeSessionId();
    const sessionId = this.activeSessionId() || this.supabase.generateUuid();

    const originalItems = this.editingSessionOriginal?.items || [];
    let anyItemChanged = false;

    const itemsToSave = this.weighingItems().map(item => {
      const originalItem = originalItems.find(
        orig => (item.id && orig.id === item.id) || (orig.sequence_number === item.sequence_number)
      );

      const isNewItem = !originalItem;
      const isModified = !isNewItem && (
        Number(originalItem.animal_count) !== Number(item.animal_count) ||
        Number(originalItem.weight_kg) !== Number(item.weight_kg) ||
        (originalItem.notes || '').trim() !== (item.notes || '').trim()
      );

      if (isNewItem || isModified) {
        anyItemChanged = true;
      }

      return {
        ...item,
        created_at: item.created_at || originalItem?.created_at || nowIso,
        updated_at: (isNewItem || isModified)
          ? nowIso
          : (originalItem?.updated_at || originalItem?.created_at || item.updated_at || item.created_at || nowIso)
      };
    });

    const itemsCountChanged = isEditing && (this.weighingItems().length !== originalItems.length);
    const sessionFieldsChanged = isEditing && (
      this.sessionWeigher !== this.editingSessionOriginal?.responsible_name ||
      this.sessionDate !== this.editingSessionOriginal?.session_date ||
      this.sessionObservations !== (this.editingSessionOriginal?.observations || '')
    );

    const sessionCreatedAt = this.editingSessionOriginal?.created_at || (isEditing ? undefined : nowIso) || nowIso;
    let sessionUpdatedAt = nowIso;
    if (isEditing && !anyItemChanged && !itemsCountChanged && !sessionFieldsChanged) {
      sessionUpdatedAt = this.editingSessionOriginal?.updated_at || this.editingSessionOriginal?.created_at || nowIso;
    }

    const session: WeighingSession = {
      id: sessionId,
      seller_id: this.selectedSeller.id,
      farm_name: this.selectedSeller.farm_name,
      seller_name: this.selectedSeller.responsible_name,
      location: this.selectedSeller.location,
      responsible_name: this.sessionWeigher,
      session_date: this.sessionDate,
      observations: this.sessionObservations,
      total_animals: currentStats.totalAnimals,
      total_weight_kg: currentStats.totalWeightKg,
      avg_weight_kg: currentStats.avgWeightKg,
      total_arrobas: currentStats.totalArrobas,
      status: 'completed',
      created_at: sessionCreatedAt,
      updated_at: sessionUpdatedAt
    };

    const result = await this.supabase.saveWeighingSession(session, itemsToSave);
    this.lastSaveSynced = result.synced;
    await this.loadPastSessions();
    this.isSaving.set(false);

    // Conclusão e comprovante
    this.audio.playScaleSuccess();
    this.showSuccessModal = true;
  }

  exportCsv() {
    if (!this.selectedSeller) return;
    const session = this.buildCurrentSessionObject();
    this.exportService.exportSessionToCsv(session);
  }

  shareWhatsApp() {
    if (!this.selectedSeller) return;
    const session = this.buildCurrentSessionObject();
    const url = this.exportService.getWhatsAppShareUrl(session, this.selectedSeller.phone);
    window.open(url, '_blank');
  }

  private buildCurrentSessionObject(): WeighingSession {
    const s = this.stats();
    return {
      id: this.activeSessionId() || 'preview',
      seller_id: this.selectedSeller?.id || '',
      farm_name: this.selectedSeller?.farm_name || '',
      seller_name: this.selectedSeller?.responsible_name || '',
      location: this.selectedSeller?.location || '',
      responsible_name: this.sessionWeigher,
      session_date: this.sessionDate,
      observations: this.sessionObservations,
      total_animals: s.totalAnimals,
      total_weight_kg: s.totalWeightKg,
      avg_weight_kg: s.avgWeightKg,
      total_arrobas: s.totalArrobas,
      status: 'completed',
      items: this.weighingItems()
    };
  }

  goToStart() {
    this.audio.playClick();
    this.showSuccessModal = false;
    this.activeSessionId.set(null);
    this.editingSessionOriginal = null;
    this.weighingItems.set([]);
    this.sessionObservations = '';
    this.weightDigits = '';
    this.currentStep.set(1);
    this.activeTab.set('history');
    this.scrollToTop();
  }

  startNewSession() {
    this.showSuccessModal = false;
    this.activeSessionId.set(null);
    this.editingSessionOriginal = null;
    this.weighingItems.set([]);
    this.sessionObservations = '';
    this.weightDigits = '';
    this.currentStep.set(2);
    this.scrollToTop();
  }
}

