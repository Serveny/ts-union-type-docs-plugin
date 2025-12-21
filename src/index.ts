import type * as TS from 'typescript/lib/tsserverlibrary';
import { UnionTypeDocsPlugin } from './plugin';

export = (mod: { typescript: typeof TS }) =>
	new UnionTypeDocsPlugin(mod.typescript);
