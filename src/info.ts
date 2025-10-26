import type * as TS from 'typescript/lib/tsserverlibrary';

export class TypeInfo {
  constructor(
    public node: TS.Node,
    public symbol: TS.Symbol,
    public paramDeclaration?: TS.ParameterDeclaration,
    public unionTypeNode?: TS.UnionTypeNode
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

    let unionType = ts.isUnionTypeNode(node) ? node : undefined;
    let paramDecl: TS.ParameterDeclaration | undefined = undefined;

    if (!unionType) {
      const valDecl = symbol.valueDeclaration;
      paramDecl = ts.isParameter(node.parent)
        ? node.parent
        : valDecl != null && ts.isParameter(valDecl)
        ? valDecl
        : undefined;

      const type = checker.getTypeOfSymbolAtLocation(symbol, node);
      unionType = type.isUnion()
        ? (checker.typeToTypeNode(
            type,
            valDecl,
            ts.NodeBuilderFlags.None
          ) as TS.UnionTypeNode)
        : undefined;
    }

    return new TypeInfo(node, symbol, paramDecl, unionType);
  }
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
