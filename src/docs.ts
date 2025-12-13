import type * as TS from 'typescript/lib/tsserverlibrary';
import { TypeInfo, UnionParameterInfo } from './info';

type TagIdx = {
	tag: TS.JSDocTagInfo;
	idx: number;
};

export function addExtraJSDocTagInfo(
	ts: typeof TS,
	quickInfo: TS.QuickInfo,
	typeInfo: TypeInfo
) {
	if (typeInfo.unionParams.length === 0) return;
	typeInfo.unionParams.forEach((p) => addDocComment(ts, p));

	if (!quickInfo.tags) quickInfo.tags = [];

	const tagIdxs: TagIdx[] =
		quickInfo.tags
			?.map((tag, idx) => ({ tag, idx }))
			.filter((ti) => ti.tag.name === 'param') ?? [];

	const newTags = [
		...(tagIdxs.length > 0
			? quickInfo.tags.filter((t, i) => i < tagIdxs[0].idx)
			: quickInfo.tags),
	];

	for (const paramInfo of typeInfo.unionParams) {
		const jsDocTag = findJsDocParamTagByName(tagIdxs, paramInfo.name);
		const newTag = addParamTagInfo(
			jsDocTag?.tag ?? defaultParamJSDocTag(paramInfo.name),
			paramInfo
		);
		newTags.push(newTag);
	}

	const lastParamTagIdx =
		tagIdxs.length === 0 ? 0 : tagIdxs[tagIdxs.length - 1]?.idx ?? 0;
	if (quickInfo.tags.length - 1 > lastParamTagIdx)
		newTags.push(...quickInfo.tags.filter((t, i) => i > lastParamTagIdx));

	quickInfo.tags = newTags;
}

function findJsDocParamTagByName(tags: TagIdx[], name: string): TagIdx | null {
	const foundTag = tags.find(({ tag }) =>
		tag.text?.some(
			(textPart) =>
				textPart.kind === 'parameterName' &&
				textPart.text.toLowerCase() === name.toLowerCase()
		)
	);
	return foundTag ?? null;
}

function defaultParamJSDocTag(name: string): TS.JSDocTagInfo {
	return {
		name: 'param',
		text: [
			{
				kind: 'parameterName',
				text: name,
			},
		],
	} as TS.JSDocTagInfo;
}

function createMarkdownDisplayPart(mdText: string): TS.SymbolDisplayPart {
	return {
		text: mdText,
		kind: 'markdown',
	} as TS.SymbolDisplayPart;
}

function addParamTagInfo(
	oldTag: TS.JSDocTagInfo,
	typeInfo: UnionParameterInfo | undefined
): TS.JSDocTagInfo {
	const newTag: TS.JSDocTagInfo = JSON.parse(JSON.stringify(oldTag));
	if (!typeInfo?.docComment) return newTag;
	if (!newTag.text) newTag.text = [];
	newTag.text!.push(
		createMarkdownDisplayPart(
			typeInfo.docComment
				?.map((line, i) => (i > 0 ? (line = '> ' + line) : line))
				.join('\n')
		)
	);
	return newTag;
}

function addDocComment(ts: typeof TS, param: UnionParameterInfo) {
	const visited = new Set();
	const comments: string[][] = [];

	// Read out all comments
	for (const entryNode of param.entries) {
		if (visited.has((entryNode as any).id)) continue;
		visited.add((entryNode as any).id);
		comments.push(extractJSDocsFromNode(ts, entryNode));

		let parent = entryNode.callParent;
		while (parent != null) {
			if (!visited.has((parent as any).id)) {
				comments.push(extractJSDocsFromNode(ts, parent));
				visited.add((parent as any).id);
			}
			parent = parent.callParent;
		}
	}

	// Add the comments in order parent -> ... -> child
	const lines = comments.reverse().flat();
	if (!param.docComment) param.docComment = lines;
	else param.docComment.push(...lines);
}

function extractJSDocsFromNode(ts: typeof TS, node: TS.Node): string[] {
	// If the node was resolved, get the original node
	node = (node as any).original ?? node;
	const sourceFile = node.getSourceFile();
	if (!sourceFile) return [];
	const sourceText = sourceFile.getFullText();
	const start = node.getStart();
	const comment = getLeadingComment(ts, sourceText, start);

	return comment
		? prepareJSDocText(sourceText.substring(comment.pos, comment.end))
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

	// only spaces, tabs or linebreaks allowed between comment and node
	const textBetween = text.substring(commentEnd + 2, pos);
	if (/[^ \t|\n]/.test(textBetween)) return;

	return {
		pos: commentStart + 3,
		end: commentEnd,
		kind: ts.SyntaxKind.MultiLineCommentTrivia,
	};
}

function prepareJSDocText(rawComment: string): string[] {
	return (
		rawComment
			.replace('/**', '')
			.replace('*/', '')
			.split('\n')
			// remove whitespace and the leading * in every line
			.map((line) => line.trim().replace(/^\* ?/, ''))
			// make @tags cursive again
			.map((line) => line.replace(/@(\w+)/g, (_, tag) => `\n> _@${tag}_`))
	);
}
