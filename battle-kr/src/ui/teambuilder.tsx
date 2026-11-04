/** 팀 편집 */
import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { allSpecies, allItems, allNatures, learnset, moveData, speciesData, toID, abilityKo, abilityDesc, itemKo, itemDesc,
	natureKo, STAT_KO, STAT_SHORT, STATS, RAW, speciesKo, type Gen, type StatID } from '../data';
import { randomSetFor, applySpread, randomTeam, type PSet } from '../sets';
import { loadTeams, upsertTeam, deleteTeam, newId, type SavedTeam } from '../store';
import { Screen, Sprite, MiniSprite, TypeBadge, Modal, toast, confirmBox } from './core';
import { SetCard } from './screens';

// 초성 검색
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function chosung(s: string) {
	let out = '';
	for (const ch of s) {
		const c = ch.charCodeAt(0);
		out += c >= 0xAC00 && c <= 0xD7A3 ? CHO[Math.floor((c - 0xAC00) / 588)] : ch;
	}
	return out;
}
export function matches(query: string, ...names: string[]) {
	const q = query.trim().toLowerCase().replace(/\s/g, '');
	if (!q) return true;
	const isCho = /^[ㄱ-ㅎ]+$/.test(q);
	return names.some(n => {
		const nn = n.toLowerCase().replace(/\s/g, '');
		if (nn.includes(q) || toID(n).includes(toID(q) || '\u0000')) return true;
		return isCho && chosung(nn).includes(q);
	});
}

export function newSet(species: string, gen: Gen): PSet {
	return randomSetFor(species, gen, 50);
}

/** 팀 목록 */
export function TeamList({ onBack, onEdit }: { onBack: () => void; onEdit: (t: SavedTeam) => void }) {
	const [teams, setTeams] = useState(loadTeams());
	const create = (gen: Gen, random: boolean) => {
		const t: SavedTeam = { id: newId(), name: `${gen}세대 팀 ${teams.length + 1}`, gen, sets: random ? randomTeam({ gen, size: 6, minBst: 470 }) : [], updated: Date.now() };
		upsertTeam(t);
		onEdit(t);
	};
	return <Screen title="팀 편집" onBack={onBack}>
		<div class="row wrap">
			<button class="btn primary" onClick={() => create(4, false)}>+ 4세대 팀</button>
			<button class="btn primary" onClick={() => create(5, false)}>+ 5세대 팀</button>
			<button class="btn ghost" onClick={() => create(4, true)}>🎲 4세대 추천팀</button>
			<button class="btn ghost" onClick={() => create(5, true)}>🎲 5세대 추천팀</button>
		</div>
		<ImportBox onImported={() => setTeams(loadTeams())} />
		{!teams.length && <p class="empty-msg">아직 팀이 없습니다. 새 팀을 만들거나 추천팀을 받아 보세요.</p>}
		<div class="card-list">
			{teams.map(t => <div class="team-row clickable" onClick={() => onEdit(t)}>
				<div class="team-row-head"><b>{t.name}</b><span class="tag">{t.gen}세대</span><span class="muted">{t.sets.length}/6</span></div>
				<div class="preview-row">{t.sets.map(s => <MiniSprite species={s.species} gen={t.gen} size={40} />)}</div>
			</div>)}
		</div>
	</Screen>;
}

