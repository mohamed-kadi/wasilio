# Brand Direction

This document captures the naming and logo direction before replacing the temporary Nexora brand. It is a working decision artifact, not a final legal or trademark clearance.

## Current Decision

Selected working brand: **Wasilio**

Preferred domain: **wasilio.ma**

Rationale:

- The name has a local delivery/connection signal without sounding like a small courier company.
- It is short, professional, and pronounceable for Moroccan Arabic, French, and English contexts.
- The `.ma` domain reinforces the first market and is appropriate for Moroccan merchant acquisition.
- A WHOIS check on June 10, 2026 returned `No Object Found` for `wasilio.ma`, so it appears unregistered at the time of checking. This is not a substitute for registrar checkout or legal review.

Immediate action:

- Register `wasilio.ma` before public rebrand work.
- Consider defensive fallbacks if affordable: `getwasilio.com`, `usewasilio.com`, and `wasilio.co`.
- Keep the product codebase internal names unchanged until the public-facing rebrand is confirmed.

## Naming Criteria

The brand should work for Moroccan COD merchants without sounding small or temporary.

Required qualities:

- Easy to pronounce in Arabic, French, and English.
- Short enough for a navbar, invoice, receipt, and WhatsApp message.
- Professional B2B SaaS tone, not playful consumer delivery branding.
- Related to delivery, order flow, confirmation, cash collection, or operational control.
- Flexible enough to expand beyond COD into broader e-commerce operations.
- Clear visual potential for a simple wordmark and favicon.

Avoid:

- Names that include `COD` directly unless used only in the tagline.
- Names that sound like a courier company instead of merchant software.
- Names that are too close to banks, telecoms, marketplaces, or existing logistics brands.
- Spellings that are hard to dictate over phone or WhatsApp.

## Shortlist Archive

### Wasilio

Derived from `wasl`, meaning connection/reaching/delivery. It feels local enough for Morocco while still working as a software brand.

Strengths:

- Strong Arabic root without being hard for French/English speakers.
- Works for confirmation, delivery coordination, and merchant operations.
- Good domain shape: `wasilio.ma`, `wasilio.co`, `getwasilio.com`, `usewasilio.com`.
- Strong logo potential: connected route line, order card, check mark, or linked nodes.

Risks:

- Needs domain and trademark clearance.
- Similar-sounding names around delivery/connectivity should be checked carefully.

Recommendation: selected working brand.

### Kourio

Inspired by courier operations, but shortened into a more SaaS-style name.

Strengths:

- Easy to say.
- Directly hints at delivery and logistics.
- Strong icon direction around courier route, package movement, or operational flow.

Risks:

- May sound more like a courier service than software for merchants.
- Similar to `courier`, so search differentiation may be weaker.

Recommendation: strong backup if we want a more logistics-forward name.

### Livrino

Built from `livraison`, with a lighter SaaS ending.

Strengths:

- Easy for French-speaking Moroccan merchants.
- Clear relation to delivery.
- Friendly and memorable.

Risks:

- Less serious than Wasilio.
- More delivery-company coded than operations-platform coded.

Recommendation: good if we want an approachable, SMB-friendly brand.

### Rassid

From the idea of monitoring, balance, and operational visibility.

Strengths:

- Stronger fit for dashboards, tracking, reconciliation, and control.
- Professional tone.
- Can expand beyond delivery into analytics and merchant operations.

Risks:

- Finance/accounting association may confuse the product positioning.
- Arabic pronunciation and Latin spelling need care.

Recommendation: good strategic name, but less immediately tied to COD delivery.

### Colivo

Built from `colis` and `livraison`.

Strengths:

- Short and brandable.
- Clear logistics signal.
- Nice visual direction with parcel and flow elements.

Risks:

- May be confused with co-living or delivery/courier companies.
- Less distinctive than Wasilio.

Recommendation: acceptable, not first choice.

## Rejected Directions

- `Nexora`: polished but generic and not tied to the actual market.
- `Confirmly`: clear function, but too generic and narrow.
- `CashFlow`: already overloaded in finance and accounting.
- `Tawsil`: meaningful, but likely too generic for delivery and hard to own.
- `ShipCOD`: too literal and limits future expansion.

## Recommended Brand Position

Use **Wasilio** as the selected working brand.

Positioning line:

> COD operations software for Moroccan merchants.

Sharper product sentence:

> Wasilio helps Moroccan e-commerce teams confirm COD orders, manage callbacks, coordinate delivery, and track failed deliveries from one operational workspace.

## Logo Direction

The logo should be restrained and operational. It must work at small sizes in:

- Navbar.
- Favicon.
- Login screen.
- Admin billing screen.
- Receipt print view.
- Social preview image.
- WhatsApp shared link preview.

Recommended visual system:

- Wordmark: custom or lightly customized geometric sans wordmark.
- Mark: simple `W` built from a route line or connected order checkpoints.
- Shape language: route node, check mark, parcel edge, or order card.
- Color direction: deep green or ink blue paired with a warm amber accent.
- Avoid: trucks, shopping carts, cash bills, loud gradients, mascot-style marks.

Suggested palette:

- Primary: deep green `#0F5B4A` or operational blue `#164E63`.
- Accent: amber `#D99A2B`.
- Neutral: off-white `#F7F8F5`, slate `#1F2933`.

## Rollout Plan

Do not rename Java packages or database identifiers in the first rebrand pass. Keep internal technical names stable unless there is a real operational reason to change them.

Phase 1 public-facing rebrand:

- Landing page copy.
- Navbar and auth page brand text.
- Legal page company/product references.
- SEO metadata and Open Graph tags.
- Favicon and social preview.
- Email subject/body sender text.
- Environment defaults for support email and internal tenant display name.
- README and operations docs where user-facing.

Phase 2 technical cleanup only if needed:

- Java package names.
- Maven group ID.
- Database name defaults.
- Local storage key.
- Test fixture emails and tenant names.

## Open Checks

Before final adoption:

- Check `.ma`, `.com`, and practical fallback domains.
- Search Moroccan company names and obvious regional conflicts.
- Check trademark exposure if the product will be marketed publicly.
- Verify the name is not awkward or misleading in Moroccan Arabic and French.
