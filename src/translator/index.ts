import mongoParse from "mongo-parse";
import JSON5 from "json5";
import { operatorsMap } from "./operationsMap.js";

const NESTED_OPERATOR = "NESTED_OPERATOR";

type ParsedResult = {
  fromSection: string;
  whereSection: Array<any>;
  selectSection: Array<any>;
};

export class Translator {
  static convertToSQL(input: string): string {
    const parsedObject = Translator.parseSQLInput(input);
    return Translator.buildQueryString(parsedObject);
  }

  private static parseSQLInput(query: string): ParsedResult {
    if (query.length < 1) {
      throw Error("Empty query statement");
    }

    let index = query.indexOf(".");
    if (index === -1) {
      throw Error("Wrong format, use .");
    }
    const prefix = query.slice(0, index);
    if (prefix !== "db") {
      throw Error("Wrong format, use db statement");
    }

    let rest = query.slice(index + 1);
    index = rest.indexOf(".");
    if (index === -1) {
      throw Error("Wrong format");
    }
    const fromSection = rest.slice(0, index);
    if (fromSection.length == 0) {
      throw Error("Missing collection name");
    }

    rest = rest.slice(index + 1);
    index = rest.indexOf("(");
    const method = rest.slice(0, index);
    if (method !== "find") {
      throw Error("Wrong or not supported MongoDB method (" + method + ")");
    }

    let lastChar = rest.length;
    if (rest[lastChar - 1] === ";") {
      lastChar -= 1;
    }
    const mongoQuery = rest.slice(index, lastChar);

    if (mongoQuery[0] !== "(" || mongoQuery[mongoQuery.length - 1] !== ")") {
      throw Error("Method is not parenthized");
    }

    const preparedForObjectParsing =
      "[" + mongoQuery.slice(1, mongoQuery.length - 1) + "]";
    console.log("PARSED OBEJCT", JSON.stringify(preparedForObjectParsing));
    const queryObject = JSON5.parse(preparedForObjectParsing);

    const whereParsed = mongoParse.parse(queryObject[0]);

    const selectParsed = mongoParse.parse(queryObject[1]);

    const whereSection = whereParsed.parts.reduce(
      (prev: any, curr: any) => [...prev, Translator.buildWhereSection(curr)],
      []
    );

    const selectSection = selectParsed.parts.reduce(
      (prev: any, curr: { operand: number; field: any }) => {
        if (curr.operand === 1) {
          return [...prev, curr.field];
        } else {
          return null;
        }
      },
      []
    );

    return {
      fromSection,
      whereSection,
      selectSection,
    };
  }

  private static buildWhereSection(currentMongoParserElement: any): any {
    const { field, operator, operand } = currentMongoParserElement;

    if (typeof field === "undefined") {
      const nested = operand.reduce((prev: any, curr: any) => {
        const parsed = mongoParse.parse(curr);
        return [...prev, Translator.buildWhereSection(parsed.parts[0])];
      }, []);

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

  private static buildQueryString(parsedResult: ParsedResult): string {
    const { selectSection, fromSection, whereSection } = parsedResult;

    const whereClauseSQL = whereSection
      .reduce(
        (prev: any, curr: any) => [...prev, Translator.buildWhereString(curr)],
        []
      )
      .join(" AND ");

    const select =
      "SELECT " + (selectSection.length > 0 ? selectSection.join(", ") : "*");
    const from = "FROM " + fromSection;
    const where = "WHERE " + whereClauseSQL;

    return select + " " + from + " " + where + ";";
  }

  private static buildWhereString(elem: {
    field: any;
    operator: any;
    operand: any;
  }): string {
    const { field, operator, operand } = elem;

    if (field === NESTED_OPERATOR) {
      return "(" + Translator.getTyppedOperand(operand, operator, field) + ")";
    } else {
      return (
        field +
        " " +
        operator +
        " " +
        Translator.getTyppedOperand(operand, operator, field)
      );
    }
  }

  private static getTyppedOperand(
    operand: any,
    operator: any,
    field: any
  ): any {
    if (typeof operand === "string") {
      return "'" + operand + "'";
    } else if (operator === "IN") {
      operand = operand
        .map((op: any) => Translator.getTyppedOperand(op, null, null))
        .join(", ");
      return "(" + operand + ")";
    } else if (field === NESTED_OPERATOR) {
      return operand
        .reduce((prev: any, curr: any) => {
          return [...prev, Translator.buildWhereString(curr)];
        }, [])
        .join(" " + operator + " ");
    } else {
      return operand;
    }
  }
}
