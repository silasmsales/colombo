import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AudioFeedbackService } from '../../services/audio.service';
import { ExportService } from '../../services/export.service';
import { Seller } from '../../models/seller.model';
import { WeighingSession, WeighingItem } from '../../models/weighing.model';

@Component({
  selector: 'app-buyer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="admin-dashboard">
      
      <!-- Topo do Painel Administrativo -->
      <div class="admin-header-row">
        <div>
          <div class="admin-badge">PAINEL ADMINISTRATIVO DE COMPRAS</div>
          <h1 class="admin-title">Romaneios & Pesagens de Gado</h1>
          <p class="admin-subtitle">Monitoramento e consolidação das pesagens realizadas nas fazendas parceiras da <strong>Colombo Agro</strong>.</p>
        </div>

        <div class="admin-header-actions">
          <button type="button" class="btn btn-secondary" (click)="refreshData()" [class.spinning]="isLoading()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Atualizar
          </button>

          <button 
            type="button" 
            class="btn btn-primary" 
            (click)="exportAllFilteredCsv()" 
            [disabled]="filteredSessions().length === 0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Exportar CSV Geral
          </button>
        </div>
      </div>

      <!-- Métricas Consolidadas Executivas (KPI Cards) -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon-wrap green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total de Cabeças</span>
            <strong class="kpi-val">{{ totalFilteredStats().totalAnimals }} <small>animais</small></strong>
            <span class="kpi-sub">{{ filteredSessions().length }} romaneios listados</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap emerald">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Peso Bruto Total</span>
            <strong class="kpi-val">{{ totalFilteredStats().totalWeightKg | number:'1.0-0' }} <small>kg</small></strong>
            <span class="kpi-sub">{{ (totalFilteredStats().totalWeightKg / 1000) | number:'1.2-2' }} toneladas</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Média Ponderada</span>
            <strong class="kpi-val text-accent">{{ totalFilteredStats().avgWeightKg | number:'1.1-1' }} <small>kg/cab</small></strong>
            <span class="kpi-sub">Média por cabeça</span>
          </div>
        </div>
      </div>

      <!-- Barra de Filtros & Busca Administrativa -->
      <div class="card filter-bar-card">
        <div class="filter-controls-grid">
          
          <!-- Filtro por Fazenda -->
          <div class="form-group mb-0">
            <label class="form-label">Filtrar por Fazenda / Produtor</label>
            <select 
              class="form-control" 
              [ngModel]="selectedSellerFilter()" 
              (ngModelChange)="selectedSellerFilter.set($event)"
            >
              <option value="">🌾 Todas as Fazendas ({{ sessions().length }} pesagens)</option>
              <option *ngFor="let s of sellers()" [value]="s.id">
                {{ s.farm_name }} — {{ s.responsible_name }} ({{ s.location }})
              </option>
            </select>
          </div>

          <!-- Campo de Busca Rápida em Tempo Real -->
          <div class="form-group mb-0 search-group">
            <label class="form-label">Busca Rápida</label>
            <div class="search-input-wrapper">
              <input 
                type="text" 
                class="form-control search-field" 
                placeholder="Buscar por fazenda, pesador, cidade..." 
                [ngModel]="searchQuery()" 
                (ngModelChange)="searchQuery.set($event)"
              />
              <button 
                *ngIf="searchQuery()" 
                type="button" 
                class="search-clear-btn" 
                (click)="searchQuery.set('')"
                title="Limpar busca"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Filtro por Data -->
          <div class="form-group mb-0">
            <label class="form-label">Data da Pesagem</label>
            <input 
              type="date" 
              class="form-control" 
              [ngModel]="selectedDateFilter()" 
              (ngModelChange)="selectedDateFilter.set($event)"
            />
          </div>

          <!-- Botão Limpar Filtros -->
          <div class="filter-action-box">
            <button 
              *ngIf="selectedSellerFilter() || searchQuery() || selectedDateFilter()" 
              type="button" 
              class="btn btn-secondary btn-sm" 
              (click)="clearFilters()"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      <!-- Tabela Administrativa Desktop -->
      <div class="card table-card">
        <div class="table-card-header">
          <h3 class="card-title">
            Romaneios de Pesagem ({{ filteredSessions().length }})
          </h3>
        </div>

        <div *ngIf="isLoading()" class="loading-state">
          <div class="spinner"></div>
          <p>Carregando registros de pesagens...</p>
        </div>

        <div *ngIf="!isLoading() && filteredSessions().length === 0" class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>{{ searchQuery() || selectedSellerFilter() || selectedDateFilter() ? 'Nenhum romaneio encontrado para os filtros' : 'Nenhum romaneio recebido na base de dados' }}</h3>
          <p class="text-muted" *ngIf="searchQuery() || selectedSellerFilter() || selectedDateFilter()">
            Não encontramos resultados para os filtros selecionados.
          </p>
          <p class="text-muted" *ngIf="!searchQuery() && !selectedSellerFilter() && !selectedDateFilter()">
            Os registros de pesagem só aparecem aqui após serem transmitidos pelos operadores da balança para a base de dados central (Supabase).
          </p>
          <button *ngIf="searchQuery() || selectedSellerFilter() || selectedDateFilter()" type="button" class="btn btn-secondary mt-2" (click)="clearFilters()">
            Limpar Filtros
          </button>
        </div>

        <!-- Tabela Completa para Desktop Otimizada para Toda a Largura -->
        <div *ngIf="!isLoading() && filteredSessions().length > 0" class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Data / Horários</th>
                <th>Fazenda / Origem</th>
                <th>Produtor</th>
                <th>Local</th>
                <th>Pesador</th>
                <th class="text-center">Cabeças</th>
                <th class="text-right">Peso Total</th>
                <th class="text-right">Média</th>
                <th class="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let session of filteredSessions()" class="table-row">
                <td class="td-date-time">
                  <div class="dt-created" title="Horário original da pesagem">
                    📅 {{ session.created_at ? (session.created_at | date:'dd/MM/yyyy HH:mm') : session.session_date }}
                  </div>
                  <div class="dt-updated" *ngIf="session.updated_at && session.updated_at !== session.created_at" title="Data e hora da última alteração">
                    ✏️ Atualizado: {{ session.updated_at | date:'dd/MM/yyyy HH:mm' }}
                  </div>
                </td>
                <td class="td-farm"><strong>{{ session.farm_name }}</strong></td>
                <td>{{ session.seller_name }}</td>
                <td class="td-muted">📍 {{ session.location }}</td>
                <td>{{ session.responsible_name }}</td>
                <td class="text-center">
                  <span class="badge badge-success">{{ session.total_animals }} cab</span>
                </td>
                <td class="text-right td-mono font-bold">{{ session.total_weight_kg | number:'1.2-2' }} kg</td>
                <td class="text-right td-mono text-accent">{{ session.avg_weight_kg | number:'1.2-2' }} kg</td>
                <td class="text-center">
                  <div class="action-buttons-group">
                    <button type="button" class="btn-action view" (click)="openDetailModal(session, false)" title="Ver Detalhes">
                      🔍 Ver
                    </button>
                    <button type="button" class="btn-action edit" (click)="openDetailModal(session, true)" title="Editar Pesagem">
                      ✏️ Editar
                    </button>
                    <button type="button" class="btn-action csv" (click)="exportSessionCsv(session)" title="Baixar CSV">
                      📥 CSV
                    </button>
                    <button type="button" class="btn-action zap" (click)="shareSessionWhatsApp(session)" title="WhatsApp">
                      <svg class="whatsapp-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z"/>
                      </svg>
                      Zap
                    </button>
                    <button type="button" class="btn-action del" (click)="deleteSession(session.id)" title="Excluir Pesagem">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="table-foot-row">
                <td colspan="5"><strong>TOTAL LISTADO</strong></td>
                <td class="text-center"><strong>{{ totalFilteredStats().totalAnimals }} cab</strong></td>
                <td class="text-right td-mono"><strong>{{ totalFilteredStats().totalWeightKg | number:'1.2-2' }} kg</strong></td>
                <td class="text-right td-mono text-accent"><strong>{{ totalFilteredStats().avgWeightKg | number:'1.2-2' }} kg</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- MODAL DE VISUALIZAÇÃO E EDIÇÃO DO ROMANEIO                   -->
      <!-- ============================================================ -->
      <div *ngIf="activeDetailSession" class="modal-overlay" (click)="closeDetailModal()">
        <div class="modal-dialog modal-xl" (click)="$event.stopPropagation()">
          
          <!-- Cabeçalho Compacto do Modal -->
          <div class="modal-header-compact">
            <div class="mhc-left">
              <div class="mhc-badge-row">
                <span class="badge" [class.badge-warning]="isEditingSession" [class.badge-success]="!isEditingSession">
                  {{ isEditingSession ? '✏️ MODO EDIÇÃO' : '📋 ROMANEIO' }}
                </span>
                <span class="mhc-farm">{{ activeDetailSession.farm_name }}</span>
                <span class="mhc-meta-inline" *ngIf="!isEditingSession">
                  • 👤 {{ activeDetailSession.seller_name }} • 📅 {{ activeDetailSession.session_date }} • 📍 {{ activeDetailSession.location }}
                </span>
              </div>
            </div>
            
            <!-- Resumo Rápido dos Totais (Compact Metric Badges) -->
            <div class="mhc-metrics">
              <div class="metric-pill">
                <span class="mp-lbl">Cabeças:</span>
                <strong class="mp-val">{{ activeDetailSession.total_animals }}</strong>
              </div>
              <div class="metric-pill">
                <span class="mp-lbl">Total:</span>
                <strong class="mp-val">{{ activeDetailSession.total_weight_kg | number:'1.1-1' }} kg</strong>
              </div>
              <div class="metric-pill highlight">
                <span class="mp-lbl">Média:</span>
                <strong class="mp-val">{{ activeDetailSession.avg_weight_kg | number:'1.1-1' }} kg/cab</strong>
              </div>
            </div>

            <div class="mhc-right-actions">
              <button 
                type="button" 
                class="btn btn-xs"
                [class.btn-accent]="!isEditingSession"
                [class.btn-secondary]="isEditingSession"
                (click)="toggleModalEditMode(!isEditingSession)"
              >
                {{ isEditingSession ? '👁️ Visualizar' : '✏️ Editar Lote' }}
              </button>
              <button type="button" class="btn-close-compact" (click)="closeDetailModal()" title="Fechar">✕</button>
            </div>
          </div>

          <!-- Barra de Edição de Cabeçalho (Apenas quando em Modo Edição) -->
          <div *ngIf="isEditingSession" class="modal-edit-compact-bar">
            <div class="mec-field date">
              <label>Data e Hora da Pesagem</label>
              <input 
                type="datetime-local" 
                class="form-control-compact" 
                [(ngModel)]="activeDetailSession.session_date" 
              />
            </div>
            <div class="mec-field resp">
              <label>Pesador Responsável</label>
              <input 
                type="text" 
                class="form-control-compact" 
                [(ngModel)]="activeDetailSession.responsible_name" 
                placeholder="Operador" 
              />
            </div>
            <div class="mec-field obs flex-1">
              <label>Observações do Lote</label>
              <input 
                type="text" 
                class="form-control-compact" 
                [(ngModel)]="activeDetailSession.observations" 
                placeholder="Ex: Lote Nelore, Piquete 02..." 
              />
            </div>
            <div class="mec-add-btn">
              <button type="button" class="btn btn-success btn-xs" (click)="addModalItem()">
                ➕ Adicionar Balançada
              </button>
            </div>
          </div>

          <!-- Observações em Modo Visualização (se houver) -->
          <div class="modal-obs-compact" *ngIf="!isEditingSession && activeDetailSession.observations">
            🏷️ <strong>Observações:</strong> {{ activeDetailSession.observations }}
          </div>

          <!-- Tabela de Balançadas (Área Maximizada com Scroll Interno) -->
          <div class="modal-table-container">
            <table class="detail-table">
              <thead>
                <tr>
                  <th style="width: 65px;">#</th>
                  <th class="text-center" style="width: 100px;">Animais</th>
                  <th class="text-right" style="width: 130px;">Peso Total</th>
                  <th class="text-right" style="width: 130px;">Média / Cab</th>
                  <th>Anotação / Brinco</th>
                  <th style="width: 210px;">Horários (Original / Atualizado)</th>
                  <th *ngIf="isEditingSession" class="text-center" style="width: 65px;">Ação</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of activeDetailSession.items; let idx = index">
                  <td class="td-seq">#{{ item.sequence_number }}</td>
                  
                  <!-- Modo Visualização -->
                  <ng-container *ngIf="!isEditingSession">
                    <td class="text-center"><strong>{{ item.animal_count }}</strong> cab</td>
                    <td class="text-right td-mono font-bold">{{ item.weight_kg | number:'1.2-2' }} kg</td>
                    <td class="text-right td-mono text-accent">{{ item.avg_weight_kg | number:'1.2-2' }} kg</td>
                    <td class="td-notes">{{ item.notes || '-' }}</td>
                    <td class="td-timestamp">
                      <div class="ts-created">
                        🕒 <strong>Original:</strong> {{ item.created_at ? (item.created_at | date:'dd/MM/yyyy HH:mm:ss') : '-' }}
                      </div>
                      <div class="ts-updated">
                        ✏️ <strong>Atualizado:</strong> {{ (item.updated_at || item.created_at) ? ((item.updated_at || item.created_at) | date:'dd/MM/yyyy HH:mm:ss') : '-' }}
                      </div>
                    </td>
                  </ng-container>

                  <!-- Modo Edição -->
                  <ng-container *ngIf="isEditingSession">
                    <td class="text-center">
                      <input 
                        type="number" 
                        min="1" 
                        max="50" 
                        class="modal-edit-input num" 
                        [(ngModel)]="item.animal_count" 
                        (input)="recalculateActiveModalTotals()" 
                      />
                    </td>
                    <td class="text-right">
                      <input 
                        type="number" 
                        step="0.1" 
                        min="1" 
                        class="modal-edit-input num font-bold" 
                        [(ngModel)]="item.weight_kg" 
                        (input)="recalculateActiveModalTotals()" 
                      />
                    </td>
                    <td class="text-right td-mono text-accent font-bold">
                      {{ (item.weight_kg / (item.animal_count || 1)) | number:'1.2-2' }} kg
                    </td>
                    <td>
                      <input 
                        type="text" 
                        class="modal-edit-input" 
                        [(ngModel)]="item.notes" 
                        placeholder="Brinco / Identificação" 
                      />
                    </td>
                    <td class="td-timestamp">
                      <div class="ts-created">
                        🕒 <strong>Original:</strong> {{ item.created_at ? (item.created_at | date:'dd/MM/yyyy HH:mm:ss') : '-' }}
                      </div>
                      <div class="ts-updated">
                        ✏️ <strong>Atualizado:</strong> {{ (item.updated_at || item.created_at) ? ((item.updated_at || item.created_at) | date:'dd/MM/yyyy HH:mm:ss') : '-' }}
                      </div>
                    </td>
                    <td class="text-center">
                      <button type="button" class="btn-del-item" (click)="removeModalItem(idx)" title="Excluir Balançada">
                        🗑️
                      </button>
                    </td>
                  </ng-container>
                </tr>

                <tr *ngIf="!activeDetailSession.items || activeDetailSession.items.length === 0">
                  <td [attr.colspan]="isEditingSession ? 7 : 6" class="text-center py-4 text-muted">
                    Nenhuma balançada detalhada cadastrada.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Ações do Rodapé do Modal -->
          <div class="modal-footer-compact">
            <ng-container *ngIf="!isEditingSession">
              <button type="button" class="btn btn-primary btn-sm flex-1" (click)="exportSessionCsv(activeDetailSession)">
                📥 Baixar Romaneio em CSV
              </button>
              <button type="button" class="btn btn-whatsapp btn-sm flex-1" (click)="shareSessionWhatsApp(activeDetailSession)">
                <svg class="whatsapp-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z"/>
                </svg>
                Compartilhar no WhatsApp
              </button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="closeDetailModal()">
                Fechar
              </button>
            </ng-container>

            <ng-container *ngIf="isEditingSession">
              <button 
                type="button" 
                class="btn btn-primary btn-sm flex-1" 
                [disabled]="isSaving()" 
                (click)="saveEditedSession()"
              >
                <span *ngIf="!isSaving()">💾 Salvar Alterações no Romaneio</span>
                <span *ngIf="isSaving()">Gravando...</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="toggleModalEditMode(false)">
                Cancelar Edição
              </button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="closeDetailModal()">
                Fechar
              </button>
            </ng-container>
          </div>

        </div>
      </div>

    </div>
  `,
  styles: [`
    .admin-dashboard {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .admin-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .admin-badge {
      font-size: 0.75rem;
      font-weight: 800;
      color: #34d399;
      letter-spacing: 0.08em;
      margin-bottom: 0.25rem;
    }

    .admin-title {
      font-size: 1.85rem;
      color: var(--text-main);
      margin-bottom: 0.25rem;
    }

    .admin-subtitle {
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .admin-header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .btn-icon {
      width: 18px;
      height: 18px;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }

    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: var(--shadow-sm);
    }

    .kpi-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kpi-icon-wrap svg {
      width: 26px;
      height: 26px;
    }

    .kpi-icon-wrap.green {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }

    .kpi-icon-wrap.emerald {
      background: rgba(5, 150, 105, 0.2);
      color: #10b981;
    }

    .kpi-icon-wrap.amber {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
    }

    .kpi-icon-wrap.gold {
      background: rgba(217, 119, 6, 0.2);
      color: #f59e0b;
    }

    .kpi-content {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kpi-val {
      font-family: var(--font-mono);
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.2;
    }

    .kpi-val small {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-dim);
    }

    .kpi-sub {
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-top: 0.2rem;
    }

    .text-accent {
      color: #34d399;
    }

    .text-gold {
      color: #fbbf24;
    }

    .font-bold {
      font-weight: 700;
    }

    /* Filter Bar */
    .filter-bar-card {
      padding: 1.25rem;
    }

    .filter-controls-grid {
      display: grid;
      grid-template-columns: 1.5fr 2fr 1fr auto;
      gap: 1rem;
      align-items: flex-end;
    }

    @media (max-width: 900px) {
      .filter-controls-grid {
        grid-template-columns: 1fr;
      }
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-field {
      padding-right: 2.2rem;
    }

    .search-clear-btn {
      position: absolute;
      right: 10px;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 0.9rem;
      cursor: pointer;
      padding: 4px;
    }

    .search-clear-btn:hover {
      color: var(--text-main);
    }

    .mb-0 {
      margin-bottom: 0;
    }

    .mb-1 {
      margin-bottom: 0.35rem;
    }

    .mt-2 {
      margin-top: 0.75rem;
    }

    .filter-action-box {
      display: flex;
      align-items: center;
    }

    /* Table */
    .table-card {
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
    }

    .table-card-header {
      padding: 1.15rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-surface-elevated);
      border-bottom: 1px solid var(--border);
    }

    .table-responsive {
      overflow-x: auto;
      width: 100%;
      max-height: 68vh;
    }

    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.86rem;
      text-align: left;
    }

    .admin-table th {
      background: var(--bg-surface-elevated);
      position: sticky;
      top: 0;
      z-index: 10;
      padding: 0.65rem 0.6rem;
      font-size: 0.72rem;
      font-weight: 800;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 2px solid var(--border);
      white-space: nowrap;
    }

    .admin-table td {
      padding: 0.65rem 0.6rem;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
      white-space: nowrap;
    }

    .table-row {
      transition: background 0.12s ease;
    }

    .table-row:hover {
      background: rgba(52, 211, 153, 0.05);
    }

    .table-foot-row td {
      background: var(--bg-surface-elevated);
      font-weight: 800;
      border-top: 2px solid var(--border);
      padding: 0.75rem 0.6rem;
    }

    .td-date-time {
      line-height: 1.3;
      white-space: nowrap;
    }

    .dt-created {
      color: #34d399;
      font-weight: 700;
      font-size: 0.84rem;
    }

    .dt-updated {
      color: #fbbf24;
      font-size: 0.73rem;
      font-family: var(--font-mono);
      margin-top: 2px;
    }

    .td-farm {
      color: var(--text-main);
      font-size: 0.92rem;
    }

    .td-muted {
      color: var(--text-muted);
      font-size: 0.82rem;
    }

    .td-mono {
      font-family: var(--font-mono);
      font-size: 0.88rem;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    .action-buttons-group {
      display: flex;
      gap: 0.25rem;
      justify-content: center;
      align-items: center;
      flex-wrap: nowrap;
    }

    .btn-action {
      border: 1px solid var(--border);
      background: var(--bg-surface-elevated);
      color: var(--text-main);
      padding: 0.32rem 0.5rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      white-space: nowrap;
    }

    .btn-action:hover {
      background: var(--bg-surface);
      border-color: var(--primary-light);
      transform: translateY(-1px);
    }

    .btn-action.view {
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.3);
      background: rgba(56, 189, 248, 0.1);
    }

    .btn-action.view:hover {
      background: #0284c7;
      color: #fff;
    }

    .btn-action.edit {
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.3);
      background: rgba(245, 158, 11, 0.1);
    }

    .btn-action.edit:hover {
      background: #f59e0b;
      color: #000;
      border-color: #f59e0b;
    }

    .btn-action.csv {
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.3);
      background: rgba(16, 185, 129, 0.1);
    }

    .btn-action.csv:hover {
      background: #10b981;
      color: #fff;
    }

    .btn-action.zap {
      color: #22c55e;
      border-color: rgba(34, 197, 94, 0.3);
      background: rgba(34, 197, 94, 0.1);
    }

    .btn-action.zap:hover {
      background: #16a34a;
      color: #fff;
    }

    .btn-action.del {
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.1);
    }

    .btn-action.del:hover {
      background: #ef4444;
      color: #fff;
      border-color: #ef4444;
    }

    /* MODAL FLUTUANTE GRANDE (DIALOG OVERLAY) */
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
      z-index: 999999 !important;
      padding: 1rem !important;
      margin: 0 !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
    }

    .modal-dialog.modal-xl {
      background: #0f172a !important;
      border: 1.5px solid rgba(52, 211, 153, 0.4) !important;
      border-radius: var(--radius-xl) !important;
      padding: 1.25rem 1.5rem !important;
      max-width: 1440px !important;
      width: 96vw !important;
      height: 92vh !important;
      max-height: 94vh !important;
      margin: auto !important;
      display: flex !important;
      flex-direction: column !important;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(5, 150, 105, 0.2) !important;
      overflow: hidden !important;
      text-align: left !important;
      position: relative !important;
      box-sizing: border-box !important;
      animation: modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    /* Cabeçalho Compacto */
    .modal-header-compact {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 0.65rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .mhc-left {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .mhc-badge-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .mhc-farm {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .mhc-meta-inline {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .mhc-metrics {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .metric-pill {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      padding: 0.35rem 0.65rem;
      border-radius: var(--radius-md);
      font-size: 0.8rem;
    }

    .metric-pill.highlight {
      border-color: rgba(245, 158, 11, 0.4);
      background: rgba(245, 158, 11, 0.1);
    }

    .metric-pill .mp-lbl {
      color: var(--text-muted);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .metric-pill .mp-val {
      font-family: var(--font-mono);
      font-size: 0.95rem;
      color: var(--text-main);
      font-weight: 700;
    }

    .metric-pill.highlight .mp-val {
      color: #fbbf24;
    }

    .mhc-right-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .btn-xs {
      padding: 0.35rem 0.65rem;
      font-size: 0.8rem;
      min-height: 32px;
      border-radius: var(--radius-sm);
    }

    .btn-close-compact {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      color: var(--text-muted);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-weight: 700;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .btn-close-compact:hover {
      background: var(--danger);
      color: #fff;
      border-color: var(--danger);
    }

    /* Barra Compacta de Edição */
    .modal-edit-compact-bar {
      display: flex;
      align-items: flex-end;
      gap: 0.65rem;
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: var(--radius-md);
      padding: 0.5rem 0.75rem;
      margin: 0.65rem 0;
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .mec-field {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .mec-field.date {
      width: 140px;
    }

    .mec-field.resp {
      width: 170px;
    }

    .mec-field label {
      font-size: 0.72rem;
      font-weight: 700;
      color: #fbbf24;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .form-control-compact {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-main);
      padding: 0.35rem 0.55rem;
      font-size: 0.85rem;
      height: 34px;
      outline: none;
      transition: border-color 0.15s;
    }

    .form-control-compact:focus {
      border-color: var(--primary-light);
    }

    .mec-add-btn {
      margin-left: auto;
    }

    .modal-obs-compact {
      background: rgba(0, 0, 0, 0.25);
      border-left: 3px solid #f59e0b;
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      color: var(--text-muted);
      margin: 0.5rem 0;
      flex-shrink: 0;
    }

    /* Tabela com Área Maximizada */
    .modal-table-container {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: rgba(0, 0, 0, 0.2);
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .detail-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .detail-table th {
      background: #1e293b;
      position: sticky;
      top: 0;
      z-index: 5;
      padding: 0.55rem 0.75rem;
      font-size: 0.72rem;
      font-weight: 800;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1.5px solid var(--border);
    }

    .detail-table td {
      padding: 0.35rem 0.65rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
    }

    .detail-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .td-seq {
      font-family: var(--font-mono);
      font-weight: 800;
      color: #34d399;
      font-size: 0.85rem;
    }

    .td-timestamp {
      font-size: 0.76rem;
      white-space: nowrap;
      line-height: 1.4;
    }

    .ts-created {
      color: #94a3b8;
      font-family: var(--font-mono);
    }

    .ts-created strong {
      color: #cbd5e1;
      font-weight: 700;
    }

    .ts-updated {
      color: #fbbf24;
      font-family: var(--font-mono);
      font-size: 0.74rem;
      margin-top: 2px;
    }

    .ts-updated strong {
      color: #f59e0b;
      font-weight: 700;
    }

    .modal-edit-input {
      width: 100%;
      background: #1e293b;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-main);
      padding: 0.25rem 0.45rem;
      font-size: 0.85rem;
      height: 32px;
    }

    .modal-edit-input:focus {
      outline: none;
      border-color: #34d399;
      box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.2);
    }

    .modal-edit-input.num {
      text-align: right;
      font-family: var(--font-mono);
      font-weight: 700;
    }

    .btn-del-item {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
    }

    .btn-del-item:hover {
      background: var(--danger);
      color: #fff;
    }

    /* Rodapé Compacto */
    .modal-footer-compact {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding-top: 0.65rem;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
  `]
})
export class BuyerComponent implements OnInit {
  supabase = inject(SupabaseService);
  audio = inject(AudioFeedbackService);
  exportService = inject(ExportService);

  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  sellers = signal<Seller[]>([]);
  sessions = signal<WeighingSession[]>([]);

  // Filtros Reativos como Signals para que o computed recalcule a cada caractere digitado
  selectedSellerFilter = signal<string>('');
  searchQuery = signal<string>('');
  selectedDateFilter = signal<string>('');
  
  // Modal de Detalhes / Edição
  activeDetailSession: WeighingSession | null = null;
  originalModalSessionSnapshot: WeighingSession | null = null;
  isEditingSession = false;

  // Normalização de texto sem acentos para busca rápida flexível
  private normalizeText(text?: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  filteredSessions = computed(() => {
    let list = this.sessions();
    const sellerFilter = this.selectedSellerFilter();
    const dateFilter = this.selectedDateFilter();
    const query = this.normalizeText(this.searchQuery());

    if (sellerFilter) {
      list = list.filter(s => s.seller_id === sellerFilter);
    }

    if (dateFilter) {
      list = list.filter(s => s.session_date === dateFilter);
    }

    if (query) {
      list = list.filter(s => {
        const farm = this.normalizeText(s.farm_name);
        const seller = this.normalizeText(s.seller_name);
        const weigher = this.normalizeText(s.responsible_name);
        const loc = this.normalizeText(s.location);
        const obs = this.normalizeText(s.observations);

        return (
          farm.includes(query) ||
          seller.includes(query) ||
          weigher.includes(query) ||
          loc.includes(query) ||
          obs.includes(query)
        );
      });
    }

    return list;
  });

  totalFilteredStats = computed(() => {
    const list = this.filteredSessions();
    const totalAnimals = list.reduce((acc, s) => acc + s.total_animals, 0);
    const totalWeightKg = list.reduce((acc, s) => acc + s.total_weight_kg, 0);
    const avgWeightKg = totalAnimals > 0 ? totalWeightKg / totalAnimals : 0;
    const totalArrobas = list.reduce((acc, s) => acc + s.total_arrobas, 0);

    return {
      totalAnimals,
      totalWeightKg,
      avgWeightKg,
      totalArrobas,
      sessionCount: list.length
    };
  });

  async ngOnInit() {
    await this.refreshData();
  }

  async refreshData() {
    this.isLoading.set(true);
    const [sellersData, sessionsData] = await Promise.all([
      this.supabase.getSellers(true),
      this.supabase.getWeighingSessions(undefined, true)
    ]);
    this.sellers.set(sellersData);
    this.sessions.set(sessionsData);
    this.isLoading.set(false);
  }

  clearFilters() {
    this.audio.playClick();
    this.selectedSellerFilter.set('');
    this.searchQuery.set('');
    this.selectedDateFilter.set('');
  }

  formatToLocalDateTime(dateStr?: string): string {
    if (!dateStr) return '';
    if (dateStr.includes('T') && dateStr.length >= 16) {
      return dateStr.substring(0, 16);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return `${dateStr}T12:00`;
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  }

  openDetailModal(session: WeighingSession, isEdit = false) {
    this.audio.playClick();
    // Clona para permitir edição isolada e manter snapshot de comparação
    const cloned: WeighingSession = JSON.parse(JSON.stringify(session));
    if (cloned.session_date) {
      cloned.session_date = this.formatToLocalDateTime(cloned.session_date);
    }
    this.originalModalSessionSnapshot = JSON.parse(JSON.stringify(cloned));
    this.activeDetailSession = cloned;
    this.isEditingSession = isEdit;
  }

  closeDetailModal() {
    this.activeDetailSession = null;
    this.originalModalSessionSnapshot = null;
    this.isEditingSession = false;
  }

  toggleModalEditMode(edit: boolean) {
    this.audio.playClick();
    if (!edit && this.originalModalSessionSnapshot) {
      // Restaura o estado anterior se cancelar
      this.activeDetailSession = JSON.parse(JSON.stringify(this.originalModalSessionSnapshot));
    }
    this.isEditingSession = edit;
  }

  recalculateActiveModalTotals() {
    if (!this.activeDetailSession || !this.activeDetailSession.items) return;

    let totalAnimals = 0;
    let totalWeight = 0;

    for (const item of this.activeDetailSession.items) {
      const count = Math.max(1, Number(item.animal_count) || 1);
      const weight = Math.max(0, Number(item.weight_kg) || 0);
      item.animal_count = count;
      item.weight_kg = weight;
      item.avg_weight_kg = Number((weight / count).toFixed(2));
      totalAnimals += count;
      totalWeight += weight;
    }

    this.activeDetailSession.total_animals = totalAnimals;
    this.activeDetailSession.total_weight_kg = totalWeight;
    this.activeDetailSession.avg_weight_kg = totalAnimals > 0 ? Number((totalWeight / totalAnimals).toFixed(2)) : 0;
    this.activeDetailSession.total_arrobas = Number((totalWeight / 30).toFixed(2));
  }

  addModalItem() {
    if (!this.activeDetailSession) return;
    this.audio.playClick();
    if (!this.activeDetailSession.items) {
      this.activeDetailSession.items = [];
    }
    const nowIso = new Date().toISOString();

    const newItem: WeighingItem = {
      sequence_number: this.activeDetailSession.items.length + 1,
      animal_count: 1,
      weight_kg: 0,
      avg_weight_kg: 0,
      notes: '',
      created_at: nowIso,
      updated_at: nowIso
    };

    this.activeDetailSession.items.push(newItem);
    this.recalculateActiveModalTotals();
  }

  removeModalItem(index: number) {
    if (!this.activeDetailSession || !this.activeDetailSession.items) return;
    this.audio.playDelete();
    this.activeDetailSession.items.splice(index, 1);
    this.activeDetailSession.items.forEach((item, idx) => {
      item.sequence_number = idx + 1;
    });
    this.recalculateActiveModalTotals();
  }

  async saveEditedSession() {
    if (!this.activeDetailSession) return;
    this.recalculateActiveModalTotals();
    const nowIso = new Date().toISOString();

    const originalItems = this.originalModalSessionSnapshot?.items || [];
    let anyItemChanged = false;

    if (this.activeDetailSession.items) {
      this.activeDetailSession.items.forEach((item, idx) => {
        // Encontra o item original correspondente pelo ID ou número de sequência inicial
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
          item.updated_at = nowIso;
        } else {
          // Mantém exatamente o timestamp anterior de modificação
          item.updated_at = originalItem.updated_at || originalItem.created_at || item.updated_at || item.created_at || nowIso;
        }

        if (!item.created_at) {
          item.created_at = originalItem?.created_at || nowIso;
        }
      });
    }

    const itemsCountChanged = (this.activeDetailSession.items?.length || 0) !== originalItems.length;
    const sessionFieldsChanged = 
      this.activeDetailSession.responsible_name !== this.originalModalSessionSnapshot?.responsible_name ||
      this.activeDetailSession.session_date !== this.originalModalSessionSnapshot?.session_date ||
      this.activeDetailSession.observations !== this.originalModalSessionSnapshot?.observations;

    if (anyItemChanged || itemsCountChanged || sessionFieldsChanged) {
      this.activeDetailSession.updated_at = nowIso;
    } else {
      this.activeDetailSession.updated_at = this.originalModalSessionSnapshot?.updated_at || this.originalModalSessionSnapshot?.created_at || nowIso;
    }

    this.isSaving.set(true);
    await this.supabase.saveWeighingSession(this.activeDetailSession, this.activeDetailSession.items || []);
    await this.refreshData();
    this.isSaving.set(false);
    this.isEditingSession = false;
    this.originalModalSessionSnapshot = JSON.parse(JSON.stringify(this.activeDetailSession));
    this.audio.playScaleSuccess();
  }

  async deleteSession(sessionId: string) {
    if (!confirm('Deseja realmente excluir permanentemente esta pesagem?')) return;
    this.audio.playDelete();
    await this.supabase.deleteWeighingSession(sessionId);
    if (this.activeDetailSession?.id === sessionId) {
      this.closeDetailModal();
    }
    await this.refreshData();
  }

  exportSessionCsv(session: WeighingSession) {
    this.audio.playClick();
    this.exportService.exportSessionToCsv(session);
  }

  exportAllFilteredCsv() {
    this.audio.playClick();
    this.exportService.exportAllSessionsToCsv(this.filteredSessions());
  }

  shareSessionWhatsApp(session: WeighingSession) {
    this.audio.playClick();
    const seller = this.sellers().find(s => s.id === session.seller_id);
    const url = this.exportService.getWhatsAppShareUrl(session, seller?.phone);
    window.open(url, '_blank');
  }
}
