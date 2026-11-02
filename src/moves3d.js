import { PRESETS_MELEE_FIRE } from './presets_melee_fire.js';
import { PRESETS_ICE_VOLT } from './presets_ice_volt.js';
import { PRESETS_COSMIC_HOLY_DARK } from './presets_cosmic_holy_dark.js';
import { PRESETS_DEFENSE_PROPS } from './presets_defense_props.js';
import { PRESETS_BOW } from './presets_bow.js';
import { PRESETS_CHARGE } from './presets_charge.js';
import { PRESETS_BUFF_DEBUFF } from './presets_buff_debuff.js';
import { PRESETS_LEAP_SPELLS } from './presets_leap_spells.js';
import { PRESETS_PIXELFX_1 } from './presets_pixelfx_1.js';
import { PRESETS_PIXELFX_2 } from './presets_pixelfx_2.js';
import { PRESETS_AAA_SHOWCASE } from './presets_aaa_showcase.js';
import { CHANT_ULT_MOVES, SUMMON_ZONE_MOVES, NEW_GAMEDEV_ALGO_MOVES } from './presets_chant_summon_zone.js';
import { PRESETS_HEAL_SUPPORT } from './presets_heal_support.js';

export const CATEGORIES_3D = [
  { id: 'all',          label: '全部特效' },
  { id: 'bow',          label: '🏹 弓箭射擊／箭雨' },
  { id: 'aaa_env',      label: '🌟 3A 環境/持續區域/寫實陣' },
  { id: 'heal_support', label: '💚 治癒/護盾/隊友輔助' },
  { id: 'summon_zone',  label: '🐉 召喚魔法/領域結界' },
  { id: 'gamedev_algo', label: '🧮 遊戲演算法實戰' },
  { id: 'melee',        label: '⚔️ 刀劍武技' },
  { id: 'defense',      label: '🛡️ 半透明盾防' },
  { id: 'charge',       label: '💥 蓄力爆發技' },
  { id: 'buff_debuff',  label: '🧪 增益/減益/戰吼' },
  { id: 'leap_spell',   label: '☄️ 衝鋒/飛天/大法術' },
  { id: 'ui_fx',        label: '💎 系統/拾取/轉場' },
  { id: 'fire',         label: '🔥 烈焰爆破' },
  { id: 'ice',          label: '❄️ 寒冰水系' },
  { id: 'volt',         label: '⚡ 雷電戰錘' },
  { id: 'arcane',       label: '🔮 奧術星界' },
  { id: 'holy',         label: '✨ 神聖巨劍' },
  { id: 'shadow',       label: '💀 暗影鎖鏈' },
  { id: 'earth',        label: '🪨 大地巨岩' },
];

// Order moves cleanly: Flagship RPG/AAA packs first, followed by full PixelFX 3D remastered library
const FLAGSHIP_RAW = [
  ...PRESETS_AAA_SHOWCASE,
  ...PRESETS_HEAL_SUPPORT,
  ...CHANT_ULT_MOVES,
  ...SUMMON_ZONE_MOVES,
  ...NEW_GAMEDEV_ALGO_MOVES,
  ...PRESETS_MELEE_FIRE,
  ...PRESETS_ICE_VOLT,
  ...PRESETS_COSMIC_HOLY_DARK,
  ...PRESETS_DEFENSE_PROPS,
  ...PRESETS_BOW,
  ...PRESETS_CHARGE,
  ...PRESETS_BUFF_DEBUFF,
  ...PRESETS_LEAP_SPELLS,
];

const PIXELFX_RAW = [
  ...PRESETS_PIXELFX_1,
  ...PRESETS_PIXELFX_2,
];

const CAT_ORDER = [
  'aaa_env', 'heal_support', 'summon_zone', 'gamedev_algo',
  'melee', 'defense', 'bow', 'charge', 'buff_debuff', 'leap_spell', 'ui_fx',
  'fire', 'ice', 'volt', 'arcane', 'holy', 'shadow', 'earth',
];

export const MOVES_3D = [
  ...CAT_ORDER.flatMap((c) => FLAGSHIP_RAW.filter((m) => m.cat === c)),
  ...CAT_ORDER.flatMap((c) => PIXELFX_RAW.filter((m) => m.cat === c)),
];
