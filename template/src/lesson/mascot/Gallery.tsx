import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {pick} from '../../core/kit';
import {Character} from './Character';
import {POSES, type MascotPose, type MascotWardrobe} from './poses';

const LABELS: Record<MascotPose, string> = {
  explain: pick('zh', '讲解 · EXPLAIN', 'Explain · EXPLAIN'), point: pick('zh', '指向 · POINT', 'Point · POINT'),
  check: pick('zh', '勾选 · CHECK', 'Check · CHECK'), warn: pick('zh', '提醒 · WARN', 'Warn · WARN'),
  think: pick('zh', '思考 · THINK', 'Think · THINK'), affirm: pick('zh', '肯定 · AFFIRM', 'Affirm · AFFIRM'),
  cheer: pick('zh', '欢呼 · CHEER', 'Cheer · CHEER'), wave: pick('zh', '挥手 · WAVE', 'Wave · WAVE'),
};
const ROLE_NAMES = {
  'peep-mentor': pick('zh', 'MENTOR · 男讲师', 'MENTOR · Instructor'),
  'peep-counsel': pick('zh', 'COUNSEL · 女律师', 'COUNSEL · Counsel'),
  'peep-teacher': pick('zh', 'TEACHER · 老师', 'TEACHER · Teacher'),
} as const;
type MascotId = keyof typeof ROLE_NAMES;
const WARDROBES: Record<MascotId, MascotWardrobe> = {
  'peep-mentor': {id: 'peep-mentor'},
  'peep-counsel': {id: 'peep-counsel'},
  'peep-teacher': {id: 'peep-teacher'},
};

const cell = (id: MascotId, pose: MascotPose, frame?: {w: number; h: number}) => <Character pose={pose} fromPose={pose} progress={1} mouth={0} blink={0} elapsedMs={400} wardrobe={WARDROBES[id]} ink="#1E2422" surface="#FFFFFF" frameWidth={frame?.w} frameHeight={frame?.h} />;

