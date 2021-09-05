import { alt, peek, take, bind, pure, empty, liftAs, many, sat, whitespace, sentence, token, some, char, alts, unpack } from "../src"

describe("Test the primitives", () => {
  describe("pure", () => {
    test("Should return parser from given input", () => {
      expect(pure("input")("<html>")).toStrictEqual([["input", "<html>"]])    
    })
  })

  describe("emppty", () => {
    test("Should return parser that returns empty list", () => {
      expect(empty()("input")).toStrictEqual([])
    })
  })

  describe("bind", () => {
    test("Should create new parser that combines 2 takes", () => {
      expect(bind(take, x => bind(take, y => pure(x + y)))("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<h", "tml><body><p>This is main text.</p></body></html>"]])
    })

    test("If a parser fails midway through bind, return empty result", () => {
      const takeThree = bind(
        take, x => bind(
        take, y => bind(
        take, z => 
          pure(x + y + z)
        )))
      expect(takeThree("i")).toStrictEqual([])
    })
  })

  describe("liftAs", () => {
    test("Should create new parser that combines 2 takes", () => {
      expect(liftAs(x => y => x + y, take, take)("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<h", "tml><body><p>This is main text.</p></body></html>"]])
    })

    test("If a parser fails midway through liftAs, return empty result", () => {
      const takeThree = liftAs(
        x => y => z => x + y + z,
        take,
        take,
        take,
      )
      expect(takeThree("i")).toStrictEqual([])
    })
  })

  describe("take", () => {
    test("Should succeed with input length > 0", () => {
      expect(take("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<", "html><body><p>This is main text.</p></body></html>"]])
    })
  
    test("Should fail if not able to take", () => {
      expect(take("")).toStrictEqual([])
    })
  })

  describe("peek", () => {
    test("Should succeed with input length > 0", () => {
      expect(peek("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<", "<html><body><p>This is main text.</p></body></html>"]])
    })
  
    test("Peek, should not fail with empty input", () => {
      expect(peek("")).toStrictEqual([["", ""]])
    })
  })

  describe("char", () => {
    test("Matches first input of length 1", () => {
      expect(char("*")("*")).toStrictEqual([["*", ""]])
    })

    test("Matches first input of length > 1", () => {
      expect(char("*")("**")).toStrictEqual([["*", "*"]])
    })

    test("Does not match input should fail", () => {
      expect(char("*")("-")).toStrictEqual([])
    })

    test("Given empty input should fail", () => {
      expect(char("*")("")).toStrictEqual([])
    })
  })

  describe("sat", () => {
    test("Should succeed when predicate returns true", () => {
      expect(sat(c => c === "0")("0")).toStrictEqual([["0", ""]])
    })

    test("Should fail when predicate returns false", () => {
      expect(sat(c => c === "0")("B")).toStrictEqual([])
    })

    test("Should fail when input is empty", () => {
      expect(sat(c => c === "0")("")).toStrictEqual([])
    })
  })

  describe("alt", () => {
    test("Take at start should return result of take", () => {
      expect(alt(take, empty)("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<", "html><body><p>This is main text.</p></body></html>"]])
    })
  
    test("Empty at start should be skipped in favor of take", () => {
      expect(alt(empty(), take)("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<", "html><body><p>This is main text.</p></body></html>"]])
    })

    test("None matching should fail", () => {
      expect(alt(char("*"), char("-"))("&")).toStrictEqual([])
    })
  })

  describe("alts", () => {
    describe("Matches first given parser", () => {
      const numeric = sat(c => /[0-9]/.test(c))
      const alpha = sat(c => /[a-zA-Z]/.test(c))
      const star = char("*")

      expect(alts(() => numeric, () => alpha, () => star)("0123")).toStrictEqual([["0", "123"]])
    })

    describe("Matches second given parser", () => {
      const numeric = sat(c => /[0-9]/.test(c))
      const alpha = sat(c => /[a-zA-Z]/.test(c))
      const star = char("*")

      expect(alts(() => numeric, () => alpha, () => star)("abc")).toStrictEqual([["a", "bc"]])
    })

    describe("Matches third given parser", () => {
      const numeric = sat(c => /[0-9]/.test(c))
      const alpha = sat(c => /[a-zA-Z]/.test(c))
      const star = char("*")

      expect(alts(() => numeric, () => alpha, () => star)("*****")).toStrictEqual([["*", "****"]])
    })

    describe("No parser matches, should fail", () => {
      const numeric = sat(c => /[0-9]/.test(c))
      const alpha = sat(c => /[a-zA-Z]/.test(c))
      const star = char("*")

      expect(alts(() => numeric, () => alpha, () => star)("---")).toStrictEqual([])
    })

    describe("Empty input given, should fail", () => {
      const numeric = sat(c => /[0-9]/.test(c))
      const alpha = sat(c => /[a-zA-Z]/.test(c))
      const star = char("*")

      expect(alts(() => numeric, () => alpha, () => star)("")).toStrictEqual([])
    })
  })

  describe("many", () => {
    test("Should get as many characters as possible", () => {
      expect(many(take)("Words.")).toStrictEqual([[["W", "o", "r", "d", "s", "."], ""]])
    })
  
    test("Should grab all but the dots", () => {
      expect(many(sat(c => c !== "."))("Words.More.Words.")).toStrictEqual([[["W", "o", "r", "d", "s"], ".More.Words."]])
    })
  
    test("Should not fail even if there are no matches", () => {
      expect(many(sat(c => c !== "."))(".Words.More.Words.")).toStrictEqual([[[], ".Words.More.Words."]])
    })
  })

  describe("some", () => {
    test("Should return as many matches as possible", () => {
      expect(some(sat(c => c !== "."))("Words.More.Words.")).toStrictEqual([[["W", "o", "r", "d", "s"], ".More.Words."]])
    })
  
    test("Should fail if 0 matches", () => {
      expect(some(sat(c => c !== "."))(".Words.More.Words.")).toStrictEqual([])
    })
  })

  describe("sentence", () => {
    test("Matches given input, should succeed", () => {
      expect(sentence("<p>")("<p>")).toStrictEqual([["<p>", ""]])
    })

    test("Does not match given input, should fail", () => {
      expect(sentence("<p>")("<html>")).toStrictEqual([])
    })

    test("Empty input string, should fail", () => {
      expect(sentence("<p>")("")).toStrictEqual([])
    })
  })

  describe("whitespace", () => {
    test("Should match space", () => {
      expect(whitespace(" ")).toStrictEqual([[" ", ""]])
    })
  
    test("Should match tab", () => {
      expect(whitespace("\t")).toStrictEqual([["\t", ""]])
    })
  
    test("Should match newline", () => {
      expect(whitespace("\n")).toStrictEqual([["\n", ""]])
    })
  })

  describe("token", () => {
    test("Should match given string surrounded by whitespace", () => {
      expect(token(sentence("<html>"))("  \t  \n <html>  \t \n")).toStrictEqual([["<html>", ""]])
    })

    test("Should fail if given parser can't take input", () => {
      expect(token(sentence("<html>"))("  \t \n <p> \t  \n")).toStrictEqual([])
    })
  })

  describe("unpack", () => {
    test("Should succesfully unpack if input has been completely parsed succesfully", () => {
      expect(unpack(sentence("<html>"))("<html>")).toBe("<html>")
    })

    test("Should fail if the remainder of the input string is not empty", () => {
      expect(unpack(sentence("<html>"))("<html></html>")).toBeUndefined()
    })
    
    test("Should fail if the parser has failed", () => {
      expect(unpack(sentence("<html>"))("<p>")).toBeUndefined()
    })
  })
})
