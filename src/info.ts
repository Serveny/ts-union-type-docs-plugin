import type * as TS from 'typescript/lib/tsserverlibrary';

export enum SupportedType {
	Paramter,
}

// This class holds every type information the plugin needs
export class UnionInfo {
	constructor(
		public type: SupportedType,
		public name: string,
		// Can be multiple nodes because different union types can have same values
		public entries: CalledNode[],
		public value?: string,
		public docComment?: string[]
	) {}
}

export interface CalledNode extends TS.Node {
	id?: number;
	callParent?: CalledNode; // The node that references to it
	original?: TS.Node; // For resolved nodes
	isRegexPattern?: boolean; // For template syntax like ${number}
	codeText?: string;
}

export class TypeInfoFactory {
	private checker!: TS.TypeChecker;
	private id = -1; // ID counter for generating synthetic nodes

	constructor(private ts: typeof TS, private ls: TS.LanguageService) {}

	create(fileName: string, position: number): UnionInfo[] | null {
		const program = this.ls.getProgram();
		if (!program) return null;

		this.checker = program.getTypeChecker();
		if (!this.checker) return null;

		const source = program.getSourceFile(fileName);
		if (!source) return null;

		const node = this.findNodeAtPos(source, position);
		if (!node) return null;

		const symbol = this.checker.getSymbolAtLocation(node);
		if (!symbol) return null;

		// Find union type parameter info for function call
		const callExpression = this.getCallExpression(node);
		if (callExpression) return this.getUnionParamtersInfo(callExpression);

		// TODO: Find union type info for variable
		return null;
	}

	private findNodeAtPos(srcFile: TS.SourceFile, pos: number): TS.Node | null {
		const find = (node: TS.Node): TS.Node | null =>
			pos >= node.getStart() && pos < node.getEnd()
				? this.ts.forEachChild(node, find) || node
				: null;
		return find(srcFile);
	}

	private getCallExpression(node: TS.Node): TS.CallExpression | null {
		if (this.ts.isCallExpression(node)) return node;
		while (node && !this.ts.isCallExpression(node)) node = node.parent;
		return node;
	}

	private getUnionParamtersInfo(callExpr: TS.CallExpression): UnionInfo[] {
		const paramTypes: UnionInfo[] = [];
		const signature = this.checker.getResolvedSignature(callExpr);
		if (!signature) return paramTypes;

		const args = callExpr.arguments;
		const params = signature.getParameters();
		for (let i = 0; i < params.length; i++) {
			const paramInfo = this.getUnionInfo(params[i], args[i]);
			if (paramInfo) paramTypes.push(paramInfo);
		}

		return paramTypes;
	}

	private getUnionInfo(
		paramSymbol: TS.Symbol,
		arg: TS.Expression
	): UnionInfo | null {
		const decl = paramSymbol.valueDeclaration;
		if (!decl || !this.ts.isParameter(decl) || !decl.type) return null;

		const unionMemberNodes = this.collectUnionMemberNodes(decl.type);
		if (unionMemberNodes.length === 0) return null;

		const value = this.getValue(arg);
		const valueNodes = unionMemberNodes.filter((entry) => this.cmp(arg, entry));

		return new UnionInfo(
			SupportedType.Paramter,
			paramSymbol.name,
			valueNodes,
			value
		);
	}

	private getValue(expr: TS.Expression): string {
		return this.ts.isLiteralExpression(expr) ? expr.text : expr.getText();
	}

	private collectUnionMemberNodes(
		node: TS.Node,
		callParent?: TS.Node
	): CalledNode[] {
		const ts = this.ts;
		(node as any).codeText = getNodeText(node);

		if (
			ts.isUnionTypeNode(node) || // e.g. string | number
			ts.isIntersectionTypeNode(node) || // e.g. Class1 & Class2
			ts.isHeritageClause(node) // e.g. Class1 extends BaseClass implements Interface1
		) {
			return node.types.flatMap((tn) =>
				this.collectUnionMemberNodes(tn, callParent)
			);
		}

		// e.g. T extends U ? string : number
		if (ts.isConditionalTypeNode(node))
			return this.collectConditionalTypeNode(node);

		// e.g. Object1["propName"]
		if (ts.isIndexedAccessTypeNode(node))
			return this.collectIndexedAccessTypeNode(node);

		// e.g. { prop1: string; prop2: number }
		if (ts.isTypeLiteralNode(node)) return this.collectTypeLiteralNode(node);

		// e.g. { [K in keyof T]: T[K] }
		if (ts.isMappedTypeNode(node)) return this.collectMappedTypeNode(node);

		// e.g. Promise<string>
		if (ts.isTypeReferenceNode(node))
			return this.collectTypeReferenceNode(node);

		// e.g. keyof Class1
		if (
			ts.isTypeOperatorNode(node) &&
			node.operator === ts.SyntaxKind.KeyOfKeyword
		)
			return this.collectKeyOfKeywordTypeOperatorNode(node, callParent);

		// e.g. (string | number)[]
		if (ts.isParenthesizedTypeNode(node))
			return this.collectUnionMemberNodes(node.type, node);

		// e.g. string[]
		if (ts.isArrayTypeNode(node))
			return this.collectUnionMemberNodes(node.elementType, node);

		// e.g. [string, number, boolean]
		if (ts.isTupleTypeNode(node)) return this.collectTupleTypeNode(node);

		// e.g. typeof var1
		if (ts.isTypeQueryNode(node)) return this.collectTypeQueryNode(node);

		// e.g. `text-${number}`
		if (ts.isTemplateLiteralTypeNode(node))
			return this.buildTemplateLiteralNode(node);

		// This is the end of the journey
		if (
			ts.isLiteralTypeNode(node) || // e.g. "text", 42, true
			ts.isTypeNode(node) // e.g. string, number, boolean
		) {
			return [calledNode(node, callParent)];
		}

		console.warn('Unknown node type: ', node);
		return [];
	}

