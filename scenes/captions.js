/*
 * Caption text and timing for every chapter. Edit freely, then reload ingress.html (or rebuild dist/ with build.py).
 *
 *   step  the title shown on the caption card and on the scrubber
 *   text  the description
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

  // ---- Layers · The layers · 11 captions · 86.2 s
  "The layers": {
    "The layers": {
      step: "The layers",
      text: "From the client to the internal network, with L0 steering from the side",
      hold: 3.0
    },
    "L1 · Client": {
      step: "L1 · Client",
      text: "Browsers, mobile apps, API clients, delegated and autonomous agents and M2M callers. Every request starts here, untrusted regardless of type",
      hold: 7.8
    },
    "L0 · DNS control plane": {
      step: "L0 · DNS control plane",
      text: "Before a client sends anything, its resolver asks L0 for an edge address. L0 answers from beside the request path, never in it",
      hold: 10.2   // animation
    },
    "L2 · Edge protection / CDN": {
      step: "L2 · Edge protection / CDN",
      text: "Akamai and Cloudflare terminate TLS close to the user, absorb attacks and classify callers, without establishing identity",
      hold: 6.9
    },
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "PSaaS+ and AWS WAF admit only CDN traffic into JPMorgan networks, which is what makes origin lockdown enforceable",
      hold: 6.6
    },
    "L4 · Enforcement tier": {
      step: "L4 · Enforcement tier",
      text: "The single enforcement point: resolves every credential to live state, inspects the payload, enforces scopes and mandates, and injects verified identity",
      hold: 8.3
    },
    "L5 · IFA workload zone": {
      step: "L5 · IFA workload zone",
      text: "Application workloads on GKP and EKS, reachable only from L4 over mutual TLS",
      hold: 4.9
    },
    "L6 · Internal network": {
      step: "L6 · Internal network",
      text: "Downstream services, systems of record and the identity platform, with identity propagated rather than re-asserted",
      hold: 6.6
    },
    "P1 · VAN → BP PSaaS": {
      step: "P1 · VAN → BP PSaaS",
      text: "Institutional clients on private circuits bypass L0 and L2 and enter at L3. They are still L1 clients and still carry a credential",
      hold: 7.4
    },
    "P2 · AWS PrivateLink": {
      step: "P2 · AWS PrivateLink",
      text: "Partner services in their own AWS VPC reach our endpoint service privately, entering at L4",
      hold: 5.6
    },
    "All together": {
      step: "All together",
      text: "Web on-prem, an API call into AWS, M2M on-prem and partners over P1 and P2, all at once",
      hold: 18.6   // animation
    }
  },

  // ---- Layers · L0 · DNS Control Plane · 5 captions · 47.4 s
  "L0 · DNS Control Plane": {
    "L0 · DNS control plane": {
      step: "L0 · DNS control plane",
      text: "It resolves the hostname to an edge address before any request is made. It sits ahead of the request path: no traffic flows through it",
      hold: 7.5
    },
    "Two DNS providers": {
      step: "Two DNS providers",
      text: "jpmorgan.com is served by 4 JPMorgan primary nameservers and 3 Cloudflare secondaries (zone transfer). Resolvers ask any of them, so either provider can fail without an outage",
      hold: 9.0
    },
    "A lookup, step by step": {
      step: "A lookup, step by step",
      text: "The resolver asks a nameserver, follows the hand-off to Akamai GTM, and gets the best edge IP back",
      hold: 12.2   // animation
    },
    "Smart routing": {
      step: "Smart routing",
      text: "Akamai GTM and Cloudflare Load Balancing pick the edge from the client’s location, latency, load and health, using handout policies, liveness tests, pools and monitors",
      hold: 9.0
    },
    "Steering is not instant": {
      step: "Steering is not instant",
      text: "Changes are bounded by the TTL and resolver caching rather than taking effect immediately. Cached answers also mean DNS adds nothing to most requests, so it sits outside the 50 ms budget",
      hold: 9.0
    }
  },

  // ---- Layers · L1 · Client · 5 captions · 41.3 s
  "L1 · Client": {
    "L1 · Client": {
      step: "L1 · Client",
      text: "Browsers, mobile apps, API clients, delegated agents, autonomous agents and M2M callers. Every request starts here, untrusted regardless of type",
      hold: 8.0
    },
    "Not security categories": {
      step: "Not security categories",
      text: "Human, machine and agent are not security categories: any of them can hold a credential. What counts is the credential, and the key it is bound to",
      hold: 8.1
    },
    "Two ways in": {
      step: "Two ways in",
      text: "Over the internet through L2 and L3, or over private connectivity: P1 enters at L3 and P2 at L4. The path changes; the check at L4 does not",
      hold: 7.8
    },
    "Why: assume compromise": {
      step: "Why: assume compromise",
      text: "Devices get malware, tokens get stolen, bots imitate people and agents overreach. So no layer trusts a request because of where it came from",
      hold: 7.8
    },
    "Latency · client → edge: 8 ms": {
      step: "Latency · client → edge: 8 ms",
      text: "Network distance, not our processing: DNS steering or anycast picks a nearby PoP, and warm connections (TLS resumption, HTTP/2 or HTTP/3 reuse) avoid extra round trips. Mobile networks take longer",
      hold: 9.0
    }
  },

  // ---- Layers · L2 · Edge Protection / CDN · 6 captions · 48.4 s
  "L2 · Edge Protection / CDN": {
    "L2 · Edge protection / CDN": {
      step: "L2 · Edge protection / CDN",
      text: "Akamai (4,100+ PoPs) and Cloudflare (310+ cities), active-active from one source ruleset: the first hop we control, as close to the client as possible",
      hold: 8.3
    },
    "What the edge does": {
      step: "What the edge does",
      text: "TLS ends at the PoP; the edge classifies the caller, serves from cache when it can, and otherwise forwards to the perimeter. It classifies; it does not establish identity",
      hold: 9.0
    },
    "Why at the edge": {
      step: "Why at the edge",
      text: "Volumetric attacks, bots and common web attacks are absorbed across thousands of PoPs, far away from our data centres",
      hold: 6.8
    },
    "Defences by client type": {
      step: "Defences by client type",
      text: "With no identity yet, the edge picks its defences by what the caller looks like",
      hold: 6.9   // animation
    },
    "Hand-off to a region: 10 ms": {
      step: "Hand-off to a region: 10 ms",
      text: "The edge re-originates over TLS to the perimeter, from source addresses the perimeter restricts to. Each CDN can reach both regional perimeters, so a regional outage is routed around",
      hold: 9.0
    },
    "Latency · 21 ms of the 50": {
      step: "Latency · 21 ms of the 50",
      text: "Client → edge 8 ms and edge → region 10 ms are network distance, which depends on where the user is; the edge’s own processing is about 3 ms",
      hold: 7.8
    }
  },

  // ---- Layers · L3 · Regional Perimeter · 5 captions · 37.5 s
  "L3 · Regional Perimeter": {
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "The entry into JPMorgan networks: PSaaS+ in 9 on-prem data centres and AWS WAF in 8 AWS regions. No platform components of our own run here",
      hold: 7.8
    },
    "What it does": {
      step: "What it does",
      text: "It admits only traffic from the CDN, then applies a second WAF pass and perimeter traffic policy before handing over to SESF",
      hold: 7.1
    },
    "Why: origin lockdown": {
      step: "Why: origin lockdown",
      text: "Source addresses are restricted to CDN ranges (Akamai SiteShield on-prem) and direct-to-origin paths are closed, so the edge cannot be skipped",
      hold: 7.9
    },
    "Why a second control point": {
      step: "Why a second control point",
      text: "An independent regional layer with its own WAF pass and traffic policy, and a clean boundary before anything reaches the enforcement tier",
      hold: 7.7
    },
    "Latency · 3 ms": {
      step: "Latency · 3 ms",
      text: "Network policy and a second WAF pass only; identity and payload policy happen at L4",
      hold: 6.4   // animation
    }
  },

  // ---- Layers · L4 · Enforcement Tier · 9 captions · 121.9 s
  "L4 · Enforcement Tier": {
    "L4 · Enforcement tier": {
      step: "L4 · Enforcement tier",
      text: "Tier 2, the DMZ gateway inside SESF, on both substrates: Envoy and Kong data planes on-prem and on EKS. The single enforcement point, and it fails closed",
      hold: 8.4
    },
    "Inspect and apply policy": {
      step: "Inspect and apply policy",
      text: "Envoy breaks and inspects TLS and calls auth-service, which resolves the session, exchanges the token, then runs the global malicious-content policy and the route policy generated from the workload’s code",
      hold: 34.9   // animation
    },
    "Live state, not just a valid token": {
      step: "Live state, not just a valid token",
      text: "The session validator sidecar resolves the session against the session manager in L6, through a revoke cache, then mints the internal token",
      hold: 16.7   // animation
    },
    "A signal arrives": {
      step: "A signal arrives",
      text: "The signal manager in L6 raises a CAEP risk-level-change for this session; the message broker carries it to the L4 signal receiver",
      hold: 7.4
    },
    "Receive, verify, enforce": {
      step: "Receive, verify, enforce",
      text: "The signal receiver verifies the Security Event Token and matches it to the live session; the policy decides the action: step-up to AAL3",
      hold: 9.8   // animation
    },
    "The next request is stopped": {
      step: "The next request is stopped",
      text: "The same session tries a payment. Its enforcement state now requires step-up, so L4 refuses it with a 401 and nothing reaches L5",
      hold: 19.0   // animation
    },
    "What L4 resolves, per client type": {
      step: "What L4 resolves, per client type",
      text: "Every client type presents something different, and L4 resolves each one to live state before anything goes further",
      hold: 7.1   // animation
    },
    "Why one enforcement point": {
      step: "Why one enforcement point",
      text: "Internet and partner paths all converge here, so identity, payload policy and signals are enforced once, consistently. Onward to L5 is mutual TLS, and the workload verifies the client certificate",
      hold: 9.0
    },
    "Latency · 24 ms": {
      step: "Latency · 24 ms",
      text: "The largest slice: break and inspect, ext_authz and two Rego evaluations (about 10 ms), then live state, token exchange and mTLS to L5 (about 14 ms). Signals arrive asynchronously, and enforcement state is cached locally",
      hold: 9.0
    }
  },

  // ---- Layers · L5 · IFA Workload Zone · 5 captions · 37.0 s
  "L5 · IFA Workload Zone": {
    "L5 · IFA workload zone": {
      step: "L5 · IFA workload zone",
      text: "The isolated firewall application zone: application workloads on GKP and EKS with their sidecars, bounded by firewall rules on the internal network",
      hold: 8.1
    },
    "What arrives here": {
      step: "What arrives here",
      text: "Only traffic from L4, over mutual TLS. The workload verifies the peer certificate on every connection and receives verified identity as headers, rather than parsing tokens",
      hold: 9.0
    },
    "Injected identity, per client type": {
      step: "Injected identity, per client type",
      text: "What the workload receives depends on who is calling, and for agents on whose behalf",
      hold: 6.9   // animation
    },
    "What workloads can rely on": {
      step: "What workloads can rely on",
      text: "Authentication, live state, payload hygiene and risk are handled once, consistently, at L4",
      hold: 5.9   // animation
    },
    "Latency · outside the 50 ms": {
      step: "Latency · outside the 50 ms",
      text: "The ingress budget ends on arrival at L5; what happens here is the application’s own time",
      hold: 6.4   // animation
    }
  },

  // ---- Layers · L6 · Internal Network · 4 captions · 34.0 s
  "L6 · Internal Network": {
    "L6 · Internal network": {
      step: "L6 · Internal network",
      text: "Trusted services on the internal network: downstream services and systems of record, the identity platform’s session and signal managers, the message broker and the configuration pipeline",
      hold: 9.0
    },
    "Identity carried forward": {
      step: "Identity carried forward",
      text: "When a workload calls a downstream service, the correlation identifier and the acting-for chain go with it, over mutual TLS. Identity is propagated, not re-asserted",
      hold: 8.9
    },
    "It also feeds L4": {
      step: "It also feeds L4",
      text: "The session manager supplies live state, the signal manager raises risk signals that the broker carries, and the configuration pipeline distributes route policy to the enforcement tier",
      hold: 9.0
    },
    "Observability": {
      step: "Observability",
      text: "Every layer reports to the observability stack, with the same trace ID from L1 to L6",
      hold: 6.4   // animation
    }
  },

  // ---- Layers · P · Private Connectivity · 5 captions · 40.9 s
  "P · Private Connectivity": {
    "P · Private connectivity": {
      step: "P · Private connectivity",
      text: "Two paths that skip part of the internet route. On both, the client is still L1 and still carries a credential",
      hold: 6.5
    },
    "P1 · VAN → BP PSaaS": {
      step: "P1 · VAN → BP PSaaS",
      text: "An institutional client on a VAN, private circuit or leased line bypasses L0 and L2 and enters at L3, through BP PSaaS. The circuit is only the network path",
      hold: 9.7   // animation
    },
    "P2 · AWS PrivateLink": {
      step: "P2 · AWS PrivateLink",
      text: "A partner service in its own AWS VPC never touches the internet: it bypasses L0, L2 and L3 and enters at L4, through our endpoint service and its load balancer",
      hold: 10.7   // animation
    },
    "Why they still converge on L4": {
      step: "Why they still converge on L4",
      text: "Each path secures its own hop, but neither replaces the credential check: both are enforced at L4 like internet traffic",
      hold: 6.9
    },
    "Latency": {
      step: "Latency",
      text: "Set by the circuit, the AWS network or the internal network rather than the internet; the L4 budget is the same as for internet traffic",
      hold: 7.6
    }
  },

  // ---- Journeys · Web · on-prem · 13 captions · 96.2 s
  "Web · on-prem": {
    "Web journey · on-prem": {
      step: "Web journey · on-prem",
      text: "A customer opens the web app in a browser",
      hold: 3.3
    },
    "L0 · DNS": {
      step: "L0 · DNS",
      text: "Before the request: the resolver asks one of the seven nameservers. A JPMorgan primary returns a CNAME to Akamai GTM, and GTM picks the best edge",
      hold: 11.0   // animation
    },
    "L2 · CDN / edge protection": {
      step: "L2 · CDN / edge protection",
      text: "The browser connects straight to the edge IP it was given. Akamai terminates TLS, absorbs attacks, applies WAF and bot management, then forwards to origin",
      hold: 8.4
    },
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "Only CDN traffic may enter the on-prem network; PSaaS+ admits it into SESF",
      hold: 4.8
    },
    "L4 · Enforcement tier": {
      step: "L4 · Enforcement tier",
      text: "The request reaches the T2 gateway in SESF, the single enforcement point",
      hold: 4.7
    },
    "Inside L4 · gateway-envoy": {
      step: "Inside L4 · gateway-envoy",
      text: "The T2 node expands: Envoy calls auth-service (ext_authz) to resolve the session, exchange the token and run the payload policies",
      hold: 7.3
    },
    "Route, then resolve the session": {
      step: "Route, then resolve the session",
      text: "Envoy matches the route; the session validator checks the session (for ingress-gateway, signed, DPoP-bound) against live state, and the token is exchanged for an internal one",
      hold: 16.2   // animation
    },
    "No body, no payload policies": {
      step: "No body, no payload policies",
      text: "This GET has no body, so the global and route payload policies are skipped; the Payload policies journey shows them at work",
      hold: 7.0
    },
    "L5 · IFA workload zone": {
      step: "L5 · IFA workload zone",
      text: "Over mutual TLS, the accounts workload on GKP receives the verified identity as headers",
      hold: 5.4
    },
    "L6 · Internal network": {
      step: "L6 · Internal network",
      text: "The workload reads the system of record downstream, with the trace ID and the acting-for chain carried forward",
      hold: 6.5
    },
    "Response": {
      step: "Response",
      text: "200 OK returns along the same path, with one trace ID across every layer",
      hold: 4.9
    },
    "Next click · caches": {
      step: "Next click · caches",
      text: "The DNS answer is still cached, so L0 is not contacted, and the edge serves the static asset from its cache",
      hold: 11.1   // animation
    },
    "Observability": {
      step: "Observability",
      text: "Every layer emitted a span, log and metric tagged with the same trace ID",
      hold: 5.2   // animation
    }
  },

  // ---- Journeys · Client types · L4 · 8 captions · 75.8 s
  "Client types · L4": {
    "Client types": {
      step: "Client types",
      text: "Six client types, one enforcement point: what each presents at L4, what L4 resolves it to, and what reaches the workload",
      hold: 6.9
    },
    "Browser": {
      step: "Browser",
      text: "At L2: javaScript challenge, fingerprinting, CAPTCHA. At L4 it presents: signed session artefact, opaque reference",
      hold: 10.1   // animation
    },
    "Mobile app": {
      step: "Mobile app",
      text: "At L2: app attestation, certificate pinning. At L4 it presents: access token, key-bound",
      hold: 10.1   // animation
    },
    "API client": {
      step: "API client",
      text: "At L2: schema validation, per-client rate limits, API discovery. At L4 it presents: delegated access token, DPoP or certificate bound",
      hold: 10.1   // animation
    },
    "Delegated agent": {
      step: "Delegated agent",
      text: "At L2: agent classification, schema validation, rate limits. At L4 it presents: exchanged agent-scoped token, sub = user, act = agent",
      hold: 10.1   // animation
    },
    "Autonomous agent": {
      step: "Autonomous agent",
      text: "At L2: agent classification, signed-request check, strict rate and transaction limits. At L4 it presents: agent credential plus signed request",
      hold: 10.1   // animation
    },
    "M2M": {
      step: "M2M",
      text: "At L2: rate limits, IP allow-lists. At L4 it presents: client credentials or signed assertion",
      hold: 10.1   // animation
    },
    "One table, one place": {
      step: "One table, one place",
      text: "Human, machine and agent are not security categories: the credential and its key decide what L4 resolves, and L4 is the only place that decides it",
      hold: 8.1
    }
  },

  // ---- Journeys · Payload policies · L4 · 11 captions · 132.8 s
  "Payload policies · L4": {
    "Payload policies · L4": {
      step: "Payload policies · L4",
      text: "Three requests to POST /api/v1/users/register show the two Rego policies that protect every route",
      hold: 5.9
    },
    "1 · Valid payload": {
      step: "1 · Valid payload",
      text: "The browser submits the registration form; the request crosses the edge and perimeter to L4",
      hold: 5.6
    },
    "1 · Valid payload · policies": {
      step: "1 · Valid payload · policies",
      text: "Session resolved and token exchanged; the global policy finds no injection patterns; the route policy confirms required fields and formats: allowed, 201 Created",
      hold: 31.4   // animation
    },
    "1 · Valid payload · 201": {
      step: "1 · Valid payload · 201",
      text: "Allowed: the request continues over mTLS to the workload in L5, and 201 Created returns to the client",
      hold: 8.8   // animation
    },
    "2 · SQL injection": {
      step: "2 · SQL injection",
      text: "The browser submits the registration form; the request crosses the edge and perimeter to L4",
      hold: 5.6
    },
    "2 · SQL injection · policies": {
      step: "2 · SQL injection · policies",
      text: "The global policy (a blocklist, default allow) matches an injection pattern in full_name and denies: 403. The route policy never runs",
      hold: 20.1   // animation
    },
    "2 · SQL injection · 403": {
      step: "2 · SQL injection · 403",
      text: "The 403 goes straight back to the client; nothing reaches L5",
      hold: 5.4   // animation
    },
    "3 · Malformed email": {
      step: "3 · Malformed email",
      text: "The browser submits the registration form; the request crosses the edge and perimeter to L4",
      hold: 5.6
    },
    "3 · Malformed email · policies": {
      step: "3 · Malformed email · policies",
      text: "The global policy passes; the route policy (default deny) rejects the email format: 403",
      hold: 30.1   // animation
    },
    "3 · Malformed email · 403": {
      step: "3 · Malformed email · 403",
      text: "The 403 goes straight back to the client; nothing reaches L5",
      hold: 5.4   // animation
    },
    "One lever for every route": {
      step: "One lever for every route",
      text: "The global policy patches every route at once against new attack patterns; each route policy is generated from its workload’s code and knows only its own fields",
      hold: 8.7
    }
  },

  // ---- Journeys · API · AWS · 7 captions · 45.4 s
  "API · AWS": {
    "API journey · AWS": {
      step: "API journey · AWS",
      text: "An API client calls the accounts API",
      hold: 3.1
    },
    "L0 · DNS": {
      step: "L0 · DNS",
      text: "This resolver happened to ask a Cloudflare secondary. The zone came from the JPMorgan primary, but this hostname is overridden to Cloudflare LB, which answers with an anycast IP",
      hold: 9.0
    },
    "L2 · CDN / edge protection": {
      step: "L2 · CDN / edge protection",
      text: "Cloudflare terminates TLS, checks the API request and the client, then forwards to origin",
      hold: 6.2   // animation
    },
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "AWS WAF admits only CDN traffic into AWS",
      hold: 4.8   // animation
    },
    "L4 · Enforcement tier · AWS": {
      step: "L4 · Enforcement tier · AWS",
      text: "The T2 gateway on EKS terminates mTLS, resolves the key-bound token to the user’s grant, exchanges it, and runs the global and route policies",
      hold: 7.8
    },
    "L5 · IFA workload zone": {
      step: "L5 · IFA workload zone",
      text: "The accounts workload on EKS answers, with the user and client identity in headers",
      hold: 5.2
    },
    "Response": {
      step: "Response",
      text: "200 OK and a JSON body return to the client",
      hold: 9.0   // animation
    }
  },

  // ---- Journeys · Private connectivity · 13 captions · 82.2 s
  "Private connectivity": {
    "Private connectivity": {
      step: "Private connectivity",
      text: "Institutional clients and partner services can skip part of the internet route",
      hold: 5.0
    },
    "Distinct routes, one enforcement point": {
      step: "Distinct routes, one enforcement point",
      text: "No DNS steering or CDN: each path lands on its own entry point, and every one converges on L4",
      hold: 5.7
    },
    "P1 · Private circuit": {
      step: "P1 · Private circuit",
      text: "Institutional client Acme sends a payment over its VAN / leased line",
      hold: 4.6
    },
    "P1 · BP PSaaS, entering at L3": {
      step: "P1 · BP PSaaS, entering at L3",
      text: "BP PSaaS terminates the circuit, checks the client allow-list and maps the route. The circuit is only the network path",
      hold: 6.8
    },
    "L4 · Enforcement tier": {
      step: "L4 · Enforcement tier",
      text: "The client is still L1 and still carries a credential: the T2 gateway resolves it and applies the same policies as for internet traffic",
      hold: 7.6
    },
    "L5 · IFA workload zone": {
      step: "L5 · IFA workload zone",
      text: "The payments workload on GKP accepts the instruction",
      hold: 3.8
    },
    "Response": {
      step: "Response",
      text: "201 Created returns over the same private circuit",
      hold: 4.3   // animation
    },
    "P2 · Partner VPC": {
      step: "P2 · Partner VPC",
      text: "A trusted 3rd party runs its service in its own AWS account and VPC, alongside ours on the AWS network",
      hold: 6.1
    },
    "P2 · Interface endpoint": {
      step: "P2 · Interface endpoint",
      text: "It calls a private IP inside its own VPC: an interface endpoint for our service",
      hold: 5.1
    },
    "P2 · VPC to VPC": {
      step: "P2 · VPC to VPC",
      text: "PrivateLink carries it from the partner VPC straight into our VPC: no internet gateway, NAT or public IP, and no L0, L2 or L3",
      hold: 7.1
    },
    "P2 · Endpoint service, entering at L4": {
      step: "P2 · Endpoint service, entering at L4",
      text: "Only allow-listed partner accounts can connect, only to this one service, and only in that direction. Its load balancer fronts the enforcement tier",
      hold: 8.1
    },
    "L4 · Enforcement tier · AWS": {
      step: "L4 · Enforcement tier · AWS",
      text: "A credential is still required: the T2 gateway on EKS terminates mTLS and resolves the partner’s signed assertion to workload identity",
      hold: 11.1   // animation
    },
    "Two private paths, one enforcement point": {
      step: "Two private paths, one enforcement point",
      text: "Internet traffic comes through L2 and L3. P1 enters at L3 and P2 at L4, and all of it meets the same L4 enforcement",
      hold: 6.7
    }
  },

  // ---- Journeys · Failover · 11 captions · 60.4 s
  "Failover": {
    "Failover": {
      step: "Failover",
      text: "A mobile user on a bad day: an edge network is degraded and an on-prem region is down",
      hold: 5.3
    },
    "Incident 1 · L2": {
      step: "Incident 1 · L2",
      text: "The Akamai edge serving this region is degraded",
      hold: 3.6
    },
    "Incident 2 · L3": {
      step: "Incident 2 · L3",
      text: "The on-prem PSaaS+ region is down",
      hold: 3.0
    },
    "L1 · Steering failover": {
      step: "L1 · Steering failover",
      text: "The cached answer expires (20 s TTL). A JPM NS hands off to GTM; GTM sees its edge is degraded and answers with a Cloudflare edge IP. Failover speed is bounded by the TTL",
      hold: 10.1   // animation
    },
    "L2 · Edge": {
      step: "L2 · Edge",
      text: "The app connects to Cloudflare; the user sees no error",
      hold: 3.9
    },
    "L2 · Origin failover": {
      step: "L2 · Origin failover",
      text: "On-prem origin health checks fail, so Cloudflare sends the request to the AWS origin",
      hold: 5.3
    },
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "AWS WAF admits the request into AWS",
      hold: 4.5   // animation
    },
    "L4 · T2 gateway · AWS": {
      step: "L4 · T2 gateway · AWS",
      text: "The same enforcement on EKS: the session resolves to live state, then Envoy routes to the workload with outlier detection and retries",
      hold: 7.5
    },
    "L5 · Upstream error": {
      step: "L5 · Upstream error",
      text: "The first pod returns 503",
      hold: 2.6
    },
    "Retry": {
      step: "Retry",
      text: "The gateway retries the idempotent request on a healthy pod",
      hold: 4.2
    },
    "Response": {
      step: "Response",
      text: "200 OK returns through AWS and Cloudflare; two failovers, zero errors for the user",
      hold: 10.2   // animation
    }
  },

  // ---- Journeys · Defense in depth · 5 captions · 46.3 s
  "Defense in depth": {
    "Defense in depth": {
      step: "Defense in depth",
      text: "Hostile traffic is stopped at the earliest layer that can recognise it",
      hold: 4.7
    },
    "L2 · Flood absorbed": {
      step: "L2 · Flood absorbed",
      text: "A botnet floods the edge; it is absorbed across the CDN networks and never reaches a region",
      hold: 5.6
    },
    "L2 · Agent classification": {
      step: "L2 · Agent classification",
      text: "An unregistered agent scrapes pages it has no delegation or mandate for; agent classification blocks it at the edge",
      hold: 7.1   // animation
    },
    "L3 · Direct to origin": {
      step: "L3 · Direct to origin",
      text: "An attacker skips the CDN and targets the regional perimeter directly",
      hold: 7.5   // animation
    },
    "L4 · Contract violation": {
      step: "L4 · Contract violation",
      text: "A syntactically clean request passes the edge and WAF, but breaks the route policy generated from the API contract",
      hold: 21.1   // animation
    }
  }
};
