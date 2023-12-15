import mongoParse from "mongo-parse";
import JSON5 from "json5";
import { operatorsMap } from "./operationsMap.js";

// Constant representing the nested operator
const NESTED_OPERATOR = "NESTED_OPERATOR";

// Define the structure of parsed MongoDB query result
type ParsedResult = {
  fromSection: string;
  whereSection: Array<any>;
  selectSection: Array<any>;
};

// Define the structure of a parser element
type ParserElement = {
  field?: string;
  operator: string;
  operand: Array<any>;
};

// Translator class responsible for converting MongoDB query to SQL
export class Translator {
  /**
   * Convert MongoDB query to SQL.
   * @param input MongoDB query string
   * @returns SQL query string
   */
  static convertToSQL(input: string): string {
    const parsedObject = Translator.parseSQLInput(input);
    return Translator.buildQueryString(parsedObject);
  }

  /**
   * Parse the input MongoDB query to extract components.
   * @param query MongoDB query string
   * @returns Parsed components (FROM, WHERE, SELECT) of the query
   */
  private static parseSQLInput(query: string): ParsedResult {
    if (!query.startsWith("db.")) {
      throw new Error("Wrong format, use db statement");
    }

    // Extract parts of the query
    const parts = query.split(".");
    if (parts.length < 3 || !parts[2].startsWith("find(")) {
      throw new Error("Wrong format or unsupported MongoDB method");
    }

    // Extract sections: FROM, WHERE, SELECT
    const fromSection = parts[1];
    const rest = parts.slice(2).join(".");

    // Validate method parenthesization
    const openParenIndex = rest.indexOf("(");
    const closeParenIndex = rest.lastIndexOf(")");
    if (
      openParenIndex === -1 ||
      closeParenIndex === -1 ||
      closeParenIndex <= openParenIndex
    ) {
      throw new Error("Method is not parenthesized properly");
    }

    // Extract and parse MongoDB query
    const mongoQuery = rest.substring(openParenIndex + 1, closeParenIndex);
    let preparedForObjectParsing = "";
    try {
      preparedForObjectParsing = JSON5.parse("[" + mongoQuery + "]");
    } catch (error) {
      throw new Error("Error parsing MongoDB query");
    }

    // Parse WHERE and SELECT sections using mongo-parse library
    const whereParsed = mongoParse.parse(preparedForObjectParsing[0]);
    const selectParsed = mongoParse.parse(preparedForObjectParsing[1]);

    // Build WHERE and SELECT sections
    const whereSection = whereParsed.parts.map((part: any) =>
      Translator.buildWhereSection(part)
    );
    const selectSection = selectParsed.parts.reduce((prev: any, curr: any) => {
      if (curr.operand === 1) {
        return [...prev, curr.field];
      }
      return prev;
    }, []);

    return {
      fromSection,
      whereSection,
      selectSection,
    };
  }

  /**
   * Build the WHERE section of SQL query from parsed MongoDB WHERE section.
   * @param parserElement Parsed MongoDB element for WHERE clause
   * @returns Constructed WHERE clause elements for SQL query
   */
  private static buildWhereSection(parserElement: ParserElement): any {
    const { field, operator, operand } = parserElement;

    // Build WHERE clause elements based on MongoDB parsed elements
    if (field === undefined) {
      // Handle nested conditions and build appropriate structure
      const nested = operand.map((curr: any) => {
        const parsed = mongoParse.parse(curr);
        return Translator.buildWhereSection(parsed.parts[0]);
      });

      return {
        field: NESTED_OPERATOR,
        operator: operatorsMap[operator],
        operand: nested,
      };
    }

    return {
      field,
      operator: operatorsMap[operator],
      operand,
    };
  }

  /**
   * Build the complete SQL query string.
   * @param parsedResult Parsed MongoDB query components
   * @returns Assembled SQL query string
   */
  private static buildQueryString(parsedResult: ParsedResult): string {
    const { selectSection, fromSection, whereSection } = parsedResult;

    // Construct SQL query components: SELECT, FROM, WHERE
    const whereClauseSQL = whereSection
      .map((curr: any) => Translator.buildWhereString(curr))
      .join(" AND ");

    const select = `SELECT ${
      selectSection.length > 0 ? selectSection.join(", ") : "*"
    }`;
    const from = `FROM ${fromSection}`;
    const where = `WHERE ${whereClauseSQL}`;

    return `${select} ${from} ${where};`;
  }

  /**
   * Build the WHERE clause string for a single element.
   * @param elem Single element from parsed MongoDB WHERE section
   * @returns Constructed WHERE clause string for SQL query
   */
  private static buildWhereString(elem: {
    field: any;
    operator: any;
    operand: any;
  }): string {
    const { field, operator, operand } = elem;

    // Construct WHERE clause for a single element based on its field, operator, and operand
    const typpedOperand = Translator.getTyppedOperand(operand, operator, field);

    if (field === NESTED_OPERATOR) {
      return `(${typpedOperand})`;
    } else {
      return `${field} ${operator} ${typpedOperand}`;
    }
  }

  /**
   * Get typed operand for WHERE clause.
   * @param operand Operand value
   * @param operator Operator for WHERE clause
   * @param field Field type for WHERE clause
   * @returns Typed operand value for WHERE clause
   */
  private static getTyppedOperand(
    operand: any,
    operator: any,
    field: any
  ): any {
    // Determine the operand type and format it accordingly for WHERE clause
    // Handle strings, arrays (for IN operator), and nested conditions
    if (typeof operand === "string") {
      return `'${operand}'`;
    } else if (Array.isArray(operand) && operator === "IN") {
      return `(${operand
        .map((op) => Translator.getTyppedOperand(op, null, null))
        .join(", ")})`;
    } else if (field === NESTED_OPERATOR && Array.isArray(operand)) {
      return operand
        .map((curr) => Translator.buildWhereString(curr))
        .join(` ${operator} `);
    } else {
      return operand;
    }
  }
}
