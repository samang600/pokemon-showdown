/** 앱에서 쓰는 배틀 규칙(포맷) 목록 — config/formats.ts 대신 사용 */
const common = {
	searchShow: false,
	debug: true,
	battle: { trunc: Math.trunc },
	ruleset: ['Max Team Size = 24', 'Max Move Count = 24', 'Max Level = 9999', 'Default Level = 50'],
};

export const Formats = [
	{ name: "[Gen 4] KR Singles", mod: 'gen4', gameType: 'singles', ...common },
	{ name: "[Gen 4] KR Doubles", mod: 'gen4', gameType: 'doubles', ...common },
	{ name: "[Gen 5] KR Singles", mod: 'gen5', gameType: 'singles', ...common },
	{ name: "[Gen 5] KR Doubles", mod: 'gen5', gameType: 'doubles', ...common },
	{ name: "[Gen 4] Random Battle", mod: 'gen4', team: 'random', ...common },
	{ name: "[Gen 5] Random Battle", mod: 'gen5', team: 'random', ...common },
];
