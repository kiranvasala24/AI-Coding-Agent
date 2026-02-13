import ts from 'typescript';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { config } from '../config';

export interface SymbolInfo {
    name: string;
    kind: string;
    line: number;
    character: number;
    containerName?: string;
    filePath: string;
}

/**
 * Extract symbols from a TypeScript/JavaScript file using the Compiler API
 */
export async function extractSymbols(file: string): Promise<SymbolInfo[]> {
    const fullPath = join(config.repoPath, file);
    const content = await readFile(fullPath, 'utf-8');

    const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
    );

    const symbols: SymbolInfo[] = [];

    function visit(node: ts.Node, containerName?: string) {
        let name: string | undefined;
        let kind: string | undefined;

        if (ts.isClassDeclaration(node) && node.name) {
            name = node.name.text;
            kind = 'class';
        } else if (ts.isFunctionDeclaration(node) && node.name) {
            name = node.name.text;
            kind = 'function';
        } else if (ts.isInterfaceDeclaration(node) && node.name) {
            name = node.name.text;
            kind = 'interface';
        } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
            name = node.name.text;
            kind = 'method';
        } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            // Only index top-level constants or exported variables
            if (ts.isVariableStatement(node.parent.parent)) {
                name = node.name.text;
                kind = 'variable';
            }
        }

        if (name && kind) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            symbols.push({
                name,
                kind,
                line: line + 1,
                character: character + 1,
                containerName,
                filePath: file,
            });
        }

        ts.forEachChild(node, (child) => visit(child, name || containerName));
    }

    visit(sourceFile);
    return symbols;
}

/**
 * Symbol Lookup Tool
 * Searches for a symbol name across the repository
 */
export async function lookupSymbol(symbolName: string): Promise<SymbolInfo[]> {
    // For now, we'll do a simple scan of common files. 
    // In a full implementation, we would use a pre-built SQLite index.
    const { listFiles } = await import('./repo');
    const { files } = await listFiles('src/**/*.{ts,tsx}');

    const allSymbols: SymbolInfo[] = [];

    // Scan files for the symbol (limited for performance in this MVP)
    for (const file of files.slice(0, 50)) {
        try {
            const symbols = await extractSymbols(file);
            const matches = symbols.filter(s => s.name.toLowerCase().includes(symbolName.toLowerCase()));
            allSymbols.push(...matches);
        } catch (e) {
            // Skip files that fail to parse
        }
    }

    return allSymbols;
}

/**
 * Find References (Simplified)
 */
export async function findReferences(symbolName: string): Promise<{ file: string; line: number; content: string }[]> {
    const { search } = await import('./repo');
    const results = await search(symbolName, 'src/**/*.{ts,tsx}');

    return results.map(r => ({
        file: r.file,
        line: r.line,
        content: r.content
    }));
}
