/* ShrutiCalc – Calculus Calculator
   Plain JavaScript, no libraries.

   Sections
   1. Expression parser   (turns text like "x^2 + 3x" into a tree)
   2. Tree helpers        (build, simplify, print, evaluate)
   3. Differentiation     (symbolic rules)
   4. Integration         (symbolic table + Simpson's rule)
   5. Graph drawing       (canvas)
   6. Feature panels      (arithmetic, entropy, derivative, integral, limits, graphs)
   7. Page wiring         (tabs, buttons, chips)
*/
"use strict";

const $ = (id) => document.getElementById(id);

/* =========================================================
   1. EXPRESSION PARSER
   ========================================================= */
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  exp: Math.exp, ln: Math.log, log: Math.log10,
  sqrt: Math.sqrt, abs: Math.abs
};
const CONSTS = { pi: Math.PI, e: Math.E, inf: Infinity };

function tokenize(text) {
  const src = text
    .replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-")
    .replace(/π/g, "pi").replace(/∞/g, "inf").toLowerCase();
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const piece = src.slice(i, j);
      if (isNaN(Number(piece))) throw new Error("'" + piece + "' is not a valid number.");
      tokens.push({ t: "num", v: Number(piece) });
      i = j;
    } else if (/[a-z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-z]/.test(src[j])) j++;
      tokens.push({ t: "id", v: src.slice(i, j) });
      i = j;
    } else if ("+-*/^()".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
    } else {
      throw new Error("Unexpected character '" + c + "'.");
    }
  }
  return tokens;
}

/* Grammar:  expr = term (+|- term)*      term = unary (* / unary | implicit unary)*
             unary = -unary | power       power = primary [^ unary]            */
function parse(text) {
  const toks = tokenize(text);
  if (!toks.length) throw new Error("Please type an expression first.");
  let pos = 0;

  const isOp = (v) => pos < toks.length && toks[pos].t === "op" && toks[pos].v === v;

  function expr() {
    let n = term();
    while (isOp("+") || isOp("-")) {
      const op = toks[pos++].v;
      n = { t: "bin", op, a: n, b: term() };
    }
    return n;
  }

  function term() {
    let n = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = toks[pos++].v;
        n = { t: "bin", op, a: n, b: unary() };
      } else if (pos < toks.length && (toks[pos].t === "num" || toks[pos].t === "id" || isOp("("))) {
        n = { t: "bin", op: "*", a: n, b: unary() };   // "3x" means 3*x
      } else {
        return n;
      }
    }
  }

  function unary() {
    if (isOp("-")) { pos++; return { t: "neg", a: unary() }; }
    if (isOp("+")) { pos++; return unary(); }
    return power();
  }

  function power() {
    const base = primary();
    if (isOp("^")) { pos++; return { t: "bin", op: "^", a: base, b: unary() }; }
    return base;
  }

  function primary() {
    const t = toks[pos++];
    if (!t) throw new Error("The expression ends too early.");
    if (t.t === "num") return N(t.v);
    if (t.t === "op" && t.v === "(") {
      const inner = expr();
      if (!isOp(")")) throw new Error("A closing bracket ) is missing.");
      pos++;
      return inner;
    }
    if (t.t === "id") {
      if (t.v === "x") return X;
      if (t.v in CONSTS) return { t: "const", name: t.v };
      if (t.v in FUNCS) {
        if (!isOp("(")) throw new Error("Put brackets after " + t.v + ", for example " + t.v + "(x).");
        pos++;
        const arg = expr();
        if (!isOp(")")) throw new Error("A closing bracket ) is missing.");
        pos++;
        return { t: "fn", name: t.v, a: arg };
      }
      throw new Error("Unknown name '" + t.v + "'. You can use x, pi, e, sin, cos, tan, exp, ln, log, sqrt and abs.");
    }
    throw new Error("Unexpected '" + t.v + "'.");
  }

  const tree = expr();
  if (pos < toks.length) throw new Error("Unexpected '" + toks[pos].v + "'.");
  return tree;
}

/* =========================================================
   2. TREE HELPERS
   The "smart" builders below tidy results as they are created
   (for example 1*x becomes x and 0+x becomes x).
   ========================================================= */
const N = (v) => ({ t: "num", v });
const X = { t: "var" };
const isNum = (n, v) => n.t === "num" && (v === undefined || n.v === v);

