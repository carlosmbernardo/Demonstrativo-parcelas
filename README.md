# Evolução de Parcelas — MVP

Software web que substitui a planilha manual de cálculo de evolução de
parcelas de contratos (correção monetária + multa + juros + pagamentos
parciais).

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS para estilos
- SheetJS (`xlsx`) para exportação Excel
- Persistência em `localStorage` (sem backend)

## Como rodar

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>.

Para produção:
```bash
npm run build
npm start
```

## Estrutura

```
app/
  layout.tsx          # Layout raiz + nav (Calculadora / Índices)
  page.tsx            # Página principal (calculadora)
  indices/page.tsx    # Gerenciamento de índices
  globals.css         # Tailwind + utilitários

components/
  ContractForm.tsx    # Formulário completo do contrato
  PaymentsInput.tsx   # Lista dinâmica de pagamentos parciais
  EvolutionTable.tsx  # Tabela de eventos da evolução
  Summary.tsx         # Painel de resumo final
  IndexManager.tsx    # CRUD de índices + entradas mensais

lib/
  calculation.ts      # Motor de cálculo (puro, sem React)
  storage.ts          # Helpers de localStorage
  export.ts           # Geração do arquivo .xlsx

types/
  index.ts            # Tipos compartilhados
```

## Fluxo de uso

1. **Cadastre o(s) índice(s)** em "Índices": informe nome, tipo (CUB/SC, INCC, IPCA, IGP-M ou personalizado) e os valores mensais. A variação mensal é calculada automaticamente em relação ao mês anterior.

2. **Preencha o contrato** na página principal: identificação, datas, valor, percentuais e o modo de correção (índice cadastrado, percentual manual ou sem correção).

3. **Veja a evolução** atualizada em tempo real (resumo + tabela de eventos).

4. **Exporte** clicando em "Exportar Excel" para gerar um `.xlsx` com layout semelhante ao da planilha original.

## Modelo de cálculo

Reproduz fielmente o modelo da planilha-referência (validado contra dados reais: correção, multa, juros e total casam até a segunda casa decimal):

- **Correção monetária** aplicada no **1º de cada mês** (refletindo a publicação mensal dos índices brasileiros).
- **Vencimento** marca a transição para o regime de inadimplência.
- **Multa**: aplicada **uma única vez** no dia seguinte ao vencimento, sobre o saldo na data de vencimento.
- **Juros**: capitalizados no **último dia de cada mês** após o vencimento, com taxa diária equivalente `(1+i_m)^(1/30)-1` aplicada sobre o número de dias do período. Se a data final cair no meio do mês, é gerado um juros parcial extra.
- **Base de cálculo** pós-vencimento:
  - Juros: `saldo − multa` (juros incidem sobre principal + juros anteriores; capitalização mensal padrão)
  - Correção: `saldo − multa − juros_acumulados` (corrige só o principal)
- **Déficit de variações negativas**: se um mês tem variação negativa do índice, "utilizado" é zero e o déficit acumula; correções positivas futuras absorvem o déficit antes de serem aplicadas.
- **Pagamentos parciais** entram em ordem cronológica e reduzem o saldo diretamente.

A lógica fica encapsulada em `/lib/calculation.ts` e é independente do front; pode ser testada/portada para outro contexto sem alterações.

## Validações

- Campos obrigatórios (título, devedor, datas, valor)
- Datas válidas
- Vencimento ≥ competência
- Valor não-negativo
- Multa/juros não-negativos
- Modo "index" exige índice cadastrado
- Modo "manual" exige percentual informado
- Avisos (não-bloqueantes) quando faltam variações de índice em meses específicos

## Persistência

Tudo em `localStorage` sob o namespace `contract-evolution`:
- `contract-evolution:indices` — array de índices cadastrados
- `contract-evolution:current-contract` — último contrato em edição

Para limpar, abra o DevTools → Application → Local Storage → remover as chaves.