	private collectConditionalTypeNode(
		node: TS.ConditionalTypeNode
	): CalledNode[] {
		return [
			...this.collectUnionMemberNodes(node.checkType, node),
			...this.collectUnionMemberNodes(node.extendsType, node),
			...this.collectUnionMemberNodes(node.trueType, node),
			...this.collectUnionMemberNodes(node.falseType, node),
		];
	}

	private collectIndexedAccessTypeNode(
		node: TS.IndexedAccessTypeNode
	): CalledNode[] {
		return [
			...this.collectUnionMemberNodes(node.objectType, node),
			...this.collectUnionMemberNodes(node.indexType, node),
		];
	}

	private collectTypeLiteralNode(node: TS.TypeLiteralNode): CalledNode[] {
		return node.members.flatMap((m) =>
			(m as any).type ? this.collectUnionMemberNodes((m as any).type, node) : []
		);
	}

	private collectMappedTypeNode(node: TS.MappedTypeNode): CalledNode[] {
		const results: TS.Node[] = [];
		if (node.typeParameter.constraint)
			results.push(
				...this.collectUnionMemberNodes(node.typeParameter.constraint, node)
			);
		if (node.type)
			results.push(...this.collectUnionMemberNodes(node.type, node));
		return results;
	}

	private collectTypeReferenceNode(node: TS.TypeReferenceNode): CalledNode[] {
		const checker = this.checker,
			ts = this.ts,
			symbol = checker.getSymbolAtLocation(node.typeName);
		if (!symbol) return [];

		const aliasedSymbol =
			symbol.flags & ts.SymbolFlags.Alias
				? checker.getAliasedSymbol(symbol)
				: symbol;

		const decl = aliasedSymbol.declarations?.[0];
		if (!decl) return [];
		const tn = ts.isTypeParameterDeclaration(decl)
			? decl.constraint ?? null
			: ts.isTypeAliasDeclaration(decl)
			? decl.type
			: null;
		if (!tn) return [];
		return this.collectUnionMemberNodes(tn, node);
	}

	private collectKeyOfKeywordTypeOperatorNode(
		node: TS.TypeOperatorNode,
		callParent?: TS.Node
	): CalledNode[] {
		const ts = this.ts,
			checker = this.checker,
			type = checker.getTypeAtLocation(node.type);
		return type.getProperties().map((p) => {
			const decl = p.getDeclarations()?.[0];
			const litNode = ts.factory.createLiteralTypeNode(
				ts.factory.createStringLiteral(p.getName())
			);
			return calledNode(litNode, callParent, decl);
		});
	}

	private collectTupleTypeNode(node: TS.TupleTypeNode): CalledNode[] {
		return node.elements.flatMap((el) =>
			this.collectUnionMemberNodes(el, node)
		);
	}

	private collectTypeQueryNode(node: TS.TypeQueryNode): CalledNode[] {
		const symbol = this.checker.getSymbolAtLocation(node.exprName);
		if (symbol) {
			const decls = symbol.getDeclarations() ?? [];
			return decls.flatMap((d) =>
				this.collectUnionMemberNodes(d as TS.Node, node)
			);
		}
		return [];
	}

	private createLiteralNode<T extends TS.Node>(
		node: T,
		text: string,
		callParent?: TS.Node,
		isRegexPattern?: boolean
	): CalledNode & TS.LiteralLikeNode {
		const litNode = this.ts.factory.createStringLiteral(text);
		(litNode as any).id = this.id--;
		return calledNode(
			litNode,
			callParent,
			(node as any).original ?? node,
			isRegexPattern
		);
	}

