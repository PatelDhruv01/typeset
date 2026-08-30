# RFLR 2026 — Lectures 4, 5, 6: Finding the Optimal Policy

**Covers: Bellman backup operators, Q-values, Policy Iteration, the Bellman Optimality Equation, Value Iteration**

---

## Part 0 — Where we are

Lectures 1–3 answered one question: **given a policy `π`, what is it worth?** That's `Vπ`, and you now have three ways to get it (definition, recursion, matrix inverse).

Lectures 4–6 answer a much bigger question: **which policy is best?**

The bridge between them is one idea: **operators**. Instead of thinking about `Vπ` as a number you solve for, you think about a *machine* that takes a value vector and improves it. Everything in Lectures 4–6 is built from three such machines:

| Machine | Introduced | What it does |
|---|---|---|
| `Bπ` | Lecture 4 | one step of "follow `π`" — iterating it gives `Vπ` |
| `Qπ` / `QV` | Lecture 5–6 | one step of "try action `a`, then follow the policy / trust `V`" |
| `B` | Lecture 6 | one step of "take the *best* action" — iterating it gives `V*` |

Two algorithms fall out:
- **Policy Iteration** (Lecture 5) — walk through policy space: `π₀ → π₁ → π₂ → … → π*`
- **Value Iteration** (Lecture 6) — walk through value space: `V₀ → V₁ → V₂ → … → V*`

