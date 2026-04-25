import type { TestCase } from '../types';

export const cotacaoPFScenario: TestCase[] = [
  {
    id: '02-01',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Quero uma cotação para mim',
    criterion: 'Inicia coleta de dados (idade, perfil)',
  },
  {
    id: '02-02',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Tenho 35 anos',
    criterion: 'Processa a idade e continua o fluxo de cotação',
  },
  {
    id: '02-03',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Quero incluir minha família no plano',
    criterion: 'Pergunta número de dependentes/membros da família',
  },
  {
    id: '02-04',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Somos 4: eu, minha esposa e 2 filhos',
    criterion: 'Calcula ou encaminha para cotação familiar com 4 membros',
  },
  {
    id: '02-05',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Cobre consultas médicas?',
    criterion: 'Detalha as coberturas do plano',
  },
  {
    id: '02-06',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Qual a diferença entre os planos?',
    criterion: 'Compara as opções de planos disponíveis',
  },
  {
    id: '02-07',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Tem carência?',
    criterion: 'Informa a política de carência do plano',
  },
  {
    id: '02-08',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Tenho -5 anos',
    criterion: 'Trata idade inválida sem quebrar o fluxo de atendimento',
  },
  {
    id: '02-09',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Como posso pagar?',
    criterion: 'Informa as formas de pagamento disponíveis',
  },
  {
    id: '02-10',
    scenario: 'Cotação PF (Individual e Familiar)',
    message: 'Tem algum desconto?',
    criterion: 'Responde sobre descontos ou promoções disponíveis',
  },
];
