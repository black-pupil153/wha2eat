// 从 HowToCook（Unlicense，https://github.com/Anduin2017/HowToCook）结构化数据
// 构建晚餐精选底库 src/data/catalog.json。
// 用法：node scripts/build-catalog.mjs [all_recipes.json 路径]
// 无参数时优先读 scripts/.cache/all_recipes.json，否则从 CDN 下载。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(__dirname, '.cache', 'all_recipes.json');
const OUT = path.join(__dirname, '..', 'src', 'data', 'catalog.json');
const SOURCE_URL =
  'https://mp-bc8d1f0a-3356-4a4e-8592-f73a3371baa2.cdn.bspapp.com/all_recipes.json';

// ── 数据获取 ──
async function loadRaw() {
  const argPath = process.argv[2];
  if (argPath && existsSync(argPath)) {
    return JSON.parse(readFileSync(argPath, 'utf8'));
  }
  if (existsSync(CACHE)) {
    return JSON.parse(readFileSync(CACHE, 'utf8'));
  }
  console.log('从 CDN 下载 HowToCook 数据…');
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`下载失败：${res.status}`);
  const text = await res.text();
  mkdirSync(path.dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, text);
  return JSON.parse(text);
}

// ── 入选条件 ──
const DINNER_CATEGORIES = new Set(['荤菜', '素菜', '汤羹', '水产', '主食']);
// 不适合两人日常晚餐的菜名（猎奇 / 应付型）
const NAME_BLACKLIST =
  /泡面|方便面|罐头|兔|乳鸽|海参|带把肘子|杀猪菜|小龙虾|腊八粥|醪糟|蕨根粉/;
// 依赖特殊设备：菜名 / 步骤 / 描述任一命中即排除（PRD §5.2）
const EQUIPMENT_BLACKLIST =
  /微波炉|微波|电饭煲|电饭锅|烤箱|空气炸锅|轻食机|面包机|破壁机|电饼铛/;

// ── 食材分类（顺序敏感：调味 → 主食 → 蔬菜 → 肉蛋 → 其他）──
const RE_SEASONING =
  /酱油|生抽|老抽|蚝油|耗油|豆瓣|腐乳|豆豉|老干妈|泡椒|野山椒|藤椒|料酒|黄酒|白酒|米酒|啤酒|香油|麻油|花椒|八角|桂皮|香叶|孜然|胡椒|味精|鸡精|鸡粉|淀粉|生粉|勾芡|白糖|红糖|冰糖|砂糖|蜂蜜|番茄酱|蛋黄酱|沙拉酱|芥末|咖喱|五香粉|十三香|辣椒粉|辣椒面|干辣椒|辣椒油|辣椒酱|甜面酱|黄豆酱|芝麻酱|^芝麻$|食用油|植物油|菜籽油|花生油|橄榄油|猪油|黄油|^油$|盐|^醋$|陈醋|香醋|米醋|^糖$|^水$|开水|清水|温水|凉水|热水|饮用水|高汤|姜粉|蒜粉|鱼露|虾皮|酵母|小苏打|泡打粉|桂花|茴香|白醋|南乳|柱侯酱|茄汁|剁椒|火锅底料|味极鲜|陈皮|吉士粉/;
// 小米 用词界：避免「小米辣/小米椒」被主食抢走；小米粥仍主食
const RE_STAPLE =
  /大米|米饭|糯米|面粉|面条|挂面|河粉|米粉|粉丝|粉条|年糕|吐司|面包|馒头|饺子皮|馄饨皮|意面|意大利面|荞麦面|米线|燕麦|^小米$|小米粥|凉粉|快熟面/;
