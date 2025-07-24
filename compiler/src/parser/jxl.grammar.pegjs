Identifier "identifier"
  = id:[a-zA-Z_][a-zA-Z0-9_]* { return id.join(""); }

Integer "integer"
  = digits:[0-9]+ { return parseInt(digits.join(""), 10); }

Float "float"
  = parts:([0-9]+ "." [0-9]+) { return parseFloat(parts.join("")); }

StringLiteral "string"
  = '"' chars:DoubleStringCharacter* '"' { return chars.join(""); }
  / "'" chars:SingleStringCharacter* "'" { return chars.join(""); }

DoubleStringCharacter
  = !('"' / "\\" / LineTerminator) c:. { return c; }
  / EscapeSequence

SingleStringCharacter
  = !("'" / "\\" / LineTerminator) c:. { return c; }
  / EscapeSequence

EscapeSequence
  = "\\" ('"' / "'" / "\\" / "n" / "r" / "t" / "b" / "f" / "v" / "0")
  / "\\" ([0-9] [0-9] [0-9]) // octal escape
  / "\\u" hex:[0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] { return String.fromCharCode(parseInt(hex.join(""), 16)); }
  / "\\" LineTerminatorSequence // line continuation

LineTerminator = "\n" / "\r" / "\u2029" / "\u2028"
LineTerminatorSequence = "\n" / "\r\n" / "\r" / "\u2029" / "\u2028"

BooleanLiteral "boolean"
  = "true" { return true; }
  / "false" { return false; }

SingleLineComment
  = "//" (!LineTerminator .)* LineTerminator?

MultiLineComment
  = "/*" (!"*/" .)* "*/"

Comment
  = SingleLineComment / MultiLineComment

_ "whitespace"
  = (WhiteSpace / Comment)*

__ "mandatory whitespace"
  = (WhiteSpace / Comment)+

WhiteSpace 
  = [ \t\n\r\u000B\u000C\u00A0\uFEFF]

EOF = !.

// --- syntax rules (parser rules) ---
// a program is a sequence of top-level statements
Program
  = _ elements:TopLevelStatement* _ EOF {
    return {
      type: "Program",
      body: elements
    };
  }

TopLevelStatement
  = ViewDeclaration

// --- core ---
// 3.1. 'view' declaration
ViewDeclaration
  = "view" __ name:Identifier _ typeParams:TypeParameters? _ returnType:(":" _ t:Identifier {return t;})? _ body:Block {
    return {
      type: "ViewDeclaration",
      name: name,
      // on MVP v0.1, type parameters and return types are parsed but not used in codegen
      typeParameters: typeParams || [],
      returnType: returnType || null,
      body: body
    };
  }

TypeParameters
  = "<" _ params:IdentifierList _ ">" { return params; }

IdentifierList
  = head:Identifier tail:("," _ Identifier)* { return [head].concat(tail.map(function(element) { return element[1]; })); }

Block
  = "{" _ statements:Statement* _ "}" {
    return {
      type: "BlockStatement",
      body: statements
    };
  }

// things that 'do' or declare something
Statement
  = SignalDeclaration
  / RenderBlock
  / ExpressionStatement

// 3.2. 'signal' declaration
SignalDeclaration
  = "signal" __ name:Identifier _ ":" _ typeName:Identifier _ ("=" _ init:Expression)? _ ";"? {
    return {
      type: "SignalDeclaration",
      name: name,
      typeAnnotation: {
        type: "Identifier",
        name: typeName
      },
      initializer: init || null
    };
  }

// 3.3. 'render' block
RenderBlock
  = "render" _ block:Block {
    return {
      type: "RenderBlock",
      body: block
    };
  }

// 3.6. expression statement, expression followed by optional semicolon (`count += 1;`)
ExpressionStatement
  = expr:Expression _ ";"? {
    return {
      type: "ExpressionStatement",
      expression: expr
    };
  }

Expression
  = AssignmentExpression

