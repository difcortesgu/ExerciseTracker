import { anExerciseDraft, existing, newValue } from './exercise-draft.builder';

describe('anExerciseDraft', () => {
  it('builds the valid form input of "My Goblet Squat" by default', () => {
    expect(anExerciseDraft().build()).toEqual({
      name: 'My Goblet Squat',
      category: { source: 'existing', key: 'strength' },
      primaryMuscles: [{ source: 'existing', key: 'quadriceps' }],
      secondaryMuscles: [{ source: 'existing', key: 'glutes' }],
      equipment: { source: 'existing', key: 'kettlebells' },
      instructionsText: 'Hold the kettlebell at your chest.\nSquat down and stand up.',
      photos: [],
      trackedMetrics: ['weight', 'reps'],
    });
  });

  it('overrides fields, names it and attaches photos', () => {
    const draft = anExerciseDraft()
      .named('Sandbag Carry')
      .withPhotos('a.jpg')
      .with({ equipment: newValue('Sandbag'), category: existing('Cardio') })
      .build();

    expect(draft).toMatchObject({
      name: 'Sandbag Carry',
      photos: ['a.jpg'],
      equipment: { source: 'new', label: 'Sandbag' },
      category: { source: 'existing', key: 'cardio' },
    });
  });
});
