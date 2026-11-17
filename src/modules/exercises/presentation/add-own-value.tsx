import { useState, type ReactElement } from 'react';
import { View } from 'react-native';

import { Button, TextField, useTheme } from '@shared/ui';

export interface AddOwnValueProps {
  /** E.g. "equipment", "muscle" — the input is labelled "New equipment". */
  readonly noun: string;
  /** Resolves the reason the value was rejected, or `undefined` once it is selected. */
  readonly onAdd: (label: string) => Promise<string | undefined>;
}

/**
 * "Add your own" in a form picker (S1-29): reveals an input, sends the text as typed (the domain
 * trims, validates and matches it against existing values) and shows the rejection reason in place.
 */
export function AddOwnValue({ noun, onAdd }: AddOwnValueProps): ReactElement {
  const { spacing } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) {
    return <Button label="Add your own" variant="secondary" onPress={() => setIsOpen(true)} />;
  }

  const add = async () => {
    setIsAdding(true);
    const rejection = await onAdd(text);
    setIsAdding(false);
    setError(rejection);
    if (rejection === undefined) {
      setText('');
      setIsOpen(false);
    }
  };

  return (
    <View style={{ gap: spacing.small }}>
      <TextField
        label={`New ${noun}`}
        value={text}
        onChangeText={setText}
        {...(error === undefined ? {} : { error })}
      />
      <Button label="Add" disabled={isAdding} onPress={() => void add()} />
    </View>
  );
}
