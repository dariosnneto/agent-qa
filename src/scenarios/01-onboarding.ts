import type { TestCase } from '../types';

export const onboardingScenario: TestCase[] = [
  {
    id: '01-01',
    scenario: 'Onboarding e Apresentação',
    message: 'Oi',
    criterion: 'Eugênia se apresenta e menciona App Vida',
  },
  {
    id: '01-02',
    scenario: 'Onboarding e Apresentação',
    message: 'O que você oferece?',
    criterion: 'Descreve os serviços/planos disponíveis',
  },
  {
    id: '01-03',
    scenario: 'Onboarding e Apresentação',
    message: 'Quais planos vocês têm?',
    criterion: 'Lista categorias de plano (PF/PJ, individual/familiar)',
  },
  {
    id: '01-04',
    scenario: 'Onboarding e Apresentação',
    message: 'asdfghjkl',
    criterion: 'Trata input inválido sem travar o fluxo',
  },
  {
    id: '01-05',
    scenario: 'Onboarding e Apresentação',
    message: '.',
    criterion: 'Pede mais contexto ou mantém o fluxo',
  },
  {
    id: '01-06',
    scenario: 'Onboarding e Apresentação',
    message: 'What do you sell?',
    criterion: 'Responde ou solicita que o usuário fale em português',
  },
  {
    id: '01-07',
    scenario: 'Onboarding e Apresentação',
    message: 'Quanto custa?',
    criterion: 'Pede mais informações antes de cotar (sem contexto suficiente)',
  },
  {
    id: '01-08',
    scenario: 'Onboarding e Apresentação',
    message: 'O que é a App Vida?',
    criterion: 'Explica a empresa/produto',
  },
  {
    id: '01-09',
    scenario: 'Onboarding e Apresentação',
    message: 'Quero falar com um atendente humano',
    criterion: 'Executa protocolo de handoff para atendente humano',
  },
  {
    id: '01-10',
    scenario: 'Onboarding e Apresentação',
    message: 'Tchau, obrigado',
    criterion: 'Encerra a conversa de forma adequada',
  },
];
