// @ts-check
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    create(context) {
      return {
        Identifier: function (node) {
          if (node.name.length === 1)
            context.report({
              node,
              message: "Avoid single-letter identifiers",
            });
        },
      };
    },
  };