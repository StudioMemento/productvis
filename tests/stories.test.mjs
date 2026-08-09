import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ANIMATION_CHAPTERS,
  MAX_EXPLODE_OFFSETS,
  MAX_EXPLODE_STATES,
  MAX_STORIES,
  MAX_STORY_STEPS,
  resolveChapterRange,
  sanitizeExplosionState,
  sanitizeStoryAuthoringState,
  validateStoryReferences,
} from '../src/story/StoryGrammar.js';
import { StorySystem } from '../src/story/StorySystem.js';
import { StoryPlayer } from '../src/story/StoryPlayer.js';

test('explosion grammar keeps stable part IDs, clamps vectors and preserves an assembled state', () => {
  const state = sanitizeExplosionState({
    explodeOffsets: {
      part_valid123: [12, -12, 0.5],
      invalid: [1, 2, 3],
      part_zero000: [0, 0, 0],
    },
    explodeStates: [
      { id: 'assembled', name: 'Assembled', offsets: {} },
      { id: 'open-state', name: 'Open', offsets: { part_valid123: [1, 0, 0] } },
    ],
    activeExplodeStateId: 'assembled',
  });

  assert.deepEqual(state.explodeOffsets, { part_valid123: [8, -8, 0.5] });
  assert.equal(state.explodeStates.length, 2);
  assert.deepEqual(state.explodeStates[0].offsets, {});
  assert.equal(state.activeExplodeStateId, 'assembled');
});

test('story authoring grammar clamps unsafe values and enforces bounded libraries', () => {
  const state = sanitizeStoryAuthoringState({
    animationChapters: Array.from({ length: MAX_ANIMATION_CHAPTERS + 5 }, (_, index) => ({
      id: `chapter ${index}`,
      name: `Chapter ${index}`,
      clipIndex: index,
      startTime: -20,
      endTime: 99999,
      speed: 99,
      loop: index % 2 === 0,
    })),
    stories: Array.from({ length: MAX_STORIES + 5 }, (_, storyIndex) => ({
      id: `story ${storyIndex}`,
      name: `Story ${storyIndex}`,
      steps: Array.from({ length: MAX_STORY_STEPS + 5 }, (_, stepIndex) => ({
        id: `step ${stepIndex}`,
        transitionDuration: 99,
        holdDuration: -9,
        easing: 'teleport',
        infographicDisplay: 'everything',
      })),
    })),
    storyPreviewEnabled: true,
  });

  assert.equal(state.animationChapters.length, MAX_ANIMATION_CHAPTERS);
  assert.equal(state.stories.length, MAX_STORIES);
  assert.equal(state.stories[0].steps.length, MAX_STORY_STEPS);
  assert.equal(state.animationChapters[0].startTime, 0);
  assert.equal(state.animationChapters[0].endTime, 3600);
  assert.equal(state.animationChapters[0].speed, 4);
  assert.equal(state.stories[0].steps[0].transitionDuration, 12);
  assert.equal(state.stories[0].steps[0].holdDuration, 0);
  assert.equal(state.stories[0].steps[0].easing, 'cinematic');
  assert.equal(state.stories[0].steps[0].infographicDisplay, 'inherit');
  assert.equal(state.storyPreviewEnabled, true);
});

test('story reference validation reports missing reusable assets without deleting the step', () => {
  const validated = validateStoryReferences({
    animationChapters: [{ id: 'chapter-ok', name: 'Open', clipIndex: 0, startTime: 0, endTime: 1 }],
    stories: [{
      id: 'story-main',
      name: 'Main',
      steps: [{
        id: 'step-main',
        name: 'Reveal',
        presentationId: 'shot-missing',
        explodeStateId: 'explode-ok',
        chapterId: 'chapter-ok',
        selectedInfographicId: 'info-missing',
      }],
    }],
    activeStoryId: 'story-main',
    activeStoryStepId: 'step-main',
  }, {
    presentations: [],
    explodeStates: [{ id: 'explode-ok' }],
    infographics: [],
  });

  assert.equal(validated.stories.length, 1);
  assert.equal(validated.stories[0].steps.length, 1);
  assert.deepEqual(validated.stories[0].steps[0].unresolved, ['presentation', 'infographic']);
  assert.equal(validated.unresolvedCount, 1);
});

test('animation chapter ranges clamp to the selected clip and report playback duration', () => {
  const range = resolveChapterRange({
    id: 'chapter',
    clipIndex: 0,
    startTime: 2,
    endTime: 20,
    speed: 2,
  }, 6);
  assert.equal(range.valid, true);
  assert.equal(range.startTime, 2);
  assert.equal(range.endTime, 6);
  assert.equal(range.duration, 2);

  const invalid = resolveChapterRange({ startTime: 0, endTime: 1 }, 0);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.duration, 0);
});

