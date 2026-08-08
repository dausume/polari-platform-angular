
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

## 15. THE PORT COLLISION + the polari-on-isle plan (2026-08-08)

View: edges now CLICKABLE (detail panel w/ URLs), wider cells,
short inner labels; L2 segment hub node w/ interface-labeled device
edges (ethernet-up or declared-sole-isle only).

🔑 **THE CONVERGENCE COLLISION HAPPENED FOR REAL**: isle-vlan-agent
crash-looped (114×) — (a) container attached only to isle-br-0
while apps live on isle-agent-net (docker DNS failed → nginx
emerg); (b) after fixing that, the agent could not bind 80/443
because **polari's swarm published prf-proxy via INGRESS MESH,
which binds *:80/*:443 on EVERY swarm node** — polari squatting
isle's ports on isle's own machine. RULING APPLIED (matches the
architecture): device ingress belongs to isle-agent; polari's proxy
publishes **mode=host on its own machine only**. ⚠ two gotchas:
worker ingress state goes STALE (manager-side `service update
--force` re-propagates); durable host-mode belongs in the stack
RENDER (stackify/compose) — currently a live service update only.
Agent now healthy, dual-network, https://sample.local → 200.
Comms channel opened: isle-core:~/Isle-Mesh/NOTES-FROM-POL-CORE.md
(committed b4e2a0e).

**Resources surveyed for polari-on-isle-only** (Dustin's ask):
isle-core 837G disk FREE (4%!), 7.6G RAM (~5.4 avail), 6 cores —
disk is a non-issue, RAM is the budget. pol-core 38G free +
~14.6G reclaimable (8.4G images, 6.2G build cache). Bring-down
candidates: polari-engines stack (frees isle-core RAM + its 9500
ingress), exited-container debris + image prune isle-core (~4.3G),
docker prune pol-core. prf-b = rows only, nothing to stop.

**Deployment shape (proposed, = the 2026-07-03 plan §3 realized):**
new instance `prf-isle` ON isle-core, .isle-ONLY: containers on
isle-agent-net; NO host/ingress port publish; reachable exclusively
through the agent (polari.isle / api.polari.isle fragments,
registered via isle's own register flow); certs = isle ssl tooling
v1; lean module set (islemesh + topology core); mariadb optional
(sqlite v1 given RAM). Route via isle's compose→isle-app scaffold =
DOGFOODING the converter before upgrading it (mac-4). prf-a on
pol-core STAYS as the workbench during transition.

**Real-data feed (design):** once prf-isle lives on isle-core, an
AGENT-SIDE PUSHER (systemd timer / host-agent hook) POSTs
registry.json + fragments + device facts to api.polari.isle
/api/islemesh/ingest/* on change — the mesh feeds ITSELF, offline-
complete, replacing pol-core SSH pulls (which remain the workbench
path).

AWAITING Dustin: (1) confirm bring-down list (engines stack +
prunes), (2) confirm prf-isle shape (lean/sqlite vs full stack),
(3) confirm prf-a stays up as workbench.