function add(a, b) {
  if (isNum(a) && isNum(b)) return N(a.v + b.v);
  if (isNum(a, 0)) return b;
  if (isNum(b, 0)) return a;
  if (b.t === "neg") return sub(a, b.a);
  if (isNum(b) && b.v < 0) return sub(a, N(-b.v));
  if (b.t === "bin" && b.op === "*" && isNum(b.a) && b.a.v < 0) return sub(a, mul(N(-b.a.v), b.b));
  return { t: "bin", op: "+", a, b };
}
function sub(a, b) {
  if (isNum(a) && isNum(b)) return N(a.v - b.v);
  if (isNum(b, 0)) return a;
  if (isNum(a, 0)) return neg(b);
  if (b.t === "neg") return add(a, b.a);
  if (isNum(b) && b.v < 0) return add(a, N(-b.v));
  if (b.t === "bin" && b.op === "*" && isNum(b.a) && b.a.v < 0) return add(a, mul(N(-b.a.v), b.b));
  return { t: "bin", op: "-", a, b };
}
function neg(a) {
  if (isNum(a)) return N(-a.v);
  if (a.t === "neg") return a.a;
  return { t: "neg", a };
}
function mul(a, b) {
  if (isNum(a) && isNum(b)) return N(a.v * b.v);
  if (isNum(a, 0) || isNum(b, 0)) return N(0);
  if (isNum(a, 1)) return b;
  if (isNum(b, 1)) return a;
  if (isNum(a, -1)) return neg(b);
  if (isNum(b, -1)) return neg(a);
  if (a.t === "neg") return neg(mul(a.a, b));
  if (b.t === "neg") return neg(mul(a, b.a));
  if (isNum(b)) return mul(b, a);                       // numbers go first: 2x, not x*2
  if (isNum(a) && b.t === "bin" && b.op === "*" && isNum(b.a)) return mul(N(a.v * b.a.v), b.b);
  return { t: "bin", op: "*", a, b };
}
function div(a, b) {
  if (isNum(b, 1)) return a;
  if (isNum(a, 0)) return N(0);
  if (isNum(a) && isNum(b) && b.v !== 0) return N(a.v / b.v);
  if (!isNum(a) && str(a) === str(b)) return N(1);                // x/x = 1
  if (a.t === "neg") return neg(div(a.a, b));
  if (isNum(b) && b.v !== 0) return mul(N(1 / b.v), a);  // dividing by 3 = multiplying by 1/3
  return { t: "bin", op: "/", a, b };
}
function pow(a, b) {
  if (isNum(b, 0)) return N(1);
  if (isNum(b, 1)) return a;
  if (isNum(a) && isNum(b)) {
    const r = Math.pow(a.v, b.v);
    if (isFinite(r)) return N(r);
  }
  return { t: "bin", op: "^", a, b };
}
function fn(name, a) {
  if (name === "ln" && a.t === "const" && a.name === "e") return N(1);
  if (name === "ln" && isNum(a, 1)) return N(0);
  return { t: "fn", name, a };
}

/* Rebuild a parsed tree with the smart builders. */
function simplify(n) {
  switch (n.t) {
    case "neg": return neg(simplify(n.a));
    case "fn":  return fn(n.name, simplify(n.a));
    case "bin": {
      const a = simplify(n.a), b = simplify(n.b);
      return { "+": add, "-": sub, "*": mul, "/": div, "^": pow }[n.op](a, b);
    }
    default: return n;
  }
}

/* Does the expression contain the variable x? */
function hasX(n) {
  switch (n.t) {
    case "var": return true;
    case "neg": case "fn": return hasX(n.a);
    case "bin": return hasX(n.a) || hasX(n.b);
    default: return false;
  }
}

/* Calculate the value of a tree for a given x. */
function ev(n, x) {
  switch (n.t) {
    case "num": return n.v;
    case "var":
      if (x === undefined) throw new Error("The variable x can't be used here. Type a plain number instead.");
      return x;
    case "const": return CONSTS[n.name];
    case "neg": return -ev(n.a, x);
    case "fn": return FUNCS[n.name](ev(n.a, x));
    case "bin": {
      const a = ev(n.a, x), b = ev(n.b, x);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        default:  return Math.pow(a, b);
      }
    }
  }
  return NaN;
}

/* Turn a number into the nicest text: 3, 1/2, 0.3333 ... */
function nearInt(v) { return Math.abs(v - Math.round(v)) < 1e-9; }
function ratio(v) {
  for (let q = 2; q <= 99; q++) {
    const p = Math.round(v * q);
    if (Math.abs(v * q - p) < 1e-9 * q) return [p, q];
  }
  return null;
}
function fmtNum(v) {
  if (nearInt(v)) return String(Math.round(v));
  const r = ratio(v);
  if (r) return r[0] + "/" + r[1];
  return String(Number(v.toFixed(6)));
}

/* Turn a tree back into text. "min" is the precedence the
   surroundings need; lower precedence gets brackets. */
