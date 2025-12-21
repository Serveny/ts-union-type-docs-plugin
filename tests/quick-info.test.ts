import type * as TS from 'typescript/lib/tsserverlibrary';
import { describe, it, expect } from 'vitest';
import { createProxyFromCase } from './setup';

function quickInfoTest(casePath: string, textAtCursor: string) {
	const { proxy, absolutePath, code } = createProxyFromCase(casePath);
	const cursorPos = code.indexOf(textAtCursor);
	const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);
	return result;
}

function tagsToText(quickInfo: TS.QuickInfo) {
	return quickInfo.tags
		?.map((tag) => tag.text?.map((t) => t.text)?.join(''))
		.join('');
}

describe('Plugin Tests', () => {
	it('should find inline js doc comment of union parameter', () => {
		const result = quickInfoTest(
			'tests/cases/inline-union-param-docs.ts',
			`test('bar')`
		);
		expect(result).toBeDefined();
		expect(tagsToText(result!)).toContain('x\n> bar docs\n');
	});
});