const RE_VEG =
  /白菜|青菜|油麦菜|生菜|菠菜|韭菜|芹菜|香芹|香菜|娃娃菜|酸菜|雪菜|梅干菜|梅菜|包菜|卷心菜|花菜|西兰花|西蓝花|西葫芦|苦瓜|黄瓜|冬瓜|丝瓜|南瓜|木瓜|茄子|番茄|西红柿|土豆|马铃薯|萝卜|洋葱|大葱|小葱|葱|姜|蒜|香菇|蘑菇|金针菇|杏鲍菇|平菇|口蘑|白玉菇|茶树菇|菌菇|木耳|银耳|竹笋|春笋|笋|莲藕|藕|豆角|豇豆|四季豆|荷兰豆|毛豆|豌豆|青豆|豆芽|海带|紫菜|山药|芋头|红薯|玉米|青椒|红椒|彩椒|柿子椒|菜椒|尖椒|朝天椒|螺丝椒|美人辣|小米辣|小米椒|辣椒|芦笋|莴笋|秋葵|苋菜|空心菜|柠檬|板栗|栗子|花生|茭白|橄榄菜/;
const RE_MEAT =
  /五花肉|里脊|瘦肉|肉末|肉沫|肉丝|肉片|肉馅|猪肉|牛肉|羊肉|羊排|鸡肉|鸭肉|鸭子|鸡翅|鸡腿|鸡胸|鸡爪|排骨|牛排|肋排|大排|肘子|蹄|培根|火腿|香肠|腊肠|腊肉|丸子|肥牛|肥羊|牛蛙|鱼|虾|蟹|蛏|蚝|生蚝|扇贝|鱿鱼|墨鱼|鳕|鲈|鲤|鳊|桂鱼|翘嘴|黄鳝|鸡蛋|鸭蛋|皮蛋|鹌鹑蛋|蛋清|蛋黄|豆腐|豆干|腐竹|千张|豆皮|日本豆腐|午餐肉|牛腩|金枪鱼|鸡$|鸭$|肉$/;

function classify(name) {
  // 调味优先：小米辣椒粉等含「辣椒粉」仍走调味，不会落到蔬菜小米辣
  if (RE_SEASONING.test(name)) return '调味';
  if (RE_STAPLE.test(name)) return '主食';
  if (RE_VEG.test(name)) return '蔬菜';
  if (RE_MEAT.test(name)) return '肉蛋';
  return '其他';
}

// ── 节气标签：时令食材/做法关键词 → 季节 → 取季内 2 个相邻节气 ──
const SEASON_TERMS = {
  spring: ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'],
  summer: ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'],
  autumn: ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'],
  winter: ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒'],
};
const SEASON_KEYWORDS = {
  spring: /春笋|韭菜|菠菜|荠菜|香椿|豌豆|蚕豆|芦笋|草莓|青团/,
  summer: /苦瓜|黄瓜|冬瓜|丝瓜|绿豆|凉拌|凉面|毛豆|茄子|番茄|西红柿|空心菜|苋菜|油麦菜|柠檬|酸辣|酸汤/,
  autumn: /莲藕|^藕|南瓜|山药|板栗|栗子|螃蟹|^蟹|秋葵|芋头|菱角|桂花/,
  winter: /白菜|萝卜|羊肉|红薯|酸菜|腊肉|腊肠|乱炖|炖|煲|火锅|砂锅/,
};

function hashInt(s) {
  return parseInt(createHash('md5').update(s).digest('hex').slice(0, 8), 16);
}

function solarTermsFor(name, ingredientNames) {
  const text = name + ' ' + ingredientNames.join(' ');
  const terms = [];
  for (const [season, re] of Object.entries(SEASON_KEYWORDS)) {
    if (re.test(text)) {
      const ring = SEASON_TERMS[season];
      const idx = hashInt(name + season) % (ring.length - 1);
      terms.push(ring[idx], ring[idx + 1]);
    }
  }
  return [...new Set(terms)];
}

// ── 耗时估算 ──
const BASE_MINUTES = { 1: 10, 2: 15, 3: 25, 4: 40, 5: 60 };
function estimateMinutes(r) {
  if (typeof r.total_time_minutes === 'number' && r.total_time_minutes > 0) {
    return Math.min(r.total_time_minutes, 90);
  }
  let m = BASE_MINUTES[r.difficulty] ?? 30;
  const text = r.steps.map((s) => s.description).join(' ');
  if (/炖|焖|卤|煲|熬/.test(r.name + text)) m = Math.max(m, 45);
  if (/腌制|腌\s*\d+/.test(text)) m += 10;
  return Math.min(m, 90);
}

