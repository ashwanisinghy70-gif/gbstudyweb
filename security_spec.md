# Security Specification — GB STUDY Firestore Rules

## 1. Data Invariants
1. Public users can read `apps`, `slider_photos`, `site_config/branding`, and `site_config/social_links` in real time, and cannot write or delete any document.
2. Only the verified administrator (`sarvottamyadav777@gmail.com` with `email_verified == true`) can create, update, or delete platforms, carousel slides, branding, or social links.
3. Every document write enforces exact keys (`keys().hasAll` + `keys().hasOnly`), explicit types, bounded `.size()` limits, safe ID format (`^[a-zA-Z0-9_\-]+$`), immutable `created_at`, and server-enforced `request.time`.

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. Unauthenticated create on `/apps/bad1`
2. Authenticated non-admin (`other@gmail.com`) create on `/apps/bad2`
3. Unverified admin email spoof (`email_verified == false`) write on `/site_config/branding`
4. Shadow/ghost field injection (`isAdmin: true`) on `/apps/app1`
5. Oversized string DoW payload (500KB `name`) on `/apps/app2`
6. Invalid path ID (`../etc/passwd` or 200-char ID) on `/apps/{appId}`
7. Client-forged `created_at` timestamp (not equal to `request.time`) on create
8. Mutating `created_at` during `/apps/{appId}` update
9. Unauthenticated delete on `/slider_photos/slide1`
10. Invalid `is_active` type (`"true"` string instead of boolean) on `/apps/app3`
11. Extra shadow key on `/site_config/social_links` (`hacked: true`)
12. Unmatched collection write on `/users/u1` (blocked by global default-deny catch-all)
