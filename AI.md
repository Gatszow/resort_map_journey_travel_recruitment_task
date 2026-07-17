# AI-assisted workflow

## Tools

- **Claude Code** (Opus 4.8) in the terminal — the whole solution was written in one session.
- **Context7 MCP** — pulled current docs for Express 5, Vite, React 19, Playwright, Supertest and
  the npm CLI, because model training data lags behind releases.
- **Playwright** — as the test runner, and as the way to actually look at the rendered map.

## How it went, in steps

**1. Read the brief, then measure instead of assuming.** Before any code, I had the agent read
`README.md`, `map.ascii`, `bookings.json` and every asset. Two things came out of this that shaped
everything after:

- The `arrow*.png` files are not arrows, they are **path tiles**. Rather than eyeball them, I had
  the agent write a throwaway script that sampled the pixels along each image's edges to find where
  the ink touches. That produced the base orientations (`arrowStraight` joins N–S, `arrowSplit`
  joins N–S–E, `arrowEnd` only S, …) that the rotation logic depends on. Guessing here would have
  produced a map of disconnected paths.
- A second script computed the neighbour set of all 97 `#` tiles and reported which sprite and
  rotation each would need. It confirmed the sample map exercises every sprite and almost every
  rotation, with no isolated tiles.

**2. Settle the ambiguities up front.** The agent asked me four questions before writing code:
the stack, whether one `W` is one cabana or a block of them, whether a room may hold several
bookings, and how far the tests should go. Answering those first is what kept the design small.

**3. Plan, then have the plan attacked.** The plan went into a file, and a second agent was given
it with an explicit instruction to poke holes. That was the highest-value step of the session:

- It challenged my claim of "~60 cabanas". Counting proved **47**. I had guessed from a glance.
- It caught that Express 5 leaves `req.body` **undefined** when nothing parsed it, which would have
  turned a malformed request into a 500 instead of a 400.
- It argued `403` for a bad room/name re-imports the auth the task explicitly removes. I agreed and
  moved to `400`.
- It pointed out `GET /api/bookings` was a second source of truth the frontend never reads, and
  that it leaks the guest names that *are* the credential. Removed.
- It flagged the CRLF risk on a Windows checkout, which is now pinned in `.gitattributes`.

I did not take all of it. It claimed my error handler turned bad JSON into a 500 (it did not — I
had an explicit branch), that `listCabanaIds` was dead code (it is used to validate cabana ids),
and that collapsing `prestart` into `start` would fix a reviewer forgetting `--` (it does not —
npm eats the flag either way; the real fix was logging the resolved paths at startup).

**4. Verify claims against sources, not memory.** Two assumptions were load-bearing, so both were
checked rather than trusted: npm's own `lib/commands/run.js` confirms positional args go to the
named script and not to `pre*` hooks, and Express's docs and tests confirm a synchronous `throw`
in a handler reaches the error middleware.

**5. Build, then look at it.** Backend first (pure parsing and rules, then HTTP), then the
frontend. The screenshot from the E2E run caught a bug no assertion had: the pool drawing was
invisible. The cause was mine — I had dropped `position: relative` from the overlay while editing,
and positioned elements (the water tiles) paint over static ones no matter the DOM order. The test
had only checked that the *container* was visible, so it passed while the picture was hidden. The
assertion now checks the image itself, that every sprite decodes, and that the overlay stays
positioned.

## Prompts that did the work

The useful prompts were the ones that refused to let the model be agreeable:

- *"I measured which edges carry ink to derive base orientations"* — giving the agent measured
  facts instead of asking it to recall how the assets look.
- *"Poke holes: correctness bugs, edge cases, anything that violates 'simplicity/right-sized
  design' or that a reviewer would flag. Be concise and prioritise the items where I am most
  likely to be wrong."* — plus a list of the specific decisions I was least sure about
  (403-vs-400, the npm arg trick, Express 5 error handling, `id="x,y"` in the DOM).
- *"You were right to challenge me — I verified by counting."* — feeding the correction back so the
  critique continued from facts rather than from my summary of them.
- A standing instruction throughout: check the current API via Context7 before writing against a
  library, and don't soften a finding just because I pushed back.

## What I'd tell you in the interview

The agent is quick but confidently wrong at the edges, and the errors it makes are plausible ones —
"~60 cabanas" reads fine until you count. Everything load-bearing here was either measured
(asset orientations, tile counts), verified against a primary source (npm, Express), or checked by
running it and looking at the result. The one bug that reached the screen got there because a test
asserted the container instead of the thing I actually cared about — which is the lesson I'd take
from this exercise, not the tile maths.
