# Athar Engineering & Learning Resource Catalog

This catalog records the 25 external GitHub repositories supplied for the Athar project. The user's own Athar and agent-skill repositories are not counted in these 25. This is a curated reference list for later evaluation and selective adoption.

> **Important:** Listing a repository here does not mean its code or skills have been installed, merged, tested, or approved for production. Review each repository's README, license, dependencies, maintenance status, security implications, and compatibility before adopting it. Do not copy code wholesale or add untrusted agent instructions without review.

## A. Engineering workflow and agent skills

1. [obra/superpowers](https://github.com/obra/superpowers) — Agent workflow and development practices.
2. [hueyexe/frontend-agent-skills](https://github.com/hueyexe/frontend-agent-skills) — Frontend agent skill references.
3. [PracticalSwan/agent-skills](https://github.com/PracticalSwan/agent-skills) — General agent skills.
4. [magnus919/agent-skills](https://github.com/magnus919/agent-skills) — General agent skills.
5. [awesome-design-agent-skills](https://github.com/frankxai/awesome-design-agent-skills) — Design-focused agent skill directory.
6. [awesome-agent-skills](https://github.com/salihcantekin/awesome-agent-skills) — Agent skill directory.
7. [vivy-yi/awesome-skills](https://github.com/vivy-yi/awesome-skills) — Skill directory.
8. [khasky/awesome-agent-skills](https://github.com/khasky/awesome-agent-skills) — Agent skill directory.

## B. Quality assurance, testing, security, and code review

9. [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — QA skill references.
10. [upex-galaxy/agentic-qa-boilerplate](https://github.com/upex-galaxy/agentic-qa-boilerplate) — Agentic QA starter/reference.
11. [leosssvip-dot/AI-website-test-automation-skill](https://github.com/leosssvip-dot/AI-website-test-automation-skill) — Website test automation skill reference.
12. [neonwatty/qa-skills](https://github.com/neonwatty/qa-skills) — QA skill references.
13. [carlacazv/agentic-holistic-testing](https://github.com/carlacazv/agentic-holistic-testing) — Holistic agentic testing reference.
14. [dmdhrumilmistry/security-harness](https://github.com/dmdhrumilmistry/security-harness) — Security testing/harness reference.
15. [michaelshimeles/code-review-analyzer](https://github.com/michaelshimeles/code-review-analyzer) — Code review analysis reference.

## C. AI learning and education platform examples

16. [mmumshad/hackathon-2025-teach-me-anything](https://github.com/mmumshad/hackathon-2025-teach-me-anything) — AI-assisted learning project reference.
17. [ghwmelite-dotcom/brilla-study-platform](https://github.com/ghwmelite-dotcom/brilla-study-platform) — Study platform reference.
18. [MananGupta1910/LEARN-AI](https://github.com/MananGupta1910/LEARN-AI) — AI learning project reference.
19. [AlaminM01/ClassConnect-AI](https://github.com/AlaminM01/ClassConnect-AI) — AI education/classroom project reference.
20. [felixyustian/edusenseai](https://github.com/felixyustian/edusenseai) — Education AI project reference.
21. [Pranjal-Chavan/THINK-SMART](https://github.com/Pranjal-Chavan/THINK-SMART) — Learning/thinking project reference.
22. [Mogumoon/daud-sensei](https://github.com/Mogumoon/daud-sensei) — Learning assistant project reference.
23. [subramanib/The-Learners-AI](https://github.com/subramanib/The-Learners-AI) — AI learning project reference.
24. [rahulsags/EduAssist](https://github.com/rahulsags/EduAssist) — Education assistant project reference.

## D. Free model/API resources

25. [cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) — Reference list of free LLM API resources. The GitHub connector could not retrieve its README during this pass, so verify repository availability before relying on it. Availability, limits, terms, privacy, and key requirements can change; verify each provider before use.

## Proposed adoption order for Athar

1. **QA baseline:** review the QA and website automation repositories; select a small, compatible set of checks for navigation, RTL layout, forms, MCQ creation/scoring, and responsive breakpoints.
2. **Security review:** inspect the security harness and code-review analyzer; adapt checks only after understanding permissions, dependencies, and safe execution.
3. **Design/frontend skills:** evaluate frontend and design skills against Athar's existing Arabic RTL design system before changing UI code.
4. **Learning-platform research:** inspect education projects for reusable ideas and architectural patterns; do not assume their licenses permit copying.
5. **AI integration:** compare free model providers for Arabic quality, rate limits, data handling, and uptime. Keep all secret API keys on a server-side environment; never commit them to browser JavaScript or Git.
6. **Controlled implementation:** integrate one capability at a time, run tests, review diffs, and document what is actually active.

## Adoption tracking

| Area | Status |
|---|---|
| Resource links recorded | Complete |
| License and maintenance review for all 25 external repositories | Not yet completed |
| Project-local agent instructions/skills drafted | Complete (repository-local) |
| Skills installed into an external agent environment | Not yet completed |
| Code copied or merged from external projects | Not done |
| Static local-link/RTL/metadata checks added | Complete (execution pending) |
| Browser E2E suite for Athar | Not yet completed |
| Free LLM provider selected and connected | Not yet completed |
