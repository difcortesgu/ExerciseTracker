import { Slot } from 'expo-router';
import { renderRouter, type RenderRouterResult } from 'expo-router/testing-library';
import type { ReactElement, ReactNode } from 'react';
import { Text } from 'react-native';

import { createContainer, type Container } from '@core/di/container';
import { AppStack, DependencyProvider } from '@core/presentation';
import { domainError } from '@shared/domain/domain-error';
import { ok } from '@shared/domain/result';
import {
  anExerciseDetails,
  anExerciseFormValues,
  anExerciseListItem,
  aVocabularyOption,
} from '@test/builders/exercise-dtos.builder';

import {
  CreateCustomExerciseToken,
  DeleteCustomExerciseToken,
  DiscardPhotosToken,
  GetExerciseDetailsToken,
  GetExerciseFormValuesToken,
  GetExerciseImageToken,
  FindExercisesToken,
  ImportPhotoToken,
  ListVocabularyOptionsToken,
  PrepareDuplicateToken,
  ResolveVocabularyValueToken,
  UpdateCustomExerciseToken,
  EditExerciseScreen,
  ExerciseDetailScreen,
  ExercisesScreen,
  NewExerciseScreen,
  type CreateCustomExercise,
  type DeleteCustomExercise,
  type DiscardPhotos,
  type ExerciseImageRef,
  type FindExercises,
  type GetExerciseDetails,
  type GetExerciseFormValues,
  type GetExerciseImage,
  type ImportPhoto,
  type ListVocabularyOptions,
  type PrepareDuplicate,
  type ResolveVocabularyValue,
  type UpdateCustomExercise,
  type VocabularyOptions,
} from '@modules/exercises';

/**
 * Test harness of the exercises screens (S1-16 to S1-23, S1-29): every use case the screens
 * resolve, stubbed with a plain typed function (use cases are functions; no fakes needed), and a
 * container wired with them. Tests override only the use cases that matter for the behaviour.
 */

export interface ExerciseUseCases {
  readonly findExercises: FindExercises;
  readonly listVocabularyOptions: ListVocabularyOptions;
  readonly getExerciseDetails: GetExerciseDetails;
  readonly getExerciseImage: GetExerciseImage;
  readonly resolveVocabularyValue: ResolveVocabularyValue;
  readonly createCustomExercise: CreateCustomExercise;
  readonly updateCustomExercise: UpdateCustomExercise;
  readonly deleteCustomExercise: DeleteCustomExercise;
  readonly getExerciseFormValues: GetExerciseFormValues;
  readonly prepareDuplicate: PrepareDuplicate;
  readonly importPhoto: ImportPhoto;
  readonly discardPhotos: DiscardPhotos;
}

const option = (label: string) => aVocabularyOption().labelled(label).build();

/** Filter and picker values: a few built-ins per vocabulary plus the user's own "Sandbag". */
export const vocabularyOptions: VocabularyOptions = Object.freeze({
  category: Object.freeze([option('Cardio'), option('Strength')]),
  muscle: Object.freeze([option('Glutes'), option('Hamstrings'), option('Quadriceps')]),
  equipment: Object.freeze([
    option('Barbell'),
    option('Kettlebells'),
    aVocabularyOption().labelled('Sandbag').custom().build(),
  ]),
});

/** Where the stubbed `GetExerciseImage` pretends a cached image lives. */
export const cachedImageUri = (image: ExerciseImageRef): string =>
  image.kind === 'builtIn'
    ? `file:///data/exercise-images/${image.path}`
    : `file:///data/exercise-photos/${image.fileName}`;

export const libraryItems = Object.freeze([
  anExerciseListItem().withId('barbell-squat').named('Barbell Squat').build(),
  anExerciseListItem()
    .withId('my-goblet-squat')
    .named('My Goblet Squat')
    .with({ isCustom: true, equipmentLabel: 'Kettlebells', coverImage: null })
    .build(),
]);

const notStubbed = (useCase: string) => () =>
  Promise.reject(new Error(`${useCase} is not stubbed in this test.`));

