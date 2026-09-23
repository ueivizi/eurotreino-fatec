import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Monogram } from '@/components/brand/monogram';
import { Icon } from '@/components/ui/icon';
import { fonts, palettes } from '@/theme/tokens';

import type { ShareLayout } from './layouts';

/**
 * A imagem do treino, em 9:16 — o formato dos stories, que é onde ela vai parar.
 *
 * O cartão é sempre **Ônix**, mesmo para quem usa o app no Mármore: a imagem sai do aparelho e
 * passa a representar o produto, e o produto é escuro e dourado. Por isso as cores vêm direto da
 * paleta, sem o tema da tela.
 *
 * Com foto, o retrato ocupa o fundo inteiro e um véu escuro desce sobre ele: sem o véu, o texto
 * dourado some numa foto clara. As proporções são fração da largura do cartão, porque ele é
 * desenhado numa largura e capturado em 1080 — nada aqui pode depender de pixel fixo.
 */

const onix = palettes.onix;

export const CARD_RATIO = 16 / 9;

export type ShareCardProps = {
  layout: ShareLayout;
  /** Nome de quem compartilha e o rank: a assinatura da imagem. */
  displayName: string;
  rankLabel: string;
  /** Foto escolhida pela pessoa. Fica no aparelho: a imagem é montada aqui e vai para a folha. */
  photoUri?: string | null;
  /** Largura do cartão em pontos; a altura sai da proporção. */
  width: number;
};

export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { layout, displayName, rankLabel, photoUri, width },
  ref,
) {
  const height = Math.round(width * CARD_RATIO);
  const unit = width / 100;
  const pad = Math.round(unit * 8);

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width, height, backgroundColor: onix.background }]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient
          colors={['#17130C', onix.background]}
          locations={[0, 0.7]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* O véu garante o contraste do texto sobre qualquer foto, clara ou escura. */}
      <LinearGradient
        colors={['rgba(5,4,3,0.15)', 'rgba(5,4,3,0.55)', 'rgba(5,4,3,0.92)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Sem foto, o alto do cartão ficaria vazio: a modalidade entra ali, grande e discreta. */}
      {photoUri ? null : (
        <View style={[styles.watermark, { top: height * 0.17 }]} pointerEvents="none">
          <Icon name={layout.icon} size={Math.round(unit * 46)} color={onix.gold} strokeWidth={0.8} />
        </View>
      )}

      <View style={[styles.top, { padding: pad }]}>
        <Monogram size={Math.round(unit * 14)} />
        <Text style={{ fontFamily: fonts.display, fontSize: unit * 4.4, letterSpacing: unit * 0.3, color: onix.text }}>
          EUROTREINO
        </Text>
      </View>

      <View style={[styles.bottom, { padding: pad, gap: unit * 4 }]}>
        <Text style={{ fontFamily: fonts.body, fontSize: unit * 3.6, letterSpacing: unit * 0.2, color: onix.textSecondary }}>
          {`${layout.mark}  ${layout.when.toUpperCase()}`}
        </Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.displayBold, fontSize: unit * 11, lineHeight: unit * 13, color: onix.text }}>
          {layout.title}
        </Text>

        <View style={[styles.stats, { gap: unit * 3, marginTop: unit * 2 }]}>
          {layout.stats.map((stat) => (
            <View key={stat.label} style={[styles.stat, { borderColor: onix.hairlineSoft, borderRadius: unit * 1.2, padding: unit * 3 }]}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: unit * 3.2, letterSpacing: unit * 0.2, color: onix.textMuted }}>
                {stat.label.toUpperCase()}
              </Text>
              <Text style={{ fontFamily: fonts.bodySemibold, fontSize: unit * 6.4, color: onix.goldHighlight }}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontFamily: fonts.motto, fontSize: unit * 5.4, color: onix.goldHighlight, marginTop: unit * 2 }}>
          {`"${layout.motto}"`}
        </Text>

        <View style={[styles.signature, { borderTopColor: onix.hairlineSoft, paddingTop: unit * 3, marginTop: unit * 1 }]}>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: unit * 4, color: onix.text }}>
            {displayName}
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: unit * 4, color: onix.gold }}>{rankLabel}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  watermark: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.22,
  },
  bottom: {
    width: '100%',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stat: {
    flexGrow: 1,
    flexBasis: '40%',
    borderWidth: 1,
  },
  signature: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    gap: 8,
  },
});
