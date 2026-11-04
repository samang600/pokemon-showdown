/** 네임드 트레이너 · 일반 트레이너 · PWT 대회 데이터 */
import { rng } from './sets';
import { CLASS_SPRITES, NAMED_SPRITE, NAMED_LINES, genericLines } from './trainer-lines';

export interface NamedTrainer {
	id: string;
	name: string;
	title: string; // 예: '회색체육관 관장'
	region: '관동' | '성도' | '호연' | '신오' | '하나';
	role: 'leader' | 'elite' | 'champion';
	team: string[]; // 종족 ID 6마리 (앞쪽이 에이스 순서 아님)
	ace: string; // 마지막에 나오는 에이스
	line?: string; // 승부 시작 대사
}

const T = (id: string, name: string, title: string, region: NamedTrainer['region'], role: NamedTrainer['role'],
	team: string[], line?: string): NamedTrainer => ({ id, name, title, region, role, team, ace: team[team.length - 1], line });

export const NAMED: NamedTrainer[] = [
	// ── 관동 ──
	T('brock', '웅', '관동 체육관 관장 · 바위', '관동', 'leader', ['kabutops', 'omastar', 'aerodactyl', 'golem', 'rhyperior', 'steelix'], '단단한 의지의 바위 포켓몬을 보여주지!'),
	T('misty', '이슬', '관동 체육관 관장 · 물', '관동', 'leader', ['golduck', 'quagsire', 'lapras', 'politoed', 'gyarados', 'starmie'], '내 물 포켓몬의 실력, 얕보지 마!'),
	T('ltsurge', '마티스', '관동 체육관 관장 · 전기', '관동', 'leader', ['electrode', 'lanturn', 'jolteon', 'magnezone', 'electivire', 'raichu'], '찌릿찌릿하게 해 주마!'),
	T('erika', '민화', '관동 체육관 관장 · 풀', '관동', 'leader', ['bellossom', 'jumpluff', 'victreebel', 'tangrowth', 'exeggutor', 'vileplume'], '꽃처럼 우아하게 상대해 드릴게요.'),
	T('koga', '독수', '관동 체육관 관장 · 독', '관동', 'leader', ['ariados', 'venomoth', 'tentacruel', 'muk', 'weezing', 'crobat'], '닌자의 독술을 맛보아라!'),
	T('sabrina', '초련', '관동 체육관 관장 · 에스퍼', '관동', 'leader', ['xatu', 'jynx', 'mrmime', 'slowbro', 'espeon', 'alakazam'], '네가 질 거라는 건 이미 보였어.'),
	T('blaine', '강연', '관동 체육관 관장 · 불꽃', '관동', 'leader', ['torkoal', 'ninetales', 'rapidash', 'houndoom', 'magmortar', 'arcanine'], '화상 치료제는 준비했겠지!'),
	T('giovanni', '비주기', '관동 체육관 관장 · 땅', '관동', 'leader', ['dugtrio', 'marowak', 'krookodile', 'nidoqueen', 'rhyperior', 'nidoking'], '진정한 강함을 가르쳐 주지.'),
	T('lorelei', '칸나', '관동 사천왕 · 얼음', '관동', 'elite', ['dewgong', 'cloyster', 'jynx', 'slowbro', 'mamoswine', 'lapras'], '얼음 포켓몬으로 얼려 주겠어!'),
	T('bruno', '시바', '관동 사천왕 · 격투', '관동', 'elite', ['hitmonlee', 'hitmonchan', 'hitmontop', 'poliwrath', 'steelix', 'machamp'], '우오오! 단련된 근육을 보여주마!'),
	T('agatha', '국화', '관동 사천왕 · 고스트', '관동', 'elite', ['arbok', 'weezing', 'crobat', 'dusknoir', 'mismagius', 'gengar'], '포켓몬은 싸우기 위해 있는 거란다!'),
	T('lance', '목호', '관동·성도 챔피언', '관동', 'champion', ['aerodactyl', 'gyarados', 'charizard', 'kingdra', 'salamence', 'dragonite'], '드래곤 포켓몬의 힘, 느껴 보아라!'),
	T('blue', '그린', '관동 챔피언', '관동', 'champion', ['pidgeot', 'exeggutor', 'rhyperior', 'gyarados', 'alakazam', 'arcanine'], '내가 세계에서 제일 강하다고!'),
	T('red', '레드', '전설의 트레이너', '관동', 'champion', ['espeon', 'snorlax', 'venusaur', 'blastoise', 'charizard', 'pikachu'], '…………'),
	// ── 성도 ──
	T('falkner', '비상', '성도 체육관 관장 · 비행', '성도', 'leader', ['noctowl', 'swellow', 'honchkrow', 'skarmory', 'staraptor', 'pidgeot'], '비행 포켓몬의 진가를 보여주지!'),
	T('bugsy', '호일', '성도 체육관 관장 · 벌레', '성도', 'leader', ['shuckle', 'forretress', 'yanmega', 'pinsir', 'heracross', 'scizor'], '벌레 포켓몬 연구의 성과를 보여줄게!'),
	T('whitney', '꼭두', '성도 체육관 관장 · 노말', '성도', 'leader', ['girafarig', 'ambipom', 'wigglytuff', 'clefable', 'blissey', 'miltank'], '귀엽다고 봐주면 안 돼~!'),
	T('morty', '유빈', '성도 체육관 관장 · 고스트', '성도', 'leader', ['sableye', 'banette', 'drifblim', 'dusknoir', 'mismagius', 'gengar'], '보이지 않는 것을 보는 힘이 있어.'),
	T('chuck', '사도', '성도 체육관 관장 · 격투', '성도', 'leader', ['primeape', 'hitmontop', 'breloom', 'heracross', 'machamp', 'poliwrath'], '와하하! 수련의 성과다!'),
	T('jasmine', '규리', '성도 체육관 관장 · 강철', '성도', 'leader', ['forretress', 'skarmory', 'ampharos', 'magnezone', 'scizor', 'steelix'], '강철처럼 단단하게… 열심히 할게요.'),
	T('pryce', '류옹', '성도 체육관 관장 · 얼음', '성도', 'leader', ['glalie', 'dewgong', 'walrein', 'weavile', 'lapras', 'mamoswine'], '세월의 무게를 견뎌 온 얼음이다.'),
	T('clair', '이향', '성도 체육관 관장 · 드래곤', '성도', 'leader', ['altaria', 'flygon', 'gyarados', 'salamence', 'dragonite', 'kingdra'], '드래곤 사용자의 자존심을 걸고!'),
	T('will', '일목', '성도 사천왕 · 에스퍼', '성도', 'elite', ['exeggutor', 'jynx', 'slowbro', 'bronzong', 'gardevoir', 'xatu'], '에스퍼의 힘을 보여주지.'),
	T('karen', '카렌', '성도 사천왕 · 악', '성도', 'elite', ['honchkrow', 'weavile', 'spiritomb', 'houndoom', 'tyranitar', 'umbreon'], '강한 포켓몬, 약한 포켓몬… 그건 사람의 제멋대로야.'),
	// ── 호연 ──
	T('roxanne', '원규', '호연 체육관 관장 · 바위', '호연', 'leader', ['relicanth', 'armaldo', 'cradily', 'aerodactyl', 'golem', 'probopass'], '배운 것을 실전에서 확인할 때예요!'),
	T('brawly', '철구', '호연 체육관 관장 · 격투', '호연', 'leader', ['medicham', 'breloom', 'hitmontop', 'lucario', 'machamp', 'hariyama'], '거친 파도처럼 몰아쳐 주지!'),
	T('wattson', '암페어', '호연 체육관 관장 · 전기', '호연', 'leader', ['electrode', 'lanturn', 'raichu', 'ampharos', 'magnezone', 'manectric'], '우와하하! 짜릿한 승부를 해 보자!'),
	T('flannery', '민지', '호연 체육관 관장 · 불꽃', '호연', 'leader', ['magcargo', 'ninetales', 'houndoom', 'camerupt', 'magmortar', 'torkoal'], '뜨거운 승부를 보여줄게!'),
	T('norman', '종길', '호연 체육관 관장 · 노말', '호연', 'leader', ['ursaring', 'swellow', 'kangaskhan', 'porygonz', 'snorlax', 'slaking'], '아버지로서, 관장으로서 전력을 다하겠다.'),
	T('winona', '은송', '호연 체육관 관장 · 비행', '호연', 'leader', ['pelipper', 'tropius', 'swellow', 'skarmory', 'staraptor', 'altaria'], '하늘을 나는 포켓몬의 우아함을 봐!'),
	T('tateliza', '풍&란', '호연 체육관 관장 · 에스퍼', '호연', 'leader', ['solrock', 'lunatone', 'xatu', 'claydol', 'gardevoir', 'metagross'], '우리 둘의 호흡을 깨뜨릴 수 있을까?'),
	T('juan', '아단', '호연 체육관 관장 · 물', '호연', 'leader', ['whiscash', 'crawdaunt', 'ludicolo', 'walrein', 'milotic', 'kingdra'], '물과 하나 된 아름다운 승부를!'),
	T('sidney', '혁진', '호연 사천왕 · 악', '호연', 'elite', ['mightyena', 'cacturne', 'shiftry', 'crawdaunt', 'sharpedo', 'absol'], '좋아, 신나게 붙어 보자고!'),
	T('phoebe', '회연', '호연 사천왕 · 고스트', '호연', 'elite', ['sableye', 'banette', 'spiritomb', 'mismagius', 'froslass', 'dusknoir'], '보이지 않는 세계의 포켓몬과 함께 수행했어.'),
	T('glacia', '미혜', '호연 사천왕 · 얼음', '호연', 'elite', ['glalie', 'froslass', 'abomasnow', 'cloyster', 'mamoswine', 'walrein'], '차가운 얼음의 기술을 맛보세요.'),
	T('drake', '권수', '호연 사천왕 · 드래곤', '호연', 'elite', ['altaria', 'flygon', 'kingdra', 'dragonite', 'garchomp', 'salamence'], '드래곤 포켓몬을 다루려면 필요한 것이 있다!'),
	T('steven', '성호', '호연 챔피언', '호연', 'champion', ['skarmory', 'claydol', 'cradily', 'armaldo', 'aggron', 'metagross'], '자, 전력으로 승부하자!'),
	T('wallace', '윤', '호연 챔피언', '호연', 'champion', ['wailord', 'tentacruel', 'ludicolo', 'whiscash', 'gyarados', 'milotic'], '아름다움과 강함, 모두 보여주지.'),
	// ── 신오 ──
	T('roark', '강석', '신오 체육관 관장 · 바위', '신오', 'leader', ['bastiodon', 'probopass', 'golem', 'aerodactyl', 'rhyperior', 'rampardos'], '내 화석 포켓몬은 단단하다고!'),
	T('gardenia', '유채', '신오 체육관 관장 · 풀', '신오', 'leader', ['cherrim', 'carnivine', 'tangrowth', 'leafeon', 'torterra', 'roserade'], '풀 포켓몬의 매력, 알려줄게!'),
	T('maylene', '자두', '신오 체육관 관장 · 격투', '신오', 'leader', ['toxicroak', 'breloom', 'hitmontop', 'medicham', 'machamp', 'lucario'], '열심히 수행한 성과를 보여줄게요!'),
	T('crasherwake', '맥실러', '신오 체육관 관장 · 물', '신오', 'leader', ['quagsire', 'ludicolo', 'gastrodon', 'empoleon', 'gyarados', 'floatzel'], '물 포켓몬의 거친 파도를 받아라!'),
	T('fantina', '멜리사', '신오 체육관 관장 · 고스트', '신오', 'leader', ['rotom', 'froslass', 'drifblim', 'dusknoir', 'gengar', 'mismagius'], '나의 포켓몬, 아주 아름답죠?'),
	T('byron', '동관', '신오 체육관 관장 · 강철', '신오', 'leader', ['skarmory', 'magnezone', 'empoleon', 'bronzong', 'steelix', 'bastiodon'], '강철의 방어를 뚫을 수 있겠느냐!'),
	T('candice', '무청', '신오 체육관 관장 · 얼음', '신오', 'leader', ['glaceon', 'walrein', 'weavile', 'mamoswine', 'abomasnow', 'froslass'], '집중! 집중이야!'),
	T('volkner', '전진', '신오 체육관 관장 · 전기', '신오', 'leader', ['ambipom', 'octillery', 'raichu', 'jolteon', 'electivire', 'luxray'], '나를 감전시킬 승부를 보여줘.'),
	T('aaron', '충호', '신오 사천왕 · 벌레', '신오', 'elite', ['dustox', 'vespiquen', 'yanmega', 'heracross', 'scizor', 'drapion'], '벌레 포켓몬의 강인함을 보여주마!'),
	T('bertha', '들국화', '신오 사천왕 · 땅', '신오', 'elite', ['quagsire', 'whiscash', 'golem', 'gliscor', 'rhyperior', 'hippowdon'], '할머니라고 얕보면 큰코다친다.'),
	T('flint', '대엽', '신오 사천왕 · 불꽃', '신오', 'elite', ['rapidash', 'flareon', 'houndoom', 'magmortar', 'drifblim', 'infernape'], '불타오르는 승부를 하자고!'),
	T('lucian', '오엽', '신오 사천왕 · 에스퍼', '신오', 'elite', ['girafarig', 'mrmime', 'espeon', 'gallade', 'alakazam', 'bronzong'], '책을 덮고, 승부에 집중하지.'),
	T('cynthia', '난천', '신오 챔피언', '신오', 'champion', ['spiritomb', 'roserade', 'gastrodon', 'lucario', 'milotic', 'garchomp'], '포켓몬 챔피언 난천. 승부를 받아들일게.'),
	// ── 하나 ──
	T('cheren', '체렌', '하나 체육관 관장 · 노말', '하나', 'leader', ['watchog', 'cinccino', 'bouffalant', 'unfezant', 'audino', 'stoutland'], '강함이란 무엇인지, 승부로 확인하자.'),
	T('lenora', '알로에', '하나 체육관 관장 · 노말', '하나', 'leader', ['watchog', 'cinccino', 'kangaskhan', 'bouffalant', 'miltank', 'stoutland'], '노말 포켓몬을 연구한 성과야!'),
	T('burgh', '아티', '하나 체육관 관장 · 벌레', '하나', 'leader', ['accelgor', 'crustle', 'galvantula', 'escavalier', 'scolipede', 'leavanny'], '나의 예술적인 벌레 포켓몬을 봐!'),
	T('elesa', '카밀레', '하나 체육관 관장 · 전기', '하나', 'leader', ['emolga', 'jolteon', 'ampharos', 'galvantula', 'eelektross', 'zebstrika'], '눈부시게 반짝이는 승부를!'),
	T('clay', '야콘', '하나 체육관 관장 · 땅', '하나', 'leader', ['gigalith', 'seismitoad', 'golurk', 'steelix', 'krookodile', 'excadrill'], '내 땅 포켓몬은 거칠다고!'),
	T('skyla', '풍란', '하나 체육관 관장 · 비행', '하나', 'leader', ['sigilyph', 'unfezant', 'archeops', 'skarmory', 'braviary', 'swanna'], '하늘을 날듯이 즐거운 승부를!'),
	T('brycen', '하치쿠', '하나 체육관 관장 · 얼음', '하나', 'leader', ['cryogonal', 'vanilluxe', 'weavile', 'abomasnow', 'mamoswine', 'beartic'], '얼음처럼 냉정하게 상대해 주지.'),
	T('drayden', '사간', '하나 체육관 관장 · 드래곤', '하나', 'leader', ['druddigon', 'altaria', 'flygon', 'dragonite', 'salamence', 'haxorus'], '드래곤의 긍지를 걸고!'),
	T('alder', '노간주', '하나 챔피언', '하나', 'champion', ['bouffalant', 'accelgor', 'vanilluxe', 'escavalier', 'druddigon', 'volcarona'], '포켓몬과의 승부, 즐겨 보자!'),
	T('iris', '아이리스', '하나 챔피언', '하나', 'champion', ['archeops', 'lapras', 'aggron', 'dragonite', 'hydreigon', 'haxorus'], '드래곤 포켓몬과 함께, 진심으로 갈게!'),
];