AssignmentExpression
  = left:Identifier _ op:("=" / "+=" / "-=" / "*=" / "/=") _ right:Expression {
    return {
      type: "AssignmentExpression",
      operator: op,
      left: {
        type: "Identifier",
        name: left
      },
      right: right
    };
  }
  / LogicalORExpression

LogicalORExpression
  = left:LogicalANDExpression _ "||" _ right:LogicalORExpression { return { type: "BinaryExpression", operator: "||", left: left, right: right }; }
  / LogicalANDExpression

LogicalANDExpression
  = left:EqualityExpression _ "&&" _ right:LogicalANDExpression { return { type: "BinaryExpression", operator: "&&", left: left, right: right }; }
  / EqualityExpression

EqualityExpression
  = left:RelationalExpression _ op:("==" / "!=") _ right:EqualityExpression { return { type: "BinaryExpression", operator: op, left: left, right: right }; }
  / RelationalExpression

RelationalExpression
  = left:AdditiveExpression _ op:("<" / ">" / "<=" / ">=") _ right:RelationalExpression { return { type: "BinaryExpression", operator: op, left: left, right: right }; }
  / AdditiveExpression

AdditiveExpression
  = left:MultiplicativeExpression _ op:("+" / "-") _ right:AdditiveExpression { return { type: "BinaryExpression", operator: op, left: left, right: right }; }
  / MultiplicativeExpression

MultiplicativeExpression
  = left:UnaryExpression _ op:("*" / "/" / "%") _ right:MultiplicativeExpression { return { type: "BinaryExpression", operator: op, left: left, right: right }; }
  / UnaryExpression

UnaryExpression
  = op:("!" / "-" / "+") _ argument:UnaryExpression { return { type: "UnaryExpression", operator: op, argument: argument }; }
  / PostfixExpression

// postfix expressions (calls, member access - for MVP, just calls)
PostfixExpression
  = CallExpression
  / PrimaryExpression

// 3.4. ui element instantiation
CallExpression
  // case 1: `Identifier(args) { props } { children }`
  = callee:Identifier _ args:Arguments _ props:PropertyBlock? _ content:Block? {
    return {
      type: "CallExpression",
      callee: { type: "Identifier", name: callee },
      arguments: args,
      properties: props || [],
      children: content ? content.body : [] // extract statements from block
    };
  }
  // case 2: `Identifier { props } { children }`
  / callee:Identifier _ props:PropertyBlock _ content:Block? {
    return {
      type: "CallExpression",
      callee: { type: "Identifier", name: callee },
      arguments: [],
      properties: props,
      children: content ? content.body : []
    };
  }
  // case 3: `Identifier(args)`
  / callee:Identifier _ args:Arguments {
    return {
      type: "CallExpression",
      callee: { type: "Identifier", name: callee },
      arguments: args,
      properties: [],
      children: []
    };
  }

Arguments
  = "(" _ args:ArgumentList? _ ")" { return args || []; }

ArgumentList
  = head:Expression tail:("," _ Expression)* { return [head].concat(tail.map(function(element) { return element[1]; })); }

PropertyBlock
  = "{" _ props:PropertyAssignment* _ "}" { return props; }

PropertyAssignment
  = name:Identifier _ "=" _ value:Expression _ ";"? {
    return {
      type: "Property",
      key: { type: "Identifier", name: name },
      value: value
    };
  }

PrimaryExpression
  = IdentifierExpression
  / LiteralExpression
  / EmbeddedExpression
  / "(" _ expr:Expression _ ")" { return expr; } // grouping

IdentifierExpression
  = name:Identifier { return { type: "Identifier", name: name }; }

LiteralExpression
  = value:(Float / Integer / StringLiteral / BooleanLiteral) {
    let valueType = "unknown";
    if (typeof value === 'number') {
        valueType = Number.isInteger(value) ? "Int" : "Float";
    } else if (typeof value === 'string') {
        valueType = "String";
    } else if (typeof value === 'boolean') {
        valueType = "Boolean";
    }
    return { type: "Literal", value: value, valueType: valueType };
  }

EmbeddedExpression
  = "\\(" _ expr:Expression _ ")" {
    return {
      type: "EmbeddedExpression",
      expression: expr
    };
  }
