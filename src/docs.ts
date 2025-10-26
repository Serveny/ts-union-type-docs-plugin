import type * as TS from 'typescript/lib/tsserverlibrary';

export function extractJsDocs(
	ts: typeof TS,
	typeNode: TS.TypeNode,
	checker: TS.TypeChecker
): string[] {
	let unionTypeNode: TS.UnionTypeNode | undefined = undefined;

	// is inline union (i.e. param: string | number)
	if (ts.isUnionTypeNode(typeNode)) {
		unionTypeNode = typeNode;
	}

	// is type alias (i.e. type X = string | number)
	else if (typeNode.kind === ts.SyntaxKind.TypeReference) {
		const symbol = checker.getSymbolAtLocation(typeNode);
		if (
			symbol &&
			symbol.valueDeclaration &&
			ts.isTypeAliasDeclaration(symbol.valueDeclaration)
		) {
			const aliasDecl = symbol.valueDeclaration;
			if (ts.isUnionTypeNode(aliasDecl.type)) {
				unionTypeNode = aliasDecl.type;
			}
		}
	}

	if (unionTypeNode) {
		const sourceFile = unionTypeNode.getSourceFile();
		return extractJSDocsFromUnionNode(ts, unionTypeNode, sourceFile);
	}

	return [];
}

export function addExtraDocs(quickInfo: TS.QuickInfo, extraDocs: string[]) {
	if (!quickInfo.documentation) quickInfo.documentation = [];
	quickInfo.documentation.push(
		...extraDocs.map((c) => ({ text: c, kind: 'text' } as TS.SymbolDisplayPart))
	);
}

function extractJSDocsFromUnionNode(
	ts: typeof TS,
	unionNode: TS.UnionTypeNode,
	sourceFile: TS.SourceFile
): string[] {
	const lines = [];
	const sourceText = sourceFile.getFullText();

	for (const memberNode of unionNode.types) {
		const start = memberNode.getStart();
		const test = sourceText.slice(start, memberNode.end);
		const comment = getLeadingComment(ts, sourceText, start);
		if (comment)
			lines.push(
				...cleanJSDocText(sourceText.substring(comment.pos, comment.end))
			);
	}
	return lines;
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
