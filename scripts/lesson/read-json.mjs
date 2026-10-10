// 开源版直接读仓库里的 JSON。没有加密资源包，也没有买家密钥。
import fs from 'node:fs';

export function readJsonResource(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8').replace(/^\uFEFF/u, ''));
}
