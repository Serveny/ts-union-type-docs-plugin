import type * as TS from 'typescript/lib/tsserverlibrary';
import { UnionParameterInfo } from './info';

export function extractJsDocs(
	ts: typeof TS,
	param: UnionParameterInfo
): string[] {
	const lines: string[] = [];

	for (const node of param.entries) {
		// TODO: Cache source files?
		const sourceFile = node.getSourceFile();
		lines.push(...extractJSDocsFromNode(ts, node, param.value, sourceFile));
	}

	return lines;
}

export class ParamDocs {
	constructor(
		public i: number,
		public name: string,
		public docComment: string[]
	) {}
	toMarkdown(): string {
		const docs = this.docComment.join('\n');
		return `\n#### ${numberEmoji(this.i + 1)} ${this.name} ${docs}`;
	}
}

export function addExtraDocs(quickInfo: TS.QuickInfo, paramDocs: ParamDocs[]) {
	const paramBlocks = paramDocs.map((pd) => pd.toMarkdown());
	const mdText = `\n
---
### 🌟 Parameter-Details
${paramBlocks.join('\n')}
`;
	quickInfo.documentation = [
		...(quickInfo.documentation ?? []),
		{ text: mdText, kind: 'text' } as TS.SymbolDisplayPart,
	];
}

function extractJSDocsFromNode(
	ts: typeof TS,
	node: TS.LiteralTypeNode,
	value: unknown,
	sourceFile: TS.SourceFile
): string[] {
	const sourceText = sourceFile.getFullText();
	const start = node.getStart();
	const comment = getLeadingComment(ts, sourceText, start);

	return comment
		? cleanJSDocText(sourceText.substring(comment.pos, comment.end))
		: [];
}

function getLeadingComment(
	ts: typeof TS,
	text: string,
	pos: number
): TS.CommentRange | undefined {
	const comments = ts.getLeadingCommentRanges(text, pos) ?? [];
	// jsdoc comment (has to start with /**)
	if (comments.length > 0 && text[comments[0].pos + 2] === '*')
		return comments[comments.length - 1];
	text = text.substring(0, pos);
	const commentStart = text.lastIndexOf('/**');
	if (commentStart === -1) return;
	const commentEnd = text.lastIndexOf('*/');
	if (commentEnd === -1) return;
	const textBetween = text.substring(commentEnd + 2, pos);
	if (/[^ \t|\n]/.test(textBetween)) return;
	return {
		pos: commentStart + 3,
		end: commentEnd,
		kind: ts.SyntaxKind.MultiLineCommentTrivia,
	};
}

function cleanJSDocText(rawComment: string): string[] {
	return (
		rawComment
			.replace('/**', '')
			.replace('*/', '')
			.split('\n')
			// remove whitespace and the leading * in every line
			.map((line) => line.trim().replace(/^\* ?/, ''))
	);
}

const numEmjs = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function numberEmoji(num: number) {
	if (num === 10) return '🔟';
	return [...String(num)].map((char) => numEmjs[parseInt(char, 10)]);
}
