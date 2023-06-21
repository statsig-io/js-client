// @ts-check
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ensure all public methods of the `StatsigClient` class have their code within an errorBoundary',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    return {
      ClassDeclaration(node) {
        if (node?.id?.name !== 'StatsigClient') {
          return;
        }

        for (const method of node.body.body) {
          if(method.type !== 'MethodDefinition' || method.accessibility !== 'public' || method.key.name === 'constructor'){
            continue;
          }

          const statments = method.value.body.body;
          for (const statment of statments) {
            const arguement = statment.argument; 
            const isErrorBoundaryReturnStatment = 
              arguement?.callee?.object?.object?.type === 'ThisExpression' &&
              arguement?.callee?.object?.property?.name === 'errorBoundary'
  
            const expression = statment.expression;
            const isErrorBoundaryExpression = 
              expression?.type === 'CallExpression' &&
              expression?.callee?.object?.object?.type === 'ThisExpression' && 
              expression?.callee?.object?.property?.name === 'errorBoundary';
  
  
            const isGetter = 
              arguement?.type === "MemberExpression" && 
              arguement?.property?.type === "Identifier"
  
            if(!isErrorBoundaryReturnStatment && !isGetter && !isErrorBoundaryExpression){
              context.report({
                node: statment,
                message: `All code in public method should be contained inside a single errorBoundary statment.`,
              });
            }
          }
        }
      },
    };
  },
};