(Linear Programming is the third algorithm she listed; it hasn't been covered yet. A one-paragraph preview is in Part 6 so you know where it fits.)

**Read in this order.** Part 1 rebuilds Lecture 4 from scratch — don't skip it even though you've seen the slides, because Lecture 5's main proof is *entirely* Lecture 4's two properties applied twice. Part 2 is the single table that organises everything; if you memorise one thing, memorise that.

---

# PART 1 — Lecture 4: the operator `Bπ`

## 1.1 The problem it solves

You know `Vπ = (I − γPπ)⁻¹Rπ`. So why do we need another method?

Because inverting an `n × n` matrix costs about `n³` operations and needs `n²` memory. For `n = 3`, fine. For a real MDP with a million states, the matrix has `10¹²` entries — you cannot even store it, let alone invert it. We need a method that never forms the inverse.

The trick: **turn the equation into a repeated update.**

## 1.2 Definition

> `Bπ : ℝⁿ → ℝⁿ` is the **Bellman backup operator for policy `π`**:
>
> ```
>  Bπ[V]  =  Rπ + γ Pπ V          for any V ∈ ℝⁿ
> ```

Componentwise:

```
 Bπ[V](s)  =  R(s, π(s))  +  γ  Σ  P_ss'(π(s)) · V(s')
                                s'∈S
```

**Read it as an instruction:** *"take one real step under `π`, collect the real reward, and then — instead of continuing — just look up your current guess `V` for wherever you landed."*

### The distinction that trips everyone up

| Symbol | What it is |
|---|---|
| `Vπ` | **the** value function of `π`. One specific, true vector. |
| `V` | **any** vector in `ℝⁿ`. A guess. Could be zeros, could be nonsense. |
| `Bπ[V]` | the result of improving that guess by one step. |

`Bπ` accepts garbage and returns slightly-less-garbage. That's the whole algorithm.

## 1.3 `Vπ` is the fixed point

The Bellman equation from Lecture 3 says `Vπ = Rπ + γPπVπ`. Look at the right-hand side — it *is* `Bπ` applied to `Vπ`. So:

```
 ┌──────────────────┐
 │  Bπ[Vπ]  =  Vπ   │
 └──────────────────┘
```

`Vπ` is the one vector that `Bπ` leaves alone. Everything else, it moves — and (as we'll prove) it moves it *toward* `Vπ`.

## 1.4 Property 1: Monotonicity

> ```
>  V₁ ≤ V₂   ⟹   Bπ[V₁] ≤ Bπ[V₂]          (componentwise)
> ```

**Proof.**
```
 Bπ[V₂] − Bπ[V₁] = (Rπ + γPπV₂) − (Rπ + γPπV₁) = γ Pπ (V₂ − V₁)
```
`Rπ` cancels. Now `V₂ − V₁ ≥ 0` by assumption, `γ ≥ 0`, and every entry of `Pπ` is a probability so `Pπ ≥ 0`. A non-negative matrix times a non-negative vector is non-negative. Hence `Bπ[V₂] − Bπ[V₁] ≥ 0`. ∎

**In words:** if you're more optimistic about the future everywhere, your backed-up estimate can only go up. Nothing about backing up can turn better news into worse news.

*This property looks trivial. It is the engine of the entire Policy Improvement Theorem in Lecture 5 — you will use it to chain an infinite sequence of inequalities.*

## 1.5 Property 2: Contraction

> ```
>  ‖ Bπ[V₁] − Bπ[V₂] ‖∞   ≤   γ ‖ V₁ − V₂ ‖∞
> ```
> where `‖x‖∞ = maxᵢ |xᵢ|` is the largest absolute entry.

**Lemma first** — for any stochastic matrix `P` (non-negative, rows sum to 1) and any vector `x`:

```
 |(P x)ᵢ| = | Σⱼ Pᵢⱼ xⱼ |  ≤  Σⱼ Pᵢⱼ |xⱼ|   ≤   Σⱼ Pᵢⱼ ‖x‖∞   =   ‖x‖∞ · Σⱼ Pᵢⱼ  =  ‖x‖∞
```
*(triangle inequality → bound each `|xⱼ|` by the maximum → rows sum to 1)*

So `‖Px‖∞ ≤ ‖x‖∞`. **A stochastic matrix never enlarges the max-norm.** This is worth remembering on its own; it shows up in four different proofs across these three lectures.

**Proof of contraction.**
```
 Bπ[V₁] − Bπ[V₂] = γ Pπ (V₁ − V₂)                      (Rπ cancels again)
 ‖Bπ[V₁] − Bπ[V₂]‖∞ = γ ‖Pπ(V₁ − V₂)‖∞ ≤ γ ‖V₁ − V₂‖∞
```
∎

**In words:** applying `Bπ` pulls any two vectors at least a factor `γ` closer together. `γ` is the *shrink factor*.

### Why contraction is the whole ballgame

Contraction gives you three things at once (this is the **Banach fixed-point theorem**):
1. A fixed point **exists**.
2. It is **unique** — so `Vπ` is well defined; there's no second candidate.
3. Iterating from **any** starting vector converges to it.

You get all of that for free from `γ < 1`. That's the real reason discounting is not just a modelling convenience.

## 1.6 The algorithm: iterative policy evaluation

```
 V₀ ∈ ℝⁿ                     (anything — zeros are conventional)
 k ← 0
 Repeat
     V_{k+1} = Bπ[V_k]                 i.e.  V_{k+1} = Rπ + γ Pπ V_k
     k ← k + 1
 Until V_k = V_{k−1}
 Return V_k
```

```
 V₀ ──Bπ──► V₁ ──Bπ──► V₂ ──Bπ──► … ──► Vπ
```

## 1.7 Convergence, with the rate

Using `Bπ[Vπ] = Vπ` and contraction repeatedly:

```
 ‖Vπ − V₁‖∞ = ‖Bπ[Vπ] − Bπ[V₀]‖∞ ≤ γ  ‖Vπ − V₀‖∞
 ‖Vπ − V₂‖∞ = ‖Bπ[Vπ] − Bπ[V₁]‖∞ ≤ γ  ‖Vπ − V₁‖∞ ≤ γ² ‖Vπ − V₀‖∞
   ⋮
 ‖Vπ − V_k‖∞ ≤ γᵏ ‖Vπ − V₀‖∞          →  0
```

So `Vπ = lim_{k→∞} Bπᵏ[V]` for **any** `V ∈ ℝⁿ`.

**Rate:** the error shrinks by a factor `γ` per sweep. With `γ = 0.9`, `0.9²² ≈ 0.1`, so you gain roughly one decimal digit every 22 sweeps. Big `γ` ⟹ slow. This is exactly why Value Iteration in Lecture 6 will need dozens of sweeps while Policy Iteration needs three.

---

# PART 2 — The five one-step backups (memorise this)

Lecture 6 slide 4 lists four of these; adding `B` makes five. **This table is the organising idea of the entire unit.** Every formula in Lectures 5 and 6 is one of these five.

Every one has the same shape: `immediate reward + γ × (average of something over next states)`. They differ on exactly two questions.

> **Question 1 — where does the first action come from?**
> forced by `π` · freely chosen as `a` · maximised over all `a`
>
> **Question 2 — what value do you back up onto?**
> the *true* `Vπ` · an *arbitrary* guess `V`

That's a 3 × 2 grid, and five of the six cells have names:

| | back up onto **true `Vπ`** | back up onto **any `V`** |
|---|---|---|
| **first action forced by `π`** | `Vπ(s)` | `Bπ[V](s)` |
| **first action is a free `a`** | `Qπ(s,a)` | `QV(s,a)` |
| **first action maximised** | *(= `V*` when `π` optimal)* | `B[V](s)` |

Written out:

```
 Vπ(s)     =  R(s, π(s))  +  γ Σ_s' P_ss'(π(s)) · Vπ(s')       true value, self-consistent
 Qπ(s,a)   =  R(s, a)     +  γ Σ_s' P_ss'(a)    · Vπ(s')       take a once, then follow π
 Bπ[V](s)  =  R(s, π(s))  +  γ Σ_s' P_ss'(π(s)) · V(s')        one sweep of "follow π"
 QV(s,a)   =  R(s, a)     +  γ Σ_s' P_ss'(a)    · V(s')        take a once, then trust V
 B[V](s)   = max_a { R(s,a) + γ Σ_s' P_ss'(a)   · V(s') }      one sweep of "act greedily"
```

### The relations between them — these are exam gold

```
 Qπ(s, π(s))  =  Vπ(s)              following π IS choosing a = π(s)
 Bπ[V](s)     =  QV(s, π(s))        Bπ is QV with the action forced
 B[V](s)      =  max_a QV(s,a)      B is QV with the action maximised
 B[V]         ≥  Bπ[V]   ∀π         a max is ≥ any particular choice
 Bπ[Vπ]       =  Vπ                 fixed point of Bπ
 B[V*]        =  V*                 fixed point of B (Bellman optimality)
```

> **The trap.** `B[V] = B_{πgreedy[V]}[V]`, but `B[V] ≠ V^{πgreedy[V]}`.
> One sweep of greedy backup is not the same as *committing* to the greedy policy forever and computing its value. `B[V]` looks ahead one step and then falls back on `V`; `V^{πgreedy[V]}` looks ahead forever. Confusing these two is the single most common error on this material.

---

# PART 3 — Lecture 5: Q-values and Policy Iteration

## 3.1 Q-values

> `Qπ(s,a)` is the expected discounted sum of rewards when you start at `s`, **take action `a` this once** (even if `π` wouldn't have), and follow `π` from then on.

```
              ┌  ∞                   │                                      ┐
 Qπ(s,a) = E  │  Σ  γᵗ R(S_t, A_t)   │ S₀ = s, A₀ = a, A_t = π(S_t) for t ≥ 1│
              └ t=0                  │                                      ┘
```

Splitting off the first step gives the computable form:

```
 ┌──────────────────────────────────────────────────────┐
 │  Qπ(s,a)  =  R(s,a)  +  γ  Σ  P_ss'(a) · Vπ(s')      │
 │                            s'∈S                      │
 └──────────────────────────────────────────────────────┘
```

**Why we want this.** `Vπ(s)` tells you *how good `π` is*. It doesn't tell you *whether `π` picked the right action at `s`*. `Qπ(s,a)` does — it lets you price each alternative action against the same yardstick `Vπ`, and pick the winner.

**Shape:** `Qπ` is `|S| × |A|` — one number per (state, action) pair. Note `Qπ(s, π(s)) = Vπ(s)` always: the column that `π` actually chose reproduces `Vπ`.

**Computing it by hand** is one line per (state, action) pair. This is the main mechanical skill of Lecture 5, so here it is spelled out on the Robot MDP with `Vπ = [1, 1]`, `γ = 0.9`:

```
 Q(H, search) = R(H,s) + 0.9 [ P_HH(s)·V(H) + P_HL(s)·V(L) ]
              = 1      + 0.9 [ 0.8 · 1      + 0.2 · 1      ]
              = 1      + 0.9 (1)
              = 1.9
```

Do that once per row of the big `P` matrix. That's all "policy improvement" is.

## 3.2 The Policy Iteration algorithm

```
 Let π₀ be an arbitrary policy
 k ← 0
 Repeat
     π ← π_k

     POLICY EVALUATION:   compute Vπ
                          (matrix inverse, or iterate Bπ)

     POLICY IMPROVEMENT:  compute Qπ(s,a) for every s, a
                          π'(s) ∈ argmax_{a∈A} Qπ(s,a),   ∀s ∈ S

     π_{k+1} ← π'
     k ← k + 1
 Until V^{π_k} = V^{π_{k−1}}          (equivalently: the policy stops changing)
 Return π_k
```

Two phases alternating:

```
 π₀ ──eval──► Vπ⁰ ──improve──► π₁ ──eval──► Vπ¹ ──improve──► π₂ ──► … ──► π*
```

and the values are guaranteed non-decreasing all the way:

```
 Vπ⁰  ≤  Vπ¹  ≤  Vπ²  ≤  …  ≤  V*
```

**Important detail on the argmax:** if two actions tie, pick either — but if the *incumbent* action `π(s)` is among the winners, keep it. Otherwise you can cycle forever between two equally-good policies and the termination test never fires.

## 3.3 The Policy Improvement Theorem

This is the theorem that makes the algorithm correct. It says: *the greedy policy is genuinely better, not just better-looking.*

> **Theorem.** If `π'(s) ∈ argmax_a Qπ(s,a)` for every `s`, then `Vπ' ≥ Vπ`.

The proof has two halves. Half one is a one-line calculation; half two is Lecture 4's monotonicity applied infinitely many times.

### Half 1 — `Bπ'[Vπ] ≥ Vπ`

```
 Bπ'[Vπ](s)  =  R(s, π'(s)) + γ Σ_s' P_ss'(π'(s)) · Vπ(s')

             =  Qπ(s, π'(s))                    ← by definition of Qπ

             =  max_a Qπ(s, a)                  ← because π' was chosen greedily

             ≥  Qπ(s, π(s))                     ← a max is ≥ any particular entry

             =  Vπ(s)                           ← because Qπ(s,π(s)) = Vπ(s)
```

True for every `s`, so `Bπ'[Vπ] ≥ Vπ`. ∎

**What this actually says:** *"Deviate to `π'` for exactly one step, then revert to `π` forever. You are no worse off."* That's a modest claim — one step only.

### Half 2 — bootstrap that one step into forever

Start from `Vπ ≤ Bπ'[Vπ]` and hit both sides with `Bπ'` repeatedly. Each application preserves the inequality by **monotonicity of `Bπ'`** (Lecture 4):

```
 Vπ  ≤  Bπ'[Vπ]
     ≤  Bπ'[ Bπ'[Vπ] ]  =  B²π'[Vπ]              (monotonicity)
     ≤  B³π'[Vπ]                                  (monotonicity again)
     ≤  …
     ≤  lim_{k→∞} Bᵏπ'[Vπ]
     =  Vπ'                                       (convergence of Bπ', Lecture 4)
```

Hence `Vπ ≤ Vπ'`. ∎

> **The idea in one sentence:** deviating for one step doesn't hurt; therefore deviating for two steps doesn't hurt; therefore deviating forever doesn't hurt — and deviating forever *is* switching to `π'`.

Notice how little machinery this needs. Half 1 is bookkeeping. Half 2 is `Bπ'` being monotone plus `Bπ'` converging. That's why Lecture 4 comes first.

## 3.4 Why Policy Iteration terminates — and terminates *at the optimum*

**Terminates.** There are only finitely many deterministic policies (`mⁿ` of them). By the theorem, values never decrease. Once a policy is revisited its value would have to be both `≥` and `≤` its earlier value, so the sequence of *values* can never revisit a strictly-lower level — the algorithm must stop within `mⁿ` iterations. In practice it stops in a handful; you'll see 2 and 3 in the worked examples.

**Terminates at the optimum.** Suppose the algorithm stops, i.e. `π' = π`. Then for every `s`:

```
 Vπ(s) = Qπ(s, π(s)) = max_a Qπ(s,a) = max_a { R(s,a) + γ Σ_s' P_ss'(a) Vπ(s') }
```

That last line is precisely the **Bellman Optimality Equation** (Lecture 6). Since `V*` is the unique vector satisfying it, `Vπ = V*` and `π` is optimal. ∎

So the stopping condition isn't a heuristic — it *is* optimality.

## 3.5 `V*` exists (is finite)

> **Claim.** `|V*(s)| ≤ Rmax/(1 − γ)` for all `s`, where `Rmax = ‖R‖∞`.

**Proof** (this is Maam's hint — use the matrix definition, and it reuses HW1 Q5 directly):

Write `M = (I − γPπ)⁻¹`. From Lecture 3 we know

```
 M = Σ_{t=0}^∞ γᵗ (Pπ)ᵗ
```

Two facts about `M` follow immediately, both of which you proved in HW1:
1. **Every entry of `M` is `≥ 0`** — it's a sum of non-negative terms.
2. **Every row of `M` sums to `1/(1−γ)`** — this was HW1 Q5.

Now for any policy `π` and any state `s`:

```
 |Vπ(s)| = | Σⱼ M_sⱼ · Rπ(j) |
         ≤   Σⱼ M_sⱼ · |Rπ(j)|                (triangle inequality, M ≥ 0)
         ≤   Σⱼ M_sⱼ · Rmax                   (bound each reward by the max)
         =   Rmax · Σⱼ M_sⱼ
         =   Rmax / (1 − γ)                   (row sums, from HW1 Q5)
```

This bound holds for **every** policy, and `V*(s) = max_π Vπ(s)`, so `|V*(s)| ≤ Rmax/(1−γ)`. ∎

**Sanity check on our examples** (`γ = 0.9`, so the bound is `10 × Rmax`):

| MDP | `Rmax` | bound | actual `max\|V*\|` |
|---|---|---|---|
| Robot | 1 | 10 | 8.475 ✓ |
| HW1 | 2 | 20 | 11.743 ✓ |

Loose, but finite — and finiteness is the whole point. Without it, "the maximum over policies" might not be a real number.

## 3.6 `V*` is unique

Here's the worry. `Vπ` is a *vector*, and vectors only have a **partial** order. Two policies can be genuinely incomparable — `π₁` better at `s₁`, `π₂` better at `s₂`. If that happened between two "best" policies, there'd be no single `V*` and the whole theory collapses.

The theorem says it can't happen. And the proof is constructive and rather beautiful: **you can always stitch the good halves together.**

### Maam's concrete example

Suppose both `π₁` and `π₂` claim to be optimal:

```
 π₁ = [a₁, a₁]ᵀ ,   Vπ¹ = [10,  5]ᵀ
 π₂ = [a₂, a₂]ᵀ ,   Vπ² = [ 5, 10]ᵀ
```

Neither dominates. Now build a **stitched policy** — take each state's action from whichever policy is better *there*:

```
 π' = [a₁, a₂]ᵀ        (π₁'s action at s₁, π₂'s action at s₂)
 V  = [10, 10]ᵀ        (the componentwise max: V = max(Vπ¹, Vπ²))
```

**Step 1: show `Bπ'[V] ≥ V`.**

At `s₁`, where `π'` uses `π₁`'s action:
```
 Bπ'[V](s₁) = R(s₁, π₁(s₁)) + γ Σ_s' P_{s₁s'}(π₁(s₁)) · V(s')
            ≥ R(s₁, π₁(s₁)) + γ Σ_s' P_{s₁s'}(π₁(s₁)) · Vπ¹(s')      ← since V ≥ Vπ¹
            = Vπ¹(s₁)                                                 ← Bellman eq. for π₁
            = V(s₁)                                                   ← by construction of V
```
At `s₂` the identical argument runs with `π₂` and `Vπ²`. So `Bπ'[V] ≥ V`. ✓

**Step 2: bootstrap.** By monotonicity of `Bπ'`, exactly as in the Policy Improvement Theorem:
```
 V ≤ Bπ'[V] ≤ B²π'[V] ≤ … ≤ lim_k Bᵏπ'[V] = Vπ'
```
So `V ≤ Vπ'`.

**Step 3: contradiction.**
```
 Vπ¹ = [10, 5]ᵀ  ≤  V = [10,10]ᵀ  ≤  Vπ'
 Vπ² = [ 5,10]ᵀ  ≤  V = [10,10]ᵀ  ≤  Vπ'
```
So `π'` is at least as good as both — and *strictly* better than `π₁` at `s₂` and than `π₂` at `s₁`. Neither `π₁` nor `π₂` was maximising after all. **Contradiction.** ∎

### The general version

Same proof, no numbers. Given any two claimed-optimal `π₁, π₂`, define

```
 S₁ = { s : Vπ¹(s) ≥ Vπ²(s) }         S₂ = S − S₁

 π'(s) = π₁(s) if s ∈ S₁ ,  π₂(s) if s ∈ S₂
 V(s)  = Vπ¹(s) if s ∈ S₁ ,  Vπ²(s) if s ∈ S₂       (i.e. V = componentwise max)
```

Steps 1–3 go through verbatim. **Conclusion: any two optimal policies have the same value vector, so `V*` is unique** — and it's attained by an actual policy, not just approached.

> **Takeaway to carry forward:** value vectors are only partially ordered *in general*, but the maximum over policies is always attained by a single policy. That's the non-obvious fact that makes "the optimal policy" a meaningful phrase.

---

# PART 4 — Lecture 6: the Bellman Optimality Equation and Value Iteration

## 4.1 Greedy policy

> The **greedy policy with respect to `V`**:
> ```
>  πgreedy[V](s)  ∈  argmax_a  QV(s,a)  =  argmax_a { R(s,a) + γ Σ_s' P_ss'(a) V(s') }
> ```

It's a function *of a value vector*. Feed it any `V`, get back a policy: "at each state, pick whichever action looks best assuming `V` is right about the future."

Policy improvement in Lecture 5 is exactly `π' = πgreedy[Vπ]` — greedy with respect to the true value of the current policy.

## 4.2 The Bellman Optimality Equation

> ```
>  V*(s)  =  max_{a∈A} { R(s,a) + γ Σ_{s'∈S} P_ss'(a) · V*(s') } ,      ∀ s ∈ S
> ```
> and an optimal policy is greedy with respect to `V*`:
> ```
>  π*(s)  ∈  argmax_{a∈A} { R(s,a) + γ Σ_{s'∈S} P_ss'(a) · V*(s') }
> ```

**Compare with the policy Bellman equation:**

```
 Vπ(s) = R(s, π(s)) + γ Σ P_ss'(π(s)) Vπ(s')       ← linear:     n linear equations
 V*(s) = max_a { R(s,a) + γ Σ P_ss'(a) V*(s') }    ← NON-linear: because of the max
```

**That one `max` changes everything.** You can no longer write `V* = (I − γP)⁻¹R` and solve it — there's no single `P` to use, since which row you'd pick depends on `V*`, which is what you're solving for. Chicken and egg. Both Policy Iteration and Value Iteration are ways to break that circularity:

- **PI** breaks it by *guessing* the max (fix a policy) → solve the now-linear system → re-guess.
- **VI** breaks it by *iterating* rather than solving.

**Reading the equation in words:** the value of a state under optimal play is the value of the best single action available there, assuming you play optimally afterwards. This is **Bellman's principle of optimality**.

## 4.3 The operator `B`

> ```
>  B[V](s)  =  max_{a∈A} { R(s,a) + γ Σ_{s'∈S} P_ss'(a) · V(s') }  =  max_a QV(s,a)
> ```

The Bellman Optimality Equation is then just `B[V*] = V*` — **`V*` is the fixed point of `B`.**

Note `B` is exactly `Bπ` with "follow `π`" replaced by "take the best action". And since a max is at least any particular element:

```
 B[V] ≥ Bπ[V]     for every policy π,     with equality iff π is greedy w.r.t. V
```

## 4.4 Property 1: `B` is monotone

> `V₁ ≤ V₂ ⟹ B[V₁] ≤ B[V₂]`

**Proof.** Fix any `s` and any action `a`. Since `P_ss'(a) ≥ 0` and `γ ≥ 0`:
```
 QV¹(s,a) = R(s,a) + γΣ P_ss'(a) V₁(s')  ≤  R(s,a) + γΣ P_ss'(a) V₂(s') = QV²(s,a)
```
So `QV¹(s,·) ≤ QV²(s,·)` for every action. Taking the max over `a` of both sides preserves `≤`:
```
 B[V₁](s) = max_a QV¹(s,a) ≤ max_a QV²(s,a) = B[V₂](s)
```
∎

*(Key step: if `f(a) ≤ g(a)` for every `a`, then `max f ≤ max g`. Take `a*` maximising `f`; then `max f = f(a*) ≤ g(a*) ≤ max g`.)*

## 4.5 Property 2: `B` is a contraction

> `‖B[V₁] − B[V₂]‖∞ ≤ γ ‖V₁ − V₂‖∞`

This one needs a small lemma, because `B` has a `max` in it and `max` is not linear — the `Rπ` cancellation trick from Lecture 4 doesn't directly apply.

### The max lemma

> For any two functions `f, g` on a finite set:
> ```
>  | max_a f(a)  −  max_a g(a) |   ≤   max_a | f(a) − g(a) |
> ```

**Proof.** Let `a*` maximise `f`. Then
```
 max_a f(a) − max_a g(a)  =  f(a*) − max_a g(a)
                          ≤  f(a*) − g(a*)              ← since max_a g(a) ≥ g(a*)
                          ≤  max_a |f(a) − g(a)|
```
Swapping the roles of `f` and `g` bounds the other direction the same way. Taking absolute values gives the lemma. ∎

*(Plain-English version: two maxima can't differ by more than the largest gap between the functions anywhere.)*

### Proof of contraction

For any state `s`:
```
 |B[V₁](s) − B[V₂](s)|  =  | max_a QV¹(s,a) − max_a QV²(s,a) |

                        ≤   max_a | QV¹(s,a) − QV²(s,a) |               ← max lemma

                        =   max_a | γ Σ_s' P_ss'(a) [V₁(s') − V₂(s')] |

                        ≤   max_a  γ Σ_s' P_ss'(a) · |V₁(s') − V₂(s')|  ← triangle ineq.

                        ≤   max_a  γ Σ_s' P_ss'(a) · ‖V₁ − V₂‖∞

                        =   γ ‖V₁ − V₂‖∞                                ← rows sum to 1
```
True for every `s`, so take the max over `s`. ∎

**Consequence** (Banach again): `B` has a **unique** fixed point, and iterating `B` from any starting vector converges to it. The fixed point is `V*`. This is a *second, independent* proof that `V*` is unique — Lecture 5's stitching argument and Lecture 6's contraction argument reach the same conclusion by different routes.

## 4.6 Value Iteration

```
 Let V₀ ∈ ℝⁿ be arbitrary
 k ← 0
 Repeat
     V_{k+1}(s) = B[V_k](s) = max_a { R(s,a) + γ Σ_s' P_ss'(a) V_k(s') } ,  ∀s ∈ S
     k ← k + 1
 Until V_k = V_{k−1}
 Return V_k
```

```
 V₀ ──B──► V₁ ──B──► V₂ ──B──► V₃ ──► … ──► V*
```

Then recover the policy at the end: `π* = πgreedy[V*]`.

> **VI never stores a policy while it runs.** It works purely with value vectors and only extracts a policy once, at the end. That's the cleanest way to remember how it differs from PI.

### The intuition: `V_k` is the optimal `k`-steps-to-go value

Start from `V₀ = 0`. Then:
- `V₁(s) = max_a R(s,a)` — the best you can do with **one** action remaining.
- `V₂(s)` — the best over **two** steps.
- `V_k(s)` — the best achievable expected discounted reward in **`k`** steps from `s`.

So value iteration is literally *"plan one step ahead, then two, then three…"*, and the infinite-horizon answer is the limit. This also explains why `V_k` climbs from below when `V₀ = 0` and all rewards are positive: you're accounting for more and more of the future each sweep.

### Cost per sweep

One sweep touches every `(s,a)` pair once: `O(n·m·n)` in the worst case, or `O(n·m·d)` where `d` is the average number of reachable next states. **No matrix inverse anywhere.** That's the trade: cheap sweeps, but you need many of them.

## 4.7 Stopping criterion in practice

`V_k = V_{k−1}` exactly will essentially never happen in floating point, and in theory VI converges only in the limit. So:

```
 Input: ε > 0
 Let V₀ ∈ ℝⁿ be arbitrary
 k ← 0
 Repeat
     V_{k+1}(s) = B[V_k](s) ,  ∀s ∈ S
     k ← k + 1
 Until ‖V_k − V_{k−1}‖∞ ≤ ε
 Return V_k
```

We stop when a whole sweep moves the values by less than `ε` anywhere.

## 4.8 How far are we from `V*`? (Maam's "to do" — prove this)

> **Claim.** If we stop when `‖V_k − V_{k−1}‖∞ ≤ ε`, then
> ```
>  ‖V* − V_k‖∞   ≤   ε γ / (1 − γ)
> ```

**Proof.** Use two facts: `V* = B[V*]` (fixed point) and `V_k = B[V_{k−1}]` (the update rule).

```
 ‖V* − V_k‖∞  =  ‖B[V*] − B[V_{k−1}]‖∞

              ≤  γ ‖V* − V_{k−1}‖∞                                    ← contraction

              ≤  γ ( ‖V* − V_k‖∞ + ‖V_k − V_{k−1}‖∞ )                 ← triangle inequality

              ≤  γ ‖V* − V_k‖∞  +  γ ε                                ← stopping condition
```

Collect the `‖V* − V_k‖∞` terms on the left:

```
 (1 − γ) ‖V* − V_k‖∞  ≤  γ ε

 ┌────────────────────────────────┐
 │  ‖V* − V_k‖∞  ≤   γ ε /(1 − γ) │
 └────────────────────────────────┘
```
∎

**How to use it.** Turn it around: to guarantee accuracy `δ`, run until

```
 ε  ≤  δ (1 − γ) / γ
```

**Worked example** (`γ = 0.9`): to be within `δ = 0.01` of `V*`, you need `ε ≤ 0.01 × 0.1/0.9 ≈ 0.0011`. So the *observed* sweep-to-sweep change must be roughly **9× smaller** than the accuracy you actually want. The naive assumption "small change ⟹ close to the answer" understates the error by a factor of `γ/(1−γ) = 9`.

**This bound is tight.** On the HW1 MDP with `γ = 0.9`, the actual error equals `γε/(1−γ)` to five decimals from iteration 8 onwards — see the worked example in Part 6. It's not a loose worst-case estimate; it's what actually happens.

> **Bonus result** (not in the slides, but standard and sometimes asked): if `π` is greedy w.r.t. `V_k`, its *actual* value satisfies
> ```
>  ‖V* − Vπ‖∞  ≤  2γ ‖V* − V_k‖∞ / (1 − γ)
> ```
> Loss in the *policy* is bounded by loss in the *values*, with another `γ/(1−γ)` blow-up. In practice VI usually finds the optimal *policy* far earlier than the optimal *values* — you'll see this vividly in Part 6.

---

# PART 5 — Policy Iteration vs Value Iteration

| | **Policy Iteration** | **Value Iteration** |
|---|---|---|
| Iterates over | policies `π₀, π₁, …` | value vectors `V₀, V₁, …` |
| Per iteration | evaluate (solve `n × n` system) **+** improve | one sweep of `B` |
| Cost per iteration | `O(n³ + n²m)` — expensive | `O(n²m)` — cheap |
| Iterations needed | very few (2–3 typical; `≤ mⁿ` guaranteed) | many; `γ`-dependent, infinite in theory |
| Terminates exactly? | **Yes**, in finite steps | **No** — only `ε`-close |
| Intermediate `V` | is a real policy's value `V^{π_k}` | generally *not* any policy's value |
| Monotone? | `Vπ⁰ ≤ Vπ¹ ≤ …` guaranteed | not in general (depends on `V₀`) |
| Stopping test | policy stops changing | `‖V_k − V_{k−1}‖∞ ≤ ε` |
| Output | `π*` directly | `V*`; extract `π* = πgreedy[V*]` |

**How to choose.** Small `n` → Policy Iteration, because the exact solve is affordable and you converge in a handful of iterations. Huge `n` → Value Iteration, because you can't invert anything. In between → **Modified Policy Iteration**: run PI, but do the evaluation step approximately with a few sweeps of `Bπ` instead of an exact solve. VI is the extreme case of exactly one sweep.

**Both are grounded in the same two properties** — monotonicity and contraction — applied to `Bπ` and `B` respectively. That's the unifying takeaway of Lectures 4–6.

### Preview: Linear Programming (the third algorithm, not yet covered)

For completeness, since Maam listed three. `V*` can also be found by solving

```
 minimise   Σ_s V(s)
 subject to V(s) ≥ R(s,a) + γ Σ_s' P_ss'(a) V(s')      for every s ∈ S, a ∈ A
```

`n` variables, `n·m` constraints. Any feasible `V` is an upper bound on `V*`; minimising pushes it down until it hits `V*` exactly. Expect this in a later lecture — don't worry about it now.

---

# PART 6 — Fully worked examples

## 6.1 Robot MDP — Policy Iteration

Recall (`γ = 0.9`, states `H`, `L`):

```
                        s'=H   s'=L                    R
          (H, search)  ┌ 0.8    0.2 ┐            ┌   1    ┐
          (H, wait)    │ 1.0    0.0 │            │  0.1   │
     P =  (L, search)  │ 0.3    0.7 │       R =  │ −0.2   │
          (L, wait)    │ 0.0    1.0 │            │  0.1   │
          (L, recharge)└ 1.0    0.0 ┘            └   0    ┘
```

### Iteration 0 — `π₀ = (wait, wait)`

**Evaluate:** `Vπ⁰ = [1, 1]ᵀ` (computed in the Lectures 1–4 guide).

**Improve:** compute `Qπ⁰(s,a) = R(s,a) + 0.9 [P_sH(a)·1 + P_sL(a)·1]` for all five rows.

```
 Q(H, search)   = 1    + 0.9[0.8(1) + 0.2(1)] = 1    + 0.9(1.0) = 1.9    ← max
 Q(H, wait)     = 0.1  + 0.9[1.0(1) + 0.0(1)] = 0.1  + 0.9(1.0) = 1.0

 Q(L, search)   = −0.2 + 0.9[0.3(1) + 0.7(1)] = −0.2 + 0.9(1.0) = 0.7
 Q(L, wait)     = 0.1  + 0.9[0.0(1) + 1.0(1)] = 0.1  + 0.9(1.0) = 1.0    ← max
 Q(L, recharge) = 0    + 0.9[1.0(1) + 0.0(1)] = 0    + 0.9(1.0) = 0.9
```

`π₁ = (search, wait)`. Changed at `H`.

### Iteration 1 — `π₁ = (search, wait)`

**Evaluate:** `Vπ¹ = [4.2143, 1]ᵀ` (this is Maam's `π₄`; slide says `[4.214, 1]` ✓).

**Improve:**
```
 Q(H, search)   = 1    + 0.9[0.8(4.2143) + 0.2(1)] = 1    + 0.9(3.5714) = 4.2143  ← max
 Q(H, wait)     = 0.1  + 0.9[4.2143]               = 0.1  + 3.7929      = 3.8929

 Q(L, search)   = −0.2 + 0.9[0.3(4.2143) + 0.7(1)] = −0.2 + 0.9(1.9643) = 1.5679
 Q(L, wait)     = 0.1  + 0.9[1]                    = 0.1  + 0.9         = 1.0000
 Q(L, recharge) = 0    + 0.9[4.2143]               = 3.7929                        ← max
```

`π₂ = (search, recharge)`. Changed at `L`.

*Note `Q(H, search) = 4.2143 = Vπ¹(H)` exactly — the incumbent action always reproduces its own value. Free arithmetic check on every iteration.*

### Iteration 2 — `π₂ = (search, recharge)`

**Evaluate:** `Vπ² = [8.4746, 7.6271]ᵀ`.

**Improve:**
```
 Q(H, search)   = 1    + 0.9[0.8(8.4746) + 0.2(7.6271)] = 1 + 0.9(8.3051) = 8.4746  ← max
 Q(H, wait)     = 0.1  + 0.9[8.4746]                     = 7.7271

 Q(L, search)   = −0.2 + 0.9[0.3(8.4746) + 0.7(7.6271)] = −0.2 + 0.9(7.8814) = 6.8932
 Q(L, wait)     = 0.1  + 0.9[7.6271]                     = 6.9644
 Q(L, recharge) = 0    + 0.9[8.4746]                     = 7.6271                    ← max
```

**Policy unchanged** → stop.

```
 π* = (search, recharge) ,     V* = [8.4746, 7.6271]ᵀ
```

✓ Matches Maam's Lecture 2 slide, where `π₂` was circled as optimal.

**Bellman optimality check:** `Q*(H, search) = 8.4746 = V*(H)` and `Q*(L, recharge) = 7.6271 = V*(L)`. Both states satisfy `V*(s) = max_a Q*(s,a)`. ✓

**Summary trace:**

| k | `π_k` | `V^{π_k}` |
|---|---|---|
| 0 | (wait, wait) | [1.0000, 1.0000] |
| 1 | (search, wait) | [4.2143, 1.0000] |
| 2 | (search, recharge) | [8.4746, 7.6271] |
| 3 | *stable* | — |

Three evaluations. Values increased at every step, as the theorem promised.

---

## 6.2 Robot MDP — Value Iteration

```
 B[V](H) = max{ 1    + 0.9(0.8 V_H + 0.2 V_L) ,   0.1 + 0.9 V_H }
 B[V](L) = max{ −0.2 + 0.9(0.3 V_H + 0.7 V_L) ,   0.1 + 0.9 V_L ,   0 + 0.9 V_H }
```

**`V₀ = [0, 0]ᵀ`**

```
 V₁(H) = max{ 1 + 0,  0.1 + 0 }                = max{ 1, 0.1 }              = 1     [search]
 V₁(L) = max{ −0.2 + 0,  0.1 + 0,  0 }         = max{ −0.2, 0.1, 0 }        = 0.1   [wait]
```
`V₁ = [1, 0.1]ᵀ`

```
 V₂(H) = max{ 1 + 0.9(0.8·1 + 0.2·0.1),  0.1 + 0.9·1 }
       = max{ 1 + 0.9(0.82),  1.0 } = max{ 1.738, 1.0 }                     = 1.738 [search]

 V₂(L) = max{ −0.2 + 0.9(0.3·1 + 0.7·0.1),  0.1 + 0.9(0.1),  0.9(1) }
       = max{ −0.2 + 0.9(0.37),  0.19,  0.9 } = max{ 0.133, 0.19, 0.9 }     = 0.9   [recharge]
```
`V₂ = [1.738, 0.9]ᵀ`

```
 V₃(H) = max{ 1 + 0.9(0.8·1.738 + 0.2·0.9),  0.1 + 0.9(1.738) }
       = max{ 1 + 0.9(1.5704),  1.6642 } = max{ 2.4134, 1.6642 }            = 2.4134

 V₃(L) = max{ −0.2 + 0.9(0.3·1.738 + 0.7·0.9),  0.1 + 0.9(0.9),  0.9(1.738) }
       = max{ 0.8363,  0.91,  1.5642 }                                      = 1.5642
```
`V₃ = [2.4134, 1.5642]ᵀ`

**Continuing:**

| k | `V_k(H)` | `V_k(L)` | greedy policy | `‖V_k − V_{k−1}‖∞` |
|---|---|---|---|---|
| 0 | 0 | 0 | — | — |
| 1 | 1.0000 | 0.1000 | (search, wait) | 1.0000 |
| 2 | 1.7380 | 0.9000 | (search, recharge) | 0.8000 |
| 3 | 2.4134 | 1.5642 | (search, recharge) | 0.6754 |
| 5 | 3.5648 | 2.7173 | (search, recharge) | 0.5456 |
| 10 | 5.5754 | 4.7279 | (search, recharge) | 0.3221 |
| 43 | 8.3850 | 7.5375 | (search, recharge) | 0.0100 |
| ∞ | **8.4746** | **7.6271** | (search, recharge) | 0 |

**Two things to notice, and they're the point of this example:**

1. **The optimal policy appears at `k = 2`** and never changes — but the *values* are still wrong by 6.7 at that point, and it takes **43 sweeps** to get `ε` down to 0.01. Policy convergence is much faster than value convergence.
2. **Compare with Policy Iteration: 3 iterations vs 43 sweeps.** That's the trade-off in the table in Part 5, made concrete. PI's iterations cost more each, but there are dramatically fewer of them.

**Error bound check at `k = 43`:** `ε = 0.00995`, so the bound gives `‖V* − V₄₃‖∞ ≤ 0.9(0.00995)/0.1 = 0.0896`. Actual error: `8.4746 − 8.3850 = 0.0896`. **Exactly the bound** — see the note in §4.8 about tightness.

---

## 6.3 HW1 MDP — all 8 policies, and a surprise

Your homework MDP (`γ = 0.9`):

```
 (s₁,a₁): 0.9→s₁, 0.1→s₂,  R = 1        (s₁,a₂): 1.0→s₁,  R =  1
 (s₂,a₁): 0.9→s₂, 0.1→s₃,  R = 1        (s₂,a₂): 1.0→s₁,  R =  2
 (s₃,a₁): 0.9→s₃, 0.1→s₁,  R = 1        (s₃,a₂): 1.0→s₁,  R = −1
```

All eight deterministic policies, evaluated:

| `π` | `Vπ(s₁)` | `Vπ(s₂)` | `Vπ(s₃)` |
|---|---|---|---|
| (a₁,a₁,a₁) | 10.0000 | 10.0000 | 10.0000 |
| (a₁,a₁,a₂) | 9.4377 | 8.8129 | 7.4939 |
| **(a₁,a₂,a₁)** | **10.8257** | **11.7431** | **10.3911** |
| (a₁,a₂,a₂) | 10.8257 | 11.7431 | 8.7431 |
| (a₂,a₁,a₁) | 10.0000 | 10.0000 | 10.0000 |
| (a₂,a₁,a₂) | 10.0000 | 9.0526 | 8.0000 |
| (a₂,a₂,a₁) | 10.0000 | 11.0000 | 10.0000 |
| (a₂,a₂,a₂) | 10.0000 | 11.0000 | 8.0000 |

> **The surprise:** the policy from your homework, `(a₂,a₂,a₂)` with `Vπ = [10, 11, 8]`, is **not** optimal. The optimal policy is **`π* = (a₁, a₂, a₁)`** with
> ```
>  V* = [10.8257, 11.7431, 10.3911]ᵀ
> ```
> It beats `(a₂,a₂,a₂)` in **every** state. Notice also that `π*` mixes actions — no single action is right everywhere. And notice `(a₁,a₂,a₁)` dominates all seven others componentwise, exactly as the uniqueness theorem in §3.6 guarantees it must.

*Why does `a₂` win at `s₂` but lose at `s₁` and `s₃`? At `s₂`, `a₂` pays a `+2` bonus for jumping to `s₁` — worth the move. At `s₃`, `a₂` costs `−1` to make the same jump, and `s₃` isn't bad enough to justify paying that. At `s₁`, `a₁` and `a₂` pay the same reward, but `a₁` gives a `0.1` chance of drifting to `s₂` — the most valuable state — so `a₁` edges it.*

## 6.4 HW1 MDP — Policy Iteration

Start from the homework policy `π₀ = (a₂, a₂, a₂)`, so you can reuse work you've already done.

### Iteration 0 — `π₀ = (a₂,a₂,a₂)`, `Vπ⁰ = [10, 11, 8]ᵀ`

```
 Q(s₁,a₁) = 1  + 0.9[0.9(10) + 0.1(11) + 0(8)] = 1  + 0.9(10.1) = 10.09   ← max
 Q(s₁,a₂) = 1  + 0.9[1.0(10)]                  = 1  + 9         = 10.00

 Q(s₂,a₁) = 1  + 0.9[0(10) + 0.9(11) + 0.1(8)] = 1  + 0.9(10.7) = 10.63
 Q(s₂,a₂) = 2  + 0.9[1.0(10)]                  = 2  + 9         = 11.00   ← max

 Q(s₃,a₁) = 1  + 0.9[0.1(10) + 0(11) + 0.9(8)] = 1  + 0.9(8.2)  =  8.38   ← max
 Q(s₃,a₂) = −1 + 0.9[1.0(10)]                  = −1 + 9         =  8.00
```

`π₁ = (a₁, a₂, a₁)`. Changed at `s₁` and `s₃`.

### Iteration 1 — `π₁ = (a₁, a₂, a₁)`

**Evaluate.** Select rows `(s₁,a₁)`, `(s₂,a₂)`, `(s₃,a₁)`:

```
         s₁    s₂    s₃                 ┌ 1 ┐
    s₁ ┌ 0.9  0.1   0   ┐         Rπ =  │ 2 │
Pπ= s₂ │ 1.0  0     0   │               └ 1 ┘
    s₃ └ 0.1  0     0.9 ┘
```

Recursive equations:
```
 V₁ = 1 + 0.9(0.9 V₁ + 0.1 V₂)  =  1 + 0.81 V₁ + 0.09 V₂
 V₂ = 2 + 0.9 V₁
 V₃ = 1 + 0.9(0.1 V₁ + 0.9 V₃)  =  1 + 0.09 V₁ + 0.81 V₃
```

Substitute `V₂` into the first:
```
 V₁ = 1 + 0.81 V₁ + 0.09(2 + 0.9 V₁)
    = 1 + 0.81 V₁ + 0.18 + 0.081 V₁
    = 1.18 + 0.891 V₁

 0.109 V₁ = 1.18   ⟹   V₁ = 1.18/0.109 = 10.8257
```
Then
```
 V₂ = 2 + 0.9(10.8257) = 11.7431
 0.19 V₃ = 1 + 0.09(10.8257) = 1.9743   ⟹   V₃ = 10.3911
```

**Improve.**
```
 Q(s₁,a₁) = 1  + 0.9[0.9(10.8257) + 0.1(11.7431)] = 1 + 0.9(10.9174) = 10.8257  ← max
 Q(s₁,a₂) = 1  + 0.9(10.8257)                      = 10.7431

 Q(s₂,a₁) = 1  + 0.9[0.9(11.7431) + 0.1(10.3911)] = 1 + 0.9(11.6079) = 11.4471
 Q(s₂,a₂) = 2  + 0.9(10.8257)                      = 11.7431                     ← max

 Q(s₃,a₁) = 1  + 0.9[0.1(10.8257) + 0.9(10.3911)] = 1 + 0.9(10.4346) = 10.3911  ← max
 Q(s₃,a₂) = −1 + 0.9(10.8257)                      = 8.7431
```

**Policy unchanged** → stop. `π* = (a₁, a₂, a₁)`, `V* = [10.8257, 11.7431, 10.3911]ᵀ`.

**Two iterations.** And note every `Q(s, π*(s))` equals `V*(s)` exactly — the Bellman optimality equation, satisfied. ✓

## 6.5 HW1 MDP — Value Iteration, and the tightness of the error bound

```
 B[V](s₁) = max{ 1  + 0.9(0.9V₁ + 0.1V₂) ,   1  + 0.9V₁ }
 B[V](s₂) = max{ 1  + 0.9(0.9V₂ + 0.1V₃) ,   2  + 0.9V₁ }
 B[V](s₃) = max{ 1  + 0.9(0.1V₁ + 0.9V₃) ,  −1  + 0.9V₁ }
```

**`V₀ = [0,0,0]ᵀ`**

```
 V₁(s₁) = max{1, 1}   = 1     (tie — both actions pay 1)
 V₁(s₂) = max{1, 2}   = 2     [a₂]
 V₁(s₃) = max{1, −1}  = 1     [a₁]
```
`V₁ = [1, 2, 1]ᵀ` — and this is just `max_a R(s,a)`, the best one-step reward. ✓

```
 V₂(s₁) = max{ 1 + 0.9(0.9·1 + 0.1·2),  1 + 0.9·1 } = max{ 1.99, 1.9 }  = 1.99  [a₁]
 V₂(s₂) = max{ 1 + 0.9(0.9·2 + 0.1·1),  2 + 0.9·1 } = max{ 2.71, 2.9 }  = 2.90  [a₂]
 V₂(s₃) = max{ 1 + 0.9(0.1·1 + 0.9·1), −1 + 0.9·1 } = max{ 1.90, −0.1 } = 1.90  [a₁]
```
`V₂ = [1.99, 2.90, 1.90]ᵀ`

**Full trace:**

| k | `V_k(s₁)` | `V_k(s₂)` | `V_k(s₃)` | greedy | `ε = ‖V_k−V_{k−1}‖∞` | bound `γε/(1−γ)` | **actual** `‖V*−V_k‖∞` |
|---|---|---|---|---|---|---|---|
| 1 | 1.0000 | 2.0000 | 1.0000 | (a₁,a₂,a₁) | 2.00000 | 18.0000 | 9.8257 |
| 2 | 1.9900 | 2.9000 | 1.9000 | (a₁,a₂,a₁) | 0.99000 | 8.9100 | 8.8431 |
| 3 | 2.8729 | 3.7910 | 2.7181 | (a₁,a₂,a₁) | 0.89100 | 8.0190 | 7.9528 |
| 5 | 4.3840 | 5.3014 | 4.1329 | (a₁,a₂,a₁) | 0.71581 | 6.4423 | 6.4417 |
| 8 | 6.1297 | 7.0471 | 5.7926 | (a₁,a₂,a₁) | 0.52178 | 4.6960 | **4.6960** |
| 10 | — | — | — | (a₁,a₂,a₁) | 0.42264 | 3.8038 | **3.8038** |
| 15 | — | — | — | (a₁,a₂,a₁) | 0.24957 | 2.2461 | **2.2461** |
| 25 | — | — | — | (a₁,a₂,a₁) | 0.08702 | 0.7832 | **0.7832** |
| ∞ | 10.8257 | 11.7431 | 10.3911 | (a₁,a₂,a₁) | 0 | 0 | 0 |

**Three lessons, all visible in this one table:**

1. **The greedy policy is optimal from sweep 1** — before the values are anywhere near right. VI finds the *policy* almost immediately and then spends dozens of sweeps polishing *numbers*.
2. **The error bound becomes an equality** from about `k = 5` onward. `γε/(1−γ)` is not a pessimistic estimate here — it's exactly the error. So take it seriously when choosing `ε`.
3. **`ε` badly understates the true error.** At `k = 25` a sweep moves values by only `0.087`, but you're still `0.78` away from `V*` — nine times worse than the sweep size suggests. That factor of nine is `γ/(1−γ)`.

---

# PART 7 — Practice problems

Cover the answers first.

### P1. Compute `Qπ` on the Robot MDP

Given `π = (search, search)` with `Vπ = [6.073, 3.891]ᵀ` and `γ = 0.9`, compute all five `Qπ(s,a)` values and find the improved policy.

<details><summary>Answer</summary>

```
 Q(H,s)   = 1    + 0.9[0.8(6.073) + 0.2(3.891)] = 1    + 0.9(5.6366) = 6.0729  ← max
 Q(H,w)   = 0.1  + 0.9(6.073)                    = 0.1  + 5.4657      = 5.5657

 Q(L,s)   = −0.2 + 0.9[0.3(6.073) + 0.7(3.891)] = −0.2 + 0.9(4.5456) = 3.8910
 Q(L,w)   = 0.1  + 0.9(3.891)                    = 0.1  + 3.5019      = 3.6019
 Q(L,r)   = 0    + 0.9(6.073)                    = 5.4657                       ← max
```
Improved policy: `(search, recharge)` — which is `π*`. One improvement step from `π₆` lands directly on the optimum.

Note `Q(H,s) = 6.0729 ≈ Vπ(H)` and `Q(L,s) = 3.891 = Vπ(L)` — the incumbent actions reproduce their own values, as they must.
</details>

---

### P2. Prove the max lemma

Show `|max_a f(a) − max_a g(a)| ≤ max_a |f(a) − g(a)|`.

<details><summary>Answer</summary>

Let `a*` maximise `f`. Then `max_a f(a) − max_a g(a) = f(a*) − max_a g(a) ≤ f(a*) − g(a*) ≤ max_a |f(a) − g(a)|`, where the first inequality uses `max_a g(a) ≥ g(a*)`. Swap `f` and `g` for the other direction. Combining bounds the absolute value. ∎
</details>

---

### P3. Why does policy improvement give `Vπ' ≥ Vπ`, not just `Bπ'[Vπ] ≥ Vπ`?

<details><summary>Answer</summary>

`Bπ'[Vπ] ≥ Vπ` only says one step of `π'` then reverting to `π` is no worse. To get the full switch, apply `Bπ'` repeatedly, using **monotonicity** at each stage:

```
 Vπ ≤ Bπ'[Vπ] ≤ B²π'[Vπ] ≤ B³π'[Vπ] ≤ … ≤ lim_k Bᵏπ'[Vπ] = Vπ'
```

Each `≤` follows from applying the monotone `Bπ'` to the previous inequality; the final equality is convergence of `Bπ'` from any starting vector (contraction). ∎
</details>

---

### P4. Value iteration by hand

Run two sweeps of value iteration from `V₀ = [0,0]ᵀ` on this MDP (`γ = 0.5`):

```
 (s₁, a): 1.0 → s₂ ,  R = 4        (s₁, b): 1.0 → s₁ ,  R = 3
 (s₂, a): 1.0 → s₁ ,  R = 0        (s₂, b): 1.0 → s₂ ,  R = 1
```

<details><summary>Answer</summary>

```
 V₁(s₁) = max{ 4 + 0.5(0),  3 + 0.5(0) } = max{4, 3} = 4    [a]
 V₁(s₂) = max{ 0 + 0.5(0),  1 + 0.5(0) } = max{0, 1} = 1    [b]
 V₁ = [4, 1]ᵀ

 V₂(s₁) = max{ 4 + 0.5(1),  3 + 0.5(4) } = max{4.5, 5.0} = 5.0   [b]
 V₂(s₂) = max{ 0 + 0.5(4),  1 + 0.5(1) } = max{2.0, 1.5} = 2.0   [a]
 V₂ = [5, 2]ᵀ
```

Note the greedy policy **flipped at both states** between sweeps 1 and 2 — a good reminder that early greedy policies aren't reliable. (Continuing: `V* = [6, 3]ᵀ` with `π* = (a, a)` — the `s₁ → s₂ → s₁` cycle collecting 4 every other step beats sitting still.)
</details>

---

### P5. How many sweeps?

With `γ = 0.95`, you want `‖V* − V_k‖∞ ≤ 0.01`. What stopping threshold `ε` do you need?

<details><summary>Answer</summary>

From `‖V* − V_k‖∞ ≤ γε/(1−γ)`, set `γε/(1−γ) ≤ 0.01`:

```
 ε ≤ 0.01 (1 − γ)/γ = 0.01 (0.05)/0.95 = 0.000526
```

You must run until sweeps move values by less than about `5.3 × 10⁻⁴` — roughly **19× smaller** than the accuracy you actually want, since `γ/(1−γ) = 19`. With `γ = 0.99` the factor would be 99.
</details>

---

### P6. Conceptual short answers

<details><summary>Q: What's the difference between Bπ[V] and Vπ?</summary>
`Vπ` is the true value vector of `π` — a specific, fixed object satisfying `Bπ[Vπ] = Vπ`. `Bπ[V]` is what the operator returns when fed *any* vector `V`; it equals `Vπ` only when `V = Vπ`.
</details>

<details><summary>Q: Why is the Bellman Optimality Equation nonlinear, and why does that matter?</summary>
Because of the `max_a`. It matters because you can't solve it by matrix inversion — there's no single `Pπ` to invert, since which action's row you'd use depends on `V*`, the unknown. PI and VI are two ways round that circularity.
</details>

<details><summary>Q: Is B[V] = V^{πgreedy[V]}?</summary>
**No.** `B[V] = B_{πgreedy[V]}[V]` — one greedy backup on top of `V`. `V^{πgreedy[V]}` is the value of *committing* to that greedy policy forever, which requires infinitely many backups. They coincide only when `V` is already the fixed point.
</details>

<details><summary>Q: Why does PI terminate in finitely many steps but VI doesn't?</summary>
PI moves through the *finite* set of deterministic policies (`mⁿ` of them) with values never decreasing, so it must stop. VI moves through `ℝⁿ`, which is infinite; contraction gives geometric convergence but the fixed point is only reached in the limit.
</details>

<details><summary>Q: In PI, why must policy evaluation be exact?</summary>
Strictly, it doesn't have to be — approximating it with a few sweeps of `Bπ` gives *Modified Policy Iteration*, which still converges. But exact evaluation is what guarantees the clean monotone `Vπ⁰ ≤ Vπ¹ ≤ …` chain and finite termination. VI is the extreme case of exactly one sweep per improvement.
</details>

<details><summary>Q: Can two different policies both be optimal?</summary>
Yes — ties in the argmax give different optimal policies. But by §3.6 they must have the *same* value vector `V*`. The optimal *policy* need not be unique; the optimal *value vector* always is.
</details>

<details><summary>Q: Where exactly is γ &lt; 1 used?</summary>
Four places: (i) the geometric series `Σγᵗ = 1/(1−γ)` converges; (ii) `(I − γPπ)` is invertible; (iii) `Bπ` and `B` are contractions, giving unique fixed points and convergence from any `V₀`; (iv) `V*` is finite, bounded by `Rmax/(1−γ)`.
</details>

---

# PART 8 — Cheat sheet

```
FIVE BACKUPS  (all: immediate reward + γ × average over next states)

  Vπ(s)    = R(s,π(s)) + γ Σ P_ss'(π(s)) Vπ(s')     true value of π
  Qπ(s,a)  = R(s,a)    + γ Σ P_ss'(a)    Vπ(s')     take a once, then π
  Bπ[V](s) = R(s,π(s)) + γ Σ P_ss'(π(s)) V(s')      one sweep of "follow π"
  QV(s,a)  = R(s,a)    + γ Σ P_ss'(a)    V(s')      take a once, then trust V
  B[V](s)  = max_a { R(s,a) + γ Σ P_ss'(a) V(s') }  one sweep of "act greedily"

RELATIONS
  Qπ(s,π(s)) = Vπ(s)        Bπ[V](s) = QV(s,π(s))        B[V](s) = max_a QV(s,a)
  Bπ[Vπ] = Vπ               B[V*] = V*                    B[V] ≥ Bπ[V]  ∀π
  πgreedy[V](s) ∈ argmax_a QV(s,a)          B[V] = B_{πgreedy[V]}[V]  ≠  V^{πgreedy[V]}

PROPERTIES (hold for BOTH Bπ and B)
  monotone:     V₁ ≤ V₂  ⟹  B[V₁] ≤ B[V₂]
  contraction:  ‖B[V₁] − B[V₂]‖∞ ≤ γ‖V₁ − V₂‖∞
  ⟹ unique fixed point, convergence from any V₀, ‖fix − V_k‖∞ ≤ γᵏ‖fix − V₀‖∞

POLICY ITERATION                          VALUE ITERATION
  π₀ arbitrary                              V₀ arbitrary
  repeat:                                   repeat:
    eval:    Vπ = (I−γPπ)⁻¹Rπ                 V_{k+1} = B[V_k]
    improve: π'(s) ∈ argmax_a Qπ(s,a)       until ‖V_k − V_{k−1}‖∞ ≤ ε
  until π' = π                              π* = πgreedy[V*]
  guarantees Vπ⁰ ≤ Vπ¹ ≤ … ≤ V*             ‖V* − V_k‖∞ ≤ γε/(1−γ)
  finite termination (≤ mⁿ iterations)      geometric, never exact

BELLMAN OPTIMALITY EQUATION  (nonlinear — the max is why)
  V*(s) = max_a { R(s,a) + γ Σ_s' P_ss'(a) V*(s') }
  π*(s) ∈ argmax_a { R(s,a) + γ Σ_s' P_ss'(a) V*(s') }

KEY FACTS
  V* exists:  |V*(s)| ≤ Rmax/(1−γ)        [rows of (I−γPπ)⁻¹ are ≥0 and sum to 1/(1−γ)]
  V* unique:  stitch π₁ and π₂ on S₁, S₂ → Bπ'[V] ≥ V → V ≤ Vπ' → contradiction
  ‖Px‖∞ ≤ ‖x‖∞ for stochastic P           [the lemma behind every contraction proof]
  |max f − max g| ≤ max|f − g|            [the lemma that makes B a contraction]
  to get accuracy δ, stop at ε ≤ δ(1−γ)/γ

WORKED ANSWERS
  Robot MDP:  π* = (search, recharge),  V* = [8.4746, 7.6271]
              PI: 3 iterations.  VI: 43 sweeps to ε = 0.01.
  HW1 MDP:    π* = (a₁, a₂, a₁),        V* = [10.8257, 11.7431, 10.3911]
              PI: 2 iterations.  (a₂,a₂,a₂) from the homework is NOT optimal.
```

---

# Common traps

| Trap | Correct |
|---|---|
| `B[V] = V^{πgreedy[V]}` | `B[V] = B_{πgreedy[V]}[V]` — one backup, not the full value |
| Treating the Bellman optimality equation as linear | The `max` makes it nonlinear; no matrix inverse |
| `Qπ(s,a) = R(s,a) + γ Σ P_ss'(a) Qπ(s',a)` | Back up onto `Vπ(s')`, not `Qπ`. (The `Q`-form needs `max_a'` or `π(s')` inside.) |
| Using `Vπ` from the *previous* policy when improving | Improve using the value of the *current* policy — evaluate first, then improve |
| Concluding `V_k ≈ V*` because `ε` is small | Error is up to `γε/(1−γ)` — a factor `9` bigger at `γ = 0.9`, `19` at `γ = 0.95` |
| Assuming a policy that's best in one state is best overall | Optimality is componentwise; but §3.6 guarantees a single policy dominates everywhere |
| Flipping the argmax on a tie every iteration | Keep the incumbent action when it ties, or PI may never terminate |
| Forgetting to extract `π*` after VI | VI returns `V*`; you still need one greedy sweep to get `π*` |
| Assuming the "obvious" policy is optimal | The HW1 MDP is the counterexample — `(a₂,a₂,a₂)` loses to `(a₁,a₂,a₁)` everywhere |

---

# Reading

Sutton & Barto, Chapter 4 (Dynamic Programming) maps onto these lectures almost exactly:
- **4.1** Policy Evaluation → Lecture 4
- **4.2** Policy Improvement → Lecture 5 (the Policy Improvement Theorem is Section 4.2)
- **4.3** Policy Iteration → Lecture 5
- **4.4** Value Iteration → Lecture 6
- **4.6** Generalized Policy Iteration → the unifying view of both

Chapter 3.5–3.8 covers `Qπ`, `V*`, `Q*` and the Bellman Optimality Equation. Free at `incompleteideas.net/book/the-book.html`.
