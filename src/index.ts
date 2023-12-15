import figlet from "figlet";
import readline from "readline";
import chalk from "chalk";
import { Translator } from "./translator/index.js";

console.log(
  figlet.textSync("MongoDB to SQL translator! \n _________", {
    font: "big",
    horizontalLayout: "default",
    verticalLayout: "default",
    width: 80,
    whitespaceBreak: true,
  })
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt:
    "\nEnter a mongoDB query to translate it to SQL, or type 'exit' to close: \n",
});

rl.prompt();

rl.on("line", (line: string) => {
  if (line.toLowerCase() === "exit") {
    console.log(chalk.red("\nExiting!!\n"));
    process.exit(0);
  } else {
    try {
      const translatedQuery: string = Translator.convertToSQL(line);
      console.log(chalk.green(`\n${translatedQuery}\n`));
    } catch (error) {
      console.log(chalk.red(`\n${error}\n`));
    }
  }
  rl.prompt();
});