export const REGIONS: NamedTrainer['region'][] = ['관동', '성도', '호연', '신오', '하나'];
export const ROLE_KO = { leader: '체육관 관장', elite: '사천왕', champion: '챔피언' };

// ── 일반 트레이너 ──
export interface TrainerClass { name: string; types?: string[] }
export const CLASSES: TrainerClass[] = [
	{ name: '엘리트트레이너' }, { name: '베테랑트레이너' }, { name: '아가씨', types: ['Normal', 'Fairy', 'Grass'] },
	{ name: '신사' }, { name: '도련님' }, { name: '격투가', types: ['Fighting'] }, { name: '사이킥커', types: ['Psychic'] },
	{ name: '드래곤조련사', types: ['Dragon'] }, { name: '포켓몬레인저' }, { name: '배틀걸', types: ['Fighting'] },
	{ name: '과학자', types: ['Electric', 'Steel', 'Poison'] }, { name: '등산가', types: ['Rock', 'Ground'] },
	{ name: '수영선수', types: ['Water'] }, { name: '스킨헤드', types: ['Dark', 'Poison', 'Fire'] }, { name: '무녀', types: ['Ghost', 'Psychic'] },
	{ name: '학자' }, { name: '원예가', types: ['Grass', 'Bug'] }, { name: '낚시꾼', types: ['Water'] },
	{ name: '조련사', types: ['Normal', 'Fire'] }, { name: '곤충채집소년', types: ['Bug'] }, { name: '새조련사', types: ['Flying'] },
	{ name: '스키어', types: ['Ice'] }, { name: '오컬트마니아', types: ['Ghost'] }, { name: '카우걸', types: ['Normal', 'Ground'] },
	{ name: '포켓몬브리더' }, { name: '가라테왕', types: ['Fighting'] }, { name: '레인저', types: ['Grass', 'Water'] },
];
const NAMES = ['민준', '서연', '지호', '하윤', '도윤', '서진', '예준', '지우', '시우', '수아', '주원', '하은', '건우', '지민',
	'현우', '채원', '유준', '다은', '은우', '소율', '정우', '예린', '승현', '지안', '태윤', '나연', '준서', '윤서', '민서', '재원',
	'수빈', '도현', '하린', '시윤', '유나', '우진', '서윤', '지훈', '예은', '성민', '가은', '민혁', '보람', '한결', '세아', '태오'];

