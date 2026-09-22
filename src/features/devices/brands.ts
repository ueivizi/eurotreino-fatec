/**
 * Marcas de relógio e o caminho de cada uma até o EuroTreino.
 *
 * Nenhuma dessas marcas entrega os treinos direto para apps de terceiros sem contrato: Garmin só abre a
 * API para empresas aprovadas, e Zepp (Amazfit) e Samsung Health não têm API pública de nuvem. Todas,
 * porém, escrevem no repositório de saúde do celular — Health Connect no Android e Apple Saúde no iPhone —,
 * e é de lá que o app lê, com a permissão da pessoa. Sem conta de parceiro, sem servidor intermediário.
 */

export const DEVICE_BRANDS = ['garmin', 'amazfit', 'galaxy', 'apple'] as const;
export type DeviceBrand = (typeof DEVICE_BRANDS)[number];

export type HealthPlatform = 'health-connect' | 'apple-health';

type BrandInfo = {
  label: string;
  /** App da marca, onde a pessoa liga o envio para o repositório de saúde. */
  companionApp: string;
  /** Passos no app da marca, por plataforma; `null` quando a marca não funciona nessa plataforma. */
  setup: Record<'android' | 'ios', string[] | null>;
  /** Por que a marca não serve na plataforma, quando não serve. */
  unsupported?: Partial<Record<'android' | 'ios', string>>;
};

export const BRAND_INFO: Record<DeviceBrand, BrandInfo> = {
  garmin: {
    label: 'Garmin',
    companionApp: 'Garmin Connect',
    setup: {
      android: [
        'Abra o Garmin Connect e atualize o app, se a loja oferecer.',
        'Toque em Mais, depois em Configurações, e entre em Health Connect.',
        'Permita o envio de atividades, distância e frequência cardíaca.',
      ],
      ios: null,
    },
  },
  amazfit: {
    label: 'Amazfit',
    companionApp: 'Zepp',
    setup: {
      android: [
        'Abra o Zepp e entre em Perfil.',
        'Toque em Adicionar contas (ou Vincular contas de terceiros) e escolha Health Connect.',
        'Ligue Sincronizar com o Health Connect e permita exercícios, distância e frequência cardíaca.',
      ],
      ios: null,
    },
  },
  galaxy: {
    label: 'Galaxy Watch',
    companionApp: 'Samsung Health',
    setup: {
      android: [
        'Abra o Samsung Health e entre em Configurações.',
        'Em Serviços conectados, escolha Health Connect.',
        'Permita compartilhar exercícios, distância e frequência cardíaca.',
      ],
      ios: null,
    },
    unsupported: { ios: 'O Galaxy Watch não funciona com iPhone.' },
  },
  apple: {
    label: 'Apple Watch',
    companionApp: 'Saúde',
    setup: { android: null, ios: null },
    unsupported: { android: 'O Apple Watch só funciona com iPhone.' },
  },
};

/** Sem conta de desenvolvedor Apple ainda não há versão instalável para iPhone: o caminho fica anotado. */
export const IOS_PENDING_MESSAGE =
  'A leitura da Apple Saúde entra com a versão para iPhone. Por enquanto, importe o arquivo GPX exportado pelo app da marca.';

export function isDeviceBrand(value: unknown): value is DeviceBrand {
  return DEVICE_BRANDS.some((brand) => brand === value);
}

export const DEVICE_BRAND_STORAGE_KEY = 'eurotreino.relogio';

/** Qual dos aparelhos encontrados é o da pessoa (pacote do app que gravou o treino). */
export const DEVICE_ORIGIN_STORAGE_KEY = 'eurotreino.relogio.origem';
