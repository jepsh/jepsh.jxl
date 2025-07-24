// @ts-ignore
import * as JXLParser from './generated/jxl.parser';
import { Program } from '../ast';

/**
 * parse a JXL source string into Abstract Syntax Tree (AST)
 * @param source
 * @returns
 * @throws {SyntaxError}
 */
export function parse(source: string): Program {
  try {
    return JXLParser.parse(source) as Program;
  } catch (error) {
    if (error instanceof Error && 'location' in error) {
      const location = (error as any).location;
      throw new SyntaxError(
        `JXL Parse Error: ${error.message} at line ${location.start.line}, column ${location.start.column}`
      );
    }

    throw error;
  }
}

export { JXLParser };