// ── 成本档 ──
function estimateCost(ingredientNames) {
  const joined = ingredientNames.join(' ');
  return /虾|蟹|鱼|牛|排骨|肘|鳝|蚝|扇贝|鳕|鲈|桂鱼|羊/.test(joined)
    ? 'mid'
    : 'low';
}

// ── 食材用量解析：text_quantity 去掉 "- 名称" / "* 名称" 前缀 ──
function parseAmount(ing, cleanName, amountHint) {
  if (amountHint) return amountHint;
  if (!ing.text_quantity) return '适量';
  let t = ing.text_quantity.replace(/^[-*•]\s*/, '').trim();
  const prefix = cleanName || ing.name;
  if (prefix && t.startsWith(prefix)) t = t.slice(prefix.length).trim();
  else if (ing.name && t.startsWith(ing.name)) t = t.slice(ing.name.length).trim();
  if (/[=＝]|份数/.test(t)) return '适量';
  // 先去掉说明括号，再剥开头冒号，避免「（可选）：0-2 个」残留冒号
  t = t.replace(/[（(][^）)]*[）)]/g, '').trim();
  t = t.replace(/^[：:，,\s]+/, '').trim();
  return t || '适量';
}

/** 垃圾食材名：纯数字/符号，或公式片段 */
function isGarbageIngredient(name) {
  return (
    /^[\d\s.~～\-*/xX×]*$/.test(name) ||
    /[=＝]|份数|可以食用|^省略|^适量$|量$|用水$|人的量|用量为|^\d+(ml|g|克|毫升|个|只|勺)/.test(
      name
    )
  );
}

/** 明确可拆的中文数量后缀（单一主体） */
const CN_QTY_SUFFIX =
  /(手指头大小两个|半只|半根|半块|半颗|半瓶|一根|一块|一朵|一勺|两勺|两片|两个|三个|四个|五个|六个|两斤|一斤|三根|四根|五根)$/;

/** 中文数量前缀：两个鸡蛋 → 鸡蛋 + 两个 */
const CN_QTY_PREFIX = /^(两个|三个|四个|五个|一斤|两斤)([\u4e00-\u9fff].+)$/;

/**
 * 聚合食材行：一条 text_quantity / name 含多个独立食材。
 * 不猜测拆分 → 整道菜过滤。口径见 isAggregateIngredient。
 */
function isAggregateIngredient(ing) {
  const name = String(ing.name || '').trim();
  const tq = String(ing.text_quantity || '').trim();

  // 名内顿号列举：小葱、姜、蒜、小米辣
  if (/、/.test(name)) return true;
  // tq 中「汉字、汉字」：料酒、朗姆酒或啤酒
  if (/[\u4e00-\u9fff]、[\u4e00-\u9fff]/.test(tq)) return true;
  // 多主体「各N」无法安全拆：菜椒甜椒各一个
  if (/各\s*[一二三四五六七八九十两\d]+/.test(name) || /各一个|各两[个只]/.test(name))
    return true;
  if (/(菜椒甜椒|青椒甜椒|青椒红椒|红椒青椒)/.test(name)) return true;

  let rest = tq.replace(/^[-*•]\s*/, '');
  if (name && rest.startsWith(name)) rest = rest.slice(name.length);
  rest = rest.replace(/^[：:\s]+/, '').trim();
  // 剥名前缀后以顿号起头 → 后续仍是另一食材
  if (/^、/.test(rest)) return true;

  // 用量段被顿号切成 ≥2 段（盐 2g、生抽 15ml…）
  if (rest.split('、').filter((s) => s.trim()).length >= 2) return true;

  if (
    /[，,]\s*[\u4e00-\u9fff]{2,}(一个|两个|三个|四个|五个|三根|五根|各\s*[一二\d])/.test(
      tq
    )
  )
    return true;
  if (
    /[，,]\s*(干辣椒|青椒|红椒|甜椒|生抽|老抽|蚝油|蒜瓣|小葱|小米辣|姜|蒜)(\s|$|各|\d|[一二三四五])/.test(
      tq
    )
  )
    return true;

  return false;
}