function str(n, min = 0) {
  let s, p;
  switch (n.t) {
    case "num": {
      s = fmtNum(n.v);
      const fractional = !nearInt(n.v) && ratio(n.v);
      p = fractional ? 2 : (n.v < 0 ? 3 : 6);
      break;
    }
    case "var":   s = "x"; p = 6; break;
    case "const": s = n.name; p = 6; break;
    case "fn":    s = n.name + "(" + str(n.a, 0) + ")"; p = 6; break;
    case "neg":   s = "-" + str(n.a, 2); p = 3; break;
    default: {
      const { op, a, b } = n;
      if (op === "+") { s = str(a, 1) + " + " + str(b, 1); p = 1; }
      else if (op === "-") { s = str(a, 1) + " - " + str(b, 2); p = 1; }
      else if (op === "/") { s = str(a, a.t === "num" ? 3 : 2) + "/" + str(b, 3); p = 2; }
      else if (op === "^") { s = str(a, 5) + "^" + str(b, 4); p = 4; }
      else {
        p = 2;
        const joinCoef = (coef, rest) => {
          if (coef === "") return rest;
          if (coef === "-") return "-" + rest;
          return /^[a-z(]/.test(rest) ? coef + rest : coef + "*" + rest;
        };
        if (a.t === "num" && b.t !== "num") {
          const fr = nearInt(a.v) ? null : ratio(a.v);
          if (fr) {                                   // (3/2)x^2 is written 3x^2/2
            const coef = fr[0] === 1 ? "" : fr[0] === -1 ? "-" : String(fr[0]);
            s = joinCoef(coef, str(b, 2)) + "/" + fr[1];
          } else {
            s = joinCoef(str(a, 3), str(b, 2));
          }
        } else {
          s = str(a, 2) + "*" + str(b, 2);
        }
      }
    }
  }
  return p < min ? "(" + s + ")" : s;
}

/* Turn text into a ready-to-use { ast, f } pair. */
function compile(text) {
  const ast = simplify(parse(text));
  return { ast, f: (x) => ev(ast, x) };
}

/* Read a plain number such as "2", "pi/2", "1/3" or "inf". */
function constValue(text) {
  const tree = parse(text);
  if (hasX(tree)) throw new Error("Please type a plain number here (no x). Example: 2, 0.5, pi/2.");
  const v = ev(tree);
  if (Number.isNaN(v)) throw new Error("'" + text + "' is not a valid number.");
  return v;
}

/* =========================================================
   3. DIFFERENTIATION
   ========================================================= */
function deriv(n) {
  switch (n.t) {
    case "num": case "const": return N(0);
    case "var": return N(1);
    case "neg": return neg(deriv(n.a));
    case "fn": {
      const u = n.a, du = deriv(u);
      switch (n.name) {
        case "sin":  return mul(du, fn("cos", u));
        case "cos":  return neg(mul(du, fn("sin", u)));
        case "tan":  return mul(du, div(N(1), pow(fn("cos", u), N(2))));
        case "exp":  return mul(du, n);
        case "ln":   return div(du, u);
        case "log":  return div(du, mul(u, N(Math.LN10)));
        case "sqrt": return div(du, mul(N(2), n));
        case "abs":  return mul(du, div(u, n));
      }
      return N(0);
    }
    default: {
      const { op, a, b } = n;
      const da = deriv(a), db = deriv(b);
      if (op === "+") return add(da, db);
      if (op === "-") return sub(da, db);
      if (op === "*") return add(mul(da, b), mul(a, db));                       // product rule
      if (op === "/") return div(sub(mul(da, b), mul(a, db)), pow(b, N(2)));    // quotient rule
      if (!hasX(b)) return mul(mul(b, pow(a, sub(b, N(1)))), da);               // power rule + chain
      if (!hasX(a)) return mul(mul(n, fn("ln", a)), db);                        // a^u
      return mul(n, add(mul(db, fn("ln", a)), div(mul(b, da), a)));             // u^v
    }
  }
}

/* =========================================================
   4. INTEGRATION
   ========================================================= */

/* If u = k*x + m, return k. Otherwise return null. */
function linearCoef(u) {
  if (!hasX(u)) return null;
  const d = deriv(u);
  return d.t === "num" && d.v !== 0 ? d.v : null;
}

/* Symbolic antiderivative for common cases. Returns null if unknown. */
function integ(n) {
  if (!hasX(n)) return mul(n, X);
  switch (n.t) {
    case "var": return mul(N(0.5), pow(X, N(2)));
    case "neg": { const F = integ(n.a); return F && neg(F); }
    case "fn": {
      const u = n.a;
      if (n.name === "ln" && u.t === "var") return sub(mul(X, n), X);
      const k = linearCoef(u);
      if (k === null) return null;
      let F;
      if (n.name === "sin") F = neg(fn("cos", u));
      else if (n.name === "cos") F = fn("sin", u);
      else if (n.name === "exp") F = n;
      else if (n.name === "sqrt") F = mul(N(2 / 3), pow(u, N(1.5)));
      else return null;
      return div(F, N(k));
    }
    case "bin": {
      const { op, a, b } = n;
      if (op === "+" || op === "-") {
        const A = integ(a), B = integ(b);
        return A && B ? (op === "+" ? add(A, B) : sub(A, B)) : null;
      }
      if (op === "*") {
        if (!hasX(a)) { const F = integ(b); return F && mul(a, F); }
        if (!hasX(b)) { const F = integ(a); return F && mul(b, F); }
        return null;
      }
      if (op === "/") {
        if (!hasX(b)) { const F = integ(a); return F && div(F, b); }
        const k = linearCoef(b);
        if (!hasX(a) && k !== null) return mul(div(a, N(k)), fn("ln", fn("abs", b)));
        return null;
      }
      if (op === "^") {
        if (!hasX(b) && b.t === "num") {
          const k = linearCoef(a);
          if (k === null) return null;
          if (b.v === -1) return div(fn("ln", fn("abs", a)), N(k));
          return div(mul(N(1 / (b.v + 1)), pow(a, N(b.v + 1))), N(k));
        }
        if (!hasX(a)) {
          const k = linearCoef(b);
          if (k === null) return null;
          const F = a.t === "const" && a.name === "e" ? n : div(n, fn("ln", a));
          return div(F, N(k));
        }
      }
    }
  }
  return null;
}

/* Numerical integral with Simpson's rule (n must be even). */
function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}

/* =========================================================
   5. GRAPH DRAWING (canvas)
   options: { xmin, xmax, ymin?, ymax?, series:[{f,color,label,dashed,noRange}],
              shade?:{f,a,b}, points?:[{x,y,label,hollow}], vlines?:[x], hlines?:[y] }
   ========================================================= */
const COLORS = { blue: "#4f6bff", purple: "#8b5cf6", orange: "#f59e0b", grid: "#eceffa", axis: "#8a92b8", text: "#646b91" };

function safe(f, x) {
  try { const y = f(x); return typeof y === "number" ? y : NaN; } catch (e) { return NaN; }
}

function niceStep(span) {
  const raw = span / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
}

function tickText(v) { return String(Number(v.toPrecision(6))); }

function clearCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawGraph(canvas, o) {
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const ml = 46, mr = 14, mt = 14, mb = 28;
  const pw = W - ml - mr, ph = H - mt - mb;
  const { xmin, xmax } = o;
  const STEPS = Math.max(300, Math.floor(pw));

  // sample every curve
  const samples = o.series.map((s) => {
    const ys = [];
    for (let i = 0; i <= STEPS; i++) ys.push(safe(s.f, xmin + ((xmax - xmin) * i) / STEPS));
    return ys;
  });

  // choose the y-range (ignore extreme spikes so asymptotes don't squash the graph)
  let ymin = o.ymin, ymax = o.ymax;
  if (ymin === undefined) {
    const vals = [];
    samples.forEach((ys, i) => { if (!o.series[i].noRange) ys.forEach((y) => { if (isFinite(y)) vals.push(y); }); });
    (o.points || []).forEach((p) => { if (isFinite(p.y)) vals.push(p.y); });
    vals.sort((p, q) => p - q);
    if (!vals.length) { ymin = -1; ymax = 1; }
    else {
      let lo = vals[Math.floor(vals.length * 0.01)];
      let hi = vals[Math.ceil(vals.length * 0.99) - 1];
      if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.15;
      ymin = lo - pad; ymax = hi + pad;
    }
  }

  const px = (x) => ml + ((x - xmin) / (xmax - xmin)) * pw;
  const py = (y) => Math.max(-1e5, Math.min(1e5, H - mb - ((y - ymin) / (ymax - ymin)) * ph));

  ctx.font = "11px 'Segoe UI', system-ui, sans-serif";

  // grid and tick labels
  ctx.lineWidth = 1;
  const xs = niceStep(xmax - xmin), ys = niceStep(ymax - ymin);
  ctx.strokeStyle = COLORS.grid; ctx.fillStyle = COLORS.text;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let t = Math.ceil(xmin / xs) * xs; t <= xmax + 1e-9; t += xs) {
    ctx.beginPath(); ctx.moveTo(px(t), mt); ctx.lineTo(px(t), mt + ph); ctx.stroke();
    ctx.fillText(tickText(t), px(t), mt + ph + 6);
  }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let t = Math.ceil(ymin / ys) * ys; t <= ymax + 1e-9; t += ys) {
    ctx.beginPath(); ctx.moveTo(ml, py(t)); ctx.lineTo(ml + pw, py(t)); ctx.stroke();
    ctx.fillText(tickText(t), ml - 7, py(t));
  }

  // everything below is clipped to the plot area
  ctx.save();
  ctx.beginPath(); ctx.rect(ml, mt, pw, ph); ctx.clip();

  // axes
  ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
  if (xmin <= 0 && xmax >= 0) { ctx.beginPath(); ctx.moveTo(px(0), mt); ctx.lineTo(px(0), mt + ph); ctx.stroke(); }
  if (ymin <= 0 && ymax >= 0) { ctx.beginPath(); ctx.moveTo(ml, py(0)); ctx.lineTo(ml + pw, py(0)); ctx.stroke(); }

  // shaded area (integration)
  if (o.shade) {
    const lo = Math.min(o.shade.a, o.shade.b), hi = Math.max(o.shade.a, o.shade.b);
    const n = 300;
    ctx.beginPath();
    ctx.moveTo(px(lo), py(0));
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      const y = safe(o.shade.f, x);
      ctx.lineTo(px(x), py(isFinite(y) ? y : 0));
    }
    ctx.lineTo(px(hi), py(0));
    ctx.closePath();
    ctx.fillStyle = "rgba(139, 92, 246, 0.20)";
    ctx.fill();
    ctx.strokeStyle = COLORS.purple; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    [lo, hi].forEach((x) => { ctx.beginPath(); ctx.moveTo(px(x), py(0)); ctx.lineTo(px(x), py(safe(o.shade.f, x) || 0)); ctx.stroke(); });
    ctx.setLineDash([]);
  }

  // helper lines
  ctx.strokeStyle = "rgba(100, 107, 145, 0.7)"; ctx.lineWidth = 1.2; ctx.setLineDash([6, 5]);
  (o.vlines || []).forEach((x) => { ctx.beginPath(); ctx.moveTo(px(x), mt); ctx.lineTo(px(x), mt + ph); ctx.stroke(); });
  (o.hlines || []).forEach((y) => { ctx.beginPath(); ctx.moveTo(ml, py(y)); ctx.lineTo(ml + pw, py(y)); ctx.stroke(); });
  ctx.setLineDash([]);

  // curves (the line is broken at gaps and at jumps such as tan or 1/x)
  o.series.forEach((s, k) => {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.6; ctx.lineJoin = "round";
    ctx.setLineDash(s.dashed ? [7, 5] : []);
    ctx.beginPath();
    let pen = false, prev = NaN;
    samples[k].forEach((y, i) => {
      const x = xmin + ((xmax - xmin) * i) / STEPS;
      if (!isFinite(y) || (pen && Math.abs(y - prev) > (ymax - ymin) * 3)) { pen = false; prev = NaN; return; }
      if (!pen) { ctx.moveTo(px(x), py(y)); pen = true; } else ctx.lineTo(px(x), py(y));
      prev = y;
    });
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.restore();

  // points and their labels
  (o.points || []).forEach((p) => {
    if (!isFinite(p.x) || !isFinite(p.y)) return;
    if (p.x < xmin || p.x > xmax || p.y < ymin || p.y > ymax) return;
    ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 5.5, 0, Math.PI * 2);
    ctx.fillStyle = p.hollow ? "#fff" : COLORS.purple; ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = COLORS.purple; ctx.stroke();
    if (p.label) {
      ctx.font = "600 12px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#1d2142";
      const right = px(p.x) < W * 0.65;
      const upper = py(p.y) < mt + ph / 2;          // keep the label away from the curve and the edges
      ctx.textAlign = right ? "left" : "right";
      ctx.textBaseline = upper ? "top" : "bottom";
      ctx.fillText(p.label, px(p.x) + (right ? 9 : -9), py(p.y) + (upper ? 9 : -9));
    }
  });

  // legend
  let ly = mt + 12;
  ctx.font = "12px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  o.series.forEach((s) => {
    if (!s.label) return;
    ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.setLineDash(s.dashed ? [5, 3] : []);
    ctx.beginPath(); ctx.moveTo(ml + 10, ly); ctx.lineTo(ml + 30, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.text; ctx.fillText(s.label, ml + 36, ly);
    ly += 18;
  });
}

