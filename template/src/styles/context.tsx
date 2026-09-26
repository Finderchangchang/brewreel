import React, {createContext, useContext} from 'react';

// ============================================================
// 风格令牌上下文。组件里：
//   const tk = useStyleTokens();        // 整份 tokens.json
//   const pal = useStylePalette();      // 当前配色（tokens.themes[meta.theme ?? defaultTheme]）
// 不写死颜色、字号、时长：都从令牌取，二创换皮只改 tokens.json。
// ============================================================
type Tokens = Record<string, any>;
type Ctx = {tokens: Tokens; palette: Record<string, string>; themeName: string};

const C = createContext<Ctx>({tokens: {}, palette: {}, themeName: ''});

export const StyleTokensProvider: React.FC<{tokens: Tokens; themeName?: string; children: React.ReactNode}> = ({tokens, themeName, children}) => {
  const themes = (tokens?.themes ?? {}) as Record<string, Record<string, string>>;
  const name = themeName && themes[themeName] ? themeName : String(tokens?.defaultTheme ?? Object.keys(themes)[0] ?? '');
  return <C.Provider value={{tokens: tokens ?? {}, palette: themes[name] ?? {}, themeName: name}}>{children}</C.Provider>;
};

export const useStyleTokens = <T extends Tokens = Tokens>() => useContext(C).tokens as T;
export const useStylePalette = () => useContext(C).palette;
export const useStyleThemeName = () => useContext(C).themeName;
