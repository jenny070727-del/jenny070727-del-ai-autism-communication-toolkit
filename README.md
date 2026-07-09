# AI Autism Communication Support Toolkit

> A concept prototype exploring how AI may lower the barrier to using established autism communication support methods.

This project is an early-stage concept prototype. It focuses on adapting mature, commonly used communication support approaches—such as visual schedules, social stories, AAC-inspired communication cards, and communication partner coaching—into lightweight AI-assisted tools for parents, teachers, and volunteers.

The goal is not to create a new clinical intervention from scratch. The first stage is to study existing methods, reproduce their core structures safely, and explore where AI can reduce preparation time, simplify communication, and support case documentation.

## Current prototype

The current version is `v0.1`, a clickable static prototype.

Open:

```text
index.html
```

Current modules:

1. Visual Support Generator  
   Generates example visual schedules, step-by-step routines, and communication cards for common scenarios.

2. Communication Partner Coach  
   Rewrites complex adult instructions into clearer, shorter, lower-pressure communication.

3. Communication Event Review Assistant  
   Helps structure a communication difficulty into context, adult language, child response, possible communication breakdowns, and follow-up questions.

## Safety statement

This prototype is not a diagnostic, therapeutic, or clinical tool.

It does not:

- diagnose autism;
- infer a child’s true intention from facial expressions, crying, silence, or behavior;
- replace therapists, educators, clinicians, or caregivers;
- automatically speak on behalf of a child;
- collect personally identifiable child data;
- claim treatment effectiveness.

Any real-world testing involving children should require appropriate institutional permission, caregiver consent, professional supervision, and careful privacy protection.

## Project principle

The project follows a “mature methods first, AI second” approach:

1. Start from established communication support methods.
2. Use AI only to reduce practical barriers, such as preparation time or language complexity.
3. Keep the child’s autonomy and right to refuse, pause, ask for help, or correct misunderstanding.
4. Use observation and professional feedback before making product claims.

## Repository structure

```text
ai-autism-communication-toolkit/
├── index.html
├── README.md
├── ROADMAP.md
├── PROGRESS.md
└── docs/
    ├── project-brief.zh.md
    ├── observation-form.zh.md
    └── research-notes.zh.md
```

## Documents

- [Project brief in Chinese](docs/project-brief.zh.md)
- [Observation form in Chinese](docs/observation-form.zh.md)
- [Research notes in Chinese](docs/research-notes.zh.md)
- [Roadmap](ROADMAP.md)
- [Progress](PROGRESS.md)

## Deployment idea

This repository can be deployed as a static website through GitHub Pages or Cloudflare Pages. Since the prototype is a single static HTML file, no build step is required.

For Cloudflare Pages:

- Framework preset: None
- Build command: leave empty
- Build output directory: `/` or root directory

## Current status

This is a concept prototype for discussion and early feedback. The next step is to connect selected modules to real AI generation while keeping strong safety boundaries.

