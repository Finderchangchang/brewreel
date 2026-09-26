// 自动生成，不要手改：node scripts/gen-styles.mjs

import type {ShotModule, ShotSpec} from '../../../core/types';
import type {ShotEntry} from '../../types';

import * as district from './district';
import districtSpec from './district.spec.json';

export const SHOTS: Record<string, ShotEntry> = {
  district: {mod: district as ShotModule, spec: districtSpec as unknown as ShotSpec},
};
