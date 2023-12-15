import { Translator } from "./translator";

const input: string =
  "db.user.find({ $or: [ { quantity: { $lt: 20 } }, { price: 10 } ]})";

Translator.convertToSQL(input);
