import type { ExerciseFieldErrorCode, ExerciseFieldIssue } from '../domain/exercise-errors';

import { fieldErrors, issueText } from './exercise-issue-texts';

const issue = (
  code: ExerciseFieldErrorCode,
  details?: ExerciseFieldIssue['details'],
  field: ExerciseFieldIssue['field'] = 'name',
): ExerciseFieldIssue => ({
  field,
  code,
  message: 'English log text the form never shows',
  ...(details === undefined ? {} : { details }),
});

describe('issueText', () => {
  it.each<[ExerciseFieldErrorCode, ExerciseFieldIssue['details'] | undefined, string]>([
    ['exercises.nameRequired', undefined, 'Enter a name'],
    ['exercises.nameTooLong', { maximum: 80 }, 'Use at most 80 characters'],
    [
      'exercises.duplicateName',
      { existingName: 'Barbell Squat' },
      "'Barbell Squat' already exists",
    ],
    ['exercises.categoryRequired', undefined, 'Pick a category'],
    [
      'exercises.unknownCategory',
      { key: 'x' },
      'This category is no longer available. Pick another one',
    ],
    [
      'exercises.unknownMuscle',
      { key: 'x' },
      'This muscle is no longer available. Pick another one',
    ],
    [
      'exercises.unknownEquipment',
      { key: 'x' },
      'This equipment is no longer available. Pick another one',
    ],
    ['exercises.primaryMuscleRequired', undefined, 'Pick at least one primary muscle'],
    ['exercises.muscleListedTwice', { key: 'x' }, 'A muscle cannot be both primary and secondary'],
    ['exercises.vocabularyValueRequired', undefined, 'Enter a value'],
    ['exercises.vocabularyValueTooLong', { maximum: 40 }, 'Use at most 40 characters'],
    ['exercises.instructionsTooLong', { maximum: 5000 }, 'Use at most 5000 characters in total'],
    ['exercises.tooManyPhotos', { maximum: 6 }, 'Up to 6 photos'],
    ['exercises.noTrackedMetric', undefined, 'Pick at least one'],
  ])('shows %s as readable text', (code, details, expected) => {
    expect(issueText(issue(code, details))).toBe(expected);
  });

  it('still reads well when the details are missing or of the wrong type', () => {
    expect(issueText(issue('exercises.nameTooLong'))).toBe('This name is too long');
    expect(issueText(issue('exercises.duplicateName', { existingName: 42 }))).toBe(
      'This name already exists',
    );
    expect(issueText(issue('exercises.tooManyPhotos', { maximum: '6' }))).toBe('Too many photos');
    expect(issueText(issue('exercises.instructionsTooLong'))).toBe(
      'These instructions are too long',
    );
    expect(issueText(issue('exercises.vocabularyValueTooLong'))).toBe('This value is too long');
  });
});

describe('fieldErrors', () => {
  it('groups the issues by the field they belong to', () => {
    const errors = fieldErrors([
      issue('exercises.nameRequired', undefined, 'name'),
      issue('exercises.noTrackedMetric', undefined, 'trackedMetrics'),
    ]);

    expect(errors).toEqual({ name: 'Enter a name', trackedMetrics: 'Pick at least one' });
  });

  it('shows every issue of one field, one per line', () => {
    const errors = fieldErrors([
      issue('exercises.primaryMuscleRequired', undefined, 'primaryMuscles'),
      issue('exercises.unknownMuscle', { key: 'x' }, 'primaryMuscles'),
    ]);

    expect(errors.primaryMuscles).toBe(
      'Pick at least one primary muscle\nThis muscle is no longer available. Pick another one',
    );
  });
});
