# Security Spec

## Data Invariants
- Users have roles: admin, auctioneer, collector. Only admins can create/update users and settings. All operations generally require authentication.
- Sales transactions must belong to an existing buyer and existing source. Added_by should be current auth user.
- DailyCollections are tied to a buyer.
- SourcePayments are tied to a source. 

## The Dirty Dozen Payloads
1. Create user with role `admin` when not admin.
2. Update user to elevate own role to `admin`.
3. Create buyer with negative lifetime debt.
4. Add Transaction missing `weight` field.
5. Create transaction for missing `buyer_id`.
6. Read PII (users collection) by anonymous user.
7. Update `is_completed` on a Source when status is already true (Terminal state locking).
8. Change `amount_paid_to_source` with a string instead of number.
9. Inject 5MB string in transaction `fish_type`.
10. Update transaction `added_by` to someone else.
11. Update timestamp forward or backward from request.time.
12. Blanket list queries bypassing where bounds.

## Test Runner
To execute rules offline.
