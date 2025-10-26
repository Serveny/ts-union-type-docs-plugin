import type * as TS from 'typescript/lib/tsserverlibrary';

// This class holds every type information the plugin needs
export class TypeInfo {
	constructor(
		public node: TS.Node,
		public symbol: TS.Symbol,
		public checker: TS.TypeChecker,
		public unionParams: TS.UnionTypeNode[]
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
): TS.CallExpression | undefined {
	if (ts.isCallExpression(node)) return node;
	while (node && !ts.isCallExpression(node)) node = node.parent;
	return node;
}

function findNodeAtPosition(
	ts: typeof TS,
	sourceFile: TS.SourceFile,
	position: number
): TS.Node | undefined {
	function find(node: TS.Node): TS.Node | undefined {
		if (position >= node.getStart() && position < node.getEnd()) {
			return ts.forEachChild(node, find) || node;
		}
		return undefined;
	}
	return find(sourceFile);
}

function getUnionParamters(
	ts: typeof TS,
	node: TS.CallExpression,
	checker: TS.TypeChecker
): TS.UnionTypeNode[] {
	const paramTypes: TS.UnionTypeNode[] = [];
	const signature = checker.getResolvedSignature(node);
	if (!signature) return paramTypes;

	const params = signature.getParameters();
	for (const param of params) {
		const paramNode = getUnionParamNode(ts, checker, param);
		if (paramNode) paramTypes.push(paramNode);
	}

	return paramTypes;
}

function getUnionParamNode(
	ts: typeof TS,
	checker: TS.TypeChecker,
	param: TS.Symbol
): TS.UnionTypeNode | undefined {
	const decl = param.valueDeclaration;
	if (!decl || !ts.isParameter(decl) || !decl.type) return;

	const typeNode = decl.type;
	if (ts.isUnionTypeNode(typeNode)) return typeNode;

	if (ts.isTypeReferenceNode(typeNode)) {
		let symbol = checker.getSymbolAtLocation(typeNode.typeName);
		if (!symbol) return;
		if (symbol.flags & ts.SymbolFlags.Alias)
			symbol = checker.getAliasedSymbol(symbol);

		const decl = symbol.declarations?.[0];
		if (!decl || !ts.isTypeAliasDeclaration(decl)) return;
		if (ts.isUnionTypeNode(decl.type)) return decl.type;
	}
}
