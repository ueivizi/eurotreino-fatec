/**
 * Política de Privacidade e Termos de Uso exibidos no app (NF013 · LGPD).
 * Descrevem o que o app faz de fato: ao mudar coleta, retenção ou compartilhamento de dados,
 * atualize aqui e a data de atualização. Versão do piloto acadêmico, sujeita a revisão da equipe.
 */

export const CONTACT_EMAIL = 'contato.eurotreino@gmail.com';

export type LegalSection = {
  heading: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export type LegalDocument = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: readonly LegalSection[];
};

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Política de Privacidade',
  updatedAt: '15 de setembro de 2026',
  intro:
    'O EuroTreino é um aplicativo de treino com ranking privado entre amigos, criado como projeto acadêmico por estudantes da Fatec Osasco. Esta política explica quais dados usamos, para quê e como você controla seus dados, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
  sections: [
    {
      heading: 'Quem cuida dos seus dados',
      paragraphs: [
        `A equipe do projeto EuroTreino, da Fatec Osasco – Prefeito Hirant Sanazar, é responsável pelo tratamento dos dados. Fale com a equipe pelo e-mail ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Quais dados usamos',
      items: [
        'Conta: seu e-mail, usado para entrar com código. Se você entrar com o Google, o serviço de autenticação também recebe o nome e a foto da conta Google; eles não aparecem no app.',
        'Perfil: nome de exibição e emblema. Não pedimos foto, idade, peso, medidas nem localização.',
        'Treinos: tipo, duração, intensidade, dia e horário de cada treino, e a Glória calculada.',
        'Legiões: as Legiões que você fundou ou em que entrou, seu papel, a data de entrada e os códigos de convite gerados.',
        'Segurança: tentativas de código de convite inválido e registros de ações como fundar, entrar e sair de Legiões, trocar código e editar o perfil. Esses registros não guardam códigos, nomes nem senhas.',
        'No aparelho: a sessão de acesso fica no armazenamento seguro do celular (ou no navegador, na versão Web), e treinos registrados sem internet ficam guardados até o envio.',
        'Dados técnicos: os provedores do serviço registram dados das conexões, como o endereço IP, por tempo limitado, para operar e proteger o serviço.',
      ],
      paragraphs: ['Não usamos publicidade nem ferramentas de rastreamento de comportamento.'],
    },
    {
      heading: 'Para que usamos',
      items: [
        'Permitir que você entre e continue conectado.',
        'Calcular a Glória, os ranks e a Arena semanal.',
        'Mostrar seu perfil e sua posição aos membros das suas Legiões.',
        'Proteger o serviço contra abuso, com limites de tentativas e registros de segurança.',
        'Enviar os e-mails com código de acesso. Não enviamos propaganda.',
      ],
    },
    {
      heading: 'Quem vê o quê',
      items: [
        'Membros das suas Legiões: nome de exibição, emblema, rank, Glória da semana e posição na Arena.',
        'Só você: seu e-mail e os detalhes de cada treino.',
        'Quem não está em nenhuma Legião com você não vê nada do seu perfil.',
      ],
    },
    {
      heading: 'Com quem compartilhamos',
      items: [
        'Supabase: hospeda o banco de dados, a autenticação e as funções do servidor. O banco de dados fica na região de São Paulo.',
        'Google: entrega os e-mails com código e, se você escolher, faz a entrada com a conta Google.',
      ],
      paragraphs: [
        'Esses serviços podem tratar dados também fora do Brasil, com as garantias previstas na LGPD. Nunca vendemos nem alugamos dados pessoais.',
      ],
    },
    {
      heading: 'Por quanto tempo guardamos',
      items: [
        'Perfil, treinos, Glória e Legiões: enquanto sua conta existir.',
        'Tentativas de código de convite inválido: 1 dia.',
        'Registros de segurança: 90 dias.',
        'Ao excluir a conta, perfil, treinos, Glória e vínculos com Legiões são apagados na hora, e os registros de segurança deixam de apontar para você.',
      ],
    },
    {
      heading: 'Com que base usamos',
      paragraphs: [
        'Usamos seus dados para prestar o serviço que você pediu ao criar a conta (entrar, perfil, Legiões e Arena) e, no caso dos registros de segurança, para proteger o serviço e as pessoas que o usam. Os registros de treino são tratados com o cuidado de dados sensíveis: você escolhe o que registrar, e pode apagar tudo a qualquer momento excluindo a conta.',
      ],
    },
    {
      heading: 'Seus direitos',
      items: [
        'Ver seus dados: o Perfil, o Início e a Arena mostram o que guardamos sobre você.',
        'Corrigir: Perfil › Editar nome e emblema.',
        'Excluir: Perfil › Excluir conta e dados, quando quiser.',
        `Pedir uma cópia dos seus dados ou mais informações sobre o tratamento: escreva para ${CONTACT_EMAIL}. Respondemos em até 15 dias.`,
        'Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
      ],
    },
    {
      heading: 'Como protegemos',
      items: [
        'Todas as conexões são criptografadas.',
        'As regras de quem pode ver cada dado ficam no próprio banco de dados, e não só no app.',
        'A Glória é calculada no servidor: ninguém grava pontos diretamente.',
        'Excluir a conta exige confirmação com código enviado ao seu e-mail.',
      ],
    },
    {
      heading: 'Idade',
      paragraphs: ['O EuroTreino é destinado a pessoas com 18 anos ou mais.'],
    },
    {
      heading: 'Mudanças nesta política',
      paragraphs: ['Quando esta política mudar, avisaremos no app e atualizaremos a data abaixo do título.'],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  title: 'Termos de Uso',
  updatedAt: '15 de setembro de 2026',
  intro:
    'Ao usar o EuroTreino, você concorda com estes termos. Eles são curtos de propósito: leia com atenção.',
  sections: [
    {
      heading: 'O que é o EuroTreino',
      paragraphs: [
        'Um aplicativo gratuito de registro de treinos com ranking privado entre amigos, criado como projeto acadêmico. Está em fase de testes: pode mudar, ficar fora do ar ou ser encerrado ao fim do projeto.',
      ],
    },
    {
      heading: 'Não é orientação profissional',
      paragraphs: [
        'O EuroTreino não prescreve treinos e não substitui profissional de educação física nem médico. Respeite seus limites e procure orientação antes de começar atividades intensas.',
      ],
    },
    {
      heading: 'Sua conta',
      items: [
        'A conta é pessoal: não compartilhe o acesso.',
        'Mantenha seu e-mail seguro, porque é por ele que você entra.',
        'Você pode excluir a conta a qualquer momento em Perfil › Excluir conta e dados.',
      ],
    },
    {
      heading: 'Jogo limpo',
      items: [
        'Registre só treinos que você realmente fez.',
        'Não tente burlar a pontuação, os limites ou a segurança do app.',
        'A Glória não vale dinheiro nem dá direito a prêmios.',
      ],
    },
    {
      heading: 'Respeito na Legião',
      items: [
        'Use nome de exibição e nome de Legião respeitosos: nada de ofensas, discriminação ou se passar por outra pessoa.',
        'Contas usadas para abuso podem ser excluídas pela equipe.',
      ],
    },
    {
      heading: 'Privacidade',
      paragraphs: ['O uso dos seus dados segue a Política de Privacidade, disponível no app.'],
    },
    {
      heading: 'Contato',
      paragraphs: [`Dúvidas, sugestões ou problemas: ${CONTACT_EMAIL}.`],
    },
  ],
};
