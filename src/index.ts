/// Fundamental blocks ///
// Result is a list of tuples
// An empty list means something the parser wasn't able to parse the input
type ParserRes<T> = [T, string][]
export type Parser<T> = (inp: string) => ParserRes<T>

// Returns a new parser that applies the function
const fmap = <A, B>(fn: (a: A) => B, parser: Parser<A>): Parser<B> => {
  return inp => {
    const res = parser(inp);
    if (res.length === 0) return [];

    const [v, out] = res[0];
    return [[fn(v), out]];
  };
};

export const pure = <T>(a: T): Parser<T> => inp => [[a, inp]];

export const empty = <T>(): Parser<T> => () => [];

export const bind = <A, B>(parser: Parser<A>, fn: (a: A) => Parser<B>): Parser<B> => {
  return inp => {
    const res = parser(inp);
    if (res.length === 0) return [];

    const [v, out] = res[0];
    return fn(v)(out);
  };
};

/// Primitives ///
export const liftAs = <T>(fn: any, ...fns: Parser<any>[]): Parser<T> => {
  if (fns.length === 0) return fn;
  else if (fns.length === 1) return fmap(fn, fns[0]); 
  else {
    return bind(fns[0], (res) => {
      return liftAs(fn(res), ...fns.slice(1));
    });
  }
};

// Parse through first given parser if possible,
// Else parse through second parser
export const alt = <T>(parserA: Parser<T>, parserB: () => Parser<T>): Parser<T> => {
  return inp => {
    const res = parserA(inp);
    if (res.length === 0) return parserB()(inp);
    return res;
  };
};

// Assume parsers.length > 1
export const alts = <T>(...parsers: (() => Parser<T>)[]): Parser<T> => {
  return parsers.reduce((acc, curr) => () => alt(acc(), curr))();
};

// 0..n
export const many = <T>(parser: Parser<T>): Parser<T[]> => {
  return inp => {
    let currentInp = inp;
    const result = [];

    let out = parser(currentInp);
    while(out.length !== 0) {
      const [v, remainingInp] = out[0];
      result.push(v);
      currentInp = remainingInp;
      out = parser(currentInp);
    }

    return [[result, currentInp]];
  };
};

// 1..n
export const some = <T>(parser: Parser<T>): Parser<T[]> => {
  return inp => {
    const res = many(parser)(inp);
    const [[v]] = res;
    if (v.length === 0) return [];
    return res;
  };
};

export const id = <T>(a: T): T => a;
export const take: Parser<string> = inp => inp.length > 0 ? [[inp[0], inp.slice(1)]] : [];
export const peek: Parser<string> = inp => [[inp[0] || "", inp]];
export const takeDigit: Parser<number> = liftAs(
  (x: string) => Number(x),
  take,
);

export const sentence = (str: string): Parser<string> => (inp: string) => {
  if (inp.length < str.length) return [];
  const [former, latter] = [inp.slice(0, str.length), inp.slice(str.length, inp.length)];
  return former === str ? [[former, latter]] : [];
};

export const sat = (pred: (s: string) => boolean): Parser<string> => {
  return bind(take, (x: string) => {
    return pred(x) ? pure(x) : empty();
  });
};

export const alpha = sat(c => /[a-zA-Z]/.test(c));
export const numeric = sat(c => /[0-9]/.test(c));
export const aphaNumeric = alt(alpha, () => numeric);

const eq = <T>(x: T) => (y: T): boolean => x === y;
export const space = sat(eq(" "));
export const char = (c: string): Parser<string> => sat(eq(c));

// Strips whitespace/tabs/newlines away around given token
export const whitespace = sat(c => /[\n\t ]/.test(c));
export const token = <T>(parser: Parser<T>): Parser<T> => liftAs(
  () => (res: T) => () => res,
  many(whitespace),
  parser,
  many(whitespace),
);

export const logId = <T>(parser: Parser<T>): Parser<T> => inp => {
  console.log(inp);
  return parser(inp);
};

export const tap = (tapFn: (s: string) => void): Parser<undefined> => inp => {
  tapFn(inp);
  return [[undefined, inp]];
};

export const unpack = <T>(parser: Parser<T>) => (inp: string): T | undefined => {
  const res = parser(inp);
  // If the parser failed
  if (res.length === 0) return;
  // If the parser has elements left over that aren't parsed
  if (res[0][1] !== "") return;
  // If all has succeeded, return output of parser
  return res[0][0];
};