export function randomTrainer() {
	const c = rng.pick(CLASSES);
	const sprites = CLASS_SPRITES[c.name] || ['acetrainer-gen4'];
	return { className: c.name, name: rng.pick(NAMES), types: c.types, sprite: rng.pick(sprites), lines: genericLines() };
}

export function namedSprite(t: NamedTrainer) { return NAMED_SPRITE[t.id] || t.id; }
export function namedLines(t: NamedTrainer) {
	return { intro: t.line || '', ...(NAMED_LINES[t.id] || genericLines()) };
}

// ── PWT 대회 ──
export interface Cup { id: string; name: string; desc: string; trainers: () => string[]; rental?: boolean; open?: boolean }
const byRegionLeaders = (r: NamedTrainer['region']) => NAMED.filter(t => t.region === r && t.role === 'leader').map(t => t.id);
export const CUPS: Cup[] = [
	{ id: 'rental', name: '렌탈 대회', desc: '대회에서 빌려주는 포켓몬으로 참가합니다. 상대는 일반 트레이너.', trainers: () => [], rental: true },
	{ id: 'open', name: '오픈 대회', desc: '내 팀으로 참가. 상대는 실력 있는 일반 트레이너.', trainers: () => [], open: true },
	{ id: 'kanto', name: '관동 리더스', desc: '관동 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('관동') },
	{ id: 'johto', name: '성도 리더스', desc: '성도 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('성도') },
	{ id: 'hoenn', name: '호연 리더스', desc: '호연 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('호연') },
	{ id: 'sinnoh', name: '신오 리더스', desc: '신오 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('신오') },
	{ id: 'unova', name: '하나 리더스', desc: '하나 지방 체육관 관장들이 참가합니다.', trainers: () => byRegionLeaders('하나') },
	{ id: 'world', name: '월드 리더스', desc: '모든 지방의 관장들 중 무작위로 참가합니다.', trainers: () => rng.shuffle(NAMED.filter(t => t.role === 'leader').map(t => t.id)) },
	{ id: 'elite', name: '사천왕 대회', desc: '각 지방의 사천왕이 모였습니다.', trainers: () => rng.shuffle(NAMED.filter(t => t.role === 'elite').map(t => t.id)) },
	{ id: 'champions', name: '챔피언스', desc: '역대 챔피언들이 모인 최강의 대회.', trainers: () => rng.shuffle(NAMED.filter(t => t.role === 'champion').map(t => t.id)) },
];

export function namedById(id: string) { return NAMED.find(t => t.id === id)!; }
