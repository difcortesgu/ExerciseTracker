interface Exercise {
  readonly name: string;
}

const exercises: readonly Exercise[] = [];

export const firstName = exercises[0]?.name ?? 'none';