/**
 * 保守清洗食材名：只处理明确模式，无法安全处理则返回 null。
 */
function sanitizeIngredientName(rawName) {
  let name = String(rawName || '').trim();
  if (!name || isGarbageIngredient(name)) return null;

  let amountHint = null;

  // A) 主体(纯数量)：清水(50ml)
  let m = name.match(
    /^(.+?)[（(]\s*(\d+(?:\.\d+)?\s*(?:g|克|kg|千克|ml|毫升|cc|勺|个|只|朵|根|片|瓣)?)\s*[）)]\s*$/i
  );
  if (m && m[1].trim().length >= 1) {
    name = m[1].trim();
    amountHint = m[2].replace(/\s+/g, '');
  } else if (/[（(]/.test(name) && !/[）)]/.test(name)) {
    m = name.match(/^(.+?)[（(]/);
    if (!m || m[1].trim().length < 1) return null;
    name = m[1].trim();
  } else if (/[（(][^）)]*[）)]/.test(name)) {
    if (/^.{0,2}[（(].{1,2}[）)].{0,2}糖/.test(name)) return null;
    const stripped = name
      .replace(/[（(][^）)]*[）)]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!stripped || /[（(）)]/.test(stripped)) return null;
    name = stripped;
  }

  // D0) 前缀中文数量：两个鸡蛋
  m = name.match(CN_QTY_PREFIX);
  if (m) {
    name = m[2].trim();
    amountHint = amountHint || m[1];
  }

  // D) 后缀中文数量：大蒜两个、姜手指头大小两个、蒜苗三根
  m = name.match(new RegExp(`^(.+?)${CN_QTY_SUFFIX.source}`));
  if (m && m[1].trim().length >= 1) {
    name = m[1].trim();
    amountHint = amountHint || m[2];
  }

  // E) 尾部残留阿拉伯数字
  m = name.match(/^(.+?)\s+\d+\s*$/);
  if (m && m[1].trim().length >= 1) name = m[1].trim();
  else {
    m = name.match(/^([\u4e00-\u9fffA-Za-z]+)\d+\s*$/);
    if (m) name = m[1].trim();
  }

  if (
    !name ||
    name.length > 12 ||
    /[（(）)]/.test(name) ||
    /\d/.test(name) ||
    CN_QTY_SUFFIX.test(name) ||
    /^(两个|三个|四个|五个)/.test(name) ||
    /或者|比如|可选|根据|都可以|替代|火枪|长宽高|总共|部分|用量/.test(name) ||
    /^(蔬菜|肉|配菜|食材)$/.test(name)
  ) {
    return null;
  }
  if (isGarbageIngredient(name)) return null;

  return { name, amountHint };
}

function cleanDescription(desc) {
  if (!desc) return '';
  const firstPara = desc.split('\n')[0].trim();
  const noDiff = firstPara.replace(/预估烹饪难度.*$/, '').trim();
  return noDiff.length > 60 ? noDiff.slice(0, 58) + '…' : noDiff;
}

/** description 必填：原文空时给中性 fallback，避免 plan 今晚主卡空白 */
function dishDescription(name, rawDesc) {
  const cleaned = cleanDescription(rawDesc);
  if (cleaned) return cleaned;
  return `家常「${name}」，按步骤即可上手。`;
}

/**
 * 器具 / 公式元数据 / 泛化占位食材名。
 * 命中则整道过滤（不可静默丢掉后留残缺菜）。
 */
const META_INGREDIENT =
  /煲汤盅|汤盅|^盅$|一碗容量是|容量是|中断大火加热的最晚时间|米粥能够食用的最早时间|冷藏时间|最晚时间|最早时间|面类材料|^菜类$|其中青菜体积可忽略|体积可忽略|其他调料|风味调料|^调料$/;

function hasMetaIngredient(ingredients) {
  return ingredients.some((ing) => META_INGREDIENT.test(String(ing.name || '').trim()));
}

/**
 * 步骤是否含可用的烹饪/完成动作；纯备菜假菜谱淘汰。
 * 凉拌/拌菜 + 拌匀/搅拌/腌制 等冷制完整动作允许（如凉拌黄瓜）。
 */
