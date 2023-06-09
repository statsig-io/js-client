import noSingleLetter from "../../custom_eslint/no-single-letter";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
});

const errors = [{ message: "Avoid single-letter identifiers" }];

ruleTester.run("no-single-letter", noSingleLetter, {
  valid: [{ code: `const num = 123;` }],
  invalid: [{ code: `const x = 123;`, errors }],
});