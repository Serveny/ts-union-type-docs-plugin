import type * as TS from 'typescript/lib/tsserverlibrary';
import { addExtraDocs } from './docs';
import { TypeInfoFactory } from './info';

export class UnionTypeDocsPlugin {
	private logger!: TS.server.Logger;
	private ls!: TS.LanguageService;
	private proxy!: TS.LanguageService;
	private typeInfoFactory!: TypeInfoFactory;

	constructor(private readonly ts: typeof TS) {}

	create(info: TS.server.PluginCreateInfo) {
		this.logger = info.project.projectService.logger;
		this.ls = info.languageService;
		this.typeInfoFactory = new TypeInfoFactory(this.ts, this.ls)!;
		this.proxy = createLsProxy(this.ls);
		this.proxy.getQuickInfoAtPosition = this.getQuickInfoAtPosition.bind(this);
		this.proxy.getCompletionsAtPosition =
			this.getCompletionsAtPosition.bind(this);
		this.logger.info('[Union type docs plugin] Loaded');
		return this.proxy;
	}

	private getQuickInfoAtPosition(fileName: string, pos: number) {
		const quickInfo = this.ls.getQuickInfoAtPosition(fileName, pos);
		if (!quickInfo) return quickInfo;

		const typeInfo = this.typeInfoFactory.create(fileName, pos);
		if (!typeInfo) return quickInfo;

		addExtraDocs(this.ts, quickInfo, typeInfo);

		return quickInfo;
	}

	private getCompletionsAtPosition(
		fileName: string,
		pos: number,
		opts: TS.GetCompletionsAtPositionOptions | undefined,
		fmt?: TS.FormatCodeSettings
	): TS.WithMetadata<TS.CompletionInfo> | undefined {
		const cmpl = this.ls.getCompletionsAtPosition(fileName, pos, opts, fmt);

		return cmpl;
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
