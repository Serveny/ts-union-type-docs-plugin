import type * as TS from 'typescript/lib/tsserverlibrary';

// This class holds every type information the plugin needs
export class TypeInfo {
	constructor(
		public node: TS.Node,
		public symbol: TS.Symbol,
		public checker: TS.TypeChecker,
		public unionParams: UnionParameterInfo[]
	) {}

	static from(
		ts: typeof TS,
		ls: TS.LanguageService,
		fileName: string,
		position: number
	): TypeInfo | undefined {
		const program = ls.getProgram();
		if (!program) return;

		const source = program.getSourceFile(fileName);
		if (!source) return;

		const node = findNodeAtPosition(ts, source, position);
		if (!node) return;

		const checker = program.getTypeChecker();
		const symbol = checker.getSymbolAtLocation(node);
		if (!symbol) return;

		const callExpression = getCallExpression(ts, node);
		const unionParams = callExpression
			? getUnionParamters(ts, callExpression, checker)
			: [];
		//let unionType = ts.isUnionTypeNode(node) ? node : undefined;
		//let paramDecl: TS.ParameterDeclaration | undefined = undefined;

		//if (!unionType) {
		//const valDecl = symbol.valueDeclaration;
		//paramDecl = ts.isParameter(node.parent)
		//? node.parent
		//: valDecl != null && ts.isParameter(valDecl)
		//? valDecl
		//: undefined;

		//const type = checker.getTypeOfSymbolAtLocation(symbol, node);
		//unionType = type.isUnion()
		//? (checker.typeToTypeNode(
		//type,
		//valDecl,
		//ts.NodeBuilderFlags.None
		//) as TS.UnionTypeNode)
		//: undefined;
		//}

		return new TypeInfo(node, symbol, checker, unionParams);
	}
}

function getCallExpression(
	ts: typeof TS,
	node: TS.Node
): TS.CallExpression | null {
	if (ts.isCallExpression(node)) return node;
	while (node && !ts.isCallExpression(node)) node = node.parent;
	return node;
}

function findNodeAtPosition(
	ts: typeof TS,
	sourceFile: TS.SourceFile,
	position: number
): TS.Node | null {
	function find(node: TS.Node): TS.Node | null {
		if (position >= node.getStart() && position < node.getEnd()) {
			return ts.forEachChild(node, find) || node;
		}
		return null;
	}
	return find(sourceFile);
}

export class UnionParameterInfo {
	constructor(
		public i: number,
		public name: string,
		// Can be multiple nodes because different union types can have same values
		public entries: TS.LiteralTypeNode[],
		public value?: string
	) {}
}

function getUnionParamters(
	ts: typeof TS,
	node: TS.CallExpression,
	checker: TS.TypeChecker
): UnionParameterInfo[] {
	const paramTypes: UnionParameterInfo[] = [];
	const signature = checker.getResolvedSignature(node);
	if (!signature) return paramTypes;

	const args = node.arguments;
	const params = signature.getParameters();
	for (let i = 0; i < params.length; i++) {
		const paramNodes = getUnionParamNodes(ts, checker, params[i]);
		if (paramNodes.length === 0) continue;

		const arg = args[i];
		const value = ts.isStringLiteral(arg) ? arg.text : undefined;

		const valueNodes: TS.LiteralTypeNode[] = [];
		for (const unionNode of paramNodes) {
			const entries = unionNode.types.filter((entry) =>
				isNodeEqualValue(ts, entry, value)
			);
			valueNodes.push(...entries);
		}

		paramTypes.push(
			new UnionParameterInfo(i, params[i].name, valueNodes, value)
		);
	}

	return paramTypes;
}

function getUnionParamNodes(
	ts: typeof TS,
	checker: TS.TypeChecker,
	param: TS.Symbol
): TS.UnionTypeNode[] {
	const decl = param.valueDeclaration;
	if (!decl || !ts.isParameter(decl) || !decl.type) return [];
	let srcType = decl.type;
	const kind = ts.SyntaxKind[srcType.kind];
	if (ts.isTypeOperatorNode(srcType)) {
		const type = checker.getTypeAtLocation(srcType);
		if (type.isUnion()) checker.typeToTypeNode(type, decl, undefined);
	} else if (ts.isUnionTypeNode(srcType)) return [srcType];

	if (ts.isTypeReferenceNode(srcType))
		return findUnionTypes(ts, checker, srcType);

	return [];
}

function findUnionTypes(
	ts: typeof TS,
	checker: TS.TypeChecker,
	typeRefNode: TS.TypeReferenceNode
): TS.UnionTypeNode[] {
	let symbol = checker.getSymbolAtLocation(typeRefNode.typeName);
	if (!symbol) return [];
	if (symbol.flags & ts.SymbolFlags.Alias)
		symbol = checker.getAliasedSymbol(symbol);

	const decl = symbol.declarations?.[0];
	if (!decl) return [];
	const kind = ts.SyntaxKind[decl?.kind ?? 0];
	let type = ts.isTypeParameterDeclaration(decl)
		? decl.constraint ?? null
		: ts.isTypeAliasDeclaration(decl)
		? decl.type
		: null;
	if (!type) return [];
	if (ts.isTypeReferenceNode(type)) return findUnionTypes(ts, checker, type);
	if (ts.isUnionTypeNode(type)) return walkUnionEntries(ts, type, checker);
	if (ts.isTypeOperatorNode(type)) {
		const resolvedType = checker.getTypeAtLocation(type);
		if (resolvedType.isUnion()) {
			const resolvedNode = checker.typeToTypeNode(
				resolvedType,
				decl,
				undefined
			);
			return resolvedNode ? [resolvedNode as TS.UnionTypeNode] : [];
		}
		return [];
	}
	return [];
}

function walkUnionEntries(
	ts: typeof TS,
	typeNode: TS.UnionTypeNode,
	checker: TS.TypeChecker
): TS.UnionTypeNode[] {
	const children = typeNode.types
		.map((t) =>
			ts.isTypeReferenceNode(t) ? findUnionTypes(ts, checker, t) : []
		)
		.flat();
	return [typeNode, ...children];
}

export function isNodeEqualValue(
	ts: typeof TS,
	typeNode: TS.TypeNode,
	value: unknown
): typeNode is TS.LiteralTypeNode {
	if (ts.isLiteralTypeNode(typeNode)) {
		const lit = typeNode.literal;
		if (ts.isStringLiteral(lit)) return lit.text === value;
		else if (ts.isNumericLiteral(lit)) return parseFloat(lit.text) === value;
	}

	return false;
}
