# Project Proposal: Traceback

**Project Name:** Traceback  
**Tagline:** *Someone was here before you.*  
**Domain:** Geolocation Systems, Temporal Archiving, Human-Centric Social Technology, Web3/Decentralized Heritage  
**Document Type:** Official Project Proposal & Hackathon Submission  
**Version:** 1.0  

---

## 1. Executive Summary

In today’s hyper-connected world, social media platforms prioritize ephemeral, attention-maximizing feeds, algorithmic outrage, and vanity metrics (likes, shares, followers). Despite trillions of gigabytes of shared content, digital experiences have become entirely disconnected from physical reality and authentic human reflection. Once a moment is posted, it vanishes down a timeline within hours, while the physical location where that moment transpired retains no memory of it.

**Traceback** is a location-anchored, temporal memory network—a digital "reverse time capsule." Instead of broadcasting thoughts to a global, disembodied feed, users permanently seal encrypted thoughts, reflections, and photographs to precise geographic coordinates. 

Crucially, **Traceback enforces two inviolable physical constraints**:
1. **Physical Proximity (50–100m Radius):** A capsule cannot be unlocked, read, or viewed remotely. A seeker must physically stand in the exact spot where the author stood.
2. **Temporal Sealing:** Capsules can remain locked for designated intervals (e.g., 1 year, 5 years, 10 years), bridging generations of humans who walk the same ground.

By replacing the endless feed with real-world footsteps, Traceback transforms public parks, college campuses, historic monuments, and mountain peaks into living, crowd-sourced archives of human experience.

---

## 2. Problem Statement

### The Triad of Digital Alienation

1. **The Ephemeral Feed Paradox:**  
   Modern platforms (Instagram, TikTok, X) are designed for immediate consumption and rapid disposal. Important life milestones, vulnerabilities, and philosophical reflections are treated as disposable media, forgotten after a 24-hour cycle.

2. **Detachment from Physical Space:**  
   Humans possess deep emotional attachments to physical places—a specific bench in a university courtyard, a secluded overlook on a hiking trail, or a quiet neighborhood corner. However, there is no ambient digital layer that connects past visitors of that space with future visitors. The stories of those who walked the ground before us evaporate.

3. **Psychological Fatigue from Vanity Metrics:**  
   Social validation feedback loops (follower counts, like tallies, comment performance) incentivize performative content over genuine, vulnerable human reflection. Users curate for an audience rather than leaving behind authentic truth.

---

## 3. The Proposed Solution: Traceback

**Traceback** re-engineers our relationship with both space and time through an ambient, location-first web architecture:

* **Tethered to the Earth:** Memories are tethered to micro-geographic coordinates ($Latitude, Longitude$) with sub-100m precision.
* **Earned Discovery:** You cannot browse capsules from your sofa. To read what someone wrote at the edge of a cliff, you must make the journey to that cliff yourself.
* **Temporal Transcendence:** A graduating college student in 2023 seals a capsule for the batch of 2026; a parent records a memory in a quiet garden for their child to discover a decade later.
* **Zero-Vanity, Zero-Feed Architecture:** No likes, no view counters, no public follower graphs. Only two individuals, connected across time by the shared soil beneath their feet.

---

## 4. Key Features & Innovations

### 1. Hard Proximity Geofencing (Haversine Verification)
Traceback uses real-time browser Geolocation combined with high-precision Haversine spherical distance formulas to compute seeker distance. If a user is $> 100\text{ m}$ away, the capsule remains sealed in a blurred, encrypted state with distance remaining indicators (e.g., *"A trace is nearby — 78m away. Your feet have to do the walking"*). Once the 100-meter threshold is crossed, the memory unlocks.

### 2. Time-Delayed Cryptographic Sealing
Authors can lock memories for future release windows (1, 5, or 10 years). Even if someone visits the exact coordinates before the release date, the temporal vault prevents early opening, creating genuine time-capsule anticipation.

### 3. "Then $\to$ Now" Place Evolution
Places evolve as time passes. Traceback allows places to aggregate multi-year perspectives (e.g., *2022: Open football field $\to$ 2026: Modern laboratory wing*). Users see physical history through the lens of lived experience.

### 4. "Connect These Stories" (Serendipitous Synchronicity)
When a seeker unlocks a capsule and discovers that a stranger felt the exact same emotion or struggled with the same life choice years earlier, they can click **"Connect These Stories"**. This links both capsules into a shared timeline without requiring personal contact exchange or direct messaging.

### 5. Life Journeys & Mystery Trails
Users can string multiple geolocated memories into sequential physical walking trails (e.g., *Old Library $\to$ Dorm Rooftop $\to$ The Sunset Ridge*), with optional poetic clues guiding future travelers from one stop to the next.

---

## 5. System Architecture & Tech Stack