	// Creates new literal nodes with every possible content
	private buildTemplateLiteralNode(
		node: TS.TemplateLiteralTypeNode
	): CalledNode[] {
		const headText = escapeRegExp(node.head.text),
			ts = this.ts;
		const nodes: (CalledNode & TS.LiteralLikeNode)[][] = [];

		for (const span of node.templateSpans) {
			const spanNodes: (CalledNode & TS.LiteralLikeNode)[] = [];
			const innerTypeNodes = this.collectUnionMemberNodes(span.type, node);

			for (const tn of innerTypeNodes) {
				if (tn.isRegexPattern != null)
					spanNodes.push(tn as CalledNode & TS.LiteralLikeNode);
				// Literal: "foo" -> "foo"
				else if (
					ts.isLiteralTypeNode(tn) &&
					(this.ts.isStringLiteral(tn.literal) ||
						this.ts.isNumericLiteral(tn.literal))
				)
					spanNodes.push(
						this.createLiteralNode(
							tn,
							tn.literal.text + span.literal.text,
							node,
							false
						)
					);
				// number
				else if (tn.kind === ts.SyntaxKind.NumberKeyword)
					spanNodes.push(
						this.createLiteralNode(
							tn,
							'\\d+(\\.\\d+)?' + span.literal.text,
							node,
							true
						)
					);
				// boolean
				else if (tn.kind === ts.SyntaxKind.BooleanKeyword)
					spanNodes.push(
						this.createLiteralNode(
							tn,
							'(true|false)' + span.literal.text,
							node,
							true
						)
					);
				// string (caution: greedy)
				else if (tn.kind === ts.SyntaxKind.StringKeyword)
					spanNodes.push(
						this.createLiteralNode(tn, '.*' + span.literal.text, node, true)
					);
				// Fallback for unknown types
				else console.warn('Unknown type of template: ', tn);
			}

			nodes.push(spanNodes);
		}

		const catProd = cartesianProduct(nodes).flatMap((compNodes) => {
			const isRegex = compNodes.some((n) => n.isRegexPattern === true);
			const fullText = headText + compNodes.map((n) => n.text).join('');
			return compNodes.map((cn) =>
				this.createLiteralNode(cn, fullText, cn.callParent, isRegex)
			);
		});

		return catProd;
	}

	private cmp(expr: TS.Expression, node: CalledNode): boolean {
		// check for generated regex pattern
		if (isRegexPattern(node) && this.ts.isStringLiteral(expr)) {
			// Surround with ^...$, so the whole string must match
			const pattern = new RegExp(`^${node.text}$`);
			return pattern.test(expr.text);
		}
		if (node.isRegexPattern === false) return this.cmpLit(expr, node as any);
		if (!this.ts.isLiteralTypeNode(node)) return false;
		return this.cmpLit(expr, node.literal);
	}

	private cmpLit(
		expr: TS.Expression,
		typeLiteral:
			| TS.LiteralExpression
			| TS.NullLiteral
			| TS.BooleanLiteral
			| TS.PrefixUnaryExpression
	) {
		const ts = this.ts;
		// string literals (i.e. "hello" and type T = "hello")
		if (ts.isStringLiteral(expr) && ts.isStringLiteral(typeLiteral))
			return expr.text === typeLiteral.text;

		// numeric literals (i.e. 42 and type T = 42)
		if (ts.isNumericLiteral(expr) && ts.isNumericLiteral(typeLiteral))
			return expr.text === typeLiteral.text;

		// BigInt literals (i.e. 100n and type T = 100n)
		if (ts.isBigIntLiteral(expr) && ts.isBigIntLiteral(typeLiteral))
			return expr.text === typeLiteral.text;

		// booleans (compare kind of nodes)
		if (
			(expr.kind === ts.SyntaxKind.TrueKeyword &&
				typeLiteral.kind === ts.SyntaxKind.TrueKeyword) ||
			(expr.kind === ts.SyntaxKind.FalseKeyword &&
				typeLiteral.kind === ts.SyntaxKind.FalseKeyword)
		)
			return true;

		// TODO: objects

		// null
		if (
			expr.kind === ts.SyntaxKind.NullKeyword &&
			typeLiteral.kind === ts.SyntaxKind.NullKeyword
		)
			return true;

		// undefined
		if (
			expr.kind === ts.SyntaxKind.UndefinedKeyword &&
			typeLiteral.kind === ts.SyntaxKind.UndefinedKeyword
		)
			return true;

		return false;
	}
}

function calledNode<T extends TS.Node>(
	node: T,
	callParent?: TS.Node,
	original?: TS.Node,
	isRegexPattern?: boolean
): CalledNode & T {
	const cNode = node as CalledNode;
	cNode.callParent = callParent as any;
	cNode.original = original;
	cNode.isRegexPattern = isRegexPattern;
	return cNode as any;
}

function getNodeText(node: TS.Node) {
	const text = node.getSourceFile().text;
	return text.substring(node.getStart(), node.getEnd());
}

function isRegexPattern(
	node: CalledNode
): node is TS.StringLiteral & CalledNode {
	return node.isRegexPattern === true;
}

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
	return arrays.reduce(
		(acc, curr) => acc.flatMap((d) => curr.map((e) => [...d, e])),
		[[]] as T[][]
	);
}