test('StorySystem authors reusable chapters and ordered story steps deterministically', () => {
  const reasons = [];
  const system = new StorySystem({
    getLibraries: () => ({
      presentations: [{ id: 'shot-hero' }],
      explodeStates: [{ id: 'explode-open' }],
      infographics: [{ id: 'info-detail' }],
    }),
    onChange: ({ reason }) => reasons.push(reason),
  });

  const chapter = system.createChapter({ name: 'Mechanism', clipIndex: 0, startTime: 0.2, endTime: 1.4 });
  const story = system.createStory('Launch story', { loop: true });
  const first = system.addStep(story.id, {
    name: 'Hero',
    presentationId: 'shot-hero',
    holdDuration: 0.5,
  });
  const second = system.addStep(story.id, {
    name: 'Open',
    explodeStateId: 'explode-open',
    chapterId: chapter.id,
    infographicDisplay: 'selected',
    selectedInfographicId: 'info-detail',
  });

  assert.equal(system.getReport().storyCount, 1);
  assert.equal(system.getReport().chapterCount, 1);
  assert.equal(system.getReport().stepCount, 2);
  assert.equal(system.getReport().unresolvedCount, 0);
  assert.equal(system.getStory(story.id).loop, true);
  assert.equal(system.moveStep(story.id, second.id, 'up'), true);
  assert.deepEqual(system.getStory(story.id).steps.map((step) => step.id), [second.id, first.id]);
  assert.equal(system.updateStep(story.id, first.id, { name: 'Hero revised' }).name, 'Hero revised');
  assert.equal(system.selectStep(story.id, second.id).id, second.id);
  assert.equal(system.deleteStep(story.id, first.id), true);
  assert.equal(system.deleteChapter(chapter.id), true);
  assert.ok(reasons.includes('story-create'));
  assert.ok(reasons.includes('step-move'));
});

test('StoryPlayer advances transition, chapter and hold phases without a timeline', () => {
  const applied = [];
  const startedChapters = [];
  const completed = [];
  const player = new StoryPlayer({
    onApplyStep: (step) => applied.push(step.id),
    onStartChapter: (chapterId) => {
      startedChapters.push(chapterId);
      return chapterId === 'chapter-open';
    },
    onComplete: (story) => completed.push(story.id),
  });
  const story = {
    id: 'story-main',
    name: 'Main',
    loop: false,
    steps: [
      { id: 'step-one', name: 'Hero', transitionDuration: 1, holdDuration: 0.5, chapterId: null },
      { id: 'step-two', name: 'Open', transitionDuration: 0, holdDuration: 0.25, chapterId: 'chapter-open' },
    ],
  };

  assert.equal(player.play(story, { now: 0 }), true);
  assert.equal(player.getState().phase, 'transition');
  player.update(999);
  assert.equal(player.getState().stepId, 'step-one');
  player.update(1000);
  assert.equal(player.getState().phase, 'hold');
  player.update(1500);
  assert.equal(player.getState().stepId, 'step-two');
  assert.equal(player.getState().phase, 'chapter');
  assert.deepEqual(startedChapters, ['chapter-open']);
  assert.equal(player.notifyChapterComplete({ now: 1600 }), true);
  assert.equal(player.getState().phase, 'hold');
  player.update(1850);
  assert.equal(player.getState().playing, false);
  assert.deepEqual(applied, ['step-one', 'step-two']);
  assert.deepEqual(completed, ['story-main']);
});

test('StoryPlayer pause/resume freezes transition callbacks and preserves elapsed phase timing', () => {
  const transitionEvents = [];
  const player = new StoryPlayer({
    onApplyStep: () => {},
    onStartChapter: () => false,
    onPauseTransition: ({ now }) => transitionEvents.push(['pause', now]),
    onResumeTransition: ({ now }) => transitionEvents.push(['resume', now]),
    onStopTransition: () => transitionEvents.push(['stop']),
  });
  const story = {
    id: 'story-loop',
    name: 'Loop',
    loop: true,
    steps: [
      { id: 'a', transitionDuration: 1, holdDuration: 1 },
      { id: 'b', transitionDuration: 1, holdDuration: 1 },
    ],
  };

  player.play(story, { now: 0 });
  assert.equal(player.pause({ now: 400 }), true);
  player.update(5000);
  assert.equal(player.getState().phase, 'transition');
  assert.equal(player.resume({ now: 5000 }), true);
  player.update(5599);
  assert.equal(player.getState().phase, 'transition');
  player.update(5600);
  assert.equal(player.getState().phase, 'hold');
  assert.equal(player.next({ now: 6000, keepPlaying: false }), true);
  assert.equal(player.getState().stepId, 'b');
  assert.equal(player.getState().playing, false);
  assert.equal(player.previous({ now: 6100, keepPlaying: false }), true);
  assert.equal(player.getState().stepId, 'a');
  assert.deepEqual(transitionEvents.slice(0, 2), [['pause', 400], ['resume', 5000]]);
  assert.ok(transitionEvents.filter(([type]) => type === 'stop').length >= 2);
});

test('story library constants remain bounded for portable project files', () => {
  assert.equal(MAX_EXPLODE_OFFSETS, 256);
  assert.equal(MAX_EXPLODE_STATES, 32);
  assert.equal(MAX_ANIMATION_CHAPTERS, 32);
  assert.equal(MAX_STORIES, 16);
  assert.equal(MAX_STORY_STEPS, 48);
});
