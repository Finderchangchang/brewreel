import React, {createContext, useContext} from 'react';
import {Geometry, geometryOf} from './safe';

// ============================================================
// 画幅上下文：风格组件用 useGeometry() 取当前画幅的宽高和安全区（不要写死 1920）。
// cards 风格的老镜头不用它（它们只支持 9:16，直接用 safe.ts 的常量）。
// ============================================================
const Ctx = createContext<Geometry>(geometryOf('9:16'));

export const AspectProvider: React.FC<{geo: Geometry; children: React.ReactNode}> = ({geo, children}) => <Ctx.Provider value={geo}>{children}</Ctx.Provider>;

/** 当前画幅：{w, h, safe:{x0,x1,y0,y1}, card:{x0,x1}, cap:{y0,y1}, bgOnly, disclaimerY, noticeY} */
export const useGeometry = () => useContext(Ctx);
