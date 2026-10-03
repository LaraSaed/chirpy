# Chirpy

A Twitter-like back-end API built with TypeScript, Express, and PostgreSQL, with no web framework beyond Express. Users can sign up, log in, post short messages ("chirps"), and upgrade to a paid "Chirpy Red" membership through a payment webhook.

## Why this project

It covers the core of a real back-end:

- REST API design with a monolith split by path (`/app`, `/api`, `/admin`)
- PostgreSQL with Drizzle ORM and automatic migrations on startup
- Password hashing with argon2
- JWT access tokens and revocable refresh tokens
- Authorization (users can only edit or delete their own data)
- A webhook endpoint protected by an API key
- Custom error classes with centralized error handling
- Unit tests with Vitest

## Requirements

- Node.js 22.14.0 (`nvm use` picks it up from `.nvmrc`)
- PostgreSQL 15 or later

## Setup

1. Clone the repo and install dependencies:

```bash
   git clone https://github.com/LaraSaed/chirpy.git
   cd chirpy
   nvm use
   npm install
```

2. Create a database called `chirpy` in PostgreSQL.

3. Create a `.env` file in the project root:

4. Start the server. It runs the migrations automatically:

```bash
   npm run dev
```

5. Run the unit tests:

```bash
   npm test
```

## API

Protected endpoints need `Authorization: Bearer <access token>`.

### Users and auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/users` | Create a user. Body: `email`, `password` |
| PUT | `/api/users` | Update your email and password (auth required) |
| POST | `/api/login` | Log in. Returns the user, an access token (1 hour), and a refresh token (60 days) |
| POST | `/api/refresh` | Get a new access token. Send the refresh token as the Bearer token |
| POST | `/api/revoke` | Revoke a refresh token. Returns 204 |

### Chirps

| Method | Path | Description |
|---|---|---|
| POST | `/api/chirps` | Create a chirp (auth required). Body: `body`, max 140 characters |
| GET | `/api/chirps` | List chirps. Optional: `authorId=<uuid>`, `sort=asc` or `sort=desc` (default `asc`) |
| GET | `/api/chirps/:chirpId` | Get one chirp. 404 if not found |
| DELETE | `/api/chirps/:chirpId` | Delete your own chirp (auth required). 403 if it isn't yours |

### Webhooks

| Method | Path | Description |
|---|---|---|
| POST | `/api/polka/webhooks` | Upgrades a user to Chirpy Red on `user.upgraded`. Needs `Authorization: ApiKey <POLKA_KEY>` |

### Other

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Readiness check |
| GET | `/admin/metrics` | Visit count for the site |
| POST | `/admin/reset` | Reset the database. Only works when `PLATFORM=dev` |

## Notes

- Profane words (`kerfuffle`, `sharbert`, `fornax`) in chirps are replaced with `****`.
- Errors return JSON: `{ "error": "message" }`.