/* =========================================================
   6. FEATURE PANELS
   ========================================================= */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function setResult(el, html, isError) {
  el.innerHTML = html;
  el.classList.toggle("error", !!isError);
}
/* Short readable number for results (up to 8 significant digits). */
function fmtV(v) {
  if (Number.isNaN(v)) return "undefined";
  if (!isFinite(v)) return v > 0 ? "∞" : "−∞";
  if (Math.abs(v) < 1e-12) return "0";
  const r = Number(v.toPrecision(8));
  return Math.abs(r) >= 1e9 || (r !== 0 && Math.abs(r) < 1e-6) ? r.toExponential(4) : String(r);
}
function round4(v) {
  const r = Number(v.toFixed(4));
  return Math.abs(r) < 1e-9 ? "0" : String(r);
}

/* ---------- 6.1 Arithmetic ---------- */
const history = [];

function arithRun(addToHistory) {
  const out = $("arith-result"), detail = $("arith-detail");
  const src = $("arith-input").value;
  try {
    const tree = parse(src);
    if (hasX(tree)) throw new Error("This calculator is for numbers only. Use the Differentiation, Integration or Graphs tab for x.");
    const v = ev(tree);
    if (Number.isNaN(v)) throw new Error("That calculation has no real answer (for example the square root of a negative number).");
    if (!isFinite(v)) throw new Error("The answer is infinite. Check for a division by zero.");
    const text = String(Number(v.toPrecision(12)));
    setResult(out, text);
    detail.innerHTML = '<p class="mono">' + esc(src.trim()) + " = " + esc(text) + "</p>";
    if (addToHistory) {
      history.unshift({ expr: src.trim(), value: text });
      if (history.length > 6) history.pop();
      renderHistory();
    }
  } catch (e) {
    setResult(out, e.message, true);
    detail.innerHTML = "";
  }
}

function renderHistory() {
  const list = $("arith-history");
  list.innerHTML = "";
  history.forEach((h) => {
    const li = document.createElement("li");
    li.tabIndex = 0;
    li.innerHTML = "<span>" + esc(h.expr) + "</span><span>" + esc(h.value) + "</span>";
    const use = () => { $("arith-input").value = h.expr; arithRun(false); };
    li.addEventListener("click", use);
    li.addEventListener("keydown", (e) => { if (e.key === "Enter") use(); });
    list.appendChild(li);
  });
  $("arith-history-empty").classList.toggle("hidden", history.length > 0);
}

function buildKeypad() {
  const keys = [
    ["C", "clear", "clear"], ["(", "("], [")", ")"], ["⌫", "back", "op"],
    ["7", "7"], ["8", "8"], ["9", "9"], ["÷", "/", "op"],
    ["4", "4"], ["5", "5"], ["6", "6"], ["×", "*", "op"],
    ["1", "1"], ["2", "2"], ["3", "3"], ["−", "-", "op"],
    ["0", "0"], [".", "."], ["^", "^", "op"], ["+", "+", "op"],
    ["√", "sqrt(", "op"], ["|x|", "abs(", "op"], ["=", "eval", "eq"]
  ];
  const pad = $("keypad");
  const input = $("arith-input");
  keys.forEach(([label, action, cls]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "key" + (cls ? " " + cls : "");
    b.textContent = label;
    b.addEventListener("click", () => {
      if (action === "clear") { input.value = ""; setResult($("arith-result"), "–"); $("arith-detail").innerHTML = ""; }
      else if (action === "back") input.value = input.value.slice(0, -1);
      else if (action === "eval") arithRun(true);
      else {
        const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
        input.value = input.value.slice(0, s) + action + input.value.slice(e);
        input.setSelectionRange(s + action.length, s + action.length);
      }
      input.focus();
    });
    pad.appendChild(b);
  });
}

