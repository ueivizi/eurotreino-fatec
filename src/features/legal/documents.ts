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
  updatedAt: '26 de setembro de 2026',
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
        'Conta: seu e-mail e sua senha, usados para entrar (a senha fica com o serviço de autenticação só como resumo criptográfico, nunca em texto; também dá para entrar com código por e-mail). Se você entrar com o Google, o serviço de autenticação também recebe o nome e a foto da conta Google; eles não aparecem no app.',
        'Perfil: nome de exibição, emblema e a cor escolhida. Não pedimos foto, idade, peso, medidas nem localização.',
        'Treinos: tipo, duração, intensidade, dia e horário de cada treino, e a Glória calculada. Se você quiser, também a distância percorrida, as séries feitas com repetições e carga, e os exercícios da sua ficha.',
        'Medidas de saúde (só com seu consentimento): frequência cardíaca média e máxima que você digitar ou que vier do relógio conectado. Sem o consentimento, o app recusa o envio.',
        'Relógio (só se você conectar): com a sua permissão no Health Connect, o app lê no próprio aparelho os treinos das últimas 48 horas gravados pelo app do relógio — tipo, início, fim e distância — e, com o consentimento de saúde ligado, a frequência cardíaca. De um arquivo GPX que você escolher, lê o mesmo resumo; o trajeto serve só para calcular a distância no aparelho e não é enviado. Só vira registro o treino que você confirmar, e o app nunca grava nada no Health Connect.',
        'Juramento da semana (se você fizer): quantos dias por semana você se comprometeu a treinar, guardado na semana em que foi feito. Ele não muda a Glória nem o Coliseu.',
        'Legiões: as Legiões que você fundou ou em que entrou, seu papel, a data de entrada e os códigos de convite gerados.',
        'Mural da Legião: as mensagens que você escreve (só texto, até 500 caracteres, sem link) com a data, e as denúncias que você faz.',
        'Segurança: tentativas de código de convite inválido e registros de ações como fundar, entrar e sair de Legiões, trocar código, editar o perfil e escrever, apagar e denunciar no Mural. Esses registros não guardam códigos, nomes nem senhas.',
        'No aparelho: a sessão de acesso fica no armazenamento seguro do celular (ou no navegador, na versão Web), e treinos registrados sem internet ficam guardados até o envio.',
        'Só no aparelho, nunca enviados: as rotas que você desenha no mapa (a distância é calculada ali) e a foto que você escolher para a imagem de compartilhar, que é montada no próprio celular.',
        'Dados técnicos: os provedores do serviço registram dados das conexões, como o endereço IP, por tempo limitado, para operar e proteger o serviço.',
      ],
      paragraphs: ['Não usamos publicidade nem ferramentas de rastreamento de comportamento.'],
    },
    {
      heading: 'Para que usamos',
      items: [
        'Permitir que você entre e continue conectado.',
        'Calcular a Glória, os ranks e o Coliseu semanal.',
        'Mostrar seu perfil e sua posição aos membros das suas Legiões.',
        'Proteger o serviço contra abuso, com limites de tentativas e registros de segurança.',
        'Enviar os e-mails com código de acesso. Não enviamos propaganda.',
      ],
    },
    {
      heading: 'Quem vê o quê',
      items: [
        'Membros das suas Legiões: nome de exibição, emblema, rank, Glória da semana e posição no Coliseu, e as mensagens que você escreve no Mural daquela Legião.',
        'Fundador da Legião: também vê quantas denúncias cada mensagem do Mural recebeu, sem saber quem denunciou.',
        'Só você: seu e-mail e os detalhes de cada treino.',
        'Quem não está em nenhuma Legião com você não vê nada do seu perfil.',
      ],
    },
    {
      heading: 'Com quem compartilhamos',
      items: [
        'Supabase: hospeda o banco de dados, a autenticação e as funções do servidor. O banco de dados fica na região de São Paulo.',
        'Google: entrega os e-mails com código e, se você escolher, faz a entrada com a conta Google.',
        'OpenFreeMap: entrega as imagens do mapa quando você abre a tela de desenhar rota. Recebe o endereço IP e a área do mapa que está na tela, nunca o seu trajeto.',
      ],
      paragraphs: [
        'Esses serviços podem tratar dados também fora do Brasil, com as garantias previstas na LGPD. Nunca vendemos nem alugamos dados pessoais.',
      ],
    },
    {
      heading: 'Por quanto tempo guardamos',
      items: [
        'Perfil, treinos, Glória e Legiões: enquanto sua conta existir.',
        'Mensagens do Mural: até quem escreveu ou o fundador apagar, a Legião deixar de existir ou a conta ser excluída.',
        'Tentativas de código de convite inválido: 1 dia.',
        'Registros de segurança: 90 dias.',
        'Ao excluir a conta, perfil, treinos, Glória, juramentos, mensagens do Mural e vínculos com Legiões são apagados na hora, e os registros de segurança deixam de apontar para você.',
      ],
    },
    {
      heading: 'Com que base usamos',
      paragraphs: [
        'Usamos seus dados para prestar o serviço que você pediu ao criar a conta (entrar, perfil, Legiões e Coliseu) e, no caso dos registros de segurança, para proteger o serviço e as pessoas que o usam. Você escolhe o que registrar, e pode apagar tudo a qualquer momento excluindo a conta.',
        'A frequência cardíaca é a única exceção: por ser dado sensível de saúde, ela só é tratada mediante o seu consentimento específico, ligado e desligado por você em Configurações.',
      ],
    },
    {
      heading: 'Seus direitos',
      items: [
        'Ver seus dados: o Perfil, o Início e o Coliseu mostram o que guardamos sobre você.',
        'Corrigir: no Perfil, o lápis ao lado do nome; um treino da semana, em Anais › Corrigir treino.',
        'Excluir: Configurações › Excluir conta e dados, quando quiser. Uma mensagem sua do Mural: toque nela e apague.',
        'Desconectar o relógio: retire a permissão do EuroTreino no Health Connect, a qualquer momento.',
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
      heading: 'Frequência cardíaca: consentimento específico',
      paragraphs: [
        'A frequência cardíaca é dado pessoal sensível de saúde pela Lei Geral de Proteção de Dados (art. 5º, II). Por isso ela não entra junto com o resto: só é registrada depois de você ligar esse consentimento em Configurações, de forma separada e específica (art. 11, I).',
        'Você pode desligar a qualquer momento. Ao desligar, apagamos na mesma hora todas as frequências cardíacas já guardadas nos seus treinos — o treino continua no histórico, sem a medida.',
      ],
      items: [
        'A medida é digitada por você ou lida do relógio que você conectou, e só com o consentimento ligado: o app não lê sensor do celular.',
        'Ela serve só para o seu próprio histórico.',
        'Nunca aparece para a sua Legião, não entra no Coliseu, não conta na Glória e não vai no texto de compartilhar.',
        'Sem o consentimento ligado, o servidor recusa o envio — não é o app que decide isso.',
      ],
    },
    {
      heading: 'Idade mínima: 16 anos',
      paragraphs: [
        'O EuroTreino é para pessoas com 16 anos ou mais. Quem tem entre 16 e 18 anos deve usar o app com o conhecimento de um responsável, que pode pedir a exclusão da conta a qualquer momento pelo e-mail de contato.',
        'Não criamos conta para menores de 16 anos. Se soubermos que uma conta é de alguém com menos de 16, ela é excluída com os dados.',
        'O app é feito de um jeito que reduz o risco para quem é mais novo:',
      ],
      items: [
        'A Legião é fechada e só se entra por convite: não existe busca por pessoas, perfil público nem sugestão de amigos.',
        'A única conversa é o Mural de cada Legião, visto só pelos membros: só texto, sem link, sem foto e sem mensagem privada. Quem escreve apaga a própria mensagem, o fundador apaga qualquer uma, e três denúncias escondem a mensagem até o fundador decidir.',
        'Não pedimos foto, localização, peso, medidas nem data de nascimento. O mapa de rota funciona sem permissão de localização.',
        'Seu perfil só é visto por quem está em uma Legião com você.',
        'Não há publicidade, rastreamento, compras nem qualquer cobrança.',
      ],
    },
    {
      heading: 'Mudanças nesta política',
      paragraphs: ['Quando esta política mudar, avisaremos no app e atualizaremos a data abaixo do título.'],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  title: 'Termos de Uso',
  updatedAt: '26 de setembro de 2026',
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
        'Mantenha seu e-mail e sua senha seguros, porque é por eles que você entra.',
        'Você pode excluir a conta a qualquer momento em Configurações › Excluir conta e dados.',
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
        'No Mural, a mesma regra: nada de ofensa, assédio, discriminação ou conteúdo impróprio. O fundador pode apagar mensagens, e os membros podem denunciar.',
        'Contas usadas para abuso podem ser excluídas pela equipe.',
      ],
    },
    {
      heading: 'Idade mínima',
      items: [
        'É preciso ter 16 anos ou mais para usar o EuroTreino.',
        'Entre 16 e 18 anos, o uso deve ser com o conhecimento de um responsável, que pode pedir a exclusão da conta pelo e-mail de contato.',
        'Ao criar a conta, você declara ter 16 anos ou mais.',
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
