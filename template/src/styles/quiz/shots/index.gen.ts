// 自动生成，不要手改：node scripts/gen-styles.mjs

import type {ShotModule, ShotSpec} from '../../../core/types';
import type {ShotEntry} from '../../types';

import * as brandEnd from './brandEnd';
import brandEndSpec from './brandEnd.spec.json';
import * as clip from './clip';
import clipSpec from './clip.spec.json';
import * as commentCta from './commentCta';
import commentCtaSpec from './commentCta.spec.json';
import * as duoScene from './duoScene';
import duoSceneSpec from './duoScene.spec.json';
import * as meaningCard from './meaningCard';
import meaningCardSpec from './meaningCard.spec.json';
import * as phraseTitle from './phraseTitle';
import phraseTitleSpec from './phraseTitle.spec.json';
import * as quiz from './quiz';
import quizSpec from './quiz.spec.json';
import * as replay from './replay';
import replaySpec from './replay.spec.json';

export const SHOTS: Record<string, ShotEntry> = {
  brandEnd: {mod: brandEnd as ShotModule, spec: brandEndSpec as unknown as ShotSpec},
  clip: {mod: clip as ShotModule, spec: clipSpec as unknown as ShotSpec},
  commentCta: {mod: commentCta as ShotModule, spec: commentCtaSpec as unknown as ShotSpec},
  duoScene: {mod: duoScene as ShotModule, spec: duoSceneSpec as unknown as ShotSpec},
  meaningCard: {mod: meaningCard as ShotModule, spec: meaningCardSpec as unknown as ShotSpec},
  phraseTitle: {mod: phraseTitle as ShotModule, spec: phraseTitleSpec as unknown as ShotSpec},
  quiz: {mod: quiz as ShotModule, spec: quizSpec as unknown as ShotSpec},
  replay: {mod: replay as ShotModule, spec: replaySpec as unknown as ShotSpec},
};
