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

**6. Scan the finished code as an adversary.** With everything green — typecheck, 65 tests, 5 E2E —
a fresh agent was pointed at the whole repo and asked to hunt bugs, with the tests passing given as
context rather than as reassurance. It found three real ones that a green suite had hidden:

- **A successful booking could be reported as a failure.** The map refresh was awaited *before* the
  confirmation was committed, so a failed refresh after a `201` sent control into the catch block:
  the guest saw an error and an open form for a booking that had actually gone through.
- **The refresh after a `409` did nothing it claimed to.** The selected cabana was a snapshot taken
  at click time, so refreshing the map could never flip it to booked. Two browsers racing for one
  cabana left the loser retrying the same conflict forever, with the "already booked" notice — the
  whole point of the refresh — unreachable.
- **`EADDRINUSE` escaped the CLI's error handling**, because `listen()` reports failure by event,
  not by rejection. Every other startup failure had a clean one-line message; this one printed a
  stack trace. It was also the failure I had hit myself during testing.

It also caught two sentences in the README describing behaviour the code does not have, and that
`Number()` was accepting `--port 0x50` as port 80 and `--port ""` as a random one, under an error
message promising an integer.

Its accessibility notes were fair and mostly taken: `BookingDialog` was renamed `BookingForm`
because it never had the dialog semantics the name implied, and focus now moves to the panel when
it swaps. I did not take everything — some of what it raised was latent rather than live, and I
fixed those only where the fix was smaller than the argument.

**7. Stop trusting the green tick — measure the tests.** A suite that passes proves nothing about a
suite that would fail. So a multi-agent run broke the code on purpose in **34 ways** and recorded
which breakages the tests noticed: **27 caught, 7 survived**. Every survivor was a real hole:

- The blank-field tests asserted "400 with some error" — but a blank field produces exactly that
  by falling through to the guest lookup, so they passed with the guard deleted. They had been
  green for the wrong reason from the start.
- Nothing combined a bad cabana with a bad guest, so the 404-before-400 precedence was free to
  invert.
- `findCabana` carries the entire cabana selection; gutting it to `return null` kept 72/72 green.
- Deleting the explicit grid placement scrambled **30 of 47 cabanas** into the wrong cells — all
  tests still passed, because they only ever touched cabanas in one row.
- Deleting the booked-cabana CSS left a requirement of the brief resting on nothing.

Writing the tests for those was not the end of it. The first version of the "a booked cabana looks
different" test compared two *different* cabanas — but each sits over its own patch of the
parchment background, so the pixels always differ and the test passed with the styling deleted. I
had written exactly the kind of test this exercise was meant to catch. The honest version shoots
the same cabana before and after booking, and I confirmed it fails when the styling goes.

Two footnotes worth an interview conversation. First, one agent's report claimed the booked cabana
rendered "pixel-identical" under its mutation; it did not — a free cabana keeps a green glow, so
the requirement still held, weakly. Verifying the mutant rather than trusting the description
changed the conclusion. Second, an agent ignored its instruction to work in a clone and mutated the
real working tree mid-run; git caught it, but the lesson is to give agents a sandbox they cannot
escape rather than an instruction they might.

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
running it and looking at the result.

The theme worth discussing is that a green test suite proved almost nothing on its own. The pool
drawing was invisible while its test passed, because the test asserted the container instead of the
image. The two worst bugs — a successful booking shown as a failure, and a `409` the UI could never
recover from — lived happily under 65 passing tests, and surfaced only when a second agent was told
to attack the code rather than confirm it. Both are now pinned by tests that would have caught
them. Using the model to argue against my own work was worth more than using it to produce the
work.

## What was verified, and how

Nothing below is "the tests pass, so it works". Each claim was checked by exercising it:

- **The whole thing runs from a clean checkout.** Cloned the repo anonymously over HTTPS (as a
  reviewer would), ran `npm ci`, `npm test` (78 green), `npm run test:e2e` (10 green), and
  `npm run typecheck` (clean). Also confirmed `map.ascii` survives GitHub as 398 bytes with zero
  carriage returns, so the character-by-character parser cannot choke on a CRLF checkout.
- **`--map` / `--bookings` are really wired in, not hardcoded.** Started the app against a
  different 9×5 map and a one-guest bookings file: the API served that map, the fixture guest could
  book, and a guest from the real `bookings.json` was correctly rejected.
- **The startup log tells the truth about which files loaded**, including the tell (`(default)` on
  every line) for a reviewer who forgets the `--` that npm needs to forward flags.
- **`EADDRINUSE` fails cleanly**, verified against a port that was genuinely occupied — a one-line
  message and exit 1, not a stack trace.
- **The test suite itself was measured, not trusted.** Mutation testing broke the code in 34 ways;
  27 breakages were caught, 7 slipped through, and each of those 7 is now covered by a test that I
  confirmed fails on the broken code and passes on the fixed code.

## What I am not fully sure of, and how I would close each gap

I would rather name these than imply the work is airtight.

1. **The audit is a sample, not a proof.** 34 mutations is a spot-check; `map.ts` and `poolArea`
   were not mutated exhaustively, and one audit agent (test-quality) died on an API error and never
   re-ran. *To be sure:* wire in a real mutation-testing tool (Stryker) in CI so the mutation score
   is measured on every change instead of once by hand.
2. **Only Chromium was exercised.** There is a responsive breakpoint in the CSS but no real
   touch/mobile run, and no Firefox or WebKit. *To be sure:* add those projects to
   `playwright.config.ts` and a mobile viewport — cheap, I left it out to keep the suite fast.
3. **`npm test` runs no UI tests.** The brief asks for "UI responses to typical user actions"; those
   live in the Playwright suite behind a separate `npm run test:e2e`, because it needs a build and a
   browser. Both commands are documented, so the requirement is met, but a reviewer running only
   `npm test` will not see the UI covered. *To be sure the intent is unmistakable:* a single
   `npm run test:all` that runs both, or a one-line note at the top of the test section. Left as-is
   for now because coupling a browser download into the default test command is its own surprise.
4. **Concurrency is single-process and in-memory, as the brief allows.** The one-booking-per-room
   and cabana-taken checks are not transactional; two truly simultaneous requests for the same
   cabana are not stress-tested. For this task's scope that is fine, but I would say so rather than
   imply it is bulletproof. *To be sure:* a load test firing concurrent bookings at one cabana.
5. **Visual correctness rests on one screenshot and a same-cabana pixel diff.** That catches "booked
   looks identical to free" but not subtler regressions. *To be sure:* snapshot-based visual
   regression on the whole map, which I judged heavier than a recruitment task warrants.
