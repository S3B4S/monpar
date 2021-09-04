import { alt, peek, take, bind, pure, empty, liftAs, many, sat, whitespace, sentence, token, some, char, alts } from "../src"

describe("Test the primitives", () => {
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
    test("Take at start should return take", () => {
      expect(alt(take, empty)("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<", "html><body><p>This is main text.</p></body></html>"]])
    })
  
    test("Empty at start should be skipped in favor of take", () => {
      expect(alt(empty(), () => take)("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<", "html><body><p>This is main text.</p></body></html>"]])
    })

    test("None matching should fail", () => {
      expect(alt(char("*"), () => char("-"))("&")).toStrictEqual([])
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

  describe("bind", () => {
    test("Should create new parser that combines 2 takes", () => {
      expect(bind(take, x => bind(take, y => pure(x + y)))("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<h", "tml><body><p>This is main text.</p></body></html>"]])
    })
  })

  describe("liftAs", () => {
    test("Should create new parser that combines 2 takes", () => {
      expect(liftAs(x => y => x + y, take, take)("<html><body><p>This is main text.</p></body></html>")).toStrictEqual([["<h", "tml><body><p>This is main text.</p></body></html>"]])
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
  })
})
