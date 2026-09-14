import { Pressable, StyleSheet, View } from 'react-native';

import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { tapFeedback } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { EMBLEMS, EMBLEM_LABELS, type EmblemName } from '@/features/profile/emblems';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type Props = {
  label: string;
  value: EmblemName;
  onChange: (emblem: EmblemName) => void;
};

export function EmblemPicker({ label, value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <AppText variant="label" tone="secondary">{label}</AppText>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {EMBLEMS.map((emblem) => {
          const selected = emblem === value;
          return (
            <Pressable
              key={emblem}
              accessibilityRole="radio"
              accessibilityLabel={EMBLEM_LABELS[emblem]}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                tapFeedback();
                onChange(emblem);
              }}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? colors.selectedFill : 'transparent',
                  borderColor: selected ? colors.gold : colors.hairlineSoft,
                  borderWidth: selected ? 1.5 : 1,
                },
              ]}>
              <EmblemAvatar emblem={emblem} size={48} />
              <AppText variant="caption" tone={selected ? 'goldHighlight' : 'secondary'}>
                {EMBLEM_LABELS[emblem]}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: space.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  option: {
    width: '23.5%',
    paddingVertical: space.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: space.xs,
  },
});