const MascotGallery: React.FC<{id: MascotId}> = ({id}) => <div style={{width: 1440, height: 800, display: 'grid', gridTemplateColumns: 'repeat(4, 360px)', gridTemplateRows: '40px repeat(2, 380px)', background: '#F6F8FB', fontFamily: 'Arial, "Microsoft YaHei", sans-serif'}}>
  <div style={{gridColumn: '1 / -1', display: 'flex', alignItems: 'center', paddingLeft: 22, color: '#26364A', fontSize: 21, fontWeight: 700, letterSpacing: 1, background: '#EDF2F7'}}>{ROLE_NAMES[id]}</div>
  {POSES.map((pose) => <div key={pose} style={{height: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', border: '1px solid #E1E8F0', boxSizing: 'border-box', background: '#FFFFFF'}}>
    <div style={{position: 'relative', width: 280, height: 300}}>{cell(id, pose, {w: 280, h: 300})}</div>
    <div style={{width: '100%', height: 38, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#23364B', fontSize: 18, fontWeight: 700, letterSpacing: .5, borderTop: '1px solid #E1E8F0'}}>{LABELS[pose]}</div>
  </div>)}
</div>;

const roleComposition = (id: MascotId): React.FC => () => <MascotGallery id={id} />;
const Lineup: React.FC = () => <div style={{width: 1920, height: 1080, padding: 20, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: '44px repeat(3, 1fr)', background: '#F6F8FB', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', gap: 8}}>
  <div style={{gridColumn: '1 / -1', display: 'flex', alignItems: 'center', paddingLeft: 16, background: '#EAF0F6', color: '#26364A', fontSize: 22, fontWeight: 700}}>{pick('zh', 'Open Peeps 讲解员 · 三个角色 × 八个姿势', 'Open Peeps presenters')}</div>
  {(Object.keys(ROLE_NAMES) as MascotId[]).map((id) => <React.Fragment key={id}>
    {POSES.map((pose) => <div key={`${id}-${pose}`} style={{position: 'relative', background: '#FFFFFF', border: '1px solid #DFE7EF', minHeight: 280}}>
      <div style={{position: 'absolute', left: 8, top: 8, zIndex: 2, color: '#26364A', fontSize: 13, fontWeight: 700}}>{ROLE_NAMES[id].split(' · ')[0]} · {LABELS[pose].split(' · ')[0]}</div>
      <div style={{position: 'absolute', inset: '28px 8px 8px'}}>{cell(id, pose)}</div>
    </div>)}
  </React.Fragment>)}
</div>;

const LOOKS: {title: string; wardrobe: MascotWardrobe}[] = [
  {title: pick('zh', '男预设 · 深色毛衣', 'Male preset · dark sweater'), wardrobe: {preset: 'male', outfit: 'darkSweater'}},
  {title: pick('zh', '男预设 · 黑 T', 'Male preset · black tee'), wardrobe: {preset: 'male', outfit: 'blackTee'}},
  {title: pick('zh', '男预设 · 白衬衫', 'Male preset · white shirt'), wardrobe: {preset: 'male', outfit: 'whiteShirt'}},
  {title: pick('zh', '女预设 · 深色毛衣', 'Female preset · dark sweater'), wardrobe: {preset: 'female', outfit: 'darkSweater'}},
  {title: pick('zh', '女预设 · 黑 T', 'Female preset · black tee'), wardrobe: {preset: 'female', outfit: 'blackTee'}},
  {title: pick('zh', '女预设 · 白衬衫', 'Female preset · white shirt'), wardrobe: {preset: 'female', outfit: 'whiteShirt'}},
  {title: pick('zh', '随意 · Afro · 飞行员镜 · 山羊胡', 'Custom · Afro · aviators · goatee'), wardrobe: {preset: 'male', hair: 'Afro', accessory: 'GlassAviator', facialHair: 'Goatee', outfit: 'darkSweater'}},
  {title: pick('zh', '随意 · 长刘海', 'Custom · long bangs'), wardrobe: {preset: 'female', hair: 'LongBangs', accessory: 'None', facialHair: 'None', outfit: 'blackTee'}},
  {title: pick('zh', '随意 · 莫霍克 · 墨镜 · 八字胡', 'Custom · mohawk · sunglasses · handlebar mustache'), wardrobe: {preset: 'male', hair: 'Mohawk', accessory: 'SunglassWayfarer', facialHair: 'Handlebars', outfit: 'whiteShirt'}},
  {title: pick('zh', '随意 · 卷发丸子 · 厚圆镜', 'Custom · curly bun · thick round glasses'), wardrobe: {preset: 'female', hair: 'BunCurly', accessory: 'GlassRoundThick', facialHair: 'None', outfit: 'whiteShirt'}},
];

const PresenterLooks: React.FC = () => <div style={{width: 1800, height: 860, boxSizing: 'border-box', padding: 24, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '48px 1fr 1fr', gap: 12, background: '#F3F0E8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif'}}>
  <div style={{gridColumn: '1 / -1', display: 'flex', alignItems: 'center', color: '#24211C', fontSize: 28, fontWeight: 700}}>{pick('zh', '讲解员形象自由组合 · 预设 × 衣服族，外加四组随意搭配', 'Presenter looks · presets by outfit, plus four custom mixes')}</div>
  {LOOKS.map((item) => <div key={item.title} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end'}}>
    <div style={{position: 'relative', width: 240, height: 300}}>
      <Character pose="explain" fromPose="explain" progress={1} mouth={0} blink={0} elapsedMs={400} wardrobe={item.wardrobe} ink="#24211C" surface="#FFFFFF" crop="card" frameWidth={240} frameHeight={300} />
    </div>
    <div style={{height: 36, color: '#24211C', fontSize: 16, fontWeight: 700, textAlign: 'center'}}>{item.title}</div>
  </div>)}
</div>;

const GalleryRoot: React.FC = () => <>
  <Composition id="MascotPosesMentor" component={roleComposition('peep-mentor')} fps={30} width={1440} height={800} durationInFrames={1} />
  <Composition id="MascotPosesCounsel" component={roleComposition('peep-counsel')} fps={30} width={1440} height={800} durationInFrames={1} />
  <Composition id="MascotPosesTeacher" component={roleComposition('peep-teacher')} fps={30} width={1440} height={800} durationInFrames={1} />
  <Composition id="MascotLineup" component={Lineup} fps={30} width={1920} height={1080} durationInFrames={1} />
  <Composition id="PresenterLooks" component={PresenterLooks} fps={30} width={1800} height={860} durationInFrames={1} />
</>;
registerRoot(GalleryRoot);
