import * as ts from 'typescript/lib/tsserverlibrary';
import { vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { UnionTypeDocsPlugin } from '../src/plugin';

export function createProxyFromCase(relativeFilePath: string) {
	const absolutePath = path.resolve(process.cwd(), relativeFilePath);

	if (!fs.existsSync(absolutePath)) {
		throw new Error(`Test case file not found: ${absolutePath}`);
	}
	const code = fs.readFileSync(absolutePath, 'utf8');

	const compilerOptions: ts.CompilerOptions = {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.CommonJS,
	};

	const host: ts.LanguageServiceHost = {
		getScriptFileNames: () => [absolutePath],
		getScriptVersion: () => '1',
		getScriptSnapshot: (name) => {
			if (name === absolutePath) return ts.ScriptSnapshot.fromString(code);
			if (fs.existsSync(name))
				return ts.ScriptSnapshot.fromString(fs.readFileSync(name, 'utf8'));
			return undefined;
		},
		getCurrentDirectory: () => process.cwd(),
		getCompilationSettings: () => compilerOptions,
		getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
		fileExists: (p) => fs.existsSync(p),
		readFile: (p) => fs.readFileSync(p, 'utf8'),
	};

	const languageService = ts.createLanguageService(host);

	const mockInfo: Partial<ts.server.PluginCreateInfo> = {
		languageService,
		project: {
			projectService: {
				logger: {
					info: vi.fn(),
					msg: vi.fn(),
					error: vi.fn(),
				},
			},
		} as any,
	};

	const plugin = new UnionTypeDocsPlugin(ts as any);
	const proxy = plugin.create(mockInfo as ts.server.PluginCreateInfo);

	return { proxy, absolutePath, code };
}