/** 쇼다운 텍스트 가져오기 (영문/한글 이름 모두) */
const KO_LOOKUP: { [ko: string]: string } = {};
function koLookup(name: string): string {
	if (!Object.keys(KO_LOOKUP).length) {
		for (const table of [RAW.species, RAW.moves, RAW.items, RAW.abilities, RAW.natures] as any[]) {
			for (const id in table) KO_LOOKUP[table[id].n.replace(/\s/g, '')] = id;
		}
	}
	const k = name.trim().replace(/\s/g, '');
	return KO_LOOKUP[k] || toID(name);
}
export function importText(text: string, gen: Gen): PSet[] {
	const sets: PSet[] = [];
	for (const block of text.split(/\n\s*\n/)) {
		const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
		if (!lines.length) continue;
		let [first, item] = lines[0].split('@').map(s => s.trim());
		first = first.replace(/\((M|F)\)\s*$/, '').trim();
		let species = first;
		const paren = /^(.*)\(([^)]+)\)$/.exec(first);
		if (paren) species = paren[2];
		const sid = koLookup(species);
		const sd = speciesData(sid, gen);
		if (!sd) continue;
		const set: PSet = {
			name: speciesKo(sid), species: sd.en, item: item ? koLookup(item) : '', ability: sd.ab[0], moves: [], nature: 'serious',
			evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
		};
		for (const l of lines.slice(1)) {
			if (/^(Ability|특성):/i.test(l)) set.ability = koLookup(l.split(':')[1]);
			else if (/^(EVs|노력치):/i.test(l) || /^(IVs|개체값):/i.test(l)) {
				const target = /^(EVs|노력치)/i.test(l) ? set.evs : set.ivs;
				for (const part of l.split(':')[1].split('/')) {
					const m = /(\d+)\s*(.+)/.exec(part.trim());
					if (!m) continue;
					const key = { hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe', 공격: 'atk', 방어: 'def', 특공: 'spa', 특방: 'spd', 스피드: 'spe', 특수공격: 'spa', 특수방어: 'spd' }[toID(m[2]) || m[2].trim()] as StatID;
					if (key) target[key] = parseInt(m[1], 10);
				}
			} else if (/Nature$/i.test(l) || /성격$/.test(l)) set.nature = koLookup(l.replace(/\s*(Nature|성격)$/i, ''));
			else if (l.startsWith('-')) {
				const mid = koLookup(l.slice(1).replace(/\[.*\]/, ''));
				if (moveData(mid, gen)) set.moves.push(mid);
			} else if (/^Shiny: Yes/i.test(l)) set.shiny = true;
		}
		if (!set.moves.length) continue;
		sets.push(set);
	}
	return sets.slice(0, 6);
}
export function exportText(sets: PSet[]) {
	return sets.map(s => {
		const lines = [`${speciesKo(s.species)}${s.item ? ' @ ' + itemKo(s.item) : ''}`, `특성: ${abilityKo(s.ability)}`,
			`노력치: ${STATS.filter(k => s.evs[k]).map(k => `${s.evs[k]} ${STAT_SHORT[k]}`).join(' / ')}`,
			`${natureKo(s.nature)} 성격`, ...s.moves.map(m => `- ${moveData(m, 5)?.name || m}`)];
		return lines.join('\n');
	}).join('\n\n');
}

function ImportBox({ onImported }: { onImported: () => void }) {
	const [open, setOpen] = useState(false);
	const [text, setText] = useState('');
	const [gen, setGen] = useState<Gen>(4);
	if (!open) return <button class="btn ghost small" onClick={() => setOpen(true)}>텍스트로 팀 가져오기</button>;
	return <Modal title="팀 가져오기" onClose={() => setOpen(false)}>
		<p class="muted">쇼다운 형식(영어/한글 이름) 텍스트를 붙여 넣으세요.</p>
		<div class="seg">{[4, 5].map(g => <button class={gen === g ? 'on' : ''} onClick={() => setGen(g as Gen)}>{g}세대</button>)}</div>
		<textarea rows={10} value={text} onInput={e => setText((e.target as HTMLTextAreaElement).value)}
			placeholder={'한카리아스 @ 구애스카프\n특성: 모래숨기\n노력치: 252 공격 / 4 HP / 252 스피드\n명랑 성격\n- 역린\n- 지진\n- 스톤에지\n- 불꽃엄니'} />
		<div class="row end">
			<button class="btn primary" onClick={() => {
				const sets = importText(text, gen);
				if (!sets.length) { toast('읽을 수 있는 포켓몬이 없습니다'); return; }
				upsertTeam({ id: newId(), name: '가져온 팀', gen, sets, updated: Date.now() });
				toast(`${sets.length}마리를 가져왔습니다`);
				setOpen(false); onImported();
			}}>가져오기</button>
		</div>
	</Modal>;
}

