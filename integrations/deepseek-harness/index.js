// @ts-check
// Distill Video for DeepSeek Harness — Cordis entry point.
// Author: Liu Weijie (Finderchangchang). License: Apache-2.0.
import Schema from '@deepseek-ai/schemastery';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {createConfigSchema} from './lib/config.js';
import {applyPlugin, PLUGIN_NAME} from './lib/plugin.js';

export const name = PLUGIN_NAME;
export const inject = ['tools'];
export const Config = createConfigSchema(Schema);

/**
 * @param {any} ctx
 * @param {any} config
 */
export function apply(ctx, config) {
  applyPlugin(ctx, config, {defineTool});
}
