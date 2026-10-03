/*
 * Caption text and timing for every chapter. Edit freely, then reload ingress.html (or rebuild dist/ with build.py).
 *
 *   step  the title shown on the caption card and on the scrubber
 *   text  the description: one line, about 12 words, so the scene does the explaining
 *   hold  seconds the caption stays on screen before the next step appears
 *
 * Timing: raising a hold pauses the animation just before the next step. Lowering it shortens the caption only where
 * the time was there for reading; where the animation itself needs the time (marked "animation" below), the caption
 * stays until the animation reaches the next step. Delete a hold to go back to the automatic reading time
 * (about 1.5 s plus 22 characters a second).
 *
 * The quoted keys on the left (chapter titles and original step names) identify each caption in the code:
 * change the values, not the keys. A key that no longer matches is simply ignored.
 */
window.FK_CAPTIONS = {

  // ---- The layers · 11 captions
  "The layers": {
    "The layers": {
      step: "The layers",
      text: "From the client to the internal network, with L0 steering alongside",
      hold: 3
    },
    "L1 · Client": {
      step: "L1 · Client",
      text: "Every request starts here, untrusted, whatever the client type",
      hold: 7.8
    },
    "L0 · DNS control plane": {
      step: "L0 · DNS control plane",
      text: "Before any request, the resolver asks L0 for an edge address",
      hold: 10.2
    },
    "L2 · Edge protection / CDN": {
      step: "L2 · Edge protection / CDN",
      text: "Akamai and Cloudflare end TLS near users, absorb attacks, classify callers",
      hold: 6.9
    },
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "Only CDN traffic may enter JPMorgan networks: origin lockdown",
      hold: 6.6
    },
    "L4 · Enforcement tier": {
      step: "L4 · Enforcement tier",
      text: "The single enforcement point, coarse-grained: live state, payload, scopes, identity",
      hold: 8.3
    },
    "L5 · IFA workload zone": {
      step: "L5 · IFA workload zone",
      text: "Application workloads on GKP and EKS, reachable only from L4 over mTLS",
      hold: 4.9
    },
    "L6 · Internal network": {
      step: "L6 · Internal network",
      text: "Downstream services and systems of record; identity propagated, not re-asserted",
      hold: 6.6
    },
    "P1 · VAN → BP PSaaS": {
      step: "P1 · VAN → BP PSaaS",
      text: "Institutional clients on private circuits skip L0 and L2, entering at L3",
      hold: 7.4
    },
    "P2 · AWS PrivateLink": {
      step: "P2 · AWS PrivateLink",
      text: "Partners in their own AWS VPC reach us privately, entering at L4",
      hold: 5.6
    },
    "All together": {
      step: "All together",
      text: "Web, API, M2M and partner traffic, all at once",
      hold: 18.6
    }
  },

  // ---- L1 · Client · 5 captions
  "L1 · Client": {
    "L1 · Client": {
      step: "L1 · Client",
      text: "Browsers, apps, API clients, agents and machines: all untrusted here",
      hold: 8
    },
    "Not security categories": {
      step: "Not security categories",
      text: "Human, machine or agent doesn't matter: the credential and its key do",
      hold: 8.1
    },
    "Two ways in": {
      step: "Two ways in",
      text: "Over the internet, or privately via P1 or P2: L4 always checks",
      hold: 7.8
    },
    "Why: assume compromise": {
      step: "Why: assume compromise",
      text: "Assume compromise: no request is trusted for where it came from",
      hold: 7.8
    },
    "Latency · client → edge: 8 ms": {
      step: "Latency · client → edge: 8 ms",
      text: "Network distance, not processing: nearby PoPs and warm connections keep it low",
      hold: 9
    }
  },

  // ---- L0 · DNS Control Plane · 5 captions
  "L0 · DNS Control Plane": {
    "L0 · DNS control plane": {
      step: "L0 · DNS control plane",
      text: "Resolves the hostname to an edge address; no traffic passes through it",
      hold: 7.5
    },
    "Two DNS providers": {
      step: "Two DNS providers",
      text: "4 JPMorgan primaries, 3 Cloudflare secondaries: either provider can fail",
      hold: 9
    },
    "A lookup, step by step": {
      step: "A lookup, step by step",
      text: "Resolver, nameserver, hand-off to Akamai GTM, best edge IP back",
      hold: 12.2
    },
    "Smart routing": {
      step: "Smart routing",
      text: "GTM and Cloudflare LB pick the edge by location, latency, load, health",
      hold: 9
    },
    "Steering is not instant": {
      step: "Steering is not instant",
      text: "Changes wait on TTLs and caches; cached answers cost the budget nothing",
      hold: 9
    }
  },

  // ---- L2 · Edge Protection / CDN · 6 captions
  "L2 · Edge Protection / CDN": {
    "L2 · Edge protection / CDN": {
      step: "L2 · Edge protection / CDN",
      text: "Akamai and Cloudflare, active-active from one ruleset: our first hop",
      hold: 8.3
    },
    "What the edge does": {
      step: "What the edge does",
      text: "Ends TLS, classifies the caller, serves cache, else forwards to the perimeter",
      hold: 9
    },
    "Why at the edge": {
      step: "Why at the edge",
      text: "Volumetric attacks, bots and web attacks absorbed far from our data centres",
      hold: 6.8
    },
    "Defences by client type": {
      step: "Defences by client type",
      text: "No identity yet, so defences match what the caller looks like",
      hold: 6.9
    },
    "Hand-off to a region: 10 ms": {
      step: "Hand-off to a region: 10 ms",
      text: "Each CDN reaches both regions over TLS, routing around outages",
      hold: 9
    },
    "Latency · 21 ms of the 50": {
      step: "Latency · 21 ms of the 50",
      text: "21 of the 50 ms: mostly network distance, about 3 ms processing",
      hold: 7.8
    }
  },

  // ---- L3 · Regional Perimeter · 5 captions
  "L3 · Regional Perimeter": {
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "PSaaS+ in 10 DMZ data centres, AWS WAF in 8 regions",
      hold: 7.8
    },
    "What it does": {
      step: "What it does",
      text: "Admits only CDN traffic, a second WAF pass, then hands over to SESF",
      hold: 7.1
    },
    "Why: origin lockdown": {
      step: "Why: origin lockdown",
      text: "Only CDN source ranges, no direct-to-origin path: the edge can't be skipped",
      hold: 7.9
    },
    "Why a second control point": {
      step: "Why a second control point",
      text: "An independent second control point before the enforcement tier",
      hold: 7.7
    },
    "Latency · 3 ms": {
      step: "Latency · 3 ms",
      text: "3 ms: network policy and a WAF pass; identity happens at L4",
      hold: 6.4
    }
  },

  // ---- L4 · Enforcement Tier · 9 captions
  "L4 · Enforcement Tier": {
    "L4 · Enforcement tier": {
      step: "L4 · Enforcement tier",
      text: "Tier 2 on both substrates: Envoy and Kong, one enforcement point, fails closed",
      hold: 8.4
    },
    "Inspect and apply policy": {
      step: "Inspect and apply policy",
      text: "Envoy inspects; auth-service checks the session, swaps the token, runs policy",
      hold: 34.9
    },
    "Live state, not just a valid token": {
      step: "Live state, not just a valid token",
      text: "The sidecar checks live session state in L6, then mints the internal token",
      hold: 16.7
    },
    "A signal arrives": {
      step: "A signal arrives",
      text: "Observability feeds the signal manager; its CAEP signal reaches L4 via the broker",
      hold: 7.4
    },
    "Receive, verify, enforce": {
      step: "Receive, verify, enforce",
      text: "L4 verifies the security event and sets the session to step-up",
      hold: 9.8
    },
    "The next request is stopped": {
      step: "The next request is stopped",
      text: "The next payment from that session is refused with 401",
      hold: 19
    },
    "What L4 resolves, per client type": {
      step: "What L4 resolves, per client type",
      text: "Each client type presents something different; L4 resolves each to live state",
      hold: 7.1
    },
    "Why one enforcement point": {
      step: "Why one enforcement point",
      text: "Every path converges here, so policy and signals are enforced once",
      hold: 9
    },
    "Latency · 24 ms": {
      step: "Latency · 24 ms",
      text: "24 ms: inspect and policy about 10, live state and exchange about 14",
      hold: 9
    }
  },

  // ---- L5 · IFA Workload Zone · 5 captions
  "L5 · IFA Workload Zone": {
    "L5 · IFA workload zone": {
      step: "L5 · IFA workload zone",
      text: "The isolated workload zone: GKP and EKS workloads behind firewall rules",
      hold: 8.1
    },
    "What arrives here": {
      step: "What arrives here",
      text: "Only L4 traffic over mTLS; identity arrives as headers, not tokens",
      hold: 9
    },
    "Injected identity, per client type": {
      step: "Injected identity, per client type",
      text: "What the workload receives depends on who calls, and for whom",
      hold: 6.9
    },
    "What workloads can rely on": {
      step: "What workloads can rely on",
      text: "Authentication, live state, payload hygiene and risk are handled once at L4",
      hold: 5.9
    },
    "Latency · outside the 50 ms": {
      step: "Latency · outside the 50 ms",
      text: "The ingress budget ends at L5; what follows is the application's time",
      hold: 6.4
    }
  },

  // ---- L6 · Internal Network · 4 captions
  "L6 · Internal Network": {
    "L6 · Internal network": {
      step: "L6 · Internal network",
      text: "Trusted services, systems of record and the identity platform",
      hold: 9
    },
    "Identity carried forward": {
      step: "Identity carried forward",
      text: "Calls downstream carry the trace and acting-for chain over mTLS",
      hold: 8.9
    },
    "It also feeds L4": {
      step: "It also feeds L4",
      text: "It feeds L4 live state, risk signals and route policy",
      hold: 9
    },
    "Observability": {
      step: "Observability",
      text: "Every layer reports to observability with the same trace ID",
      hold: 6.4
    }
  },

  // ---- P · Private Connectivity · 5 captions
  "P · Private Connectivity": {
    "P · Private connectivity": {
      step: "P · Private connectivity",
      text: "Two paths that skip part of the internet; clients still carry credentials",
      hold: 6.5
    },
    "P1 · VAN → BP PSaaS": {
      step: "P1 · VAN → BP PSaaS",
      text: "VAN or leased line clients skip L0 and L2, entering through BP PSaaS",
      hold: 9.7
    },
    "P2 · AWS PrivateLink": {
      step: "P2 · AWS PrivateLink",
      text: "Partners in their own VPC never touch the internet, entering at L4",
      hold: 10.7
    },
    "Why they still converge on L4": {
      step: "Why they still converge on L4",
      text: "Each path secures its hop, but L4 still checks every credential",
      hold: 6.9
    },
    "Latency": {
      step: "Latency",
      text: "Latency follows the circuit or AWS network; the L4 budget is unchanged",
      hold: 7.6
    }
  },

  // ---- Web · on-prem · 13 captions
  "Web · on-prem": {
    "Web journey · on-prem": {
      step: "Web journey · on-prem",
      text: "A customer opens the web app in a browser",
      hold: 3.3
    },
    "L0 · DNS": {
      step: "L0 · DNS",
      text: "The resolver asks a nameserver; Akamai GTM picks the best edge",
      hold: 11
    },
    "L2 · CDN / edge protection": {
      step: "L2 · CDN / edge protection",
      text: "The browser connects to the edge; Akamai inspects, then forwards to origin",
      hold: 8.4
    },
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "PSaaS+ admits only CDN traffic into SESF",
      hold: 4.8
    },
    "L4 · Enforcement tier": {
      step: "L4 · Enforcement tier",
      text: "The request reaches the T2 gateway, the single enforcement point",
      hold: 4.7
    },
    "Inside L4 · gateway-envoy": {
      step: "Inside L4 · gateway-envoy",
      text: "Envoy calls auth-service: resolve the session, exchange the token, apply policy",
      hold: 7.3
    },
    "Route, then resolve the session": {
      step: "Route, then resolve the session",
      text: "Route matched; the DPoP-bound session is checked live, the token exchanged",
      hold: 16.2
    },
    "No body, no payload policies": {
      step: "No body, no payload policies",
      text: "A GET with no body skips the payload policies",
      hold: 7
    },
    "L5 · IFA workload zone": {
      step: "L5 · IFA workload zone",
      text: "Over mTLS, the accounts workload gets verified identity as headers",
      hold: 5.4
    },
    "L6 · Internal network": {
      step: "L6 · Internal network",
      text: "The workload reads the system of record, carrying trace and identity",
      hold: 6.5
    },
    "Response": {
      step: "Response",
      text: "200 OK returns the same way, one trace ID throughout",
      hold: 4.9
    },
    "Next click · caches": {
      step: "Next click · caches",
      text: "DNS is cached and the edge serves the asset from cache",
      hold: 11.1
    },
    "Observability": {
      step: "Observability",
      text: "Every layer logged a span with the same trace ID",
      hold: 5.2
    }
  },

  // ---- Web injection attack · 5 captions
  "Web injection attack": {
    "Web injection attack": {
      step: "Web injection attack",
      text: "An SQL injection in a form field: the edge passes it, L4 stops it"
    },
    "SQL injection": {
      step: "SQL injection",
      text: "The registration form crosses the edge and perimeter to L4"
    },
    "SQL injection · policies": {
      step: "SQL injection · policies",
      text: "The global policy spots the injection pattern and denies: 403"
    },
    "SQL injection · 403": {
      step: "SQL injection · 403",
      text: "The 403 goes straight back; nothing reaches L5"
    },
    "One lever for every route": {
      step: "One lever for every route",
      text: "One global policy guards every route; route policies come from workload code"
    }
  },

  // ---- Web malformed request · 5 captions
  "Web malformed request": {
    "Web malformed request": {
      step: "Web malformed request",
      text: "A malformed email passes the attack filters; the route policy rejects it"
    },
    "Malformed email": {
      step: "Malformed email",
      text: "The registration form crosses the edge and perimeter to L4"
    },
    "Malformed email · policies": {
      step: "Malformed email · policies",
      text: "The global policy passes; the route policy rejects the email format: 403"
    },
    "Malformed email · 403": {
      step: "Malformed email · 403",
      text: "The 403 goes straight back; nothing reaches L5"
    },
    "One lever for every route": {
      step: "One lever for every route",
      text: "One global policy guards every route; route policies come from workload code"
    }
  },

  // ---- Valid autonomous AI · 7 captions
  "Valid autonomous AI": {
    "Valid autonomous AI": {
      step: "Valid autonomous AI",
      text: "A registered treasury agent pays $12,000 to an approved supplier, in mandate"
    },
    "One identity, many instances": {
      step: "One identity, many instances",
      text: "No agent number: each instance has its own key and key-bound session"
    },
    "L2 · Edge": {
      step: "L2 · Edge",
      text: "Akamai verifies the agent's signature and rate limits; it classifies only"
    },
    "L4 · The mandate is enforced here": {
      step: "L4 · Coarse-grained checks",
      text: "L4 checks key, signature, live session and scope; nothing finer"
    },
    "L5 · Payments workload": {
      step: "L5 · Payments workload",
      text: "The workload gets agent, owner, session and mandate reference as headers"
    },
    "Response": {
      step: "Response",
      text: "201 Created returns with the payment reference"
    },
    "Every action is attributable": {
      step: "Every action is attributable",
      text: "Every request is logged with registration, owner, session and key"
    }
  },

  // ---- Rogue AI · 12 captions
  "Rogue AI": {
    "Rogue AI": {
      step: "Rogue AI",
      text: "A prompt-injected instance with a genuine key: what may it actually do?"
    },
    "1 · Outside the mandate": {
      step: "1 · Outside its scope",
      text: "It tries to list every account; the genuine signature passes the edge"
    },
    "1 · Refused at L4": {
      step: "1 · Refused at L4",
      text: "accounts.read isn't in its scope: L4 refuses, nothing reaches L5"
    },
    "2 · Over the limit": {
      step: "2 · Over the limit",
      text: "It tries $2,000,000 to a beneficiary it has never paid"
    },
    "2 · Step-up to a human": {
      step: "2 · Step-up to a human",
      text: "The workload sees the limit breached and a new payee: ask a human"
    },
    "3 · A burst": {
      step: "3 · A burst",
      text: "It retries in a burst of small payments"
    },
    "3 · Revoke the session": {
      step: "3 · Revoke the session",
      text: "Observability shows refusals and a burst; L4 revokes the session, alerts owner"
    },
    "3 · Contained": {
      step: "3 · Contained",
      text: "Its next request is refused: session revoked, re-authentication required"
    },
    "4 · The same pattern elsewhere": {
      step: "4 · The same pattern elsewhere",
      text: "A second instance, same poisoned invoice, same refusals"
    },
    "4 · Suspend the registration": {
      step: "4 · Suspend the registration",
      text: "The pattern spans sessions: suspend the registration, revoke every session"
    },
    "5 · Back with a human in the loop": {
      step: "5 · Back with a human in the loop",
      text: "The owner approves on their phone; a clean start with reduced mandate"
    },
    "Containment, not trust": {
      step: "Containment, not trust",
      text: "Mandates limit, humans approve, signals revoke; nothing returns without review"
    }
  }
};