/** Defaults: a loaded library, cached images, a built-in detail; writes must be stubbed. */
export function defaultUseCases(): ExerciseUseCases {
  return {
    findExercises: () => Promise.resolve(ok(libraryItems)),
    listVocabularyOptions: () => Promise.resolve(ok(vocabularyOptions)),
    getExerciseDetails: () => Promise.resolve(ok(anExerciseDetails().build())),
    getExerciseImage: (image) =>
      Promise.resolve({ status: 'available', uri: cachedImageUri(image) }),
    resolveVocabularyValue: notStubbed('ResolveVocabularyValue'),
    createCustomExercise: notStubbed('CreateCustomExercise'),
    updateCustomExercise: notStubbed('UpdateCustomExercise'),
    deleteCustomExercise: notStubbed('DeleteCustomExercise'),
    getExerciseFormValues: () => Promise.resolve(ok(anExerciseFormValues().build())),
    prepareDuplicate: () => Promise.resolve(ok(anExerciseFormValues().build())),
    importPhoto: notStubbed('ImportPhoto'),
    discardPhotos: () => Promise.resolve(),
  };
}

export function exerciseContainer(overrides: Partial<ExerciseUseCases> = {}): Container {
  const useCases = { ...defaultUseCases(), ...overrides };
  return createContainer()
    .register(FindExercisesToken, () => useCases.findExercises)
    .register(ListVocabularyOptionsToken, () => useCases.listVocabularyOptions)
    .register(GetExerciseDetailsToken, () => useCases.getExerciseDetails)
    .register(GetExerciseImageToken, () => useCases.getExerciseImage)
    .register(ResolveVocabularyValueToken, () => useCases.resolveVocabularyValue)
    .register(CreateCustomExerciseToken, () => useCases.createCustomExercise)
    .register(UpdateCustomExerciseToken, () => useCases.updateCustomExercise)
    .register(DeleteCustomExerciseToken, () => useCases.deleteCustomExercise)
    .register(GetExerciseFormValuesToken, () => useCases.getExerciseFormValues)
    .register(PrepareDuplicateToken, () => useCases.prepareDuplicate)
    .register(ImportPhotoToken, () => useCases.importPhoto)
    .register(DiscardPhotosToken, () => useCases.discardPhotos);
}

/** RNTL `wrapper` that provides `container` to the rendered tree. */
export function withContainer(container: Container) {
  return function ContainerWrapper({ children }: { readonly children: ReactNode }): ReactElement {
    return <DependencyProvider resolver={container}>{children}</DependencyProvider>;
  };
}

export const storageFailed = domainError('exercises.storageFailed', 'SQLITE_BUSY');
export const seedFailed = domainError('exercises.seedFailed', 'disk full');

/** A use-case stub whose answers the test settles later (one pending promise per call). */
export function pendingCalls<Args extends readonly unknown[], Value>() {
  const calls: { readonly args: Args; readonly resolve: (value: Value) => void }[] = [];
  const fn = (...args: Args) =>
    new Promise<Value>((resolve) => {
      calls.push({ args, resolve });
    });
  return { fn, calls };
}

/** Stand-in for a route whose screen is not under test (shows its path params). */
function routeStandIn(name: string) {
  return function RouteStandIn(): ReactElement {
    return <Text>{name}</Text>;
  };
}

/**
 * Renders the app's navigation as in production — the root stack with the tabs underneath and the
 * exercise screens on top — wired to `container`, starting at `initialUrl` (default: the
 * Exercises tab).
 */
export async function renderExerciseApp(container: Container, initialUrl = '/exercises') {
  return renderRouter(
    {
      _layout: AppStack,
      '(tabs)/_layout': () => <Slot />,
      '(tabs)/exercises': ExercisesScreen,
      '(tabs)/settings': routeStandIn('Settings tab'),
      'exercises/[id]/index': ExerciseDetailScreen,
      'exercises/[id]/edit': EditExerciseScreen,
      'exercises/new': NewExerciseScreen,
    },
    { initialUrl, wrapper: withContainer(container) },
  );
}

/** Names of the screens on the app's root stack (`AppStack`), bottom first. */
export function rootStackScreens(view: RenderRouterResult): readonly string[] {
  const appRoot = view.getRouterState()?.routes[0]?.state;
  return appRoot?.routes.map((route) => route.name) ?? [];
}
