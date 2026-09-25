import { Injectable } from '@angular/core';
import { WeighingSession } from '../models/weighing.model';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  /**
   * Exporta uma única sessão com todos os seus lançamentos de pesagem detalhados para CSV (padrão Excel Brasil)
   */
  exportSessionToCsv(session: WeighingSession) {
    const lines: string[] = [];

    // Cabeçalho da Empresa e da Fazenda
    lines.push('COLOMBO AGRO - ROMANEIO ELETRÔNICO DE PESAGEM');
    lines.push(`Fazenda / Origem;${session.farm_name}`);
    lines.push(`Vendedor / Produtor;${session.seller_name}`);
    lines.push(`Município / Localização;${session.location}`);
    lines.push(`Responsável pela Balança;${session.responsible_name}`);
    lines.push(`Data da Pesagem;${session.session_date}`);
    lines.push(`Horário Original de Registro;${session.created_at ? new Date(session.created_at).toLocaleString('pt-BR') : session.session_date}`);
    lines.push(`Horário da Última Atualização;${session.updated_at ? new Date(session.updated_at).toLocaleString('pt-BR') : (session.created_at ? new Date(session.created_at).toLocaleString('pt-BR') : session.session_date)}`);
    lines.push(`Observações;${session.observations || 'N/A'}`);
    lines.push('');

    // Cabeçalho dos Lançamentos
    lines.push('Seq;Animais na Balança;Peso Total Lote (kg);Peso Médio Cabeça (kg);Anotação/Brinco;Horário Original da Pesagem;Horário da Última Atualização');

    if (session.items && session.items.length > 0) {
      session.items.forEach(item => {
        const weightFormatted = item.weight_kg.toFixed(2).replace('.', ',');
        const avgFormatted = item.avg_weight_kg.toFixed(2).replace('.', ',');
        const notes = item.notes ? item.notes.replace(/;/g, ',') : '';
        const createdAtFormatted = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '';
        const updatedAtFormatted = item.updated_at ? new Date(item.updated_at).toLocaleString('pt-BR') : (createdAtFormatted || '');
        lines.push(`${item.sequence_number};${item.animal_count};${weightFormatted};${avgFormatted};${notes};${createdAtFormatted};${updatedAtFormatted}`);
      });
    }

    lines.push('');
    lines.push('TOTAIS CONSOLIDADOS');
    lines.push(`Total de Cabeças;${session.total_animals}`);
    lines.push(`Peso Bruto Total (kg);${session.total_weight_kg.toFixed(2).replace('.', ',')}`);
    lines.push(`Média por Animal (kg);${session.avg_weight_kg.toFixed(2).replace('.', ',')}`);

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `Pesagem_Colombo_${session.farm_name.replace(/\s+/g, '_')}_${session.session_date}.csv`;
    this.downloadBlob(blob, fileName);
  }

  /**
   * Exporta a lista consolidada de todas as sessões para CSV
   */
  exportAllSessionsToCsv(sessions: WeighingSession[]) {
    const lines: string[] = [];

    lines.push('COLOMBO AGRO - RELATÓRIO GERAL DE PESAGENS');
    lines.push(`Gerado em;${new Date().toLocaleString('pt-BR')}`);
    lines.push('');
    lines.push('Data;Fazenda;Vendedor;Localização;Responsável Balança;Cabeças;Peso Total (kg);Média (kg);Status;Observações;Data/Hora Registro;Última Atualização');

    sessions.forEach(s => {
      const createdAt = s.created_at ? new Date(s.created_at).toLocaleString('pt-BR') : '';
      const updatedAt = s.updated_at ? new Date(s.updated_at).toLocaleString('pt-BR') : (createdAt || '');
      lines.push([
        s.session_date,
        `"${s.farm_name.replace(/"/g, '""')}"`,
        `"${s.seller_name.replace(/"/g, '""')}"`,
        `"${s.location.replace(/"/g, '""')}"`,
        `"${s.responsible_name.replace(/"/g, '""')}"`,
        s.total_animals,
        s.total_weight_kg.toFixed(2).replace('.', ','),
        s.avg_weight_kg.toFixed(2).replace('.', ','),
        s.status === 'completed' ? 'Finalizado' : 'Rascunho',
        `"${(s.observations || '').replace(/"/g, '""')}"`,
        createdAt,
        updatedAt
      ].join(';'));
    });

    const totalAnimals = sessions.reduce((acc, s) => acc + s.total_animals, 0);
    const totalWeight = sessions.reduce((acc, s) => acc + s.total_weight_kg, 0);
    const generalAvg = totalAnimals > 0 ? (totalWeight / totalAnimals) : 0;

    lines.push('');
    lines.push(`TOTAL GERAL;;;;;${totalAnimals};${totalWeight.toFixed(2).replace('.', ',')};${generalAvg.toFixed(2).replace('.', ',')};;`);

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `Colombo_Agro_Relatorio_Pesagens_${new Date().toISOString().split('T')[0]}.csv`;
    this.downloadBlob(blob, fileName);
  }

  /**
   * Gera texto formatado para envio direto via WhatsApp
   */
  getWhatsAppShareUrl(session: WeighingSession, phone?: string): string {
    const text = 
`🐄 *ROMANEIO DE PESAGEM - COLOMBO AGRO*
━━━━━━━━━━━━━━━━━━━━
📍 *Fazenda:* ${session.farm_name}
👤 *Produtor:* ${session.seller_name}
📌 *Local:* ${session.location}
⚖️ *Pesador:* ${session.responsible_name}
📅 *Data:* ${session.session_date}
📝 *Obs:* ${session.observations || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
📊 *RESUMO DO LOTE:*
🐂 *Total de Cabeças:* ${session.total_animals} cab
⚖️ *Peso Bruto Total:* ${session.total_weight_kg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
🎯 *Média por Animal:* ${session.avg_weight_kg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg/cab
━━━━━━━━━━━━━━━━━━━━
✅ _Pesagem registrada e conferida via App Colombo Agro._`;

    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const phoneParam = cleanPhone.length >= 10 ? `phone=${cleanPhone}&` : '';
    return `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(text)}`;
  }

  private downloadBlob(blob: Blob, fileName: string) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