const COOK_ACTION =
  /锅|火|煮|炒|蒸|炖|焖|煎|炸|烤|烧|收汁|出锅|盛出|熟|焯|煸|氽|煲|焗|开火|关火|小火|大火|中火|起锅|烧油|下锅|入锅|煮沸|焯烫|翻炒|爆香/;
const COLD_NAME_OR_STEP = /凉拌|拌菜/;
const COLD_ACTION = /拌匀|搅拌|腌制|拌入|拌好|均匀搅拌/;

function hasUsableCookSteps(name, stepTexts) {
  const text = stepTexts.join('\n');
  if (COOK_ACTION.test(text)) return true;
  if (COLD_NAME_OR_STEP.test(name) || COLD_NAME_OR_STEP.test(text)) {
    return COLD_ACTION.test(text);
  }
  return false;
}

// ── 主流程 ──
const raw = await loadRaw();
const picked = [];
const skipped = {
  category: 0,
  blacklist: 0,
  equipment: 0,
  size: 0,
  difficulty: 0,
  dirty: 0,
  aggregate: 0,
  meta: 0,
  nosteps: 0,
};

for (const r of raw) {
  if (!DINNER_CATEGORIES.has(r.category)) {
    skipped.category++;
    continue;
  }
  const name = r.name.replace(/的做法$/, '').trim();
  if (NAME_BLACKLIST.test(name)) {
    skipped.blacklist++;
    continue;
  }
  if ((r.difficulty ?? 3) > 4) {
    skipped.difficulty++;
    continue;
  }
  const stepTexts = r.steps.map((s) => s.description);
  const equipText = [name, ...stepTexts, r.description ?? ''].join(' ');
  if (EQUIPMENT_BLACKLIST.test(equipText)) {
    skipped.equipment++;
    continue;
  }
  if (r.steps.length < 3 || r.steps.length > 18) {
    skipped.size++;
    continue;
  }
  // 元数据/器具/占位名当食材 → 整道丢弃
  if (hasMetaIngredient(r.ingredients)) {
    skipped.meta++;
    continue;
  }
  // 无烹饪/冷制完成动作（只有备菜）→ 整道丢弃
  if (!hasUsableCookSteps(name, stepTexts)) {
    skipped.nosteps++;
    continue;
  }

  // 聚合行：不拆分，整道过滤
  if (r.ingredients.some((ing) => isAggregateIngredient(ing))) {
    skipped.aggregate++;
    continue;
  }

  const cleaned = [];
  let failed = 0;
  for (const ing of r.ingredients) {
    const san = sanitizeIngredientName(ing.name);
    if (!san) {
      failed++;
      continue;
    }
    cleaned.push({
      name: san.name,
      amount: parseAmount(ing, san.name, san.amountHint),
      category: classify(san.name),
    });
  }
  // 清洗后仍有中文数量粘名、聚合残留 amount、开头冒号 → 整道丢弃
  if (
    cleaned.some(
      (i) =>
        CN_QTY_SUFFIX.test(i.name) ||
        /^(两个|三个|四个|五个)/.test(i.name) ||
        /各一个|菜椒甜椒|半瓶/.test(i.name) ||
        /^[、]/.test((i.amount || '').trim()) ||
        /[\u4e00-\u9fff]、[\u4e00-\u9fff]/.test(i.amount || '') ||
        /^[：:]/.test((i.amount || '').trim())
    )
  ) {
    skipped.dirty++;
    continue;
  }
  if (failed > 2 || cleaned.length < 2 || cleaned.length > 16) {
    skipped.dirty++;
    continue;
  }

  const ingredientNames = cleaned.map((i) => i.name);
  const minutes = estimateMinutes(r);
  if (minutes > 90) {
    skipped.size++;
    continue;
  }

  picked.push({
    id: 'ht-' + createHash('md5').update(name).digest('hex').slice(0, 8),
    name,
    description: dishDescription(name, r.description),
    minutes,
    costLevel: estimateCost(ingredientNames),
    ingredients: cleaned,
    steps: stepTexts,
    usesFridgeItems: [],
    solarTerms: solarTermsFor(name, ingredientNames),
    baseServings: typeof r.servings === 'number' && r.servings > 0 ? r.servings : 2,
    tags: r.tags ?? [],
    catalogCategory: r.category,
  });
}

