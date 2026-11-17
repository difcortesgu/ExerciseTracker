import type {
  ExerciseField,
  ExerciseFieldErrorCode,
  ExerciseFieldIssue,
} from '../domain/exercise-errors';

/**
 * Presenter of the form's field issues (S1-19, S1-29): one text per domain error code. The form
 * never checks a rule itself; it shows what the domain and the use cases return, by code (the
 * English `message` of an issue is for logs only).
 */

type Details = ExerciseFieldIssue['details'];

function numberDetail(details: Details, name: string): number | undefined {
  const value = details?.[name];
  return typeof value === 'number' ? value : undefined;
}

function textDetail(details: Details, name: string): string | undefined {
  const value = details?.[name];
  return typeof value === 'string' ? value : undefined;
}

const atMost =
  (fallback: string, suffix = '') =>
  (details: Details) => {
    const maximum = numberDetail(details, 'maximum');
    return maximum === undefined ? fallback : `Use at most ${maximum} characters${suffix}`;
  };

const noLongerAvailable = (what: string) => () =>
  `This ${what} is no longer available. Pick another one`;

const ISSUE_TEXTS: Readonly<Record<ExerciseFieldErrorCode, (details: Details) => string>> = {
  'exercises.nameRequired': () => 'Enter a name',
  'exercises.nameTooLong': atMost('This name is too long'),
  'exercises.duplicateName': (details) => {
    const existingName = textDetail(details, 'existingName');
    return existingName === undefined
      ? 'This name already exists'
      : `'${existingName}' already exists`;
  },
  'exercises.categoryRequired': () => 'Pick a category',
  'exercises.unknownCategory': noLongerAvailable('category'),
  'exercises.unknownMuscle': noLongerAvailable('muscle'),
  'exercises.unknownEquipment': noLongerAvailable('equipment'),
  'exercises.primaryMuscleRequired': () => 'Pick at least one primary muscle',
  'exercises.muscleListedTwice': () => 'A muscle cannot be both primary and secondary',
  'exercises.vocabularyValueRequired': () => 'Enter a value',
  'exercises.vocabularyValueTooLong': atMost('This value is too long'),
  'exercises.instructionsTooLong': atMost('These instructions are too long', ' in total'),
  'exercises.tooManyPhotos': (details) => {
    const maximum = numberDetail(details, 'maximum');
    return maximum === undefined ? 'Too many photos' : `Up to ${maximum} photos`;
  },
  'exercises.noTrackedMetric': () => 'Pick at least one',
};

/** The text shown for one issue (also used by "Add your own", whose errors share these codes). */
export function issueText(issue: Pick<ExerciseFieldIssue, 'code' | 'details'>): string {
  return ISSUE_TEXTS[issue.code](issue.details);
}

/** Field → text to show next to it; several issues of one field are shown one per line. */
export function fieldErrors(
  issues: readonly ExerciseFieldIssue[],
): Partial<Record<ExerciseField, string>> {
  const errors: Partial<Record<ExerciseField, string>> = {};
  for (const fieldIssue of issues) {
    const text = issueText(fieldIssue);
    const previous = errors[fieldIssue.field];
    errors[fieldIssue.field] = previous === undefined ? text : `${previous}\n${text}`;
  }
  return errors;
}
