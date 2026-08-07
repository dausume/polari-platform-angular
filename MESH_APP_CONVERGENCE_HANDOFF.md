
**§14 addendum — the D3 view (Dustin's actual intent, built):**
tables were the fallback; the intended interface is a TOPOLOGY
GRAPH. Now live at **/isle-mesh** (Angular route, branch dev-mac-1
in polari-platform-angular): D3 force graph — device/proxy/router/
app nodes, and the point of the view: **serves-edges proxy→app
labeled with the ACCESS URL** parsed from the agent's nginx config
(mTLS flagged on the label). Large mock banner at top when the
payload carries the flag; mock elements dashed amber; click a node
= detail panel w/ clickable URLs + upstream + fragment provenance.
Backend: /api/islemesh/graph. NB repo has NO @types/d3 — self-type
sim fields. ⚠ ALL node-stack services now pinned
polari.machine==pol-core by hand (frontend roll hit the same
unconstrained-scheduler failure as backend; econ-core rejoined the
swarm via home wifi) — row-driven placement render stays mac-5.
