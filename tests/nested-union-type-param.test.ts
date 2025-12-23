import { describe, it, expect } from 'vitest';
import { createProxyFromCase, tagsToText } from './_test_setup';

const { proxy, absolutePath, code } = createProxyFromCase(
	'tests/cases/nested-union-type-param.ts'
);

describe('Nested Union Type Param Docs Tests', () => {
	it('should find nothing of union type', () => {
		const cursorPos = code.indexOf(`logClassColor('')`);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);
		expect(result).toBeDefined();
		expect(tagsToText(result!)).toBe('');
	});

	it('should find first js doc comment of union type', () => {
		const cursorPos = code.indexOf(`logClassColor('Color-red')`);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);
		expect(result).toBeDefined();
		expect(tagsToText(result!)).toContain('color\n> Primary color\n');
	});

	it('should find second js doc comment of union type with regex symbols inside string', () => {
		const cursorPos = code.indexOf(
			`logClassColor('Color-green/[.*+?^\${}()|[]-]/g')`
		);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);
		expect(result).toBeDefined();
		expect(tagsToText(result!)).toContain(
			'color\n> Secondary color with some regex symbols\n> \n> \n> _@color_ green'
		);
	});

	it('should find nothing of union type', () => {
		const cursorPos = code.indexOf(`logClassColor('Color-blue')`);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);

		expect(result).toBeDefined();
		expect(tagsToText(result!)).toBe('');
	});

	it('should find fourth js doc comment of union type', () => {
		const cursorPos = code.indexOf(`logClassColor('Color-A100')`);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);
		expect(result).toBeDefined();
		expect(tagsToText(result!)).toContain(
			'color\n> A number\n> \n> \n> _@range_ 1-4'
		);
	});

	it('should find nothing of double nested template', () => {
		const cursorPos = code.indexOf(`logNColor('')`);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);

		expect(result).toBeDefined();
		expect(tagsToText(result!)).toBe('');
	});

	it('should find first js doc comment of double nested template', () => {
		const cursorPos = code.indexOf(`logNColor('Color-1-red')`);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);
		expect(result).toBeDefined();
		expect(tagsToText(result!)).toContain('color\n> Primary color\n');
	});

	it('should find fourth js doc comment of double nested template', () => {
		const cursorPos = code.indexOf(`logNColor('Color-1-A1')`);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);
		expect(result).toBeDefined();
		expect(tagsToText(result!)).toContain(
			'color\n> A number\n> \n> \n> _@range_ 1-4'
		);
	});

	it('should find second js doc comment of double nested union type with regex symbols inside string', () => {
		const cursorPos = code.indexOf(
			`logNColor('Color-1-green/[.*+?^\${}()|[]-]/g')`
		);
		const result = proxy.getQuickInfoAtPosition(absolutePath, cursorPos);
		expect(result).toBeDefined();
		expect(tagsToText(result!)).toContain(
			'color\n> Secondary color with some regex symbols\n> \n> \n> _@color_ green'
		);
	});
});
