# Colombo Agro - Sistema de Pesagem de Gado (Mobile-First)

Aplicação Web mobile-first desenvolvida em **Angular** com integração ao **Supabase** para registro, controle e romaneio de pesagens de gado para venda à **Colombo Agro**.

---

## 📱 Principais Funcionalidades

### 1. Visão do Vendedor (Produtor / Curral)
- **Cadastro e Seleção da Fazenda**: Nome da propriedade, vendedor/responsável, localização (cidade/UF), telefone/WhatsApp e inscrição.
- **Cabeçalho da Sessão**: Data da pesagem, operador da balança e observações do lote.
- **Balança Eletrônica Digital Mobile**:
  - Padrão **1 animal por pesagem**, com botões rápidos táteis de 1-toque para múltiplos animais (1, 2, 3, 5, 10 ou quantidade personalizada).
  - Teclado de peso com botões rápidos de incremento (+5kg, +10kg, +50kg, +100kg, Zerar).
  - Cálculo instantâneo em tempo real de **Média por Cabeça** e **Total em Arrobas (@)**.
  - Feedback sonoro (Web Audio API) simulando bipe de balança rodoviária/eletrônica.
  - Lista de pesagens com numeração sequencial (#1, #2, #3...), peso individual, médias e anotações (ex: brinco, lote).
- **Resumo e Envio**:
  - Consolidação completa com total de animais, peso bruto, médias e arrobas vivas e carcaça (rendimento 50%).
  - Transmissão direta ao Supabase com fallback offline automático (LocalStorage).
  - Efeito visual de confetes e comprovante pós-envio.

### 2. Visão do Comprador (Colombo Agro)
- **Interface Otimizada para o Campo**: Cartões de alto contraste para leitura clara sob sol forte.
- **Modo Sol Forte (Alto Contraste)**: Botão no cabeçalho que altera o contraste para ambientes abertos.
- **Filtros e Busca**: Filtragem por vendedor/fazenda e busca textual instantânea.
- **Métricas Consolidadas**: Total de cabeças, peso bruto total acumulado, média geral e total de arrobas.
- **Detalhes da Pesagem**: Modal detalhado com cada balançada individual do lote.
- **Exportação CSV & Compartilhamento**:
  - Exportação de CSV formatado para padrão Excel Brasil (ponto e vírgula e decimais em vírgula).
  - Exportação individual de romaneio ou relatório geral de todas as pesagens.
  - Link de envio direto formatado para **WhatsApp**.

---

## 🗄️ Estrutura do Supabase

O arquivo `supabase-schema.sql` na raiz do projeto contém o script pronto para criação das tabelas no **SQL Editor** do Supabase:

- `sellers`: Tabela de produtores e fazendas parceiras.
- `weighing_sessions`: Tabela dos romaneios de pesagem consolidados.
- `weighing_items`: Tabela dos lançamentos individuais efetuados na balança.

### Configurar no Aplicativo:
1. Acesse o menu inferior **Supabase**.
2. Insira a sua **Project URL** e a **Anon Key**.
3. Clique em **Salvar Credenciais** e **Testar Conexão**.

---

## 🚀 Como Executar o Projeto

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm start
# ou
ng serve
```

Acesse no navegador: `http://localhost:4200`
