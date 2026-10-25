ShrutiCalc - Calculus Calculator
================================

HOW TO RUN
  1. Unzip this folder.
  2. Double-click index.html  (it opens in your web browser).
  No installation, no internet connection and no server needed.

FILES
  index.html  - the page structure (one panel per feature)
  style.css   - the look: light theme, blue-purple accents, rounded cards, responsive layout
  script.js   - all the calculations and graph drawing (plain JavaScript, no libraries)

FEATURES
  Arithmetic       expression box + keypad, order of operations, history
  Binary Entropy   H(p) = -p*log2(p) - (1-p)*log2(1-p), with steps and a graph of H(p)
  Differentiation  1st and 2nd derivative (power, product, quotient, chain rules),
                   value at a point, tangent line on the graph
  Integration      antiderivative F(x) for common functions + definite integral
                   (Simpson's rule), shaded area on the graph
  Limits           two-sided or one-sided, finite or infinity, with a table of values
  Graphs           sin, cos and polynomial graphs with adjustable numbers

HOW TO TYPE FUNCTIONS
  x^2 for x squared      3x or 3*x for 3 times x      (x+1)/(x-1) for a fraction
  sin(x) cos(x) tan(x)   e^x or exp(x)                ln(x) log(x) (base 10)
  sqrt(x) abs(x)         pi and e are known numbers   inf means infinity

HOW IT WORKS (for your report)
  1. A small parser in script.js turns the typed text into a tree.
  2. Differentiation applies the calculus rules to that tree.
  3. Integration uses a table of standard integrals, and Simpson's rule for the number.
  4. Limits evaluate f(x) at points closer and closer to the target and check where the values settle.
  5. Graphs are drawn on an HTML canvas by plotting hundreds of points.
