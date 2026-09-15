import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Stop } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';

/** Folhas da coroa de louros, abertas no topo (mesma geometria do canvas de design). */
const LEAVES = Array.from({ length: 9 }, (_, i) => [
  `rotate(${202 + i * 13} 66 66) translate(0 -54) rotate(-26 66 66)`,
  `rotate(${158 - i * 13} 66 66) translate(0 -54) rotate(26 66 66)`,
]).flat();

type Props = {
  size?: number;
};

/** Símbolo aprovado: monograma "E" em coroa de louros. */
export function Monogram({ size = 132 }: Props) {
  const letterSize = Math.round(size * 0.41);
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="EuroTreino">
      <Svg width={size} height={size} viewBox="0 0 132 132" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="folha" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E6C878" />
            <Stop offset="1" stopColor="#A8842F" />
          </LinearGradient>
        </Defs>
        {LEAVES.map((transform) => (
          <Ellipse key={transform} cx={66} cy={66} rx={4} ry={9} fill="url(#folha)" transform={transform} />
        ))}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <AppText
          style={{ fontFamily: fonts.displayBold, fontSize: letterSize, lineHeight: Math.round(letterSize * 1.15), color: '#E6C878' }}
          maxFontSizeMultiplier={1}
          importantForAccessibility="no">
          E
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
