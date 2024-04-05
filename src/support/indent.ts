const indentRE = /(\r?\n)([\s\t]*)([^\r\n]*)|([^\r\n]+)/g;
export function indent(
  strings: TemplateStringsArray,
  ...args: (string | Lines | Lines[])[]
): Lines {
  const content = [] as Lines;
  let subcontent = content;
  for (let i = 0; i < strings.length; i++) {
    let match: RegExpMatchArray;
    const str = strings[i];
    while ((match = indentRE.exec(str))) {
      // console.log(match);
      if (match[1]) {
        const line = LineStruct(match[2], [match[3]]);
        subcontent = line.content;
        content.push(line);
      } else if (match[4]) {
        subcontent.push(match[4]);
      }
    }
    if (i < strings.length - 1) {
      const arg = args[i];
      if (Array.isArray(arg)) {
        for (const subarg of arg) {
          if (Array.isArray(subarg)) {
            subcontent.push(...subarg);
          } else {
            subcontent.push(subarg);
          }
        }
      } else {
        subcontent.push(arg);
      }
    }
  }
  return content;
}

export function renderIndent(indent: string, content: Lines): string {
  let result = '';
  for (const part of content) {
    if (typeof part === 'string') {
      result += part;
    } else {
      result += '\n' + indent + part.indent;
      result += renderIndent(indent + part.indent, part.content);
    }
  }
  return result;
}
export type Lines = (string | Line)[];
interface Line {
  indent: string;
  content: Lines;
}
function LineStruct(indent: string, content: (string | Line)[]): Line {
  return {
    indent,
    content,
  };
}
