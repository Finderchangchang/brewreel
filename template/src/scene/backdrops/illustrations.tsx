// 剪纸拼贴里能用平涂多边形画出来的部分：远山、草、云、太阳、路、衣架剪影、纸蛾、木桶。
// 不画人物，不画具体产品。颜色全部来自风格文件，不另写色值。
import React from 'react';
import ink from '../styles/cutpaper-collage.json';

const C = ink.palette;

const poly = (pts: Array<[number, number]>) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + ' Z';

export const Meadow: React.FC = () => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}} data-probe-skip aria-hidden>
    <circle cx="860" cy="280" r="74" fill={C.sun} stroke={C.path} strokeWidth="8" />
    <path d={poly([[620, 250], [700, 220], [790, 246], [760, 286], [650, 292]])} fill={C.cloud} />
    <path d={poly([[120, 1180], [260, 1120], [420, 1200], [560, 1100], [760, 1220], [980, 1120], [1080, 1240], [1080, 1920], [0, 1920], [0, 1280]])} fill={C.grassDark} />
    <path d={poly([[0, 1360], [140, 1280], [280, 1380], [460, 1260], [640, 1400], [820, 1280], [1000, 1380], [1080, 1320], [1080, 1920], [0, 1920]])} fill={C.grass} />
    <path d={poly([[470, 1500], [560, 1280], [640, 1500], [700, 1680], [400, 1700]])} fill={C.path} />
    <path d={poly([[80, 1500], [110, 1420], [150, 1510]])} fill={C.grassDark} />
    <path d={poly([[900, 1560], [940, 1460], [990, 1570]])} fill={C.grassDark} />
  </svg>
);

export const Hills: React.FC<{sky: string}> = ({sky}) => (
  <svg width="100%" height="100%" viewBox="0 0 640 880" preserveAspectRatio="xMidYMid slice" data-probe-skip aria-hidden>
    <rect width="640" height="880" fill={sky} />
    <circle cx="500" cy="150" r="54" fill={C.sun} stroke={C.path} strokeWidth="8" />
    <path d={poly([[80, 160], [150, 128], [230, 158], [210, 196], [100, 200]])} fill={C.cloud} />
    <path d={poly([[360, 210], [430, 176], [510, 214], [470, 248], [370, 246]])} fill={C.cloud} />
    <path d={poly([[0, 430], [90, 360], [180, 420], [300, 330], [430, 410], [540, 340], [640, 420], [640, 880], [0, 880]])} fill={C.hillFar} />
    <path d={poly([[0, 560], [120, 470], [240, 560], [380, 450], [520, 560], [640, 490], [640, 880], [0, 880]])} fill={C.hillNear} />
    <path d={poly([[250, 760], [310, 560], [370, 760], [420, 840], [210, 840]])} fill={C.path} />
    <path d={poly([[0, 760], [80, 720], [160, 770], [280, 710], [420, 780], [560, 720], [640, 760], [640, 880], [0, 880]])} fill={C.grass} />
  </svg>
);

/** 三件旧衣的剪影。左边那件袖口是补丁的落点；有产品图就裁进去。 */
export const Rack: React.FC<{imageSrc?: string}> = ({imageSrc}) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}} data-probe-skip aria-hidden>
    <path d="M160 620 H920" stroke={C.garmentDark} strokeWidth="10" fill="none" />
    <path d={poly([[250, 640], [300, 700], [230, 760], [250, 1460], [430, 1500], [470, 760], [400, 680]])} fill={C.garment} />
    <path d={poly([[250, 860], [160, 1040], [210, 1320], [340, 1240], [300, 980]])} fill={C.garmentAlt} />
    <path d={poly([[560, 650], [620, 720], [540, 780], [560, 1420], [760, 1460], [800, 780], [720, 700]])} fill={C.garmentAlt} />
    <path d={poly([[820, 660], [880, 740], [800, 800], [830, 1380], [1000, 1400], [1030, 800], [960, 720]])} fill={C.garment} />
    <clipPath id="collage-coat">
      <path d={poly([[250, 860], [160, 1040], [210, 1320], [340, 1240], [300, 980]])} />
    </clipPath>
    {imageSrc ? <image href={imageSrc} x="150" y="900" width="220" height="460" preserveAspectRatio="xMidYMid slice" clipPath="url(#collage-coat)" /> : null}
  </svg>
);

/** 带路的纸蛾。翅膀收在给定的方框里，最大边由调用方限制。 */
export const Moth: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" data-probe-skip aria-hidden>
    <path d={poly([[50, 46], [18, 22], [8, 48], [28, 58]])} fill={C.mothWing} />
    <path d={poly([[50, 50], [16, 62], [22, 88], [46, 70]])} fill={C.mothWing} />
    <path d={poly([[50, 46], [82, 20], [94, 46], [74, 58]])} fill={C.moth} />
    <path d={poly([[50, 50], [84, 64], [78, 90], [54, 72]])} fill={C.moth} />
    <path d={poly([[46, 40], [50, 18], [54, 40], [52, 78], [48, 78]])} fill={C.garmentDark} />
  </svg>
);

/** 圆木桶。没有按键，没有栅格。 */
export const Tub: React.FC<{radius: number}> = ({radius}) => {
  const r = radius + 36;
  return (
    <svg width={r * 2} height={r * 2} viewBox={`0 0 ${r * 2} ${r * 2}`} style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}} data-probe-skip aria-hidden>
      <circle cx={r} cy={r} r={r - 8} fill="none" stroke={C.path} strokeWidth="28" />
      <circle cx={r} cy={r} r={r - 24} fill="none" stroke={C.garmentDark} strokeWidth="4" />
      <rect x={r - 22} y={r + radius - 8} width="44" height="16" rx="3" fill={C.sun} />
    </svg>
  );
};

export const NeedleMark: React.FC = () => (
  <svg data-probe-skip viewBox="0 0 90 36" width={78} height={32} aria-hidden style={{display: 'block'}}>
    <path d="M10 26 L58 8" stroke={C.mark} strokeWidth="3" fill="none" />
    <path d="M58 8 L74 16" stroke={C.mark} strokeWidth="3" fill="none" />
    <circle cx="16" cy="24" r="4" fill="none" stroke={C.mark} strokeWidth="2" />
  </svg>
);

export const Stitches: React.FC = () => (
  <svg data-probe-skip viewBox="0 0 80 40" width="100%" height="28" aria-hidden>
    <path d="M8 20 H22 M30 20 H44 M52 20 H70" stroke={C.stitch} strokeWidth="4" fill="none" />
  </svg>
);
