import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Seller } from '../models/seller.model';
import { WeighingSession, WeighingItem } from '../models/weighing.model';

export interface SupabaseConfig {
  url: string;
  key: string;
}

const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: 'https://txadtqsuwcuuapjfwbge.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YWR0cXN1d2N1dWFwamZ3YmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTM1MDAsImV4cCI6MjEwNTkyOTUwMH0.8YCoSEbb3cjS-M18fx_0RVKjjvC4HDHj7BYHdyyRUCs'
};

const STORAGE_KEY_CONFIG = 'colombo_supabase_config';
const STORAGE_KEY_SELLERS = 'colombo_local_sellers';
const STORAGE_KEY_SESSIONS = 'colombo_local_sessions';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client: SupabaseClient | null = null;
  
  public isConnected = signal<boolean>(false);
  public isOnlineMode = signal<boolean>(true);
  public isSyncing = signal<boolean>(false);
  public pendingSyncCount = signal<number>(0);
  public isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  public currentConfig = signal<SupabaseConfig>(DEFAULT_SUPABASE_CONFIG);
  public connectionMessage = signal<string>('Inicializando...');

  constructor() {
    this.loadConfig();
    this.initializeClient();
    this.updatePendingCount();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline.set(true);
        this.testConnection().then(res => {
          if (res.success) {
            this.syncPendingSessions();
          }
        });
      });

      window.addEventListener('offline', () => {
        this.isOnline.set(false);
        this.isConnected.set(false);
        this.connectionMessage.set('Sem conexão (Offline)');
      });

      // Verificação periódica em segundo plano (a cada 25 segundos)
      setInterval(() => {
        if (this.pendingSyncCount() > 0 && navigator.onLine) {
          this.syncPendingSessions();
        }
      }, 25000);
    }
  }

  public updatePendingCount(): number {
    const list = this.getLocalSessions();
    const count = list.filter(s => s.sync_status !== 'synced').length;
    this.pendingSyncCount.set(count);
    return count;
  }

  public loadConfig(): SupabaseConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url && parsed.key) {
          this.currentConfig.set(parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar config Supabase:', e);
    }
    this.currentConfig.set(DEFAULT_SUPABASE_CONFIG);
    return DEFAULT_SUPABASE_CONFIG;
  }

  public saveConfig(config: SupabaseConfig): boolean {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      this.currentConfig.set(config);
      this.initializeClient();
      return true;
    } catch {
      return false;
    }
  }

  public initializeClient() {
    const config = this.currentConfig();
    try {
      if (config.url && config.key && config.url.startsWith('http')) {
        this.client = createClient(config.url, config.key, {
          auth: { persistSession: true, autoRefreshToken: true }
        });
        this.testConnection().then(res => {
          if (res.success) {
            this.syncPendingSessions();
          }
        });
      } else {
        this.client = null;
        this.isConnected.set(false);
        this.connectionMessage.set('Armazenamento Local');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.client = null;
      this.isConnected.set(false);
      this.connectionMessage.set(`Erro: ${message}`);
    }
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.client) {
      return { success: false, message: 'Cliente não inicializado.' };
    }
    try {
      const { error } = await this.client.from('sellers').select('id').limit(1);
      if (error) {
        this.isConnected.set(false);
        const msg = `Verifique permissões: ${error.message}`;
        this.connectionMessage.set(msg);
        return { success: false, message: msg };
      }
      this.isConnected.set(true);
      const okMsg = 'Conectado com sucesso';
      this.connectionMessage.set(okMsg);
      return { success: true, message: okMsg };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha na rede.';
      this.isConnected.set(false);
      this.connectionMessage.set(msg);
      return { success: false, message: msg };
    }
  }

  // ==========================================
  // SINCRONIZAÇÃO AUTOMÁTICA EM SEGUNDO PLANO
  // ==========================================

  public async syncPendingSessions(): Promise<{ success: boolean; syncedCount: number }> {
    if (this.isSyncing()) return { success: false, syncedCount: 0 };

    if (!this.client || !this.isConnected()) {
      const conn = await this.testConnection();
      if (!conn.success) {
        this.updatePendingCount();
        return { success: false, syncedCount: 0 };
      }
    }

    this.isSyncing.set(true);
    let syncedCount = 0;

    try {
      // 1. Sincroniza vendedores primeiro
      const localSellers = this.getLocalSellers();
      if (localSellers.length > 0 && this.client) {
        await this.client.from('sellers').upsert(localSellers);
      }

      // 2. Busca sessões pendentes de envio
      const localSessions = this.getLocalSessions();
      const pending = localSessions.filter(s => s.sync_status !== 'synced');

      for (const session of pending) {
        if (!this.client) break;

        const sessionPayload = {
          id: session.id,
          seller_id: session.seller_id,
          farm_name: session.farm_name,
          seller_name: session.seller_name,
          location: session.location,
          responsible_name: session.responsible_name,
          session_date: session.session_date,
          observations: session.observations || '',
          total_animals: session.total_animals,
          total_weight_kg: session.total_weight_kg,
          avg_weight_kg: session.avg_weight_kg,
          total_arrobas: session.total_arrobas,
          status: session.status || 'completed'
        };

        const { error: sessionError } = await this.client
          .from('weighing_sessions')
          .upsert(sessionPayload);

        if (!sessionError) {
          const items = session.items || [];
          if (items.length > 0) {
            const itemsPayload = items.map((item, idx) => ({
              id: item.id || this.generateUuid(),
              session_id: session.id,
              sequence_number: item.sequence_number || idx + 1,
              animal_count: item.animal_count,
              weight_kg: item.weight_kg,
              avg_weight_kg: item.avg_weight_kg,
              notes: item.notes || ''
            }));

            await this.client.from('weighing_items').delete().eq('session_id', session.id);
            await this.client.from('weighing_items').insert(itemsPayload);
          }

          session.sync_status = 'synced';
          this.saveOrUpdateLocalSession(session);
          syncedCount++;
        }
      }
    } catch (err) {
      console.warn('Erro durante sincronização em segundo plano:', err);
    } finally {
      this.isSyncing.set(false);
      this.updatePendingCount();
    }

    return { success: true, syncedCount };
  }

  // ==========================================
  // SELLERS (VENDEDORES / FAZENDAS)
  // ==========================================

  public async getSellers(remoteOnly = false): Promise<Seller[]> {
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('sellers')
          .select('*')
          .order('farm_name', { ascending: true });

        if (!error && data) {
          this.isConnected.set(true);
          this.saveLocalSellers(data);
          return data;
        } else if (error) {
          console.warn('Erro ao buscar vendedores no Supabase:', error);
        }
      } catch (err) {
        console.warn('Erro de rede ao buscar vendedores no Supabase:', err);
      }
    }

    // Se for visão administrativa (remoteOnly) e estiver offline
    if (remoteOnly) {
      return this.getLocalSellers();
    }

    return this.getLocalSellers();
  }

  public async saveSeller(seller: Omit<Seller, 'id'> & { id?: string }): Promise<Seller> {
    const finalSeller: Seller = {
      id: seller.id || this.generateUuid(),
      farm_name: seller.farm_name.trim(),
      responsible_name: seller.responsible_name.trim(),
      location: seller.location.trim(),
      phone: seller.phone?.trim() || '',
      state_registration: seller.state_registration?.trim() || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Salvar localmente no dispositivo do vendedor
    const local = this.getLocalSellers();
    const existingIdx = local.findIndex(s => s.id === finalSeller.id);
    if (existingIdx >= 0) {
      local[existingIdx] = finalSeller;
    } else {
      local.unshift(finalSeller);
    }
    this.saveLocalSellers(local);

    // Enviar ao Supabase se configurado
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('sellers')
          .upsert(finalSeller)
          .select()
          .single();

        if (!error && data) {
          this.isConnected.set(true);
          return data;
        }
      } catch (err) {
        console.warn('Erro ao persistir vendedor no Supabase:', err);
      }
    }

    return finalSeller;
  }

  public async deleteSeller(sellerId: string): Promise<boolean> {
    const local = this.getLocalSellers().filter(s => s.id !== sellerId);
    this.saveLocalSellers(local);

    if (this.client) {
      try {
        await this.client.from('sellers').delete().eq('id', sellerId);
      } catch (err) {
        console.warn('Erro ao excluir vendedor no Supabase:', err);
      }
    }
    return true;
  }

  // ==========================================
  // WEIGHING SESSIONS (ROMANEIOS DE PESAGEM)
  // ==========================================

  public async getWeighingSessions(sellerId?: string, remoteOnly = false): Promise<WeighingSession[]> {
    if (this.client) {
      try {
        let query = this.client
          .from('weighing_sessions')
          .select('*, items:weighing_items(*)')
          .neq('status', 'deleted')
          .order('session_date', { ascending: false });

        if (sellerId) {
          query = query.eq('seller_id', sellerId);
        }

        const { data, error } = await query;
        if (!error && data) {
          this.isConnected.set(true);
          const sessionsWithItems = data.map(item => ({
            ...item,
            sync_status: 'synced' as const,
            items: (item.items || []).sort((a: WeighingItem, b: WeighingItem) => a.sequence_number - b.sequence_number)
          }));
          this.mergeRemoteWithLocalSessions(sessionsWithItems);
          return sellerId ? sessionsWithItems.filter(s => s.seller_id === sellerId) : sessionsWithItems;
        } else if (error) {
          console.warn('Erro ao buscar sessões no Supabase:', error);
        }
      } catch (err) {
        console.warn('Erro ao buscar sessões no Supabase:', err);
      }
    }

    // Fallback: se estiver offline / cliente não conectado
    let localSessions = this.getLocalSessions().filter(s => s.status !== 'deleted');
    if (remoteOnly) {
      // Para o comprador em modo offline: exibe as sessões que foram marcadas como sincronizadas
      localSessions = localSessions.filter(s => s.sync_status === 'synced');
    }
    if (sellerId) {
      localSessions = localSessions.filter(s => s.seller_id === sellerId);
    }
    return localSessions;
  }

  public async saveWeighingSession(
    session: WeighingSession,
    items: WeighingItem[]
  ): Promise<{ session: WeighingSession; synced: boolean }> {
    session.items = items;
    session.updated_at = new Date().toISOString();

    // Salva no armazenamento local
    session.sync_status = 'pending';
    this.saveOrUpdateLocalSession(session);

    let isSynced = false;

    // Enviar ao Supabase
    if (this.client) {
      try {
        // 1. Garante que o vendedor existe no banco antes de criar a sessão (evita erro de chave estrangeira)
        if (session.seller_id) {
          const sellerObj = this.getLocalSellers().find(s => s.id === session.seller_id) || {
            id: session.seller_id,
            farm_name: session.farm_name,
            responsible_name: session.seller_name,
            location: session.location
          };
          await this.client.from('sellers').upsert(sellerObj);
        }

        const sessionPayload = {
          id: session.id,
          seller_id: session.seller_id,
          farm_name: session.farm_name,
          seller_name: session.seller_name,
          location: session.location,
          responsible_name: session.responsible_name,
          session_date: session.session_date,
          observations: session.observations || '',
          total_animals: session.total_animals,
          total_weight_kg: session.total_weight_kg,
          avg_weight_kg: session.avg_weight_kg,
          total_arrobas: session.total_arrobas,
          status: session.status || 'completed'
        };

        const { error: sessionError } = await this.client
          .from('weighing_sessions')
          .upsert(sessionPayload);

        if (!sessionError) {
          const itemsPayload = items.map((item, idx) => ({
            id: item.id || this.generateUuid(),
            session_id: session.id,
            sequence_number: item.sequence_number || idx + 1,
            animal_count: item.animal_count,
            weight_kg: item.weight_kg,
            avg_weight_kg: item.avg_weight_kg,
            notes: item.notes || ''
          }));

          if (itemsPayload.length > 0) {
            await this.client.from('weighing_items').delete().eq('session_id', session.id);
            await this.client.from('weighing_items').insert(itemsPayload);
          }

          session.sync_status = 'synced';
          this.saveOrUpdateLocalSession(session);
          isSynced = true;
          this.isConnected.set(true);
        } else {
          console.warn('Erro ao salvar weighing_session no Supabase:', sessionError);
        }
      } catch (err) {
        console.warn('Erro ao sincronizar pesagem com Supabase:', err);
      }
    }

    this.updatePendingCount();
    return { session, synced: isSynced };
  }

  public async deleteWeighingSession(sessionId: string): Promise<boolean> {
    const local = this.getLocalSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(local));
    this.updatePendingCount();

    if (this.client) {
      try {
        // 1. Tenta exclusão física
        await this.client.from('weighing_items').delete().eq('session_id', sessionId);
        await this.client.from('weighing_sessions').delete().eq('id', sessionId);
        
        // 2. Garante exclusão lógica via update de status caso a política DELETE não esteja no Supabase
        await this.client.from('weighing_sessions').update({ status: 'deleted' }).eq('id', sessionId);
      } catch (err) {
        console.warn('Erro ao deletar no Supabase:', err);
      }
    }
    return true;
  }

  // ==========================================
  // LOCAL STORAGE
  // ==========================================

  public getLocalSellers(): Seller[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SELLERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveLocalSellers(sellers: Seller[]) {
    try {
      localStorage.setItem(STORAGE_KEY_SELLERS, JSON.stringify(sellers));
    } catch (e) {
      console.error('Erro ao gravar sellers no localStorage:', e);
    }
  }

  public getLocalSessions(): WeighingSession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveOrUpdateLocalSession(session: WeighingSession) {
    const list = this.getLocalSessions();
    const idx = list.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      list[idx] = session;
    } else {
      list.unshift(session);
    }
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(list));
  }

  private mergeRemoteWithLocalSessions(remoteSessions: WeighingSession[]) {
    const local = this.getLocalSessions();
    const map = new Map<string, WeighingSession>();

    remoteSessions.forEach(s => map.set(s.id, s));

    local.forEach(s => {
      if (!map.has(s.id)) {
        map.set(s.id, s);
      }
    });

    const combined = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || b.session_date).getTime() - new Date(a.created_at || a.session_date).getTime()
    );
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(combined));
  }

  public generateUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
