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

  // ---- Layers · The seven layers · 11 captions · 80.1 s
  "The seven layers": {
    "Seven layers": {
      step: "Seven layers",
      text: "Every request crosses up to seven layers between the internet and a trusted workload",
      hold: 5.3
    },
    "L0 · Client": {
      step: "L0 · Client",
      text: "Browsers, mobile apps, API clients, machine-to-machine callers and AI agents: untrusted callers on the public internet",
      hold: 6.8
    },
    "L1 · DNS control plane": {
      step: "L1 · DNS control plane",
      text: "Tells each client which edge to connect to, from beside the request path rather than in it",
      hold: 10.2   // animation
    },
    "L2 · Edge protection / CDN": {
      step: "L2 · Edge protection / CDN",
      text: "Akamai and Cloudflare terminate TLS close to the user and absorb attacks before they reach us",
      hold: 5.7
    },
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "PSaaS+ and AWS WAF admit only CDN traffic into JPMorgan networks",
      hold: 4.4
    },
    "L4 · SESF / Tier 2 proxy": {
      step: "L4 · SESF / Tier 2 proxy",
      text: "The internal DMZ, where the request is authenticated, inspected for malicious content and validated against its API schema",
      hold: 7
    },
    "L5 · ESF / Tier 3 session & signals": {
      step: "L5 · ESF / Tier 3 session & signals",
      text: "Brokers every call into the trusted network, holding the live session and acting on real-time risk signals",
      hold: 6.3
    },
    "L6 · Workloads": {
      step: "L6 · Workloads",
      text: "Trusted application services that only accept requests from Tier 3",
      hold: 4.5
    },
    "P · VAN → BP PSaaS": {
      step: "P · VAN → BP PSaaS",
      text: "Business partners connect over private circuits straight to BP PSaaS, never touching the internet path",
      hold: 6.1
    },
    "P · AWS PrivateLink": {
      step: "P · AWS PrivateLink",
      text: "Partner services in their own AWS VPC reach ours privately, without leaving AWS",
      hold: 5.1
    },
    "All together": {
      step: "All together",
      text: "Web on-prem, API into AWS, M2M on-prem and business partners over private connectivity, all at once",
      hold: 18.6   // animation
    }
  },

  // ---- Layers · L0 · Client · 4 captions · 31.8 s
  "L0 · Client": {
    "L0 · Client": {
      step: "L0 · Client",
      text: "Everything that calls us from outside: browsers, mobile apps, API clients, machine-to-machine callers and AI agents. None of it is trusted",
      hold: 7.7
    },
    "How each client proves who it is": {
      step: "How each client proves who it is",
      text: "Different clients carry different credentials, and each is verified again further in",
      hold: 6.5   // animation
    },
    "Why: assume compromise": {
      step: "Why: assume compromise",
      text: "Devices get malware, cookies get stolen and bots imitate people. So no layer trusts a request just because it arrived; each one verifies again",
      hold: 7.9
    },
    "Latency · client → edge: 8 ms": {
      step: "Latency · client → edge: 8 ms",
      text: "Network distance, not our processing: DNS steering or anycast picks a nearby PoP, and warm connections (TLS resumption, HTTP/2 or HTTP/3 reuse) avoid extra round trips. Mobile networks take longer",
      hold: 9
    }
  },

  // ---- Layers · L1 · DNS Control Plane · 5 captions · 43.3 s
  "L1 · DNS Control Plane": {
    "L1 · DNS control plane": {
      step: "L1 · DNS control plane",
      text: "Beside the clients, not in the request path: it decides which edge each client connects to",
      hold: 5.6
    },
    "Two DNS providers": {
      step: "Two DNS providers",
      text: "jpmorgan.com is served by 4 JPMorgan primary nameservers and 3 Cloudflare secondaries (zone transfer). Resolvers ask any of them, so either provider can fail without an outage",
      hold: 9
    },
    "A lookup, step by step": {
      step: "A lookup, step by step",
      text: "The resolver asks a nameserver, follows the hand-off to Akamai GTM, and gets the best edge IP back",
      hold: 12.2   // animation
    },
    "Smart routing": {
      step: "Smart routing",
      text: "Akamai GTM and Cloudflare LB pick the edge from the client’s location (resolver or EDNS client subnet), latency, load and health, and can steer between CDNs",
      hold: 8.5
    },
    "Latency: outside the 50 ms budget": {
      step: "Latency: outside the 50 ms budget",
      text: "Answers are cached for their TTL, so DNS adds nothing to most requests. The same TTL bounds how quickly a failover takes effect",
      hold: 7.4
    }
  },

  // ---- Layers · L2 · Edge Protection / CDN · 5 captions · 36.6 s
  "L2 · Edge Protection / CDN": {
    "L2 · Edge protection / CDN": {
      step: "L2 · Edge protection / CDN",
      text: "Akamai (4,100+ PoPs) and Cloudflare (310+ cities): the first hop we control, as close to the client as possible",
      hold: 6.5
    },
    "What the edge does": {
      step: "What the edge does",
      text: "TLS ends at the PoP; the edge checks the request, serves from cache when it can, and otherwise forwards to origin",
      hold: 6.6
    },
    "Why at the edge": {
      step: "Why at the edge",
      text: "Volumetric DDoS, bots and common web attacks are absorbed across thousands of PoPs, far away from our data centres",
      hold: 6.6
    },
    "Hand-off to a region: 10 ms": {
      step: "Hand-off to a region: 10 ms",
      text: "The edge re-encrypts and forwards over pooled, persistent connections. Each CDN can reach both regional perimeters, so a regional outage is routed around",
      hold: 8.4
    },
    "Latency · 21 ms of the 50": {
      step: "Latency · 21 ms of the 50",
      text: "Client → edge 8 ms and edge → region 10 ms are network distance, which depends on where the user is; the edge’s own processing is about 3 ms",
      hold: 7.8
    }
  },

  // ---- Layers · L3 · Regional Perimeter · 5 captions · 34.5 s
  "L3 · Regional Perimeter": {
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "The entry into JPMorgan networks: PSaaS+ in 9 on-prem data centres and AWS WAF in 8 AWS regions",
      hold: 5.8
    },
    "What it does": {
      step: "What it does",
      text: "It admits only CDN origin traffic, scrubs and filters it regionally, and re-originates TLS into the internal DMZ",
      hold: 6.5
    },
    "Why: nobody bypasses the edge": {
      step: "Why: nobody bypasses the edge",
      text: "Traffic that does not come from the CDNs is dropped here, so the edge protections cannot be skipped",
      hold: 7.7   // animation
    },
    "Why a second control point": {
      step: "Why a second control point",
      text: "An independent regional layer: its own WAF and DDoS scrubbing, and a clean trust boundary before anything reaches the internal DMZ",
      hold: 7.4
    },
    "Latency · 3 ms": {
      step: "Latency · 3 ms",
      text: "Network policy and re-origination only; payload inspection happens further in, at Tier 2",
      hold: 6.4   // animation
    }
  },

  // ---- Layers · L4 · SESF / Tier 2 Proxy · 4 captions · 58.7 s
  "L4 · SESF / Tier 2 Proxy": {
    "L4 · SESF / Tier 2 proxy": {
      step: "L4 · SESF / Tier 2 proxy",
      text: "SESF, the Secure Enterprise Server Farm: the internal DMZ. The T2 gateway proxy is gateway-envoy on GVSI hosts, in 9 data centres",
      hold: 7.3
    },
    "What it does": {
      step: "What it does",
      text: "Envoy routes the request and calls auth-service, which checks the session JWT and runs the global and route payload policies",
      hold: 33.3   // animation
    },
    "Why Tier 2": {
      step: "Why Tier 2",
      text: "It is the first place the decrypted request is inside our network, so untrusted payloads are inspected and rejected here, before anything crosses into ESF",
      hold: 8.4
    },
    "Latency · 10 ms": {
      step: "Latency · 10 ms",
      text: "Envoy, the ext_authz round trip, JWT verification, two Rego evaluations and mTLS to Tier 3. Large bodies take longer: Envoy buffers the whole body (up to 1 MB) before inspecting it",
      hold: 9
    }
  },

  // ---- Layers · L5 · ESF / Tier 3 Session & Signals · 7 captions · 80.9 s
  "L5 · ESF / Tier 3 Session & Signals": {
    "L5 · ESF / Tier 3 · Session & Signals": {
      step: "L5 · ESF / Tier 3 · Session & Signals",
      text: "ESF, the Enterprise Server Farm. Its gateways broker every call into the trusted network, and it holds the live session and acts on real-time signals",
      hold: 8.2
    },
    "A normal request": {
      step: "A normal request",
      text: "The T3 gateway asks the session manager about the live session, mints an internal token and forwards to the workload",
      hold: 18.9   // animation
    },
    "A signal arrives": {
      step: "A signal arrives",
      text: "Fraud detection spots impossible travel and a new payee, and sends a CAEP risk-level-change event for this session",
      hold: 6.6
    },
    "Receive, verify, enforce": {
      step: "Receive, verify, enforce",
      text: "The CAEP receiver verifies the Security Event Token and matches it to the live session; the policy decides the action: step-up to AAL3",
      hold: 9.8   // animation
    },
    "The next request is stopped": {
      step: "The next request is stopped",
      text: "The same session tries a payment. The enforcement state now requires step-up, so it is refused at Tier 3 with a 401",
      hold: 19   // animation
    },
    "Why at Tier 3": {
      step: "Why at Tier 3",
      text: "It is the last hop before trusted workloads, so it holds the live session and can act on signals from anywhere in the bank within seconds, not at the next login",
      hold: 8.7
    },
    "Latency · 14 ms": {
      step: "Latency · 14 ms",
      text: "The largest processing slice: session lookup, enforcement state and token exchange, then mTLS to the workload. Signals arrive asynchronously, so they add nothing per request while enforcement state is local",
      hold: 9
    }
  },

  // ---- Layers · L6 · Workloads · 4 captions · 25.2 s
  "L6 · Workloads": {
    "L6 · Workloads": {
      step: "L6 · Workloads",
      text: "Trusted application services, on-prem and in the cloud. They accept requests only from Tier 3, over mTLS",
      hold: 6.2
    },
    "What arrives here": {
      step: "What arrives here",
      text: "Every request has already been authenticated, inspected and checked against the live session",
      hold: 5.6
    },
    "What services can rely on": {
      step: "What services can rely on",
      text: "Authentication, payload hygiene and session risk are handled once, consistently, by the layers in front",
      hold: 6.3
    },
    "Latency · outside the 50 ms": {
      step: "Latency · outside the 50 ms",
      text: "The ingress budget ends at Tier 3; what happens here is the application’s own time",
      hold: 6.4   // animation
    }
  },

  // ---- Layers · P · Private Connectivity · 5 captions · 40 s
  "P · Private Connectivity": {
    "P · Private connectivity": {
      step: "P · Private connectivity",
      text: "Business partners who never use the internet path: VAN, private circuits and leased lines on-prem, and AWS PrivateLink in the cloud",
      hold: 7.4
    },
    "VAN → BP PSaaS": {
      step: "VAN → BP PSaaS",
      text: "A partner network connects over a private circuit straight to BP PSaaS, a dedicated entry point, and then into Tier 2 like everything else",
      hold: 9.4   // animation
    },
    "AWS PrivateLink": {
      step: "AWS PrivateLink",
      text: "A partner service in its own AWS VPC reaches our endpoint service privately; traffic never leaves AWS",
      hold: 8.5   // animation
    },
    "Why a separate path": {
      step: "Why a separate path",
      text: "No public exposure, partner-specific entry points and allow-lists, yet the same Tier 2 and Tier 3 controls still apply once inside",
      hold: 7.4
    },
    "Latency": {
      step: "Latency",
      text: "Set by the circuit or the AWS network rather than the internet; the internal hops share the Tier 2 and Tier 3 budgets",
      hold: 6.8
    }
  },

  // ---- Journeys · Web · on-prem · 13 captions · 90.7 s
  "Web · on-prem": {
    "Web journey · on-prem": {
      step: "Web journey · on-prem",
      text: "A customer opens the web app in a browser",
      hold: 3.3
    },
    "L1 · Steering (DNS)": {
      step: "L1 · Steering (DNS)",
      text: "Outside the request: the resolver asks one of the seven nameservers. A JPMorgan primary returns a CNAME to Akamai GTM, and GTM picks the best edge",
      hold: 11   // animation
    },
    "L2 · CDN / edge protection": {
      step: "L2 · CDN / edge protection",
      text: "The browser connects straight to the edge IP it was given. Akamai terminates TLS, absorbs attacks, applies WAF and bot management, then forwards to origin",
      hold: 8.4
    },
    "L3 · Regional perimeter": {
      step: "L3 · Regional perimeter",
      text: "Only CDN origin traffic may enter the on-prem network; PSaaS+ admits it into the internal DMZ",
      hold: 5.7
    },
    "L4 · SESF / Tier 2": {
      step: "L4 · SESF / Tier 2",
      text: "The request reaches the T2 gateway proxy in the internal DMZ",
      hold: 4.2
    },
    "Inside T2 · gateway-envoy": {
      step: "Inside T2 · gateway-envoy",
      text: "The T2 node expands: Envoy on a GVSI host calls auth-service (ext_authz) for the session check and the payload policies",
      hold: 6.9
    },
    "Route, then check the session": {
      step: "Route, then check the session",
      text: "Envoy matches the route and calls auth-service, which verifies the session JWT: issued by the session manager, for ingress-gateway, signed, DPoP-bound",
      hold: 13.9   // animation
    },
    "No body, no payload policies": {
      step: "No body, no payload policies",
      text: "This GET has no body, so the global and route payload policies are skipped; chapter 3 shows them at work",
      hold: 6.2
    },
    "L5 · ESF / Tier 3": {
      step: "L5 · ESF / Tier 3",
      text: "The T3 IFA web gateway brokers the call across the firewall into the trusted network",
      hold: 5.3
    },
    "L6 · Trusted workloads": {
      step: "L6 · Trusted workloads",
      text: "The application service in the trusted zone answers the request",
      hold: 4.3
    },
    "Response": {
      step: "Response",
      text: "200 OK returns along the same path, with one trace ID across every layer",
      hold: 4.9
    },
    "Next click · caches": {
      step: "Next click · caches",
      text: "The DNS answer is still cached, so L1 is not contacted, and the edge serves the static asset from its cache",
      hold: 11.1   // animation
    },
    "Observability": {
      step: "Observability",
      text: "Every layer emitted a span, log and metric tagged with the same trace ID",
      hold: 5.2
    }
  },

  // ---- Journeys · Payload policies · T2 · 11 captions · 124.1 s
  "Payload policies · T2": {
    "Payload policies · T2": {
      step: "Payload policies · T2",
      text: "Three requests to POST /api/v1/users/register show the two Rego policies that protect every route",
      hold: 5.9
    },
    "1 · Valid payload": {
      step: "1 · Valid payload",
      text: "The browser submits the registration form; the request crosses the edge and perimeter to T2",
      hold: 5.6
    },
    "1 · Valid payload · policies": {
      step: "1 · Valid payload · policies",
      text: "Session JWT checked; the global policy finds no injection patterns; the route policy confirms required fields and formats: allowed, 201 Created",
      hold: 29.2   // animation
    },
    "1 · Valid payload · 201": {
      step: "1 · Valid payload · 201",
      text: "Allowed: the request continues over mTLS through Tier 3 to the backend, and 201 Created returns to the client",
      hold: 8.8   // animation
    },
    "2 · SQL injection": {
      step: "2 · SQL injection",
      text: "The browser submits the registration form; the request crosses the edge and perimeter to T2",
      hold: 5.6
    },
    "2 · SQL injection · policies": {
      step: "2 · SQL injection · policies",
      text: "The global policy (a blocklist, default allow) matches an injection pattern in full_name and denies: 403. The route policy never runs",
      hold: 17.8   // animation
    },
    "2 · SQL injection · 403": {
      step: "2 · SQL injection · 403",
      text: "The 403 goes straight back to the client; nothing reaches Tier 3 or the backend",
      hold: 5.4
    },
    "3 · Malformed email": {
      step: "3 · Malformed email",
      text: "The browser submits the registration form; the request crosses the edge and perimeter to T2",
      hold: 5.6
    },
    "3 · Malformed email · policies": {
      step: "3 · Malformed email · policies",
      text: "The global policy passes; the route policy (default deny) rejects the email format: 403",
      hold: 27.9   // animation
    },
    "3 · Malformed email · 403": {
      step: "3 · Malformed email · 403",
      text: "The 403 goes straight back to the client; nothing reaches Tier 3 or the backend",
      hold: 5.4
    },
    "One lever for every route": {
      step: "One lever for every route",
      text: "The global policy patches every route at once against new attack patterns; each route policy only knows its own fields",
      hold: 6.8
    }
  },

  // ---- Journeys · API · AWS · 8 captions · 45.9 s
  "API · AWS": {
    "API journey · AWS": {
      step: "API journey · AWS",
      text: "An API client calls the accounts API",
      hold: 3.1
    },
    "L1 · Steering (DNS)": {
      step: "L1 · Steering (DNS)",
      text: "This resolver happened to ask a Cloudflare secondary. The zone came from the JPMorgan primary, but this hostname is overridden to Cloudflare LB, which answers with an anycast IP",
      hold: 9
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
    "L4 · no Tier 2 hop in AWS": {
      step: "L4 · no Tier 2 hop in AWS",
      text: "In AWS the WAF hands off directly to the EKS gateways in the cross-firewall zone",
      hold: 5.1
    },
    "L5 · Cloud API gateway": {
      step: "L5 · Cloud API gateway",
      text: "Kong on EKS validates the token, the scope and the payload against the OpenAPI contract",
      hold: 5.4
    },
    "L6 · Trusted workloads": {
      step: "L6 · Trusted workloads",
      text: "The cloud accounts service answers",
      hold: 3
    },
    "Response": {
      step: "Response",
      text: "200 OK and a JSON body return to the client",
      hold: 9   // animation
    }
  },

  // ---- Journeys · Private connectivity · 14 captions · 86.2 s
  "Private connectivity": {
    "Private connectivity": {
      step: "Private connectivity",
      text: "Business partners on VAN, private circuits or leased lines use their own route, outside the internet path",
      hold: 6.2
    },
    "A distinct route": {
      step: "A distinct route",
      text: "No DNS steering, no CDN, no internet perimeter (L1 to L3): each partner lands on a dedicated entry point",
      hold: 6.2
    },
    "P · Private circuit to on-prem": {
      step: "P · Private circuit to on-prem",
      text: "Partner Acme sends a payment over its VAN / leased line",
      hold: 4.6   // animation
    },
    "P · BP PSaaS entry point": {
      step: "P · BP PSaaS entry point",
      text: "The dedicated business partner entry point admits the circuit into the on-prem network",
      hold: 5.4
    },
    "L4 · SESF / Tier 2": {
      step: "L4 · SESF / Tier 2",
      text: "From here it joins the internal path: the T2 gateway proxy inspects and re-encrypts with mTLS",
      hold: 5.7
    },
    "L5 · T3 IFA API gateway": {
      step: "L5 · T3 IFA API gateway",
      text: "Kong on GKP authenticates the partner and enforces its plan and the API contract",
      hold: 5.1
    },
    "L6 · Trusted workloads": {
      step: "L6 · Trusted workloads",
      text: "The on-prem payments service accepts the instruction",
      hold: 3.8
    },
    "Response": {
      step: "Response",
      text: "201 Created returns over the same private circuit",
      hold: 4.3
    },
    "P · Partner VPC": {
      step: "P · Partner VPC",
      text: "A trusted 3rd party runs its service in its own AWS account and VPC, alongside ours on the AWS network",
      hold: 6.1
    },
    "P · Interface endpoint": {
      step: "P · Interface endpoint",
      text: "It calls a private IP inside its own VPC: an interface endpoint for our service",
      hold: 5.1
    },
    "P · VPC to VPC": {
      step: "P · VPC to VPC",
      text: "PrivateLink carries it from the partner VPC straight into our VPC: no internet gateway, NAT or public IP, and no L1 to L3",
      hold: 6.9
    },
    "P · Our endpoint service": {
      step: "P · Our endpoint service",
      text: "Only allow-listed partner accounts can connect, only to this one service, and only in that direction",
      hold: 6
    },
    "L5 · Cloud API gateway": {
      step: "L5 · Cloud API gateway",
      text: "Kong on EKS authenticates the partner with mTLS and OAuth client credentials",
      hold: 12.1   // animation
    },
    "Two worlds, one platform": {
      step: "Two worlds, one platform",
      text: "Internet traffic climbs through L1 to L3. Partners enter at BP PSaaS over private circuits, or over PrivateLink from inside AWS, and join the internal path",
      hold: 8.5
    }
  },

  // ---- Journeys · Failover · 11 captions · 59.8 s
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
      hold: 3
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
    "L5 · Cloud web gateway": {
      step: "L5 · Cloud web gateway",
      text: "Envoy on EKS routes to the web service with outlier detection and retries",
      hold: 6.9   // animation
    },
    "L6 · Upstream error": {
      step: "L6 · Upstream error",
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

  // ---- Journeys · Defense in depth · 5 captions · 46.9 s
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
    "L2 · Bot and agent policy": {
      step: "L2 · Bot and agent policy",
      text: "An AI agent scrapes pages it is not allowed to; bot management blocks it at the edge",
      hold: 7.1   // animation
    },
    "L3 · Direct to origin": {
      step: "L3 · Direct to origin",
      text: "An attacker skips the CDN and targets the regional perimeter directly",
      hold: 7.5   // animation
    },
    "L5 · Contract violation": {
      step: "L5 · Contract violation",
      text: "A syntactically clean request passes the edge and WAF, but breaks the API contract",
      hold: 21.7   // animation
    }
  }
};
