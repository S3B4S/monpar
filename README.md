# MonPar
This is an unambiguous (meaning it expects one correct output for each input) parser that makes use of combinators to combine small pieces of parsers to create bigger ones.

# Guide
- [Parser type](#parser-type)
- [Combining](#combining)
- [Helpers](#helpers)
  * [take](#take)
  * [peek](#peek)
  * [char](#char)
  * [sat](#sat)
  * [alt](#alt)
  * [alts](#alts)
  * [guards](#guards)
  * [token](#token)
  * [sentence](#sentence)
  * [tap](#tap)
  * [logId](#logid)
  * [unpack](#unpack)
- [Why alt(s) can take "thunks"](#why-alts-can-take-thunks)
- [Credits](#credits)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

## Parser type
Let's think about what we want a parser to achieve for a second, let's take a simple string.
```ts
"<p>This is inner text</p>"
```
Our parser needs to recognize the structure and extract the desired content `This is inner text`. However, the parser can also fail, imagine we were given the following instead.
```ts
"<p>This is inner text<p>"
```

Thus, we can consider our parser essentially a function that takes in an input, processes it, and then returns some output indicating that the parsing went right and returns the desired content, or that the parsing has failed.

In other words, take string as input, return result of parsing:
```ts
type Parser<T> = (inp: string) => ParserRes<T>
```

What does the result of a parser look like? There are many options we could choose, this library chooses to encapsulate the result in a list, thus, the output is a list of the parsed result, or an empty list if it has failed.

```ts
type ParserRes<T> = T[]
```

Here comes something confusing, we don't just return a list, we return a list of results, and each result itself is a tuple that contains the output of the parser in the first position, and the remainder of the string in the second position.

```ts
type ParserRes<T> = [T, string][]

parseHTML("<p>This is inner text</p>") // -> [["This is inner text", ""]]
// This went well, and there is nothing left to parse!

parseHTML("<p>This is inner text<p>") // -> []
// Ouch, an empty list, something went wrong.
```

So, this implies that a parser can just partially parse a string, and return its result and then pass the remainder of the string along. Imagine we want to just parse the opening tag and extract the name of the element:

```ts
parseOpeningTag("<p>This is inner text</p>") // -> [["p", "This is inner text</p>"]]
```

So, our parsers are essentially functions that take an input and return the result of parsing and might fail or succeed.

## Combining
As mentioned in the introduction, the core idea behind this parser is to combine small blocks of parsers to form a bigger parser. How does this look like? Let's start with a small parser:
```ts
take("<p>This is inner text</p>") // -> [["<", "p>This is inner text</p>"]]
```
The `take` parser is a parser exported from the library and it does something very simple, it just takes the first character of the string and passes the remainder of the string along.

But what if we would like to take not one, but *two* characters of the string? We could do this
```ts
const takeTwo = inp => {
  const res = take("<p>This is inner text</p>")
  // Check if parser didn't return empty list
  if (!res.length) return [];
  const [[v, rem]] = res;

  // Parse for second element
  const res2 = take(rem);
  if (!res2.length) return [];
  const [[v2, rem2]] = res2;
  return [[v + v2, rem2]]
}
```
So, we're basically saying to run `take` twice, that if it at any point fails it should return `[]`, and if all goes well, return the 2 concatenated characters and the remainder of the string. This doesn't look nice now, does it? Gladly, the library provides a function that encapsulates this behavior.
```ts
const takeTwo = bind(take, x => bind(take, y => inp => [[x + y, inp]]))
```
Let's break it down. The function `bind` takes a parser and another function that takes out the result of the previously given parser.

So, if we have
```ts
const log = bind(take, x => {
  console.log(x);
  return inp => [[x, inp]];
})
log("<p>")
// logs: <
// returns: [["<", "p>"]]
```

Okay so the function in the second position has access to the parsed output of the `take`, let's consider the type of `bind`:
```ts
const bind = <A, B>(parser: Parser<A>, fn: (a: A) => Parser<B>): Parser<B> = { /* ... */ }
```

So, considering that `bind` also returns a parser, we can keep chaining it. This allows us to gain access to the outputs of multiple parsers at once:
```ts
const takeTwo = bind(take, x => // x is the output of the first take
                bind(take, y => // y is the output of the second take
                  inp => [[x + y, inp]] // return parser that concatenates x & y and returns the remainder of the input
                ))

takeTwo("<p>") // -> [["<p", ">"]]
```

Now you might be thinking, but what if the second take would fail? We had to check for the results ourselves in the first `takeTwo` we implemented ourselves.
```ts
takeTwo("<")
```
The wonderful thing about `bind` is that checking for whether a parser has returned a valid result is built-in. If at any point a parser fails, the result will be an empty list `[]`.
```ts
takeTwo("<") // []
```

However, we're still not there yet, if we really would like to combine our parsers we need more, imagine we want to take 4 elements:
```ts
const takeFour =  bind(take, w => 
                  bind(take, x =>
                  bind(take, y => 
                  bind(take, z => 
                    inp => [[w + x + y + z, ""]]
                  ))))
```
That doesn't look nice either now does it?

For this, we have another function: `liftAs`
```ts
const liftAs = <T>(fn: any, ...fns: Parser<any>[]): Parser<T> = { /* ... */ }

const takeFour = liftAs(
  w => x => y => z => w + x + y + z,
  take,
  take,
  take,
  take,
)
```

Consider `liftAs` syntactic sugar that helps you avoid nesting all those `bind`'s. The first function supplied is a curried function that takes a number of parameters equal to the parsers that come afterward and the order is maintained, meaning:
```ts
const takeFour = liftAs(
  (w: string) => (x: string) => (y: string) => (z: string) => w + x + y + z,
  take, // this supplies w
  take, // this supplies x
  take, // this supplies y
  take, // this supplies z
)
```

Another thing to note: the first function does not return a parser anymore! It just returns the value in the way you would like to combine it, so we don't need to worry about returning a parser as well.

And of course, `liftAs` returns a parser, so we can use the output of that to keep combining parsers.

```ts
const takeTwo = liftAs(
  (x: string) => (y: string) => x + y,
  take,
  take,
)

const takeFour = liftAs(
  (x: string) => (y: string) => x + y,
  takeTwo,
  takeTwo,
)

takeFour("<p>This is inner text</p>")
// -> [["<p>T", "his is inner text</p>"]]
```

I hope that at this point the reader at least knows how to use `liftAs`, this will be your biggest friend when using this parser library.

## Helpers
This library provides many utility parsers to get started with, this section will detail how to use these utility parsers.

### take
Takes 1 character out of the input
```ts
type take = Parser<string>

take("<p>") // [["<", "p>"]]
take("") // []
```

### peek
Shows the first character but does not affect the input
```ts
type peek = Parser<string>

peek("<p>") // [["<", "<p>"]]
peek("") // [["", ""]]
```

### char
Checks if given character appears in input, if it matches, extract it, else fail.
```ts
type char = (c: string) => Parser<string>

const star = char("*")
star("*") // [["*", ""]]
star("-") // []
```

### sat
Given a predicate that takes the first character as input check whether that holds, if it does, return the character, else fail.
```ts
type sat = (pred: (s: string) => boolean) => Parser<string>

const numeric = sat(c => /[0-9]/.test(c))
numeric("007") // [["0", "07"]]
numeric("Bond") // []
```

### alt
Given two parsers, going from left to right, return any successful result encountered, else fail.
Note that both parsers should return the same result.
The `LazyVal<Parser<T>>` type might surprise you a bit, despite a `Parser<T>` type being passed in the exmaple, the need for `LazyVal<Parser<T>>` is explained in [this section](#why-alts-can-take-thunks).
```ts
type alt = <T>(parserA: LazyVal<Parser<T>>, parserB: LazyVal<Parser<T>>) => Parser<T>

const numeric = sat(c => /[0-9]/.test(c))
const alpha = sat(c => /[a-zA-Z]/.test(c));

const alphaNumeric = alt(numeric, alpha)

alphaNumeric("0123") // [["0", "123"]]
alphaNumeric("abc") // [["a", "bc"]]
alphaNumeric("****") // []
```

### alts
Takes in a list of functions that return parsers, goes through the entire list until it finds a parser that successfully returns a result, else fails.
This is a variation of `alt` where you can pass a list of parsers.
The `LazyVal<Parser<T>>` type might surprise you a bit, despite a `Parser<T>` type being passed in the exmaple, the need for `LazyVal<Parser<T>>` is explained in [this section](#why-alts-can-take-thunks).
```ts
type alts = <T>(...parsers: LazyVal<Parser<T>>[]) => Parser<T>

const numeric = sat(c => /[0-9]/.test(c))
const alpha = sat(c => /[a-zA-Z]/.test(c));
const star = char("*")

const alphaNumericOrStar = alts(
  numeric,
  alpha,
  star,
)

alphaNumericOrStar("0123") // [["0", "123"]]
alphaNumericOrStar("abc") // [["a", "bc"]]
alphaNumericOrStar("*****") // [["*", "****"]]
alphaNumericOrStar("----") // []
```

### guards
These are exported parsers that will take the first character when it fulfills the predicate.
Though, these are pretty simple, I encourage the reader to create their own such guards suited for their use case.
The name guard here is made up arbitrarily and doesn't carry a heavy meaning.
```ts
type sat = (pred: (s: string) => boolean) => Parser<string>
// ->
type guard = Parser<string>

// Each of these are referred to as a guard
const alpha = sat(c => /[a-zA-Z]/.test(c));
const numeric = sat(c => /[0-9]/.test(c));
const alphaNumeric = alt(alpha, () => numeric);
const space = sat(eq(" "));
const whitespace = sat(c => /[\n\t ]/.test(c));
```

### token
Strips away all whitespace around given parser.
```ts
type token = <T>(parser: Parser<T>) => Parser<T>

const pTag = token(sentence("<p>"))

pTag("    <p>    ") // [["<p>", ""]]
pTag("    <p>    Inner text     </p>  ") // [["<p>", "Inner text     </p>  "]]
pTag("    <h1>    ") // []
```

### sentence
Checks if given string appears in input, if it matches, extract it, else fail.
```ts
type sentence = (str: string) => Parser<string>

const pTag = sentence("<p>")

pTag("<p>Inner text</p>") // [["<p>", "Inner text</p>"]]
pTag("<h1>Header</h1>") // []
```

### tap
This is a parser that helps with debugging, the supplied function will be applied to the input and then the input gets passed along.
```ts
type tap = (tapFn: (s: string) => void) => Parser<undefined>

tap(inp => { /* have access to inp to inspect if, log for example */ })
const log = tap(inp => { console.log(inp) })
log("<p>")
// logs: <p>
// returns: [[undefined, "<p>"]]
```

### logId
This is a parser that helps with debugging, if you wrap a parser in this, the input will be logged and execution will pass on.
```ts
type logId = <T>(parser: Parser<T>) => Parser<T>
const pTag = sentence("<p>")
logId(pTag)("<p>")
// logs: <p>
// returns: [["<p>", ""]]
```

### unpack
When you would like to unpack the parsed result out of `Parser<T>`.
Unpacking will happen successfully if
  - The parser returns a successful result
  - In the result, the remainder of the input is empty (meaning, unpack expects the entire string to have gone through the parser)
Else it will return `undefined`.
```ts
type unpack = <T>(parser: Parser<T>) => (inp: string) => T | undefined

const pTag = sentence("<p>")
unpack(pTag)("<p>") // "<p>"
unpack(pTag)("<p>Inner text</p>") // undefined
unpack(pTag)("<h1>") // undefined
```

## Why alt(s) can take "thunks"
One thing that we'd like to do with parsing is to be able to call it recursively. Imagine we have the following input.
```ts
const input = `
  <html>
    <body>
      Main text!
    </body>
  </html>
`
```

And we have a parser that can parse away an opening tag, a closing tag and checks whether the part in the middle is text, else assume that it's another node and recursively calls itself.

```ts
const parseHTMLNode = liftAs(
  (tag: string) => (child: Node | string) => () => ({ node: tag, child }),
  parseOpeningTag,
  alt(parseInnerText, parseHTMLNode),
  parseClosingTag,
)
```

This will give us an error because the variable can't refer to itself from within, so, we have to convert this to a function and recursively call itself to get the parser:

```ts
import { alt, liftAs } from "monpar"

const parseHTMLNode = () => liftAs(
  (tag: string) => (child: Node | string) => () => ({ node: tag, child }),
  parseOpeningTag,
  alt(parseInnerText, parseHTMLNode()),
  parseClosingTag,
)
```

So, now we can correctly call `parseHTMLNode` recursively, but, another issue arises now. Because JavaScript will evaluate the argument before passing it down, this will cause an infinite loop. But that shouldn't be necessary right? Because if `parseInnerText` would succeed in `alt`, we don't want to even evaluate the second parser. Thus, the solution here is to pass a "thunk", meaning, wrap it in a function and only evaluate when you do need it:

```ts
import { alt, liftAs, thunk } from "monpar"

const parseHTMLNode = () => liftAs(
  (tag: string) => (child: Node | string) => () => ({ node: tag, child }),
  parseOpeningTag,
  alt(parseInnerText, thunk(parseHTMLNode),
  parseClosingTag,
)
```
Now `alt` takes a thunk for the second parameter and only evaluates it if the first would fail, thus we don't have the issue of infinite recursion.

The type of the thunk simply looks like
```ts
type LazyVal<T> = (() => T) | T
```

So really, all it means is that the given argument might be wrapped in a function so we can delay the evaluation (call it when we need it, in other words, it's lazy).

The `thunk` functions is he following:
```ts
export const thunk = <T>(x: T): LazyVal<T> => () => x
```
It just wraps the given argument in a function, thus, the following lines are equivalent:
```ts
alt(parseInnerText, thunk(parseHTMLNode),
alt(parseInnerText, () => parseHTMLNode()),
alt(parseInnerText, parseHTMLNode),
```

One more thing, both positions in `alt` can take a `LazyVal<Parser<T>>`, incuding the one where we don't need it, as the first parser will always be called, it's the parser (or parsers in case of `alts`) that come afterwards we _might_ call.

However, purely for ergonomical reasons all of the arguments passed are of type `LazyVal<Parser<T>>` so that you can choose to write the following:
```ts
alts(
  thunk(emptyTag),
  thunk(HTMLelement),
  thunk(Innertext),
)
```

instead of being forced to do
```ts
alts(
  emptyTag,
  thunk(HTMLelement),
  thunk(Innertext),
)
```

So, it's up to the reader what they would prefer, the important thing is knowing that the first parser always gets called, the ones that come afterwards _might_ get called.

## Credits
Shoutout to [@emiflake](https://github.com/emiflake) for helping out with the creation of this library.
