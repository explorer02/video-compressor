import { Button } from '../../../ui';

export function ActionPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      size="sm"
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
    />
  );
}
