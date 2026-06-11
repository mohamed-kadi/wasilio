# Pilot Acquisition Workflow

This workflow explains how a public demo request becomes a real pilot merchant.

## Acquisition Paths

Wasilio supports two acquisition paths, but they should not be presented equally during early pilots.

### Preferred Path: Guided Pilot

This is the main campaign path.

```text
Landing page demo request
-> Super-admin Leads tab
-> Manual call or WhatsApp follow-up
-> Lead marked CONTACTED
-> Lead qualified
-> Convert to trial tenant
-> Merchant receives guided onboarding
-> Lead marked ONBOARDED
```

Campaign promise:

- guided workspace setup
- early pilot terms
- help reviewing the merchant's COD workflow
- less risk than starting alone

This is why the landing page emphasizes requesting a pilot demo instead of pushing direct self-service signup.

Campaign talking points:

- "We do not just give you software. We help configure your first COD workflow."
- "Qualified pilot merchants can receive preferential launch terms during onboarding."
- "Your request is reviewed by a real operator before we create your workspace."
- "The pilot is built for Moroccan COD operations: WhatsApp follow-up, cash collection, delivery visibility, and merchant control."

Avoid promising free lifetime access. Use "pilot terms", "launch offer", or "guided setup" so the offer stays flexible while Wasilio learns from the first merchants.

### Secondary Path: Approved Signup

Direct signup exists for merchants who are already approved or invited.

```text
Approved merchant opens /signup
-> creates tenant and first admin account
-> logs in at /login
-> starts merchant workflow
```

In production, keep public signup controlled with `APP_ONBOARDING_ENABLED`. For a closed pilot, leave public signup disabled and use lead conversion from the super-admin workspace.

## Lead Status Meaning

Lead status is operational tracking. It does not send messages automatically.

- `NEW`: form submitted, not reviewed yet.
- `CONTACTED`: Wasilio has called or messaged the merchant.
- `QUALIFIED`: merchant is a good pilot candidate.
- `REJECTED`: not a fit, duplicate, fake, outside target, or not ready.
- `ONBOARDED`: a tenant workspace was created from the lead.

## Super-Admin Conversion

From `/admin/billing` -> Leads, a super-admin can convert a lead into a tenant.

The conversion creates:

- a tenant in `TRIALING` status
- the first merchant `ADMIN` user
- a conversion link on the lead with converted tenant ID and timestamp
- an internal note explaining the conversion

The initial password must be shared manually through the agreed channel. For early pilots, this should usually happen during or immediately after a guided onboarding call.

## Recommended First Pilot Script

1. Review the lead details: store, city, phone, order volume, and message.
2. Contact the merchant by phone or WhatsApp.
3. Add notes and mark the lead `CONTACTED`.
4. Qualify the merchant:
   - sells COD in Morocco
   - has repeated order volume
   - currently uses WhatsApp, spreadsheets, or manual follow-up
   - agrees to test Wasilio seriously
5. If qualified, open the conversion panel.
6. Create the trial tenant and first admin user.
7. Share login instructions and initial password.
8. Walk the merchant through creating or importing the first orders.
9. Mark next follow-up for feedback after their first operational use.
