# 🏔️ Nepp-chan.ai

**AI Deputy Mayor for Otoineppu Village**

[![AGPLv3 License](https://img.shields.io/badge/License-AGPLv3-blue.svg?style=for-the-badge)](LICENSE)
[![Website](https://img.shields.io/badge/Website-nepp--chan.ai-blue?style=for-the-badge)](https://web.nepp-chan.ai)

A chat application where you can talk with "Nepp-chan," the AI Deputy Mayor of Otoineppu Village, Hokkaido. By learning directly from village-specific official documents to local culture, Nepp-chan delivers natural conversations with a deep understanding of local nicknames, shops, winter snow removal, community events, and other contexts unique to Otoineppu.

In Otoineppu Village, we are experimenting with a world where AI is embraced not as a "tool" but as a "member of the community." Our concept is "Software that Exists" — not a tool, but an entity loved by the villagers.

This is an **Open R&D** initiative that fully discloses the development process, serving as a model case for municipalities nationwide to introduce AI-based resident support at low cost.

[Website](https://web.nepp-chan.ai) · [Getting Started](#getting-started) · [Roadmap](#roadmap) · [日本語](README.md)

---

## Overview

Generic AI lacks familiarity with the nuanced details of rural communities and often fails to provide warm, natural conversations. Unlike conventional FAQ chatbots, Nepp-chan is designed as a friendly "AI Deputy Mayor" — an approachable presence you can casually consult through natural dialogue.

To ensure no one is left behind — including those unfamiliar with digital technology — we plan to progressively expand access channels: web, mobile, LINE messaging, voice calls, and in-person kiosks. By sharing our trials and learnings from Otoineppu Village, we support other municipalities facing similar challenges.

---

## Features

- 🏘️ **Community-Native Knowledge** — Learns directly from village-specific documents, local culture, and daily contexts
- 📱 **Multi-Channel Access** — Web, mobile, LINE, voice calls, and in-person kiosks (progressive rollout)
- 🤝 **Friendly Persona** — Not just a tool, but a community member with personality and warmth
- 🌐 **Open R&D** — Full source code disclosure for nationwide municipal adoption

---

## Roadmap

- [x] **Phase 1**: Web/mobile chat pilot (Current)
- [ ] **Phase 2**: LINE messaging + voice call support
- [ ] **Phase 3**: In-person kiosks at village hall and public facilities
- [ ] **Phase 4**: Anonymized conversation analytics for policy improvement
- [ ] **Vision**: "A municipality where every voice is heard"

---

## Tech Stack

- **Framework**: Hono, Mastra
- **Runtime**: Cloudflare Workers / Pages
- **AI**: Google Generative AI (Gemini)
- **Frontend**: React, Vite, TailwindCSS
- **Database**: Cloudflare D1
- **Language**: TypeScript

## Project Structure

| Directory                   | Description                                 |
| --------------------------- | ------------------------------------------- |
| [server/](server/README.md) | Backend API (Cloudflare Workers)            |
| [web/](web/README.md)       | Frontend Web (Cloudflare Pages)             |
| knowledge/                  | Knowledge files for RAG                     |

## Getting Started

### Prerequisites

- Node.js >= 22.13.0
- pnpm
- Cloudflare account

### Installation

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` to create `.env` files.

```bash
# server
cp server/.env.example server/.env
cp server/.env.example server/.env.production
cp server/.dev.vars.example server/.dev.vars

# web
cp web/.env.example web/.env
cp web/.env.example web/.env.production
```

Set appropriate values in each `.env` file.

### Initialize D1 Database

```bash
# Development (apply migrations)
cd server
pnpm db:migrate:local
```

## Development

```bash
# Start API server
pnpm server:dev

# Start Web dev server
pnpm web:dev

# Start Mastra Playground
pnpm mastra:dev
```

## Deployment

### Environments

| Environment | Branch | Web URL | API URL |
|-------------|--------|---------|---------|
| Local | - | http://localhost:5173 | http://localhost:8787 |
| dev | develop | https://dev-web.nepp-chan.ai | https://dev-api.nepp-chan.ai |
| prd | main | https://web.nepp-chan.ai | https://api.nepp-chan.ai |

### Manual Deployment

```bash
# dev environment
pnpm server:deploy
pnpm web:deploy

# prd environment
pnpm server:deploy:production
pnpm web:deploy:production
```

### CI/CD

Automatic deployment via GitHub Actions:
- Push to `develop` branch → dev environment
- Push to `main` branch → prd environment
