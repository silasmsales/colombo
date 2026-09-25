export interface WeighingItem {
  id?: string;
  session_id?: string;
  sequence_number: number;
  animal_count: number;
  weight_kg: number;
  avg_weight_kg: number;
  notes?: string;
  created_at?: string; // Data e hora de criação/registro da pesagem
  updated_at?: string; // Data e hora da última alteração do item
}

export interface WeighingSession {
  id: string;
  seller_id: string;
  farm_name: string;
  seller_name: string;
  location: string;
  responsible_name: string; // Quem fez a pesagem na balança
  session_date: string; // YYYY-MM-DD
  observations?: string;
  total_animals: number;
  total_weight_kg: number;
  avg_weight_kg: number;
  total_arrobas: number; // Peso total / 30 (arroba viva bovina)
  status: 'draft' | 'completed' | 'verified' | 'deleted';
  items?: WeighingItem[];
  created_at?: string;
  updated_at?: string;
  sync_status?: 'synced' | 'pending' | 'local_only';
}

export interface WeighingStats {
  totalAnimals: number;
  totalWeightKg: number;
  avgWeightKg: number;
  totalArrobas: number;
  minBatchWeightKg: number;
  maxBatchWeightKg: number;
  batchCount: number;
}
