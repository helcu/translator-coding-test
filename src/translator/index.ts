const mongoParse = require("mongo-parse");
import JSON5 from "json5";
import { operatorsMap } from "./operationsMap";
const MONGO_QUERY_OPERATOR = "operatiionQuery";

export class Translator {
  static convertToSQL(input: string) {
    const parsedObject = Translator.parseSQLInput(input);

    console.log("CONVERTED!", JSON.stringify(parsedObject));
  }
  private static parseSQLInput(query: string) {
    /**
     * parsing strategy is to use indexOf(char) and then slice() instead if split(char)
     * the reason: it is possible LIKE statement to contain a dot
     * */
    if (query.length < 1) {
      throw Error("Empty query statement");
    }
    // check if query starts with db
    let index = query.indexOf(".");
    if (index === -1) {
      throw Error("Wrong format, use .");
    }
    const prefix = query.slice(0, index);
    if (prefix !== "db") {
      throw Error("Wrong format, use db statement");
    }

    // parse the collection name
    let rest = query.slice(index + 1);
    index = rest.indexOf(".");
    if (index === -1) {
      throw Error("Wrong format");
    }
    const fromSection = rest.slice(0, index);
    if (fromSection.length == 0) {
      throw Error("Missing collection name");
    }

    // the only supported method is 'find'
    rest = rest.slice(index + 1);
    index = rest.indexOf("(");
    const method = rest.slice(0, index);
    if (method !== "find") {
      throw Error("Wrong or not supported MongoDB method (" + method + ")");
    }

    // cut the semicolon from the end of query if exists
    let lastChar = rest.length;
    if (rest[lastChar - 1] === ";") {
      lastChar -= 1;
    }
    const mongoQuery = rest.slice(index, lastChar);

    if (mongoQuery[0] !== "(" || mongoQuery[mongoQuery.length - 1] !== ")") {
      throw Error("Method is not parenthized");
    }

    /**
     * convert the string containing query(cleaned from brackets) to JS object(array)
     * using parseObjFromString function from utils.js
     */
    const preparedForObjectParsing =
      "[" + mongoQuery.slice(1, mongoQuery.length - 1) + "]";
    console.log("PARSED OBEJCT", JSON.stringify(preparedForObjectParsing));
    const queryObject = JSON5.parse(preparedForObjectParsing);

    // parse where clause to JS-readable format
    const whereParsed = mongoParse.parse(queryObject[0]);
    // parse select clause to JS-readable format
    const selectParsed = mongoParse.parse(queryObject[1]);

    // build usable prepared WHERE
    const whereClausePrepared = whereParsed.parts.reduce(
      (prev: any, curr: any) => [...prev, Translator.prepareWhereClause(curr)],
      []
    );

    // build usable prepared SELECT
    const selectClausePrepared = selectParsed.parts.reduce(
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
      whereClausePrepared,
      selectClausePrepared,
    };
  }

  private static prepareWhereClause(currentMongoParserElement: any): any {
    const { field, operator, operand } = currentMongoParserElement;

    // AND or OR operators with nested elements
    if (typeof field === "undefined") {
      // parse nested elements
      const nested = operand.reduce((prev: any, curr: any) => {
        const parsed = mongoParse.parse(curr);
        return [...prev, Translator.prepareWhereClause(parsed.parts[0])];
      }, []);

      // nested WHERE element
      return {
        field: MONGO_QUERY_OPERATOR,
        operator: operatorsMap[operator],
        operand: nested,
      };
    }
    // simple WHERE element
    return {
      field,
      operator: operatorsMap[operator],
      operand,
    };
  }
}