/** 팀 하나 편집 */
export function TeamEditor({ team: initial, onBack }: { team: SavedTeam; onBack: () => void }) {
	const [team, setTeam] = useState<SavedTeam>(JSON.parse(JSON.stringify(initial)));
	const [editing, setEditing] = useState<number | null>(null);
	const [adding, setAdding] = useState(false);
	const [exportOpen, setExportOpen] = useState(false);
	const commit = (t: SavedTeam) => { setTeam(t); upsertTeam(t); };
	const g = team.gen;

	if (adding) {
		return <SpeciesPicker gen={g} exclude={team.sets.map(s => toID(s.species))} onBack={() => setAdding(false)}
			onPick={sid => { const t = { ...team, sets: [...team.sets, newSet(sid, g)] }; commit(t); setAdding(false); setEditing(t.sets.length - 1); }} />;
	}
	if (editing !== null && team.sets[editing]) {
		return <SetEditor set={team.sets[editing]} gen={g} onBack={() => setEditing(null)}
			onChange={s => { const sets = team.sets.slice(); sets[editing] = s; commit({ ...team, sets }); }}
			onDelete={() => { commit({ ...team, sets: team.sets.filter((_, i) => i !== editing) }); setEditing(null); }} />;
	}
	return <Screen title={team.name} onBack={onBack} right={<button class="icon-btn" onClick={async () => {
		if (await confirmBox('팀 삭제', `"${team.name}" 팀을 삭제할까요?`, '삭제')) { deleteTeam(team.id); onBack(); }
	}} aria-label="삭제">🗑</button>}>
		<label class="field-label">팀 이름
			<input value={team.name} onInput={e => commit({ ...team, name: (e.target as HTMLInputElement).value })} />
		</label>
		<p class="muted">{g}세대 규칙 · 레벨 50 · 같은 포켓몬은 1마리씩</p>
		<div class="card-list">
			{team.sets.map((s, i) => <SetCard set={s} gen={g} onClick={() => setEditing(i)}>
				<div class="reorder" onClick={e => e.stopPropagation()}>
					<button class="icon-btn" disabled={i === 0} onClick={() => { const sets = team.sets.slice(); [sets[i - 1], sets[i]] = [sets[i], sets[i - 1]]; commit({ ...team, sets }); }}>▲</button>
				</div>
			</SetCard>)}
		</div>
		{team.sets.length < 6 && <button class="btn primary big" onClick={() => setAdding(true)}>+ 포켓몬 추가</button>}
		<div class="row wrap">
			<button class="btn ghost" onClick={() => setExportOpen(true)}>텍스트로 내보내기</button>
		</div>
		{exportOpen && <Modal title="내보내기" onClose={() => setExportOpen(false)}>
			<textarea rows={14} readOnly value={exportText(team.sets)} />
			<button class="btn primary" onClick={() => { navigator.clipboard?.writeText(exportText(team.sets)).then(() => toast('복사했습니다'), () => toast('복사 실패')); }}>복사</button>
		</Modal>}
	</Screen>;
}

function SpeciesPicker({ gen, exclude, onPick, onBack }: { gen: Gen; exclude: string[]; onPick: (id: string) => void; onBack: () => void }) {
	const [q, setQ] = useState('');
	const list = useMemo(() => allSpecies(gen).filter(s => s && !s.bo && s.ls !== undefined || (s && s.base && !s.bo)), [gen]);
	const shown = list.filter(s => s && matches(q, s.n, s.en)).slice(0, 80);
	return <Screen title="포켓몬 고르기" onBack={onBack}>
		<input class="search" placeholder="이름 검색 (초성 가능: ㅎㅋㄹ)" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} autoFocus />
		<div class="pick-list">
			{shown.map(s => s && <button class="pick-row" disabled={exclude.includes(s.id)} onClick={() => onPick(s.id)}>
				<MiniSprite species={s.id} gen={gen} size={40} />
				<span class="pick-name">{s.n}<small class="muted"> #{s.num}</small></span>
				<span class="pick-types">{s.t.map(t => <TypeBadge type={t} small />)}</span>
				<small class="muted bst">{s.bs.reduce((a, b) => a + b, 0)}</small>
			</button>)}
		</div>
	</Screen>;
}

function statValue(base: number, ev: number, iv: number, level: number, nat: number, hp: boolean) {
	if (hp) return base === 1 ? 1 : Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10;
	return Math.floor((Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5) * nat);
}