// 去重（同名保留步骤更多的）
const byName = new Map();
for (const d of picked) {
  const prev = byName.get(d.name);
  if (!prev || d.steps.length > prev.steps.length) byName.set(d.name, d);
}
const catalog = [...byName.values()].sort((a, b) =>
  a.catalogCategory === b.catalogCategory
    ? a.name.localeCompare(b.name, 'zh')
    : a.catalogCategory.localeCompare(b.catalogCategory, 'zh')
);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(catalog, null, 1));

// ── 分类断言（生成后）──
function assertCat(pred, msg) {
  if (!pred) throw new Error(`分类断言失败：${msg}`);
}
{
  const allIng = catalog.flatMap((d) => d.ingredients);
  const of = (n) => allIng.filter((i) => i.name === n);
  const names = new Set(catalog.map((d) => d.name));

  assertCat(catalog.length > 100, `底库 >100（实际 ${catalog.length}）`);

  // 灶台不可用假菜谱不得入选
  for (const bad of [
    '牛排',
    '茭白炒肉',
    '陈皮排骨汤',
    '玉米排骨汤',
    '西红柿鸡蛋挂面',
    '蒸卤面',
    '中式馅饼',
  ]) {
    assertCat(!names.has(bad), `不完整菜已过滤：${bad}`);
  }
  assertCat(names.has('凉拌黄瓜'), '合法凉拌黄瓜仍在');

  // 元数据食材命中为 0
  const metaHits = allIng.filter((i) => META_INGREDIENT.test(i.name));
  assertCat(metaHits.length === 0, `元数据食材为0（仍有 ${metaHits.map((i) => i.name).join(',')}）`);

  // 抽检：不应再有「只有备菜」
  const fakePrep = catalog.filter((d) => !hasUsableCookSteps(d.name, d.steps));
  assertCat(fakePrep.length === 0, `无烹饪步骤残留：${fakePrep.map((d) => d.name).join(',')}`);

  assertCat(
    of('小米辣').length > 0 && of('小米辣').every((i) => i.category === '蔬菜'),
    '小米辣 全蔬菜'
  );
  assertCat(of('小米椒').every((i) => i.category === '蔬菜'), '小米椒 全蔬菜');
  assertCat(classify('小米辣椒粉') === '调味', '小米辣椒粉 仍调味');
  assertCat(of('羊排').every((i) => i.category === '肉蛋'), '羊排 全肉蛋');
  assertCat(of('鸭子').every((i) => i.category === '肉蛋'), '鸭子 全肉蛋');
  assertCat(of('香芹').every((i) => i.category === '蔬菜'), '香芹 全蔬菜');
  assertCat(of('菜椒').every((i) => i.category === '蔬菜'), '菜椒 全蔬菜');
  assertCat(of('小米').every((i) => i.category === '主食'), '裸名小米 主食');

  // 设备 / 空描述
  const EQUIP_RE = /微波炉|微波|电饭煲|电饭锅|烤箱|空气炸锅|轻食机|面包机|破壁机|电饼铛/;
  assertCat(
    catalog.every((d) => d.description && d.description.trim()),
    'description 全非空'
  );
  assertCat(
    !catalog.some((d) =>
      EQUIP_RE.test([d.name, d.description, ...d.steps].join(' '))
    ),
    '设备依赖命中为0'
  );

  console.log('分类/可用性断言通过');
}

const stats = {};
for (const d of catalog) stats[d.catalogCategory] = (stats[d.catalogCategory] || 0) + 1;
const seasonal = catalog.filter((d) => d.solarTerms.length > 0).length;
console.log(`共入选 ${catalog.length} 道：`, stats);
console.log(`带节气标签：${seasonal} 道；跳过：`, skipped);
console.log(`写入 ${OUT}（${(JSON.stringify(catalog).length / 1024).toFixed(0)} KB）`);
