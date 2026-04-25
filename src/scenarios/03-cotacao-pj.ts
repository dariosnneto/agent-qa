import type { TestCase } from '../types';

export const cotacaoPJScenario: TestCase[] = [
  {
    id: '03-01',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'Quero um plano para minha empresa',
    criterion: 'Inicia fluxo PJ e pergunta dados da empresa',
  },
  {
    id: '03-02',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'Somos 10 funcionários',
    criterion: 'Processa o tamanho da empresa e continua a cotação',
  },
  {
    id: '03-03',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'Cobre todos os funcionários?',
    criterion: 'Explica a abrangência do plano PJ para funcionários',
  },
  {
    id: '03-04',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'Qual a diferença do plano empresa pro individual?',
    criterion: 'Compara plano PJ vs PF de forma clara',
  },
  {
    id: '03-05',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'Tenho só 1 funcionário além de mim',
    criterion: 'Trata microempresa/MEI adequadamente',
  },
  {
    id: '03-06',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'Somos 500 funcionários',
    criterion: 'Redireciona para processo de grandes contas',
  },
  {
    id: '03-07',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'Os dependentes dos funcionários são cobertos?',
    criterion: 'Informa a política de cobertura de dependentes no plano PJ',
  },
  {
    id: '03-08',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: '12345678',
    criterion: 'Trata dado inválido (CNPJ inválido) sem travar o atendimento',
  },
  {
    id: '03-09',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'O plano PJ tem reembolso?',
    criterion: 'Responde sobre a política de reembolso no plano PJ',
  },
  {
    id: '03-10',
    scenario: 'Cotação PJ (Pessoa Jurídica)',
    message: 'Pode me enviar uma proposta por e-mail?',
    criterion: 'Coleta e-mail ou informa o processo de envio de proposta formal',
  },
];
