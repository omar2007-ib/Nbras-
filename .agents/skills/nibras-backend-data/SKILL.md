---
name: nibras-backend-data
description: Plan and implement secure persistence, authentication, roles, uploads, and database integration for Nibras using the existing Supabase preparation.
---
# Nibras Backend & Data Skill

## Before implementation
- Inspect current SQL, auth configuration, storage policies, and site code before proposing schema changes.
- The repository currently contains Supabase preparation; do not assume a live project is active or connected.
- Explain required dashboard steps and environment variables without asking the user to commit secrets.
- Prefer small, reviewable migrations with rollback notes.

## Data model principles
- Separate profiles, courses, lessons/resources, questions, attempts, study-plan items, and administrative audit events when those features are implemented.
- Use stable IDs, timestamps, validation, and appropriate foreign keys.
- Define role and ownership checks server-side. Hiding a button is not authorization.
- Enable Row Level Security on exposed Supabase tables and write least-privilege policies for every role.
- Students may read only published content and their own records; they must not edit course content or view other students' records.
- Owner/admin actions require verified identity, explicit authorization, and audit logging where appropriate.

## Files and uploads
- Use private storage for restricted course content.
- Validate file size, MIME type, extension, and allowed categories on the server.
- Use short-lived signed URLs for private downloads; never expose service-role credentials.
- Do not trust client-provided filenames or metadata.
- Add clear upload progress, failure recovery, and permission-denied states.

## Authentication
- Use the provider's supported authentication flow; never invent a custom password scheme.
- Protect sessions, apply rate limits to sensitive operations, and avoid leaking whether a private account exists.
- Do not implement biometric collection or store face/fingerprint data in this project.
- Test owner, admin, and student permissions independently.

## Definition of done
- Migrations are reviewed and tested in a non-production environment.
- RLS is enabled and negative permission tests pass.
- Secrets are environment-managed.
- The UI accurately states what is saved, where it is saved, and whether it syncs across devices.
