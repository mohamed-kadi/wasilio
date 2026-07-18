# Pilot Acquisition Workflow

This workflow explains how a public demo request becomes a real pilot merchant.

## Acquisition Paths

Wasilio supports two acquisition paths, but they should not be presented equally during early pilots.

### Preferred Path: Guided Pilot

This is the main campaign path.

```text
Landing page demo request
-> Wasilio staff Demo Requests section
-> Manual call or WhatsApp follow-up
-> Request marked Contacted
-> Request qualified
-> Convert to pilot merchant workspace
-> Merchant receives guided onboarding
-> Request marked Workspace created
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
-> creates merchant workspace and merchant owner account
-> logs in at /login
-> starts merchant workflow
```

In production, keep public signup controlled with `APP_ONBOARDING_ENABLED`. For a closed pilot, leave public signup disabled and use demo request conversion from the Wasilio staff workspace.

## Demo Request Status Meaning

Demo request status is operational tracking. It does not send messages automatically.

- `New request`: form submitted, not reviewed yet.
- `Contacted`: Wasilio has called or messaged the merchant.
- `Qualified`: merchant is a good pilot candidate.
- `Not a fit`: duplicate, fake, outside target, or not ready.
- `Workspace created`: a merchant workspace was created from the request.

The API and database still use marketing lead status values: `NEW`, `CONTACTED`, `QUALIFIED`, `REJECTED`, and `ONBOARDED`.

## Staff Conversion

From `/admin/billing?section=leads`, Wasilio staff can convert a demo request into a merchant workspace.

The conversion creates:

- a merchant workspace in `TRIALING` status
- the first merchant owner user
- a conversion link on the request with converted tenant ID and timestamp
- an internal note explaining the conversion

The initial password must be shared manually through the agreed channel. For early pilots, this should usually happen during or immediately after a guided onboarding call.

## Recommended First Pilot Script

1. Review the request details: store, city, phone, order volume, and message.
2. Contact the merchant by phone or WhatsApp.
3. Add notes and mark the request `Contacted`.
4. Qualify the merchant:
   - sells COD in Morocco
   - has repeated order volume
   - currently uses WhatsApp, spreadsheets, or manual follow-up
   - agrees to test Wasilio seriously
5. If qualified, open the conversion panel.
6. Create the pilot workspace and merchant owner user.
7. Share login instructions and initial password.
8. Walk the merchant through creating or importing the first orders.
9. Mark next follow-up for feedback after their first operational use.