function SetEditor({ set, gen, onChange, onDelete, onBack }: { set: PSet; gen: Gen; onChange: (s: PSet) => void; onDelete: () => void; onBack: () => void }) {
	const [s, setS] = useState<PSet>(JSON.parse(JSON.stringify(set)));
	const [picker, setPicker] = useState<null | { kind: 'move'; idx: number } | { kind: 'item' } | { kind: 'nature' }>(null);
	const up = (patch: Partial<PSet>) => { const n = { ...s, ...patch }; setS(n); onChange(n); };
	const sd = speciesData(toID(s.species), gen)!;
	const nat = RAW.natures[s.nature];
	const evTotal = STATS.reduce((a, k) => a + s.evs[k], 0);

	if (picker?.kind === 'move') {
		return <MovePicker gen={gen} species={toID(s.species)} current={s.moves} onBack={() => setPicker(null)}
			onPick={mid => { const moves = s.moves.slice(); if (picker.idx < moves.length) moves[picker.idx] = mid; else moves.push(mid); up({ moves: moves.filter(Boolean) }); setPicker(null); }} />;
	}
	if (picker?.kind === 'item') {
		return <ItemPicker gen={gen} onBack={() => setPicker(null)} onPick={id => { up({ item: id }); setPicker(null); }} />;
	}
	if (picker?.kind === 'nature') {
		return <Screen title="성격" onBack={() => setPicker(null)}>
			<div class="pick-list">{allNatures().map(n => <button class="pick-row" onClick={() => { up({ nature: n.id }); setPicker(null); }}>
				<span class="pick-name">{n.n}</span>
				<small>{n.p ? <><span class="up">▲{STAT_SHORT[n.p]}</span> <span class="down">▼{STAT_SHORT[n.m]}</span></> : <span class="muted">변화 없음</span>}</small>
			</button>)}</div>
		</Screen>;
	}
	return <Screen title={sd.n} onBack={onBack} right={<button class="icon-btn" onClick={onDelete} aria-label="삭제">🗑</button>}>
		<div class="detail-head">
			<Sprite species={s.species} gen={gen} size={96} shiny={s.shiny} />
			<div>
				<div class="types">{sd.t.map(t => <TypeBadge type={t} />)}</div>
				<label class="check"><input type="checkbox" checked={!!s.shiny} onChange={e => up({ shiny: (e.target as HTMLInputElement).checked })} /> 색이 다른 포켓몬</label>
				<button class="btn ghost small" onClick={() => { const n = randomSetFor(toID(s.species), gen, 50); n.shiny = s.shiny; setS(n); onChange(n); toast('추천 세트로 바꿨습니다'); }}>🎲 추천 세트</button>
			</div>
		</div>
		<h3 class="sec">특성</h3>
		<div class="seg wrap">{sd.ab.map(a => <button class={s.ability === a ? 'on' : ''} onClick={() => up({ ability: a })}>{abilityKo(a)}</button>)}</div>
		<p class="muted small">{abilityDesc(s.ability)}</p>
		<h3 class="sec">도구</h3>
		<button class="option" onClick={() => setPicker({ kind: 'item' })}><span class="opt-body"><b>{s.item ? itemKo(s.item) : '없음'}</b><small>{itemDesc(s.item)}</small></span></button>
		<h3 class="sec">기술</h3>
		<div class="move-edit">
			{[0, 1, 2, 3].map(i => {
				const m = s.moves[i];
				const md = m ? moveData(m, gen) : null;
				return <button class="option" onClick={() => setPicker({ kind: 'move', idx: Math.min(i, s.moves.length) })}>
					{md ? <><TypeBadge type={md.type} small /><span class="opt-body"><b>{md.name}</b><small>{md.category === 'Status' ? '변화' : `${md.category === 'Physical' ? '물리' : '특수'} ${md.basePower || '-'}`} · 명중 {md.accuracy || '-'} · PP {md.pp}</small></span></>
						: <span class="opt-body muted">+ 기술 선택</span>}
				</button>;
			})}
		</div>
		<h3 class="sec">성격</h3>
		<button class="option" onClick={() => setPicker({ kind: 'nature' })}><span class="opt-body"><b>{natureKo(s.nature)}</b>
			<small>{nat?.p ? `${STAT_KO[nat.p]} ▲ / ${STAT_KO[nat.m]} ▼` : '능력 변화 없음'}</small></span></button>
		<h3 class="sec">노력치 <small class="muted">{evTotal}/510</small>
			<button class="btn ghost small" onClick={() => { const n = applySpread({ ...s, evs: { ...s.evs } }, gen); up({ evs: n.evs, nature: n.nature }); }}>자동 배분</button></h3>
		<div class="ev-table">
			{STATS.map((k, i) => {
				const natMul = nat?.p === k ? 1.1 : nat?.m === k ? 0.9 : 1;
				const val = statValue(sd.bs[i], s.evs[k], s.ivs[k], s.level, natMul, k === 'hp');
				return <div class="ev-row">
					<span class={'ev-label' + (natMul > 1 ? ' up' : natMul < 1 ? ' down' : '')}>{STAT_SHORT[k]}</span>
					<span class="ev-base">{sd.bs[i]}</span>
					<input type="range" min={0} max={252} step={4} value={s.evs[k]} onInput={e => {
						let v = parseInt((e.target as HTMLInputElement).value, 10);
						const others = evTotal - s.evs[k];
						v = Math.min(v, 510 - others);
						up({ evs: { ...s.evs, [k]: Math.max(0, v - v % 4) } });
					}} />
					<span class="ev-val">{s.evs[k]}</span>
					<b class="ev-stat">{val}</b>
				</div>;
			})}
		</div>
		<p class="muted small">개체값 {STATS.map(k => s.ivs[k]).join('/')} · 레벨 {s.level} (모드에 따라 50/100으로 맞춰짐)</p>
	</Screen>;
}

