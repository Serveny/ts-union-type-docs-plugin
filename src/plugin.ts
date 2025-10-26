import type * as TS from 'typescript/lib/tsserverlibrary';
import { addExtraDocs, extractJsDocs } from './docs';
import { TypeInfo } from './info';

export class UnionTypeDocsPlugin {
	private logger!: TS.server.Logger;
	private ls!: TS.LanguageService;
	private proxy!: TS.LanguageService;

	constructor(private readonly ts: typeof TS) {}

	create(info: TS.server.PluginCreateInfo) {
		this.logger = info.project.projectService.logger;
		this.ls = info.languageService;
		this.proxy = createLsProxy(this.ls);
		this.proxy.getQuickInfoAtPosition = this.getQuickInfoAtPosition.bind(this);
		this.logger.info('[Union type docs plugin] Loaded');
		return this.proxy;
	}

	private getQuickInfoAtPosition(fileName: string, pos: number) {
		console.log('GETQUICKINFO:', fileName, pos);
		const quickInfo = this.ls.getQuickInfoAtPosition(fileName, pos);
		if (!quickInfo) return quickInfo;

		const info = TypeInfo.from(this.ts, this.ls, fileName, pos);
		if (!info) return quickInfo;

		const extraDocs: string[] = [];
		for (const param of info.unionParams)
			extraDocs.push(...extractJsDocs(this.ts, param, info.checker));
		if (extraDocs.length > 0) addExtraDocs(quickInfo, extraDocs);

		return quickInfo;
	}
}

// Create new object with all functions of the old language service
function createLsProxy(oldLs: TS.LanguageService): TS.LanguageService {
	const proxy = Object.create(null) as TS.LanguageService;
	for (const k of Object.keys(oldLs) as Array<keyof TS.LanguageService>) {
		const x = oldLs[k];
		(proxy as any)[k] = typeof x === 'function' ? x.bind(oldLs) : x;
	}
	return proxy;
}