```
+-------------------------------------------------------------+
|                      Traceback Client                       |
|   Vanilla ES6+ SPA | HTML5 Geolocation | Leaflet Maps Engine |
|    Theme Engine (Light/Dark) | Responsive Mobile Nav Bar    |
+------------------------------+------------------------------+
                               |
                               | HTTPS / WSS / REST
                               v
+-------------------------------------------------------------+
|                     Supabase Cloud BaaS                     |
|  - PostgreSQL with PostGIS Geospatial Queries                |
|  - Row Level Security (RLS) & Granular Access Policies      |
|  - User Identity & Session Management                       |
|  - Encrypted Cloud Storage for Capsule Photos               |
+------------------------------+------------------------------+
                               |
                               | Webhook / API
                               v
+-------------------------------------------------------------+
|                 Razorpay Payment Gateway                    |
|   - Instant Payment Processing (UPI, Cards, NetBanking)     |
|   - Dynamic Prorated Upgrades (Explorer 5GB / Legacy 50GB)   |
+-------------------------------------------------------------+
```

### Technical Specifications
* **Frontend:** Vanilla JavaScript (ES6+ modular architecture), CSS3 custom properties with instant zero-flicker Dark/Light mode, Leaflet.js with CartoDB Voyager tiles.
* **Backend Database:** Supabase (PostgreSQL), utilizing relational models for profiles, places, capsules, and connections.
* **Geospatial Processing:** Haversine formula calculation for client-side live distance tracking and boundary verification.
* **Monetization & Billing:** Razorpay Checkout API with client-side event listeners and persistent account capability updates.
* **Storage & Hosting:** Edge CDN deployment with immutable static assets and dynamic cache-busting.

---

## 6. Target Audience & Practical Use Cases

| Use Case | Description | Target Users |
| :--- | :--- | :--- |
| **University Campuses** | Graduating seniors leave advice, secret traditions, and nostalgic reflections for incoming freshmen at landmark spots. | University students, alumni, campus clubs |
| **Historic & Heritage Sites** | Independent historians and locals record untold folklore and oral histories tied to monuments, street corners, and statues. | Travelers, cultural tourists, local guides |
| **Hiking & Eco-Tourism** | Mountaineers and solitude seekers leave summit logs, trail reflections, and route warnings for future hikers. | Trekkers, backpackers, nature lovers |
| **Personal & Familial Archives** | Families leave digital heirlooms at ancestral homes, wedding spots, or memorial trees for future generations. | Families, memorializers, couples |
| **Corporate & Coworking Hubs** | Founders and team members seal milestones at early-stage garages, incubators, or project launch rooms. | Startups, incubators, alumni networks |

---

## 7. Business & Monetization Model

Traceback rejects ad-based surveillance capitalism. We do not sell user location data or display banner advertisements.

### 1. Consumer Freemium Tier (Direct-to-Consumer)
* **Free / Starter (₹0):** 500 MB cloud storage (ideal for 15–20 text and photo capsules).
* **Explorer Pack (₹499 one-time):** Upgraded to 5 GB permanent storage, higher resolution media uploads, and custom audio voice notes.
* **Legacy Pack (₹999 one-time):** Upgraded to 50 GB lifetime storage, multi-decade time locks (up to 25 years), and unlimited Journey Trails.
* *Seamless Upgrades:* Users upgrading from Explorer to Legacy receive prorated credit (paying only the ₹500 difference).

### 2. B2B & Institutional Licenses
* **Campus Heritage Edition:** White-label licensing for universities and alumni associations to curate official historical campus trails.
* **Smart Tourism & City Walk Alliances:** Partnering with municipal tourism departments to create self-guided, crowd-authenticated physical walking quests.

---

## 8. Safety, Moderation & Privacy

1. **No Real-Time Stalking:** Traceback does **not** broadcast live user locations to others. Only static, historical capsules anchored to locations are queryable.
2. **Private & Anonymous Options:** Capsules can be sealed completely anonymously or attributed to an authenticated pseudonym.
3. **Location Offset & Safety Radii:** Sensitive private locations (e.g., private residences) can be flagged and blocked from public capsule dropping.
4. **Community Content Reporting:** Automated keyword heuristics combined with user-flagging mechanisms to combat abuse, hate speech, or defacement.

---

## 9. Development Roadmap

```
[Phase 1: Web MVP - COMPLETE]
  ✔ Zero-feed map discovery & Leaflet integration
  ✔ Haversine 50-100m proximity enforcement & simulation toggle
  ✔ Time-delayed capsule sealing (1yr, 5yr, 10yr)
  ✔ Razorpay storage upgrade checkout & Supabase backend integration
  ✔ Dark / Light theme parity & custom brand identity

[Phase 2: Mobile Native & Push Geofencing - Q1 2027]
  ➜ PWA / React Native mobile apps with background GPS polling
  ➜ Ambient audio push alerts ("You just walked within 30m of a sealed memory")
  ➜ Audio capsule recording (voice notes sealed in time)

[Phase 3: WebXR / Augmented Reality Anchoring - Q3 2027]
  ➜ AR camera viewfinder showing floating glowing capsule prisms in physical space
  ➜ Spatial orientation and elevation awareness for multi-story buildings

[Phase 4: Decentralized Long-Term Preservation - 2028]
  ➜ Arweave / IPFS permanent blockchain storage for 50+ year legacy capsules
  ➜ Community governance and localized heritage curation
```

---

## 10. Conclusion

In an era dominated by hyperactive algorithmic feeds that demand our immediate attention and quickly forget our past, **Traceback** brings intentionality back to human communication. By anchoring memory to physical soil and honoring the passage of time, Traceback ensures that our lived experiences outlast the ephemeral digital noise—reminding the next traveler that **someone was here before them.**