function MovePicker({ gen, species, current, onPick, onBack }: { gen: Gen; species: string; current: string[]; onPick: (id: string) => void; onBack: () => void }) {
	const [q, setQ] = useState('');
	const moves = useMemo(() => learnset(species, gen).map(id => moveData(id, gen)!).filter(Boolean)
		.sort((a, b) => (b.category !== 'Status' ? b.basePower : 0) - (a.category !== 'Status' ? a.basePower : 0)), [species, gen]);
	const shown = moves.filter(m => matches(q, m.name, m.id));
	return <Screen title="기술 고르기" onBack={onBack}>
		<input class="search" placeholder="기술 검색" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
		<div class="pick-list">
			{shown.map(m => <button class="pick-row move" disabled={current.includes(m.id)} onClick={() => onPick(m.id)}>
				<TypeBadge type={m.type} small />
				<span class="pick-name">{m.name}<small class="muted block">{m.desc}</small></span>
				<small class="mv-stats">{m.category === 'Status' ? '변화' : `${m.category === 'Physical' ? '물리' : '특수'} ${m.basePower || '-'}`}<br />{m.accuracy ? m.accuracy + '%' : '—'}</small>
			</button>)}
		</div>
	</Screen>;
}

function ItemPicker({ gen, onPick, onBack }: { gen: Gen; onPick: (id: string) => void; onBack: () => void }) {
	const [q, setQ] = useState('');
	const items = useMemo(() => allItems(gen).filter(i => !/mail$|^tr\d|^tm\d|fossil|shard|scarf$/.test(i.id) || i.id === 'choicescarf'), [gen]);
	const popular = ['leftovers', 'lifeorb', 'choicescarf', 'choiceband', 'choicespecs', 'focussash', 'sitrusberry', 'lumberry', 'expertbelt', 'blacksludge', 'eviolite', 'rockyhelmet', 'airballoon', 'lightclay'];
	const shown = items.filter(i => matches(q, i.n, i.id)).sort((a, b) => {
		const pa = popular.indexOf(a.id), pb = popular.indexOf(b.id);
		return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
	});
	return <Screen title="도구 고르기" onBack={onBack}>
		<input class="search" placeholder="도구 검색" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
		<div class="pick-list">
			<button class="pick-row" onClick={() => onPick('')}><span class="pick-name">없음</span></button>
			{shown.map(i => <button class="pick-row" onClick={() => onPick(i.id)}>
				<span class="pick-name">{i.n}<small class="muted block">{itemDesc(i.id)}</small></span>
			</button>)}
		</div>
	</Screen>;
}