/* ---------- 6.2 Binary entropy ---------- */
function binaryEntropy(p) {
  if (p <= 0 || p >= 1) return 0;
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function runEntropy() {
  const out = $("ent-result"), steps = $("ent-steps"), cv = $("ent-canvas");
  try {
    const p = constValue($("ent-p").value);
    if (!(p >= 0 && p <= 1)) throw new Error("p must be a number between 0 and 1.");
    const q = 1 - p;
    const t1 = p === 0 ? 0 : -p * Math.log2(p);
    const t2 = q === 0 ? 0 : -q * Math.log2(q);
    const H = t1 + t2;
    const f4 = (v) => String(Number(v.toFixed(4)));

    setResult(out, '<span class="lbl">H(' + f4(p) + ') =</span> ' + f4(H) + (f4(H) === "1" ? " bit" : " bits"));
    let mood = "There is some uncertainty in this event.";
    if (H >= 0.99) mood = "This is the most unpredictable case, like a fair coin.";
    else if (H < 0.2) mood = "This event is very predictable, so each outcome tells you little.";
    steps.innerHTML =
      '<div class="steps">' +
      "p = " + f4(p) + ",  1 − p = " + f4(q) + "<br>" +
      "−p·log₂(p) = " + (p === 0 ? "0 (by convention)" : "−" + f4(p) + " × " + f4(Math.log2(p)) + " = " + f4(t1)) + "<br>" +
      "−(1−p)·log₂(1−p) = " + (q === 0 ? "0 (by convention)" : "−" + f4(q) + " × " + f4(Math.log2(q)) + " = " + f4(t2)) + "<br>" +
      "H = " + f4(t1) + " + " + f4(t2) + " = " + f4(H) + " bits" +
      "</div><p>" + mood + "</p>";

    drawGraph(cv, {
      xmin: 0, xmax: 1, ymin: -0.05, ymax: 1.15,
      series: [{ f: binaryEntropy, color: COLORS.blue, label: "H(p)" }],
      points: [{ x: p, y: H, label: "(" + f4(p) + ", " + f4(H) + ")" }]
    });
  } catch (e) {
    setResult(out, e.message, true);
    steps.innerHTML = "";
    clearCanvas(cv);
  }
}

/* ---------- 6.3 Differentiation ---------- */
function runDiff() {
  const out = $("diff-result"), info = $("diff-info"), cv = $("diff-canvas");
  try {
    const { ast, f } = compile($("diff-input").value);
    const order = Number($("diff-order").value);
    const x0 = constValue($("diff-x0").value);
    let d = ast;
    for (let i = 0; i < order; i++) d = deriv(d);
    const g = (x) => ev(d, x);
    const mark = order === 1 ? "′" : "″";
    const f0 = f(x0), g0 = g(x0);

    setResult(out, '<span class="lbl">f' + mark + "(x) =</span> " + esc(str(d)));

    let html = '<p class="mono">f(x) = ' + esc(str(ast)) + "</p>";
    html += "<p>At x = " + esc(fmtNum(x0)) + ": f(x) = <b>" + fmtV(f0) + "</b>, f" + mark + "(x) = <b>" + fmtV(g0) + "</b></p>";
    if (order === 1 && isFinite(g0)) {
      html += "<p>" + (Math.abs(g0) < 1e-9 ? "The slope is 0 here, so the tangent line is flat."
        : g0 > 0 ? "The slope is positive here, so f is increasing."
        : "The slope is negative here, so f is decreasing.") + "</p>";
    }
    info.innerHTML = html;

    const series = [
      { f, color: COLORS.blue, label: "f(x)" },
      { f: g, color: COLORS.purple, label: "f" + mark + "(x)" }
    ];
    if (order === 1 && isFinite(f0) && isFinite(g0)) {
      series.push({ f: (x) => f0 + g0 * (x - x0), color: COLORS.orange, label: "tangent at x = " + fmtNum(x0), dashed: true, noRange: true });
    }
    drawGraph(cv, {
      xmin: Math.min(-6, x0 - 4), xmax: Math.max(6, x0 + 4),
      series, points: [{ x: x0, y: f0 }]
    });
  } catch (e) {
    setResult(out, e.message, true);
    info.innerHTML = "";
    clearCanvas(cv);
  }
}

/* ---------- 6.4 Integration ---------- */
function runInteg() {
  const out = $("int-result"), info = $("int-info"), cv = $("int-canvas");
  try {
    const { ast, f } = compile($("int-input").value);
    const a = constValue($("int-a").value), b = constValue($("int-b").value);
    if (!isFinite(a) || !isFinite(b)) throw new Error("The limits a and b must be finite numbers.");

    let value = simpson(f, a, b);
    if (!isFinite(value)) throw new Error("f(x) is undefined or infinite somewhere between " + fmtNum(a) + " and " + fmtNum(b) + ", so the area can't be calculated.");

    const F = integ(ast);
    const exact = F ? ev(F, b) - ev(F, a) : NaN;
    if (isFinite(exact) && Math.abs(exact - value) <= 1e-3 * Math.max(1, Math.abs(exact))) value = exact;
    const shown = String(Number(value.toFixed(6)));
    setResult(out, '<span class="lbl">∫ from ' + esc(fmtNum(a)) + " to " + esc(fmtNum(b)) + " of f(x) dx =</span> " + shown);

    let html = '<p class="mono">f(x) = ' + esc(str(ast)) + "</p>";
    if (F) {
      html += '<p class="mono">F(x) = ' + esc(str(F)) + " + C</p>";
      if (isFinite(exact)) html += "<p>Check with F(b) − F(a) = " + fmtV(exact) + "</p>";
    } else {
      html += "<p>No simple antiderivative was found for this function, but the number above is still accurate (Simpson's rule).</p>";
    }
    html += "<p>The shaded area is above the x-axis when f(x) is positive and counts as negative when f(x) is below it.</p>";
    info.innerHTML = html;

    const lo = Math.min(a, b), hi = Math.max(a, b), pad = Math.max(1, (hi - lo) * 0.3);
    drawGraph(cv, {
      xmin: lo - pad, xmax: hi + pad,
      series: [{ f, color: COLORS.blue, label: "f(x)" }],
      shade: { f, a, b }
    });
  } catch (e) {
    setResult(out, e.message, true);
    info.innerHTML = "";
    clearCanvas(cv);
  }
}

/* ---------- 6.5 Limits ---------- */

/* Look at values of f as x closes in on the target (listed from far to near)
   and decide what they do. Needs at least 5 values. */
function judge(v) {
  if (v.some(Number.isNaN)) return { kind: "undef" };
  const n = v.length, abs = v.map(Math.abs);
  const last = v[n - 1];
  if (!isFinite(last)) return { kind: "inf", sign: Math.sign(last) };

  // values keep getting bigger and bigger with the same sign
  const growing = abs[n - 1] > 5 && abs[n - 1] > abs[n - 2] * 1.05 && abs[n - 2] > abs[n - 3] * 1.05 && abs[n - 3] > abs[n - 4] * 1.05;
  const sameSign = Math.sign(v[n - 1]) === Math.sign(v[n - 2]) && Math.sign(v[n - 2]) === Math.sign(v[n - 3]);
  if (growing && sameSign) return { kind: "inf", sign: Math.sign(last) };

  // do the steps between values keep shrinking?
  const d0 = v[n - 3] - v[n - 4], d1 = v[n - 2] - v[n - 3], d2 = v[n - 1] - v[n - 2];
  const tiny = Math.abs(d2) <= 1e-4 * Math.max(1, Math.abs(last));
  const shrinking = Math.abs(d2) < 0.5 * Math.abs(d1) && Math.abs(d1) < 0.5 * Math.abs(d0);
  if (!tiny && !shrinking) return { kind: "dne" };

  // speed up the estimate with Aitken's method
  let est = last;
  const r = d1 !== 0 ? d2 / d1 : 0;
  if (r > 0 && r < 0.5) est = last + (d2 * r) / (1 - r);
  return { kind: "finite", value: est };
}

/* "lim x→a f(x) = 3"  or  "lim x→a f(x) does not exist" */
function limitLine(prefix, j) {
  return j.kind === "dne" || j.kind === "undef" ? prefix + " does not exist" : prefix + " = " + describeJudge(j);
}

function describeJudge(j) {
  if (j.kind === "finite") return round4(j.value);
  if (j.kind === "inf") return j.sign > 0 ? "∞" : "−∞";
  if (j.kind === "undef") return "undefined";
  return "does not exist";
}

function tableHTML(head, rows) {
  return "<table><thead><tr>" + head.map((h) => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") +
    "</tbody></table>";
}

function runLimit() {
  const out = $("lim-result"), info = $("lim-info"), tbl = $("lim-table"), cv = $("lim-canvas");
  try {
    const { ast, f } = compile($("lim-input").value);
    const a = constValue($("lim-a").value);
    const dir = $("lim-dir").value;
    const aText = a === Infinity ? "∞" : a === -Infinity ? "−∞" : fmtNum(a);

    let headline, note = "", limitValue = null, tableHtml = "", exists = false;
    const graph = { series: [{ f, color: COLORS.blue, label: "f(x)" }], points: [], vlines: [], hlines: [] };

    if (!isFinite(a)) {
      // x grows without bound: try x = 10, 100, ... 100000000
      const sign = a > 0 ? 1 : -1;
      const pts = [];
      for (let k = 1; k <= 8; k++) pts.push(sign * Math.pow(10, k));
      const vals = pts.map(f);
      const j = judge(vals.slice(3));
      headline = limitLine("lim x→" + aText + " f(x)", j);
      exists = j.kind === "finite" || j.kind === "inf";
      if (j.kind === "dne") note = "The values keep changing instead of settling on one number.";
      if (j.kind === "finite") { limitValue = j.value; graph.hlines.push(j.value); }
      tableHtml = tableHTML(["x", "f(x)"], pts.map((x, i) => [fmtV(x), fmtV(vals[i])]));
      graph.xmin = sign > 0 ? 0 : -40; graph.xmax = sign > 0 ? 40 : 0;
    } else {
      const hs = [0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001];
      const left = hs.map((h) => f(a - h)), right = hs.map((h) => f(a + h));
      const L = judge(left.slice(0, 5)), R = judge(right.slice(0, 5));
      const side = dir === "left" ? "⁻" : dir === "right" ? "⁺" : "";

      if (dir === "left" || dir === "right") {
        const j = dir === "left" ? L : R;
        headline = limitLine("lim x→" + aText + side + " f(x)", j);
        exists = j.kind === "finite" || j.kind === "inf";
        if (j.kind === "dne") note = "The values keep changing instead of settling on one number.";
        if (j.kind === "undef") note = "f(x) is not defined on this side of " + aText + ".";
        if (j.kind === "finite") limitValue = j.value;
      } else if (L.kind === "finite" && R.kind === "finite" && Math.abs(L.value - R.value) <= 1e-3 * Math.max(1, Math.abs(L.value))) {
        limitValue = (L.value + R.value) / 2;
        exists = true;
        headline = "lim x→" + aText + " f(x) = " + round4(limitValue);
      } else if (L.kind === "inf" && R.kind === "inf" && L.sign === R.sign) {
        headline = "lim x→" + aText + " f(x) = " + describeJudge(L);
        exists = true;
      } else {
        headline = "lim x→" + aText + " f(x) does not exist";
        note = "Left-hand limit: " + describeJudge(L) + ". Right-hand limit: " + describeJudge(R) + ". A two-sided limit exists only when both sides agree.";
      }

      const rows = hs.map((h, i) => {
        const row = [];
        if (dir !== "right") row.push(fmtV(a - h), fmtV(left[i]));
        if (dir !== "left") row.push(fmtV(a + h), fmtV(right[i]));
        return row;
      });
      const head = [];
      if (dir !== "right") head.push("x (left)", "f(x)");
      if (dir !== "left") head.push("x (right)", "f(x)");
      tableHtml = tableHTML(head, rows);

      let fa = NaN;
      try { fa = f(a); } catch (e) { /* ignore */ }
      note = (isFinite(fa) ? "The value at x = " + aText + " is f(" + aText + ") = " + fmtV(fa) + "." : "f(x) is not defined at x = " + aText + (exists ? ", but the limit can still exist." : ".")) + (note ? " " + note : "");

      graph.xmin = a - 3; graph.xmax = a + 3;
      graph.vlines.push(a);
      if (limitValue !== null) graph.points.push({ x: a, y: limitValue, label: "L = " + round4(limitValue), hollow: true });
    }

    setResult(out, esc(headline));
    info.innerHTML = note ? "<p>" + esc(note) + "</p>" : "";
    tbl.innerHTML = tableHtml;
    drawGraph(cv, graph);
  } catch (e) {
    setResult(out, e.message, true);
    info.innerHTML = "";
    tbl.innerHTML = "";
    clearCanvas(cv);
  }
}

/* ---------- 6.6 Standard function graphs ---------- */
function showGraphFields() {
  const type = $("g-type").value;
  $("g-trig").classList.toggle("hidden", type === "poly");
  $("g-poly").classList.toggle("hidden", type !== "poly");
}

function runGraph() {
  const out = $("g-result"), info = $("g-info"), cv = $("g-canvas");
  try {
    const type = $("g-type").value;
    const num = (id) => constValue($(id).value);
    const xmin = num("g-xmin"), xmax = num("g-xmax");
    if (!isFinite(xmin) || !isFinite(xmax) || xmin >= xmax) throw new Error("'x from' must be a smaller number than 'x to'.");

    let ast, facts = "";
    if (type === "poly") {
      const [a, b, c, d] = ["g-pa", "g-pb", "g-pc", "g-pd"].map(num);
      ast = add(add(add(mul(N(a), pow(X, N(3))), mul(N(b), pow(X, N(2)))), mul(N(c), X)), N(d));
      const degree = a !== 0 ? 3 : b !== 0 ? 2 : c !== 0 ? 1 : 0;
      const f = (x) => ev(ast, x);
      const roots = findRoots(f, xmin, xmax);
      facts = "<ul><li>Degree: " + degree + "</li><li>y-intercept: " + fmtV(d) + "</li><li>x-intercepts in this range: " +
        (roots.length ? roots.slice(0, 6).map((r) => fmtV(Number(r.toFixed(4)))).join(", ") : "none") + "</li></ul>";
    } else {
      const [A, B, C, D] = ["g-A", "g-B", "g-C", "g-D"].map(num);
      ast = add(mul(N(A), fn(type, add(mul(N(B), X), N(C)))), N(D));
      facts = "<ul><li>Amplitude |A|: " + fmtV(Math.abs(A)) + "</li>" +
        "<li>Period 2π/|B|: " + (B === 0 ? "none (B = 0 makes it a constant)" : fmtV((2 * Math.PI) / Math.abs(B))) + "</li>" +
        "<li>Phase shift −C/B: " + (B === 0 ? "none" : fmtV(-C / B)) + "</li>" +
        "<li>Midline: y = " + fmtV(D) + "</li>" +
        "<li>Range: " + fmtV(D - Math.abs(A)) + " to " + fmtV(D + Math.abs(A)) + "</li></ul>";
    }

    setResult(out, '<span class="lbl">y =</span> ' + esc(str(ast)));
    info.innerHTML = facts;
    drawGraph(cv, { xmin, xmax, series: [{ f: (x) => ev(ast, x), color: COLORS.blue }] });
  } catch (e) {
    setResult(out, e.message, true);
    info.innerHTML = "";
    clearCanvas(cv);
  }
}

/* Find x where f(x) = 0 by looking for sign changes and halving the gap. */
function findRoots(f, lo, hi) {
  const roots = [], n = 2000;
  let x0 = lo, y0 = f(lo);
  for (let i = 1; i <= n; i++) {
    const x1 = lo + ((hi - lo) * i) / n, y1 = f(x1);
    if (y0 === 0) roots.push(x0);
    else if (y0 * y1 < 0) {
      let a = x0, b = x1;
      for (let k = 0; k < 50; k++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; }
      roots.push((a + b) / 2);
    }
    x0 = x1; y0 = y1;
  }
  return roots;
}

/* =========================================================
   7. PAGE WIRING
   ========================================================= */
const RUNNERS = {
  arith: () => arithRun(true),
  entropy: runEntropy,
  diff: runDiff,
  integ: runInteg,
  limit: runLimit,
  graph: runGraph
};

function showTab(id) {
  document.querySelectorAll(".tab").forEach((t) => {
    const on = t.dataset.tab === id;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === id));
  if (id !== "arith") RUNNERS[id]();        // draw the graph now that the panel is visible
}

function activeTab() {
  const t = document.querySelector(".tab.active");
  return t ? t.dataset.tab : "arith";
}

document.addEventListener("DOMContentLoaded", () => {
  buildKeypad();
  renderHistory();
  arithRun(false);

  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  // buttons and selects run their calculator, text boxes run on Enter
  document.querySelectorAll("[data-run]").forEach((el) => {
    const run = RUNNERS[el.dataset.run];
    if (el.tagName === "BUTTON") el.addEventListener("click", run);
    else if (el.tagName === "SELECT") el.addEventListener("change", run);
    else el.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  });

  // example chips fill in the boxes and calculate
  document.querySelectorAll("[data-set]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const values = JSON.parse(chip.dataset.set);
      Object.keys(values).forEach((id) => {
        const el = $(id);
        el.value = values[id];
        if (id === "g-type") showGraphFields();
      });
      RUNNERS[chip.closest(".panel").id]();
    });
  });

  // graph panel: update live while typing
  $("g-type").addEventListener("change", () => {
    showGraphFields();
    const poly = $("g-type").value === "poly";
    $("g-xmin").value = poly ? "-4" : "-2pi";
    $("g-xmax").value = poly ? "4" : "2pi";
    runGraph();
  });
  document.querySelectorAll("#graph input").forEach((el) => el.addEventListener("input", runGraph));

  let timer;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (activeTab() !== "arith") RUNNERS[activeTab()](); }, 150);
  });
});
