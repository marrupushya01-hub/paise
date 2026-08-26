# Product

## Register

product

## Users

Salaried people in India in their twenties, most of them a few years into a
first job, with money spread across a bank account, UPI, a couple of SIPs and
a fixed deposit, and no clear picture of what any of it adds up to. They
already know roughly what they spend. What they don't have is an explanation:
which number moved, by how much, and whether it matters.

They open Paise in short glances, on a phone, usually after a notification or
a purchase they half-regret, and occasionally settle in on a laptop to
actually read a month. The job is "tell me what changed and whether I should
care", not "let me do bookkeeping".

## Product Purpose

Paise reads connected accounts (read-only, through an RBI-licensed account
aggregator) and explains them. Net worth, safe-to-spend, where the month went,
what the portfolio is doing, and an assistant that answers questions about all
of it in plain language.

Success is a user who can answer "why is this month different?" in under ten
seconds, trusts the number they're shown, and never feels sold to. Failure is
a user who sees a dashboard, closes it, and still doesn't know.

## Brand Personality

Warm, plain-spoken, human. It talks the way a friend who happens to be good
with money would: honest about the bad news, never scolding, never
congratulatory about nothing. It says "most of it landed on weekends", not
"spending anomaly detected" and not "great job saving!".

Emotional goal is relief, not excitement. Money apps usually make people feel
either judged or hyped. Paise should make them feel informed and slightly
lighter.

The tone setting (Direct / Warm) changes the assistant's register, never its
honesty. Both settings say the same true thing.

## Anti-references

- **Neobank neon and gradients** (Revolut, Cred). Saturated gradient cards,
  glow, confetti on every action. Treats money as a game.
- **Legacy bank portals.** Blue chrome, raw statement tables, dropdowns,
  everything a form. Accurate and unreadable.
- **Crypto trading terminals.** Dark surfaces, neon candlesticks, ticker
  tape, numbers moving to feel alive. Manufactures urgency.

Anything that makes a balance feel thrilling or alarming is off-brand. The
numbers are already emotional enough.

## Design Principles

1. **Explain, don't display.** A figure alone is not a feature. Every number
   is paired with what changed or what it means. If we can't explain it, it
   doesn't earn the space.
2. **Honest emptiness.** When there's no data, show nothing and say so.
   Never zeroes, never placeholder charts, never a skeleton pretending to be
   content.
3. **Calm over urgent.** No badges demanding attention, no red unless
   something is genuinely wrong, no motion that implies markets are moving.
4. **Read-only, and it shows.** The interface should feel incapable of
   touching the money, because it is. Say so where it matters.
5. **One layout language across breakpoints.** Phone and desktop are the same
   app at different densities, not two products. Structure changes; the
   vocabulary of type, color, and component doesn't.

## Accessibility & Inclusion

- WCAG 2.2 AA as the floor. Financial figures carry contrast well above the
  minimum since they're the whole point of the screen.
- Color never carries meaning alone. Gains and losses are signed and worded,
  not just green and rust. Category breakdowns pair every swatch with a label
  and a percentage.
- Full keyboard operation, visible focus, correct roles on the switch, tabs,
  and dialog. The assistant panel traps focus while open and returns it on
  close.
- `prefers-reduced-motion` removes all transitions and panel animation.
- Indian numeral grouping (`8,42,600`) throughout, and `tabular-nums` so
  figures don't jitter between states.
